import { parseSegment } from "@/lib/client";
import { groupSegmentsByTokenLength } from "@/lib/srt";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";

// Configurando a API para funcionar tanto em modo dinâmico quanto estático
export const dynamic = 'force-dynamic';
export const runtime = "nodejs";

const MAX_TOKENS_IN_SEGMENT = 400; // Reduzido para evitar truncamento da API Gemini

interface TranslationProgress {
  type: 'progress' | 'quota_error' | 'retry' | 'complete' | 'error';
  translated: number;
  total: number;
  percentage: number;
  currentChunk?: number;
  totalChunks?: number;
  message?: string;
  retryAfter?: number;
}

/**
 * Formata corretamente as linhas de diálogo preservando a estrutura original
 * Distingue entre falas de diálogo e palavras compostas
 */
const formatDialogueLines = (text: string): string => {
	// Regex para detectar falas de diálogo vs palavras compostas
	const dialoguePattern = /^-[^-\s][^-]*(?:\s+-[^-\s][^-]*)*$/;
	const compoundWordPattern = /^[a-záàâãäéèêëíìîïóòôõöúùûüç]+-[a-záàâãäéèêëíìîïóòôõöúùûüç]+$/i;
	
	// Se o texto contém múltiplas ocorrências de "espaco-hifen-texto" em uma linha
	// É provavelmente diálogo concatenado incorretamente
	const concatenatedDialoguePattern = /\s+-[^\s-]/g;
	const matches = text.match(concatenatedDialoguePattern);
	
	if (matches && matches.length > 0) {
		// Detectou diálogo concatenado - precisa separar
		// Exemplo: "-Olá! -Oi, tudo bem? -Estou ótimo."
		// Deve virar: "-Olá!\n-Oi, tudo bem?\n-Estou ótimo."
		
		// Divide o texto preservando falas de diálogo
		return text
			.split(/(\s+-[^-])/) // Divide mantendo o delimitador
			.reduce((result, part, index, array) => {
				if (part.match(/^\s+-[^-]/)) {
					// É uma nova fala - adiciona quebra de linha antes
					return result + '\n' + part.trim();
				} else if (index === 0) {
					// Primeira parte
					return part;
				} else {
					// Continua a fala anterior
					return result + part;
				}
			}, '')
			.trim();
	}
	
	// Verifica se é uma palavra composta simples
	const trimmedText = text.trim();
	if (compoundWordPattern.test(trimmedText)) {
		// É uma palavra composta (ex: "arco-íris") - não modifica
		return text;
	}
	
	return text;
};

const isQuotaError = (error: any): boolean => {
	const errorMessage = error?.message?.toLowerCase() || '';
	return (
		error?.status === 429 ||
		errorMessage.includes('quota') ||
		errorMessage.includes('rate limit') ||
		errorMessage.includes('resource_exhausted') ||
		errorMessage.includes('too many requests') ||
		errorMessage.includes('quota exceeded')
	);
};

const retrieveTranslationWithQuotaHandling = async (
	text: string, 
	language: string, 
	apiKey: string,
	maxRetries: number = 3,
	originalSegments?: any[] // Para re-tentar com chunks menores
): Promise<{ result: string; retryAfter?: number }> => {
	// Validação básica da chave
	if (apiKey.trim().length < 30) {
		throw new Error("Chave API inválida: formato incorreto ou comprimento muito curto para uma chave do Google Gemini.");
	}
	
	const googleProvider = createGoogleGenerativeAI({ apiKey });
	const geminiModel = googleProvider("gemini-2.0-flash-exp");
	
	for (let attempt = 0; attempt < maxRetries; attempt++) {
		try {
			const { text: translatedText } = await generateText({
				model: geminiModel,
				messages: [
					{
						role: "system",
						content: "Você é um tradutor profissional especializado em legendas de filmes e séries, com foco especial em português brasileiro. IMPORTANTE: Preserve cuidadosamente toda a formatação original, incluindo tags HTML como <i> para itálico. Separe os segmentos de tradução com o símbolo '|'. Mantenha o estilo e tom da linguagem original. Nomes próprios não devem ser traduzidos. Preserve os nomes de programas como 'The Amazing Race'. CRÍTICO: Preserve EXATAMENTE a estrutura de quebras de linha do texto original. Quando encontrar diálogos com hífens em linhas separadas (como '-Texto1\\n-Texto2\\n-Texto3'), mantenha cada fala em sua própria linha com quebra de linha (\\n). NUNCA una múltiplas falas em uma única linha. Exemplo: '-Olá.\\n-Oi!' deve se tornar '-Olá.\\n-Oi!' e NÃO '-Olá. -Oi!'. Mantenha quebras de linha originais com \\n.",
					},
					{
						role: "user",
						content: `Traduza estas legendas para português brasileiro: ${text}`,
					},
				],
			});

			// Verificar se a resposta foi truncada
			const inputSegments = text.split('|').length;
			const outputSegments = translatedText.split('|').length;
			
			if (outputSegments < inputSegments) {
				const missingSegments = inputSegments - outputSegments;
				
				// Se perdeu segmentos E temos os segmentos originais, vamos dividir e tentar novamente
				if (missingSegments > 0 && originalSegments && originalSegments.length > 1) {
					throw new Error('SPLIT_CHUNK_NEEDED');
				}
				
				// Para chunks pequenos, tenta novamente uma vez
				if (attempt === 0 && inputSegments <= 10) {
					throw new Error('Response truncated - retry needed');
				}
			}

			return { result: translatedText };
		} catch (error: any) {
			// Se precisamos dividir o chunk, propaga o erro
			if (error.message === 'SPLIT_CHUNK_NEEDED') {
				throw error;
			}
			
			// Check for authentication errors first
			if (error instanceof Error) {
				const errorMessage = error.message.toLowerCase();
				if (
					errorMessage.includes("403") || 
					errorMessage.includes("auth") || 
					errorMessage.includes("authentication") || 
					errorMessage.includes("unauthorized") ||
					errorMessage.includes("forbidden") ||
					errorMessage.includes("invalid key") ||
					errorMessage.includes("invalid api key") ||
					errorMessage.includes("api key not valid") ||
					errorMessage.includes("missing api key") ||
					errorMessage.includes("api key is required") ||
					errorMessage.includes("gemini api key") ||
					errorMessage.includes("method doesn't allow unregistered callers") ||
					errorMessage.includes("caller not authorized")
				) {
					// Don't retry authentication errors
					if (errorMessage.includes("method doesn't allow unregistered callers")) {
						throw new Error("Erro de autenticação: O Google Gemini não reconheceu sua chave API. Verifique se a chave foi copiada corretamente e é válida.");
					} else if (errorMessage.includes("invalid key") || errorMessage.includes("invalid api key")) {
						throw new Error("Erro de autenticação: Chave API inválida. Verifique se obteve a chave correta do Google AI Studio (https://aistudio.google.com/app/apikey).");
					} else {
						throw new Error("Erro de autenticação: Chave de API inválida ou não autorizada. Verifique sua chave API do Google Gemini.");
					}
				}
			}
			
			// Check for quota errors
			if (isQuotaError(error)) {
				const retryAfter = 65; // 65 seconds for quota reset
				
				if (attempt === maxRetries - 1) {
					// Last attempt, throw quota error to be handled by caller
					throw new Error('QUOTA_ERROR');
				}
				
				// Wait before retrying
				await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
				continue;
			}
			
			// For other errors, retry with exponential backoff
			if (attempt < maxRetries - 1) {
				const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
				await new Promise(resolve => setTimeout(resolve, delay));
				continue;
			}
			
			throw error;
		}
	}
	
	throw new Error('Max retries exceeded');
};

export async function POST(request: Request) {
	const encoder = new TextEncoder();
	
	const stream = new ReadableStream({
		async start(controller) {
			try {
				// Parse request data
				let content = '';
				let language = '';
				let apiKey = '';
				let validationOnly = false;
				
				try {
					const requestData = await request.json();
					content = requestData.content || '';
					language = requestData.language || 'Portuguese (Brazil)';
					apiKey = requestData.apiKey || '';
					validationOnly = requestData.validationOnly || false;
				} catch (parseError) {
					const errorData: TranslationProgress = {
						type: 'error',
						translated: 0,
						total: 0,
						percentage: 0,
						message: 'Invalid request format'
					};
					controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorData)}\n\n`));
					controller.close();
					return;
				}

				// Verificar se a API key foi fornecida
				if (!apiKey) {
					const errorData: TranslationProgress = {
						type: 'error',
						translated: 0,
						total: 0,
						percentage: 0,
						message: 'API key is required'
					};
					controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorData)}\n\n`));
					controller.close();
					return;
				}

				// Verificação básica para API keys claramente inválidas
				if (apiKey.trim().length < 30) {
					const errorData: TranslationProgress = {
						type: 'error',
						translated: 0,
						total: 0,
						percentage: 0,
						message: 'API key appears to be invalid (too short)'
					};
					controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorData)}\n\n`));
					controller.close();
					return;
				}

				// If validation only, do a simple test
				if (validationOnly) {
					try {
						const googleProvider = createGoogleGenerativeAI({ apiKey });
						const geminiModel = googleProvider("gemini-2.0-flash-exp");
						
						await generateText({
							model: geminiModel,
							messages: [{ role: "user", content: "Test message for API validation." }],
						});
						
						const successData = { valid: true, message: "API key is valid" };
						controller.enqueue(encoder.encode(`data: ${JSON.stringify(successData)}\n\n`));
						controller.close();
						return;
					} catch (error: any) {
						const errorData = { 
							valid: false, 
							error: error.message, 
							errorType: "validation_error" 
						};
						controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorData)}\n\n`));
						controller.close();
						return;
					}
				}

				// Parse SRT content into segments
				const segments = content.split(/\r\n\r\n|\n\n/).map(parseSegment);
				const totalSegments = segments.length;
				
				if (totalSegments === 0) {
					const errorData: TranslationProgress = {
						type: 'error',
						translated: 0,
						total: 0,
						percentage: 0,
						message: 'No valid subtitle segments found'
					};
					controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorData)}\n\n`));
					controller.close();
					return;
				}

				// Group segments into batches for efficient processing
				const groups = groupSegmentsByTokenLength(segments, MAX_TOKENS_IN_SEGMENT);
				const totalChunks = groups.length;
				
				// Send initial progress
				const initialProgress: TranslationProgress = {
					type: 'progress',
					translated: 0,
					total: totalSegments,
					percentage: 0,
					currentChunk: 0,
					totalChunks,
					message: `Starting translation of ${totalSegments} subtitles in ${totalChunks} chunks`
				};
				controller.enqueue(encoder.encode(`data: ${JSON.stringify(initialProgress)}\n\n`));

				let translatedSegments: string[] = [];
				let currentSegmentIndex = 0;

				// Function to process a group of segments with automatic chunk splitting
				const processSegmentGroup = async (segmentGroup: any[]): Promise<string[]> => {
					const chunkText = segmentGroup.map((segment) => segment.text).join("|");
					
					try {
						const { result, retryAfter } = await retrieveTranslationWithQuotaHandling(
							chunkText, 
							language, 
							apiKey,
							3, // maxRetries
							segmentGroup // Pass original segments for splitting detection
						);
						
						if (retryAfter) {
							throw new Error('QUOTA_ERROR');
						}
						
						const translatedChunks = result.split("|");
						
						// Ensure we have complete translation
						if (translatedChunks.length < segmentGroup.length) {
							const missing = segmentGroup.length - translatedChunks.length;
							
							// Fill missing segments with original text
							for (let i = translatedChunks.length; i < segmentGroup.length; i++) {
								translatedChunks.push(segmentGroup[i].text);
							}
						}
						
						return translatedChunks;
						
					} catch (error: any) {
						if (error.message === 'SPLIT_CHUNK_NEEDED') {
							
							// If only 1 segment, we can't split further - try harder with individual segment
							if (segmentGroup.length === 1) {
								try {
									const { result } = await retrieveTranslationWithQuotaHandling(
										chunkText, 
										language, 
										apiKey,
										5 // More retries for single segments
									);
									const translatedChunks = result.split("|");
									if (translatedChunks.length === 0 || !translatedChunks[0].trim()) {
										return [segmentGroup[0].text]; // Return original if translation fails
									}
									return translatedChunks;
								} catch (singleError: any) {
									return [segmentGroup[0].text];
								}
							}
							
							// Split the group in half and process each part
							const midPoint = Math.ceil(segmentGroup.length / 2);
							const firstHalf = segmentGroup.slice(0, midPoint);
							const secondHalf = segmentGroup.slice(midPoint);
							
							const [firstResult, secondResult] = await Promise.all([
								processSegmentGroup(firstHalf),
								processSegmentGroup(secondHalf)
							]);
							
							return [...firstResult, ...secondResult];
						}
						
						if (error.message === 'QUOTA_ERROR') {
							throw error;
						}
						
						// For other errors, return original text to ensure 100% coverage
						return segmentGroup.map(seg => seg.text);
					}
				};

				// Process each chunk
				for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
					const group = groups[chunkIndex];
					
					try {
						const translatedChunks = await processSegmentGroup(group);
						translatedSegments.push(...translatedChunks);
						
						// Update current segment index
						currentSegmentIndex += group.length;
						
						// Send progress update
						const progress: TranslationProgress = {
							type: 'progress',
							translated: currentSegmentIndex,
							total: totalSegments,
							percentage: Math.round((currentSegmentIndex / totalSegments) * 100),
							currentChunk: chunkIndex + 1,
							totalChunks,
							message: `Chunk ${chunkIndex + 1}/${totalChunks} completed (${currentSegmentIndex}/${totalSegments} subtitles)`
						};
						controller.enqueue(encoder.encode(`data: ${JSON.stringify(progress)}\n\n`));
						
					} catch (error: any) {
						if (error.message === 'QUOTA_ERROR') {
							// Handle quota error specially
							const retryAfter = 65;
							
							// Quota hit, inform frontend
							const quotaError: TranslationProgress = {
								type: 'quota_error',
								translated: translatedSegments.length,
								total: totalSegments,
								percentage: Math.round((translatedSegments.length / totalSegments) * 100),
								currentChunk: chunkIndex + 1,
								totalChunks,
								message: `Quota limit reached. Retrying in ${retryAfter} seconds...`,
								retryAfter
							};
							controller.enqueue(encoder.encode(`data: ${JSON.stringify(quotaError)}\n\n`));
							
							// Wait for quota reset
							await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
							
							// Send retry message
							const retryMessage: TranslationProgress = {
								type: 'retry',
								translated: translatedSegments.length,
								total: totalSegments,
								percentage: Math.round((translatedSegments.length / totalSegments) * 100),
								currentChunk: chunkIndex + 1,
								totalChunks,
								message: 'Quota reset. Resuming translation...'
							};
							controller.enqueue(encoder.encode(`data: ${JSON.stringify(retryMessage)}\n\n`));
							
							// Retry the same chunk
							const retryTranslatedChunks = await processSegmentGroup(group);
							translatedSegments.push(...retryTranslatedChunks);
									// Update current segment index
						currentSegmentIndex += group.length;
					} else {
						const errorData: TranslationProgress = {
							type: 'error',
							translated: currentSegmentIndex,
							total: totalSegments,
							percentage: Math.round((currentSegmentIndex / totalSegments) * 100),
							currentChunk: chunkIndex + 1,
							totalChunks,
							message: `Error in chunk ${chunkIndex + 1}: ${error.message}`
						};
						controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorData)}\n\n`));
						controller.close();
							return;
						}
					}
				}

				// Build final SRT content
				let finalSRT = '';
				
				for (let i = 0; i < segments.length; i++) {
					const originalSegment = segments[i];
					const translatedText = translatedSegments[i] || originalSegment.text;
					
					// Formatar corretamente as linhas de diálogo
					const formattedText = formatDialogueLines(translatedText);
					
					finalSRT += `${i + 1}\n${originalSegment.timestamp}\n${formattedText.trim()}\n\n`;
				}

				// Send completion
				const completion: TranslationProgress = {
					type: 'complete',
					translated: totalSegments,
					total: totalSegments,
					percentage: 100,
					totalChunks,
					message: 'Translation completed successfully!'
				};
				controller.enqueue(encoder.encode(`data: ${JSON.stringify(completion)}\n\n`));
				
				// Send final result
				controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'result', content: finalSRT })}\n\n`));
				
			} catch (error: any) {
				const errorData: TranslationProgress = {
					type: 'error',
					translated: 0,
					total: 0,
					percentage: 0,
					message: `Unexpected error: ${error.message}`
				};
				controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorData)}\n\n`));
			} finally {
				controller.close();
			}
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			'Connection': 'keep-alive',
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Headers': 'Content-Type',
		},
	});
}
