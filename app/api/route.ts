import { parseSegment } from "@/lib/client";
import { groupSegmentsByTokenLength } from "@/lib/srt";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";

// Configurando a API para funcionar tanto em modo dinâmico quanto estático
// Configuração baseada no ambiente - isso permite que a API funcione em modo estático e dinâmico
export const dynamic = process.env.NEXT_BUILD_MODE === 'static' ? 'force-static' : 'force-dynamic';
export const runtime = "nodejs";

const MAX_TOKENS_IN_SEGMENT = 700;

const retrieveTranslation = async (text: string, language: string, apiKey: string) => {
	// Validação básica da chave - Google Gemini API keys têm um formato específico e tamanho mínimo
	if (apiKey.trim().length < 30) {
		console.error("Chave API muito curta");
		throw new Error("Chave API inválida: formato incorreto ou comprimento muito curto para uma chave do Google Gemini.");
	}
	
	let retries = 3;
	while (retries > 0) {
		try {
			// A biblioteca @ai-sdk/google é utilizada para se conectar ao serviço do Google Gemini
			// Criando o provider com a API key
			const googleProvider = createGoogleGenerativeAI({ apiKey });
			const geminiModel = googleProvider("gemini-2.0-flash-exp");
			
			const { text: translatedText } = await generateText({
				model: geminiModel,
				messages: [
					{
						role: "system",
						content:
							"Você é um tradutor profissional especializado em legendas de filmes e séries, com foco especial em português brasileiro. IMPORTANTE: Preserve cuidadosamente toda a formatação original, incluindo tags HTML como <i> para itálico. Separe os segmentos de tradução com o símbolo '|'. Mantenha o estilo e tom da linguagem original. Nomes próprios não devem ser traduzidos. Preserve os nomes de programas como 'The Amazing Race'. MUITO IMPORTANTE: Quando o texto original contiver diálogos marcados por hífens (ex: '-Olá. -Oi!'), mantenha cada linha de diálogo separada pela mesma estrutura, preservando os hífens e a formatação em linhas distintas. NUNCA junte múltiplos diálogos em uma única linha.",
					},
					{
						role: "user",
						content: `Traduza estas legendas para português brasileiro: ${text}`,
					},
				],
			});

			return translatedText;
		} catch (error) {
			console.error("Translation error:", error);					// Verificar especificamente erros de autenticação da API
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
							errorMessage.includes("caller not authorized") ||
							errorMessage.includes("api key not valid")
						) {
							// Rejeita imediatamente para erros de autenticação, sem retry
							console.error("API key authentication error detected:", error.message);
							
							// Mensagens de erro mais específicas baseadas no problema detectado
							if (errorMessage.includes("method doesn't allow unregistered callers")) {
								throw new Error("Erro de autenticação: O Google Gemini não reconheceu sua chave API. Verifique se a chave foi copiada corretamente e é válida.");
							} else if (errorMessage.includes("invalid key") || errorMessage.includes("invalid api key")) {
								throw new Error("Erro de autenticação: Chave API inválida. Verifique se obteve a chave correta do Google AI Studio (https://aistudio.google.com/app/apikey).");
							} else if (errorMessage.includes("missing api key") || errorMessage.includes("api key is required")) {
								throw new Error("Erro de autenticação: Chave API não encontrada. Verifique se inseriu a chave API do Google Gemini.");
							} else {
								throw new Error("Erro de autenticação: Chave de API inválida ou não autorizada. Verifique sua chave API do Google Gemini.");
							}
						}
					}
			
			if (retries > 1) {
				console.warn("Retrying translation...");
				await new Promise((resolve) => setTimeout(resolve, 1000));
				retries--;
				continue;
			}
			throw error;
		}
	}
};

export async function POST(request: Request) {
	try {
		// Usar um bloco try/catch específico para o parsing do request
		let content = '';
		let language = '';
		let apiKey = '';
		let validationOnly = false;
		
		try {
			const requestData = await request.json();
			content = requestData.content || '';
			language = requestData.language || '';
			apiKey = requestData.apiKey || '';
			validationOnly = requestData.validationOnly || false;
		} catch (parseError) {
			console.error("Erro ao processar JSON da requisição:", parseError);
			// Tentar extrair parâmetros da URL caso o parsing do corpo falhe
			const requestUrl = new URL(request.url);
			content = requestUrl.searchParams.get('content') || '';
			language = requestUrl.searchParams.get('language') || '';
			apiKey = requestUrl.searchParams.get('apiKey') || '';
			validationOnly = requestUrl.searchParams.get('validationOnly') === 'true';
		}
		
		// Verificar se a API key foi fornecida
		if (!apiKey) {
			return new Response(JSON.stringify({ 
				error: "API Key não fornecida. Por favor, adicione uma chave de API do Google Gemini.",
				details: "Uma chave API válida é necessária para usar o serviço de tradução."
			}), {
				status: 400,
				headers: { "Content-Type": "application/json" }
			});
		}
		
		// Verificação básica para API keys claramente inválidas
		if (apiKey.trim().length < 30) {
			return new Response(JSON.stringify({ 
				error: "A chave API fornecida parece inválida (muito curta). Por favor, insira uma chave API válida do Google Gemini.",
				details: "As chaves API do Google Gemini são significativamente mais longas."
			}), {
				status: 400,
				headers: { "Content-Type": "application/json" }
			});
		}
		
		// Se for apenas para validação, verificamos a chave API sem tradução completa
		if (validationOnly) {
			try {
				// Cria uma instância do Google Generative AI apenas para validar a chave
				const googleProvider = createGoogleGenerativeAI({ apiKey });
				const geminiModel = googleProvider("gemini-2.0-flash-exp");
				
				// Faz uma solicitação simples para validar a chave
				const { text: validationText } = await generateText({
					model: geminiModel,
					messages: [
						{
							role: "user",
							content: "Olá, esta é uma mensagem de teste para validar a chave API."
						}
					],
				});
				
				// Se chegarmos aqui, a chave é válida
				return new Response(JSON.stringify({ 
					valid: true,
					message: "Chave API válida"
				}), {
					status: 200,
					headers: { "Content-Type": "application/json" }
				});
			} catch (error) {
				console.error("API key validation error:", error);
				
				// Detectar erros específicos de autenticação
				if (error instanceof Error) {
					const errorMessage = error.message.toLowerCase();
					if (
						errorMessage.includes("403") || 
						errorMessage.includes("auth") || 
						errorMessage.includes("method doesn't allow unregistered callers") ||
						errorMessage.includes("caller not authorized") ||
						errorMessage.includes("api key not valid")
					) {
						return new Response(JSON.stringify({ 
							valid: false,
							error: `Erro de autenticação: ${error.message}`,
							errorType: "auth_error"
						}), {
							status: 401,
							headers: { "Content-Type": "application/json" }
						});
					}
				}
				
				return new Response(JSON.stringify({ 
					valid: false,
					error: error instanceof Error ? error.message : "Erro desconhecido ao validar a chave API",
					errorType: "validation_error"
				}), {
					status: 500,
					headers: { "Content-Type": "application/json" }
				});
			}
		}
		
		const segments = content.split(/\r\n\r\n|\n\n/).map(parseSegment);
		const groups = groupSegmentsByTokenLength(segments, MAX_TOKENS_IN_SEGMENT);

		let currentIndex = 0;
		const encoder = new TextEncoder();

		const stream = new ReadableStream({
			async start(controller) {
				for (const group of groups) {
					const text = group.map((segment) => segment.text).join("|");
					const translatedText = await retrieveTranslation(text, language, apiKey);
					if (!translatedText) continue;

					const translatedSegments = translatedText.split("|");
					for (const segment of translatedSegments) {
						if (segment.trim()) {
							const originalSegment = segments[currentIndex];
							const srt = `${++currentIndex}\n${originalSegment?.timestamp || ""}\n${segment.trim()}\n\n`;
							controller.enqueue(encoder.encode(srt));
						}
					}
				}
				controller.close();
			},
		});

		return new Response(stream);
	} catch (error) {
		console.error("Error during translation:", error);
		
		// Detectar erros específicos de API
		let statusCode = 500;
		let errorMessage = error instanceof Error 
			? `Erro na tradução: ${error.message}` 
			: "Erro desconhecido durante a tradução";
		
		// Verificar se é um erro de autenticação
		if (error instanceof Error) {
			const errorText = error.message.toLowerCase();
			if (
				errorText.includes("auth") || 
				errorText.includes("api key") ||
				errorText.includes("403") ||
				errorText.includes("forbidden") ||
				errorText.includes("unauthorized")
			) {
				statusCode = 401; // Usar 401 para todos os erros de autenticação
				errorMessage = `Erro de autenticação: ${error.message}`;
			}
		}
		
		return new Response(JSON.stringify({ 
			error: errorMessage,
			details: error instanceof Error ? error.stack : String(error),
			errorType: statusCode === 401 ? "auth_error" : "translation_error"
		}), {
			status: statusCode,
			headers: { "Content-Type": "application/json" }
		});
	}
}
