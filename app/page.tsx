"use client";

import { libre, playfair } from "@/fonts";
import React from "react";

import Form from "@/components/Form";
import ThemeToggle from "@/components/ThemeToggle";
import Timestamp from "@/components/Timestamp";
import TranslationProgress from "@/components/TranslationProgress";

import { parseSegment, parseTimestamp } from "@/lib/client";
import type { Chunk } from "@/types";

function classNames(...classes: string[]) {
	return classes.filter(Boolean).join(" ");
}

// Função para processar o texto e garantir que cada linha com hífen esteja em uma linha separada
const processSubtitleFormat = (content: string): string => {
	// Divide o conteúdo em blocos de legendas (separados por linhas em branco)
	const blocks = content.split(/\n\n/);
	
	return blocks.map(block => {
		const lines = block.split('\n');
		
		// Se temos pelo menos 3 linhas (número, timestamp, texto)
		if (lines.length >= 3) {
			// Pega o número da legenda e o timestamp
			const number = lines[0];
			const timestamp = lines[1];
			
			// Junta todas as linhas de texto
			const textLines = lines.slice(2);
			let text = textLines.join(' ');
			
			// Verifica se temos múltiplos hífens indicando diálogos
			// Primeiro caso: texto começa com hífen e contém outro hífen precedido por espaço
			if (text.match(/^-.*\s+-/)) {
				// Substitui todos os hífens (exceto o primeiro) por quebra de linha e hífen
				text = text.replace(/^-/, '- ').replace(/\s+-/g, '\n-');
			} 
			// Segundo caso: texto não começa com hífen mas contém múltiplos hífens com espaços
			else if (text.match(/\s+-.*\s+-/)) {
				// Substitui todos os hífens por quebra de linha e hífen
				text = text.replace(/\s+-/g, '\n-');
			}
			
			// Normaliza espaços após os hífens: garante exatamente um espaço após cada hífen
			text = text
				.split('\n')
				.map(line => {
					// Primeiro remove qualquer espaço após hífen
					line = line.replace(/^-\s*/, '-');
					// Depois adiciona exatamente um espaço
					if (line.match(/^-/)) {
						return line.replace(/^-/, '- ');
					}
					return line;
				})
				.join('\n');
			
			// Reconstrói o bloco
			return `${number}\n${timestamp}\n${text}`;
		}
		
		return block;
	}).join('\n\n');
};

// Interface para arquivos traduzidos
interface TranslatedFile {
  originalName: string;
  translatedName: string;
  content: string;
  downloadTimestamp?: Date;
  previewChunks?: {
    translatedChunks: Chunk[];
    originalChunks: Chunk[];
  };
}

function Translating({ chunks }: { chunks: Chunk[] }) {
	// Estado para controlar se devemos mostrar todos os chunks ou limitar
	const [showAllChunks, setShowAllChunks] = React.useState<boolean>(false);
	
	// Limitar a exibição a no máximo 20 chunks para não sobrecarregar a interface
	// a menos que o usuário tenha escolhido ver todos
	const displayChunks = showAllChunks ? chunks : chunks.slice(-20);
  
	return (
		<div className="flex gap-y-2 flex-col">
			{chunks.length > 20 && (
				<div className="flex justify-between items-center mb-2 p-2 bg-gray-100 dark:bg-gray-800 rounded border dark:border-gray-700">
					<div className="text-sm text-gray-600 dark:text-gray-400 italic">
						{showAllChunks 
							? `Mostrando todos os ${chunks.length} segmentos traduzidos` 
							: `Mostrando os últimos 20 segmentos de ${chunks.length} traduzidos...`}
					</div>
					<button 
						onClick={() => setShowAllChunks(!showAllChunks)}
						className="text-sm bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded"
					>
						{showAllChunks ? 'Ver menos' : 'Ver todos'}
					</button>
				</div>
			)}
			<div className="flex gap-y-2 flex-col-reverse">
				{displayChunks.map((chunk) => (
					<Timestamp key={`${chunk.index}-${chunk.start}`} {...chunk} />
				))}
			</div>
		</div>
	);
}

export default function Home() {
	const [status, setStatus] = React.useState<"idle" | "busy" | "done">("idle");
	const [translatedSrt, setTranslatedSrt] = React.useState("");
	const [translatedChunks, setTranslatedChunks] = React.useState<Chunk[]>([]);
	const [originalChunks, setOriginalChunks] = React.useState<Chunk[]>([]);
	const [processedFiles, setProcessedFiles] = React.useState<string[]>([]);
	const [currentFileName, setCurrentFileName] = React.useState<string>("");
	const [translationProgress, setTranslationProgress] = React.useState<number>(0);
	const [isValidating, setIsValidating] = React.useState<boolean>(false);
	const [apiKey, setApiKey] = React.useState<string>(() => {
		// Tentar obter a chave de API do localStorage ou usar uma chave padrão vazia
		if (typeof window !== 'undefined') {
			return localStorage.getItem('gemini_api_key') || '';
		}
		return '';
	});
	const [apiError, setApiError] = React.useState<string>("");
	const [translatedFiles, setTranslatedFiles] = React.useState<TranslatedFile[]>([]);
	const [activeTranslationFile, setActiveTranslationFile] = React.useState<string>("");
	const [selectedPreviewFile, setSelectedPreviewFile] = React.useState<string | null>(null);

	// Função para cancelar a tradução atual
	const cancelTranslation = React.useCallback(() => {
		setStatus("idle");
		setTranslatedSrt("");
		setTranslatedChunks([]);
		setOriginalChunks([]);
		setTranslationProgress(0);
		setActiveTranslationFile("");
		
		// Limpar qualquer requisição pendente
		if (typeof window !== 'undefined') {
			window.stop(); // Interrompe todas as requisições pendentes
		}
	}, []);
	
	// Função para verificar se o arquivo já tem uma versão traduzida
	const isAlreadyTranslated = (fileName: string): boolean => {
		const fileNameWithoutExt = fileName.replace(/\.srt$/i, '');
		const translatedFileName = `${fileNameWithoutExt}.pt.srt`;
		
		// Verifica se o arquivo já está na lista de processados
		return processedFiles.includes(fileName) || processedFiles.includes(translatedFileName);
	};

	const handleDownload = (file: TranslatedFile) => {
		triggerFileDownload(file.translatedName, file.content);
		
		// Atualiza o arquivo com o timestamp de download
		setTranslatedFiles(prev => prev.map(f => 
			f.originalName === file.originalName 
				? {...f, downloadTimestamp: new Date()} 
				: f
		));
	};

	// Função para exibir/esconder a prévia de um arquivo traduzido
	const togglePreview = (fileName: string) => {
		if (selectedPreviewFile === fileName) {
			setSelectedPreviewFile(null);
		} else {
			setSelectedPreviewFile(fileName);
		}
	};

	const triggerFileDownload = (filename: string, content: string) => {
		const element = document.createElement("a");
		const file = new Blob([content], { type: "text/plain" });
		element.href = URL.createObjectURL(file);
		element.download = filename;
		document.body.appendChild(element);
		element.click();
		
		// Limpa o elemento do DOM após o download
		setTimeout(() => {
			document.body.removeChild(element);
			URL.revokeObjectURL(element.href);
		}, 100);
	};

	async function handleStream(response: Response) {
		const data = response.body;
		if (!data) return;

		let content = "";
		let doneReading = false;
		let processedChunks = 0;
		const reader = data.getReader();
		const decoder = new TextDecoder();
		const totalChunks = originalChunks.length;
		
		// Obtemos a última legenda para calcular o progresso baseado no tempo/número
		const lastLegend = originalChunks.length > 0 ? originalChunks[originalChunks.length - 1] : null;
		const lastIndex = lastLegend ? parseInt(lastLegend.index) : 0;
		
		// Log para depuração
		console.log(`Total de chunks: ${totalChunks}, Último índice: ${lastIndex}`);
		
		// Se possível, extraímos o timestamp final do último chunk para calcular por tempo
		const lastTimestamp = lastLegend ? 
			convertTimestampToSeconds(lastLegend.end) : 0;
			
		// Formatar o timestamp para exibição no log (HH:MM:SS)
		const formatTimeForLog = (seconds: number): string => {
			const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
			const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
			const s = Math.floor(seconds % 60).toString().padStart(2, '0');
			return `${h}:${m}:${s}`;
		};
			
		console.log(`Timestamp final: ${lastTimestamp} segundos (${formatTimeForLog(lastTimestamp)})`);
		
		// Atualizamos o progresso para 2% logo no início para mostrar que começou
		setTranslationProgress(2);

		while (!doneReading) {
			const { value, done } = await reader.read();
			doneReading = done;
			const chunk = decoder.decode(value);

			content += `${chunk}\n\n`;
			setTranslatedSrt((prev) => prev + chunk);
			if (chunk.trim().length) {
				const parsedChunk = parseChunk(chunk);
				setTranslatedChunks((prev) => [...prev, parsedChunk]);
				processedChunks++;
				
				// Cálculo de progresso baseado em posição/tempo, não apenas contagem
				if (totalChunks > 0) {
					let progress = 0;
					
					// Priorizar o uso do timestamp para cálculo mais preciso do progresso
					const currentTimestamp = convertTimestampToSeconds(parsedChunk.end);
					interface FormatTimeForLog {
						(seconds: number): string;
					}

					const formatTimeForLog: FormatTimeForLog = (seconds: number): string => {
						const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
						const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
						const s = Math.floor(seconds % 60).toString().padStart(2, '0');
						return `${h}:${m}:${s}`;
					};
					
					// Log do timestamp atual formatado para depuração
					console.log(`Timestamp atual: ${formatTimeForLog(currentTimestamp)}`);
					
					// Se o timestamp é válido e temos um timestamp final válido para comparação
					if (currentTimestamp > 0 && lastTimestamp > 0) {
						// Calcula a porcentagem baseada no tempo atual / tempo total
						progress = Math.round((currentTimestamp / lastTimestamp) * 100);
						console.log(`Progresso por tempo: ${currentTimestamp}s / ${lastTimestamp}s = ${progress}%`);
					} 
					// Se temos um ID válido para comparação
					else {
						const currentIndex = parseInt(parsedChunk.index);
						if (!isNaN(currentIndex) && lastIndex > 0) {
							progress = Math.round((currentIndex / lastIndex) * 100);
							console.log(`Progresso por índice: ${currentIndex} / ${lastIndex} = ${progress}%`);
						} 
						// Fallback para contagem de chunks processados
						else {
							progress = Math.round((processedChunks / totalChunks) * 100);
							console.log(`Progresso por chunks: ${processedChunks} / ${totalChunks} = ${progress}%`);
						}
					}
					
					// Garantimos que o progresso está entre 5% e 95%
					// Começamos com pelo menos 5% para evitar ficar em 0% por muito tempo
					progress = Math.max(5, Math.min(progress, 95));
					
					// Atualizamos o progresso na UI
					setTranslationProgress(progress);
				}
			}
		}

		// Depois de ler todo o conteúdo, mas antes de finalizar o processamento, atualizamos para 98%
		// Isso indica que a leitura foi concluída mas ainda estamos processando
		setTranslationProgress(98);
		
		return content;
		
		// Função auxiliar para converter timestamp em segundos para cálculo de progresso
		function convertTimestampToSeconds(timestamp: string): number {
			try {
				// Garantir formato válido (00:00:00,000)
				if (!timestamp || typeof timestamp !== 'string' || !timestamp.includes(':')) {
					return 0;
				}
				
				// Aceita formatos com ',' ou '.' como separador de milissegundos
				const normalizedTimestamp = timestamp.replace(',', '.');
				
				// Se tiver formato HH:MM:SS.mmm
				const timeRegex = /(\d{2}):(\d{2}):(\d{2})\.?(\d{0,3})?/;
				const match = normalizedTimestamp.match(timeRegex);
				
				if (match) {
					const hours = parseInt(match[1], 10) || 0;
					const minutes = parseInt(match[2], 10) || 0;
					const seconds = parseInt(match[3], 10) || 0;
					const milliseconds = parseInt(match[4] || '0', 10) || 0;
					
					const totalSeconds = 
						hours * 3600 + 
						minutes * 60 + 
						seconds + 
						milliseconds / 1000;
					
					return totalSeconds;
				}
				
				return 0;
			} catch (e) {
				console.error('Erro ao converter timestamp:', e);
				return 0;
			}
		}

		function parseChunk(chunkStr: string): Chunk {
			try {
				const { id, timestamp, text } = parseSegment(chunkStr);
				const { start, end } = parseTimestamp(timestamp);
				return { index: id.toString(), start, end, text };
			} catch (e) {
				// Em caso de erro no parsing, retornamos um objeto seguro com valores padrão
				console.warn("Erro ao analisar chunk:", e);
				return { 
					index: "0", 
					start: "00:00:00,000", 
					end: "00:00:00,000", 
					text: chunkStr 
				};
			}
		}
	}

	async function handleSubmit(content: string, language: string, fileName: string) {
		try {
			if (!content) {
				console.error("No content provided");
				return;
			}
			
			// Verificar se a API key foi fornecida
			if (!apiKey || apiKey.trim() === '') {
				setApiError("Por favor, insira uma chave API do Google Gemini antes de traduzir. Você pode obter uma chave em https://aistudio.google.com/app/apikey");
				return;
			}
			
			// Verificação básica de API key muito curta
			if (apiKey.trim().length < 30) {
				setApiError("A chave API fornecida parece inválida (muito curta). Por favor, insira uma chave API válida do Google Gemini.");
				return;
			}

			// Reset previous state for this specific file
			setTranslatedSrt("");
			setTranslatedChunks([]);
			setOriginalChunks([]);
			setCurrentFileName(fileName);
			setActiveTranslationFile(fileName);
			setTranslationProgress(1); // Começamos com 1% para indicar que o processo foi iniciado

			const segments = content.split(/\r\n\r\n|\n\n/).filter((segment) => {
				const lines = segment.split(/\r\n|\n/);
				const id = Number.parseInt(lines[0], 10);
				return (
					lines.length >= 3 && // Must have at least id, timestamp, and text
					!Number.isNaN(id) && // First line must be a number
					lines[1].includes(" --> ")
				); // Second line must be a timestamp
			});

			if (!segments.length) {
				setStatus("idle");
				alert("Invalid SRT file format. Please check your file.");
				return;
			}

			try {
				const originalSegments = segments.map(parseSegment);
				setOriginalChunks(
					originalSegments.map((seg) => ({
						index: seg.id.toString(),
						start: seg.timestamp.split(" --> ")[0],
						end: seg.timestamp.split(" --> ")[1],
						text: seg.text,
					})),
				);
			} catch (error) {
				setStatus("idle");
				alert("Error parsing SRT file. Please check the file format.");
				console.error("Parsing error:", error);
				return;
			}

			// Limpar qualquer erro anterior
			setApiError("");
			
			try {
				// Indicamos que estamos validando a chave API
				setIsValidating(true);
				
				// Faz uma solicitação inicial para verificar a chave API sem processar o arquivo inteiro
				const validationResponse = await fetch("/api", {
					method: "POST",
					body: JSON.stringify({ 
						content: "Teste de validação",  // Um pequeno texto para validação
						language, 
						apiKey,
						validationOnly: true // Indicador para o backend que é apenas validação
					}),
					headers: { "Content-Type": "application/json" },
				});
				
				// Finalizamos a validação
				setIsValidating(false);
				
				// Se a validação falhar, mostra o erro e não prossegue
				if (!validationResponse.ok) {
					const errorData = await validationResponse.json();
					if (errorData.error) {
						setApiError(errorData.error);
						
						// Destacar o campo de entrada da API key para chamar atenção
						setTimeout(() => {
							const apiKeyInput = document.getElementById('api-key');
							if (apiKeyInput) {
								apiKeyInput.focus();
								apiKeyInput.classList.add('shake-animation');
								setTimeout(() => {
									apiKeyInput.classList.remove('shake-animation');
								}, 820);
							}
						}, 100);
					} else {
						setApiError("Erro de validação da chave API");
					}
					setActiveTranslationFile("");
					return;
				}
				
				// Agora que sabemos que a chave é válida, podemos mudar para o estado "busy"
				setStatus("busy");
				
				// Processa o arquivo para tradução
				const response = await fetch("/api", {
					method: "POST",
					body: JSON.stringify({ content, language, apiKey }),
					headers: { "Content-Type": "application/json" },
				});

				if (response.ok) {
					const content = await handleStream(response);
					// Gera o nome do arquivo no formato original.pt.srt
					const fileNameWithoutExt = fileName.replace(/\.srt$/i, '');
					const translatedFilename = `${fileNameWithoutExt}.pt.srt`;
					
					if (content) {
						// Aplica o pós-processamento para corrigir o formato das legendas
						const processedContent = processSubtitleFormat(content);
						
						// Salva os chunks traduzidos para exibição futura
						const previewChunks = {
							translatedChunks: [...translatedChunks],
							originalChunks: [...originalChunks],
						};
						
						// Adiciona o arquivo traduzido à lista
						setTranslatedFiles(prev => [
							...prev.filter(f => f.originalName !== fileName), // remove if exists
							{
								originalName: fileName,
								translatedName: translatedFilename,
								content: processedContent,
								previewChunks // Guarda os chunks para visualização posterior
							}
						]);
						
						// Adiciona o arquivo à lista de processados
						setProcessedFiles(prev => [...prev, fileName]);
						
						// Define como arquivo de preview ativo
						setSelectedPreviewFile(fileName);
						
						// Agora sim, consideramos o processo 100% concluído
						setTranslationProgress(100);
						
						// Redefine o estado para idle e limpa a tradução atual
						setTimeout(() => {
							setStatus("idle");
							setActiveTranslationFile("");
							
							// Não limpamos translatedChunks ou originalChunks imediatamente
							// para que o usuário possa ver a prévia completa
							
							// Aguarda um breve momento antes de processar o próximo arquivo
							setTimeout(() => {
								// Verifica se existe um formulário e dispara o evento submit
								const form = document.querySelector('form');
								if (form) {
									form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
								}
								
								// Limpa os chunks para liberar memória, mas apenas depois de um tempo
								setTimeout(() => {
									if (selectedPreviewFile !== fileName) {
										setTranslatedSrt("");
										setTranslatedChunks([]);
										setOriginalChunks([]);
									}
								}, 1000);
							}, 500);
						}, 800); // Damos um tempo para o usuário ver a mensagem "Concluído!" antes de resetar
					} else {
						setStatus("idle");
						setActiveTranslationFile("");
						alert("Error occurred while reading the file");
					}
				} else {
					setStatus("idle");
					setActiveTranslationFile("");
					setTranslationProgress(0); // Zera o progresso em caso de erro
					try {
						// Tentar obter o erro da resposta
						const errorData = await response.json();
						
						// Tratamento específico para erros de autenticação
						if (
							response.status === 401 || 
							errorData.errorType === "auth_error" ||
							(errorData.error && (
								errorData.error.toLowerCase().includes("auth") || 
								errorData.error.toLowerCase().includes("api key") ||
								errorData.error.toLowerCase().includes("chave") ||
								errorData.error.toLowerCase().includes("unauthorized") ||
								errorData.error.toLowerCase().includes("forbidden")
							))
						) {
							// Mensagem mais amigável e detalhada para erros de API
							setApiError(`Erro de autenticação: ${errorData.error ? errorData.error.replace("Erro de autenticação: ", "") : "Chave API inválida ou não autorizada."} Verifique sua chave API do Google Gemini e tente novamente.`);
							
							// Destacar o campo de entrada da API key para chamar atenção
							setTimeout(() => {
								const apiKeyInput = document.getElementById('api-key');
								if (apiKeyInput) {
									apiKeyInput.focus();
									apiKeyInput.classList.add('shake-animation');
									setTimeout(() => {
										apiKeyInput.classList.remove('shake-animation');
									}, 820);
								}
							}, 100);
						} else {
							setApiError(errorData.error || "Erro ao enviar a solicitação de tradução");
						}
						
						console.error("API error:", errorData);
					} catch (e) {
						setApiError("Erro ao enviar a solicitação de tradução");
						console.error("Error occurred while submitting the translation request");
					}
				}
			} catch (error) {
				setIsValidating(false);
				setStatus("idle");
				setActiveTranslationFile("");
				setApiError(error instanceof Error ? error.message : "Erro durante a validação da chave API");
				console.error("API validation error:", error);
			}
		} catch (error) {
			setStatus("idle");
			setActiveTranslationFile("");
			setApiError(error instanceof Error ? error.message : "Erro durante a leitura do arquivo e solicitação de tradução");
			console.error(
				"Error during file reading and translation request:",
				error,
			);
		}
	}
	return (
		<main
			className={classNames(
				"max-w-2xl flex flex-col items-center mx-auto px-4 md:px-0 pt-4 pb-12 transition-all duration-300",
				libre.className,
			)}
		>
			{/* Botão de alternar tema */}
			<div className="fixed top-4 right-4 z-50">
				<ThemeToggle />
			</div>
			
			<h1
				className={classNames(
					"px-4 text-3xl md:text-5xl text-center font-bold my-8 tracking-tight dark:text-white relative title-shadow",
					playfair.className,
				)}
			>
				<span className="bg-gradient-to-r from-indigo-600 to-blue-500 dark:from-indigo-400 dark:to-blue-300 bg-clip-text text-transparent drop-shadow-sm">
					Tradutor de Legendas SRT
				</span>
				<br className="md:hidden" />
				<span className="md:ml-2">para Português Brasileiro</span>
				<div className="absolute w-32 h-1 bg-gradient-to-r from-indigo-600 to-blue-500 dark:from-indigo-400 dark:to-blue-300 left-1/2 transform -translate-x-1/2 -bottom-3 rounded-full"></div>
			</h1>
			
			<Form 
				onSubmit={handleSubmit} 
				apiKey={apiKey}
				onApiKeyChange={setApiKey}
				apiError={apiError}
				isValidating={isValidating}
			/>

			{activeTranslationFile && (
				<div className="w-full mt-6">
					<h2 className="text-xl font-semibold mb-4 dark:text-gray-200 flex items-center">
						<span className="mr-2">Tradução em progresso</span>
						<div className="h-1 w-1 rounded-full bg-blue-500 animate-pulse"></div>
					</h2>
					<TranslationProgress
						fileName={activeTranslationFile}
						translationProgress={translationProgress}
						onCancel={cancelTranslation}
					/>

					{translatedChunks.length > 0 && (
						<div className="mt-6">
							<h3 className="font-semibold mb-2 dark:text-gray-200">Prévia da tradução:</h3>
							<Translating
								chunks={translatedChunks.map((chunk, i) => ({
									...chunk,
									originalText: originalChunks[i]?.text,
								}))}
							/>
						</div>
					)}
				</div>
			)}

			{translatedFiles.length > 0 && (
				<div className="w-full mt-6 mb-8">
					<h2 className="text-xl font-semibold mb-4 dark:text-gray-200 flex items-center">
						<span className="mr-2">Arquivos traduzidos</span>
						<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500" viewBox="0 0 20 20" fill="currentColor">
							<path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
						</svg>
					</h2>
					<div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
						{translatedFiles.map((file, index) => (
							<React.Fragment key={file.originalName}>
								<div className={`p-4 flex justify-between items-center ${index < translatedFiles.length - 1 && selectedPreviewFile !== file.originalName ? 'border-b border-gray-200 dark:border-gray-700' : ''}`}>
									<div>
										<div className="font-medium dark:text-gray-200">{file.originalName}</div>
										<div className="text-sm text-gray-500 dark:text-gray-400">{file.translatedName}</div>
										{file.downloadTimestamp && (
											<div className="text-xs text-green-600 dark:text-green-400 mt-1">
												Baixado em: {file.downloadTimestamp.toLocaleString()}
											</div>
										)}
									</div>
									<div className="flex gap-2">
										<button
											onClick={() => togglePreview(file.originalName)}
											className="bg-gray-500 hover:bg-gray-600 text-white py-2 px-4 rounded-md flex items-center"
										>
											{selectedPreviewFile === file.originalName ? 'Esconder prévia' : 'Ver prévia'}
										</button>
										<button
											onClick={() => handleDownload(file)}
											className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-md flex items-center"
										>
											<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
											</svg>
											{file.downloadTimestamp ? 'Baixar novamente' : 'Baixar'}
										</button>
									</div>
								</div>
								
								{/* Exibir a prévia quando este arquivo estiver selecionado */}
								{selectedPreviewFile === file.originalName && file.previewChunks && (
									<div className="p-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
										<h3 className="font-semibold mb-2 dark:text-gray-200">Prévia da tradução:</h3>
										<Translating
											chunks={file.previewChunks.translatedChunks.map((chunk, i) => ({
												...chunk,
												originalText: file.previewChunks?.originalChunks[i]?.text,
											}))}
										/>
										<div className="mt-4 text-xs text-gray-500 dark:text-gray-400 text-center">
											Dica: Clique em 'Ver todos' para exibir todas as legendas traduzidas
										</div>
									</div>
								)}
							</React.Fragment>
						))}
					</div>
				</div>
			)}
		</main>
	);
}
