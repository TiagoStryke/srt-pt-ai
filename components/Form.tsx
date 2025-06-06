'use client';

import React, { FormEvent, useEffect, useState } from "react";

// Adicionando tipagem para o objeto window com Electron
declare global {
  interface Window {
    electron?: {
      openFileDialog: () => void;
      onFileSelection: (callback: (filePaths: string[]) => void) => void;
      translateText: (content: string, language: string, apiKey: string) => Promise<any>;
      readSrtFile: (filePath: string) => Promise<{success: boolean, content?: string, error?: string}>;
      isElectronApp: boolean;
    }
  }
}

interface Props {
  onSubmit: (content: string, language: string, fileName: string) => void;
  apiKey?: string;
  onApiKeyChange?: (newKey: string) => void;
  apiError?: string;
  isValidating?: boolean;
}
function classNames(...classes: any[]) {
  return classes.filter(Boolean).join(" ");
}

// Limitando apenas para Português Brasileiro
const LANGUAGES = ['Brazilian Portuguese']

// Interface para arquivos a serem traduzidos
interface FileToTranslate {
  file: File;
  translated: boolean;
  translating?: boolean; // Novo campo para indicar se o arquivo está sendo traduzido
}

// Função para ler o conteúdo do arquivo
const readFileContents = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    // Verificar se estamos no Electron e se o arquivo tem um caminho
    if (typeof window !== 'undefined' && window.electron?.readSrtFile && 'path' in file) {
      // Usar a API do Electron para ler o arquivo
      window.electron.readSrtFile(file.path as string)
        .then((result: any) => {
          if (result.success) {
            resolve(result.content);
          } else {
            reject(new Error(result.error || 'Erro ao ler arquivo'));
          }
        })
        .catch(reject);
    } else {
      // Usar a API padrão do navegador
      const reader = new FileReader();

      reader.onload = (e) => {
        const content = e.target?.result as string;
        resolve(content);
      };

      reader.onerror = (e) => {
        reject(e);
      };

      reader.readAsText(file);
    }
  });
};

const SrtForm: React.FC<Props> = ({ onSubmit, apiKey = '', onApiKeyChange, apiError, isValidating = false }) => {
  const [files, setFiles] = useState<FileToTranslate[]>([]);
  // Preseleciona o idioma como Brazilian Portuguese
  const [language, setLanguage] = useState<string>("Brazilian Portuguese");
  const [dragging, setDragging] = useState<boolean>(false);
  const [currentFileIndex, setCurrentFileIndex] = useState<number>(-1);
  const [localApiKey, setLocalApiKey] = useState<string>(apiKey);
  const [isElectron, setIsElectron] = useState<boolean>(false);
  
  // Verifica se estamos no ambiente Electron
  useEffect(() => {
    if (typeof window !== 'undefined' && window.electron?.isElectronApp) {
      setIsElectron(true);
      console.log('Executando no ambiente Electron');
      
      // Configura o listener para seleção de arquivos no Electron
      window.electron.onFileSelection((filePaths: string[]) => {
        console.log('Arquivos selecionados no Electron:', filePaths);
        // Converte os caminhos de arquivo em objetos File
        const newFiles = filePaths.map(path => {
          const pathParts = path.split(/[\/\\]/);
          const fileName = pathParts[pathParts.length - 1];
          // No Electron, usamos um objeto similar a File
          return {
            file: {
              name: fileName,
              path: path,
              // Estas propriedades são usadas apenas para compatibilidade
              size: 0,
              type: 'text/plain'
            } as unknown as File,
            translated: false
          };
        });
        
        setFiles(prevFiles => [...prevFiles, ...newFiles]);
      });
    }
  }, []);
  
  // Adiciona um event listener para o evento customizado reset-file-status
  React.useEffect(() => {
    const handleResetFileStatus = (e: CustomEvent<{fileName: string}>) => {
      if (e.detail && e.detail.fileName) {
        const fileName = e.detail.fileName;
        const fileIndex = files.findIndex(f => f.file.name === fileName);
        if (fileIndex !== -1) {
          resetFileTranslatedStatus(fileIndex);
        }
      }
    };

    // Adiciona o listener ao form
    const form = document.querySelector('form');
    if (form) {
      form.addEventListener('reset-file-status', handleResetFileStatus as EventListener);
    }

    return () => {
      // Remove o listener quando o componente for desmontado
      if (form) {
        form.removeEventListener('reset-file-status', handleResetFileStatus as EventListener);
      }
    };
  }, [files]);

  // Atualiza o estado local quando a prop apiKey mudar
  React.useEffect(() => {
    setLocalApiKey(apiKey);
  }, [apiKey]);
  
  // Estado para controlar se a API key foi alterada após um erro
  const [keyChangedAfterError, setKeyChangedAfterError] = useState<boolean>(false);

  // Efeito para resetar o estado keyChangedAfterError quando apiError muda
  React.useEffect(() => {
    if (apiError) {
      setKeyChangedAfterError(false);
    }
  }, [apiError]);

  // Função para lidar com mudanças na chave de API
  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newKey = e.target.value;
    setLocalApiKey(newKey);
    
    // Se houver uma função de callback para mudanças na API key, chame-a
    if (onApiKeyChange) {
      onApiKeyChange(newKey);
    }
    
    // Limpa qualquer erro relacionado à API key quando o usuário edita o campo
    if (apiError && apiError.toLowerCase().includes("api") && typeof window !== 'undefined') {
      // Indica que a chave foi alterada após um erro
      setKeyChangedAfterError(true);
      
      // Não podemos limpar o apiError diretamente pois vem como prop
      // Mas podemos sinalizar ao componente pai que o usuário está tentando corrigir
      const form = document.querySelector('form');
      if (form) {
        form.dispatchEvent(new CustomEvent('api-key-changed', { 
          detail: { newKey: newKey } 
        }));
      }
    }
    
    // Remove qualquer classe de erro ou animação quando o usuário edita a chave
    if (apiError) {
      const apiKeyInput = document.getElementById('api-key');
      if (apiKeyInput && apiKeyInput.classList.contains('shake-animation')) {
        apiKeyInput.classList.remove('shake-animation');
      }
    }
    
    // Salva a nova chave no localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('gemini_api_key', newKey);
    }
  };
  
  // Para permitir a retentativa de arquivos após um erro
  const resetFileTranslatedStatus = (index: number) => {
    if (index >= 0 && index < files.length) {
      const updatedFiles = [...files];
      updatedFiles[index].translated = false;
      updatedFiles[index].translating = false;
      setFiles(updatedFiles);
      console.log(`Arquivo ${updatedFiles[index].file.name} marcado como não traduzido para permitir nova tentativa`);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (files.length > 0 && language) {
      // Encontra o próximo arquivo não traduzido
      const nextIndex = files.findIndex(f => !f.translated && !f.translating);
      if (nextIndex !== -1) {
        setCurrentFileIndex(nextIndex);
        const fileToTranslate = files[nextIndex];
        
        // Marcamos o arquivo como "em tradução"
        const tempFiles = [...files];
        tempFiles[nextIndex].translating = true;
        setFiles(tempFiles);
        
        // Lê o conteúdo do arquivo
        let content;
        
        try {
          content = await readFileContents(fileToTranslate.file);
        } catch (error) {
          console.error('Erro ao ler arquivo:', error);
          alert(`Erro ao ler arquivo: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
          // Reset do status do arquivo para permitir nova tentativa
          resetFileTranslatedStatus(nextIndex);
          return;
        }
        
        // Se estamos no Electron e temos uma API de tradução disponível, usamos ela
        if (isElectron && window.electron?.translateText) {
          try {
            const result = await window.electron.translateText(content, language, localApiKey);
            if (result.error) {
              // Mostramos o erro ao usuário
              alert(`Erro na tradução: ${result.error}`);
              // Reset do status do arquivo para permitir nova tentativa
              resetFileTranslatedStatus(nextIndex);
            } else {
              // Processamos o resultado da tradução
              console.log('Tradução realizada com sucesso via Electron');
              // Marcar como traduzido
              const updatedFiles = [...files];
              updatedFiles[nextIndex].translated = true;
              updatedFiles[nextIndex].translating = false;
              setFiles(updatedFiles);
              // Aqui poderiamos processar o resultado e salvar o arquivo
              alert('Tradução concluída com sucesso!');
            }
          } catch (error) {
            console.error('Erro ao traduzir no Electron:', error);
            alert(`Erro ao traduzir: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
            // Reset do status do arquivo para permitir nova tentativa
            resetFileTranslatedStatus(nextIndex);
          }
        } else {
          // Processamento normal via web - com tratamento de erros melhorado
          try {
            // Verificar se estamos em um ambiente de build estático
            const isBuildStatic = typeof window !== 'undefined' && 
              window.location.protocol === 'file:' || 
              process.env.NEXT_BUILD_MODE === 'static';
            
            if (isBuildStatic) {
              console.log('Executando em modo de build estático, adaptando método de chamada da API');
              // No modo estático, precisamos usar o protocolo customizado do Electron para API
              if (window.electron?.translateText) {
                const result = await window.electron.translateText(content, language, localApiKey);
                if (result.error) {
                  alert(`Erro na tradução: ${result.error}`);
                  // Reset do status do arquivo
                  resetFileTranslatedStatus(nextIndex);
                } else {
                  console.log('Tradução realizada com sucesso em ambiente estático');
                  // Marcar como traduzido
                  const updatedFiles = [...files];
                  updatedFiles[nextIndex].translated = true;
                  updatedFiles[nextIndex].translating = false;
                  setFiles(updatedFiles);
                  alert('Tradução concluída com sucesso!');
                }
              } else {
                // Fallback para quando o Electron não está disponível
                alert('Erro: Não foi possível conectar ao serviço de tradução em ambiente estático.');
                // Reset do status do arquivo
                resetFileTranslatedStatus(nextIndex);
              }
            } else {
              // Modo dinâmico normal
              onSubmit(content, language, fileToTranslate.file.name);
              
              // Não marcamos como traduzido aqui - o componente pai vai atualizar o status
              // quando a tradução for concluída
            }
          } catch (error) {
            console.error('Erro ao processar tradução web:', error);
            alert(`Erro ao processar tradução: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
            // Reset do status do arquivo
            resetFileTranslatedStatus(nextIndex);
          }
        }
      }
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFiles = Array.from(e.dataTransfer.files);
      
      // Filtra apenas arquivos .srt
      const srtFiles = droppedFiles.filter(file => {
        const fileName = file.name;
        const fileExtension = fileName.split(".").pop()?.toLowerCase();
        return fileExtension === "srt";
      });
      
      if (srtFiles.length === 0) {
        alert("Por favor, selecione apenas arquivos .srt");
        return;
      }
      
      // Adiciona os novos arquivos à lista
      const newFiles: FileToTranslate[] = srtFiles.map(file => ({
        file,
        translated: false,
        translating: false
      }));
      
      setFiles(prev => [...prev, ...newFiles]);
    }
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFiles = Array.from(e.target.files);
      
      // Filtra apenas arquivos .srt
      const srtFiles = selectedFiles.filter(file => {
        const fileName = file.name;
        const fileExtension = fileName.split(".").pop()?.toLowerCase();
        return fileExtension === "srt";
      });
      
      if (srtFiles.length === 0) {
        alert("Por favor, selecione apenas arquivos .srt");
        return;
      }
      
      // Adiciona os novos arquivos à lista
      const newFiles: FileToTranslate[] = srtFiles.map(file => ({
        file,
        translated: false,
        translating: false
      }));
      
      setFiles(prev => [...prev, ...newFiles]);
    }
  };
  
  // Função para abrir o diálogo de seleção de arquivos no Electron
  const handleOpenElectronFileDialog = () => {
    if (isElectron && window.electron?.openFileDialog) {
      window.electron.openFileDialog();
    }
  };
  
  const removeFile = (index: number) => {
    const updatedFiles = [...files];
    updatedFiles.splice(index, 1);
    setFiles(updatedFiles);
  };

  // Função para obter o ícone de status do arquivo
  const getFileStatusIcon = (file: FileToTranslate) => {
    if (file.translated) return "✅"; // Concluído
    if (file.translating) return "🔄"; // Em tradução
    return "⏳"; // Pendente
  };

  // Função para obter a classe CSS de status do arquivo
  const getFileStatusClass = (file: FileToTranslate) => {
    if (file.translated) return "text-green-600";
    if (file.translating) return "text-blue-600";
    return "text-gray-600";
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col px-4 mt-6 w-full md:px-0"
    >
      <label
        htmlFor="srt-file"
        className="block font-bold py-4 md:pl-8 text-lg text-[#444444] dark:text-gray-200"
      >
        {files.length > 0 ? "✅" : "👉"} Passo 1: Escolha seus arquivos de legendas SRT
      </label>
      <div
        id="srt-file"
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`w-full border-2 ${dragging ? "border-blue-300 dark:border-blue-500" : "border-transparent"
          } md:rounded-lg bg-[#EFEFEF] dark:bg-gray-800 px-12 relative`}
      >
        <input
          type="file"
          accept=".srt"
          multiple
          onChange={handleFileChange}
          className="absolute inset-0 opacity-0 cursor-pointer z-10"
          style={{ pointerEvents: files.length > 0 ? "none" : "auto" }}
        />
        <div className="grid items-center py-4">
          <div>
            <div className="text-center py-4 md:py-0 text-[#444444] dark:text-gray-200">
              {files.length > 0 ? (
                <div className="text-left">
                  <div className="mb-2 font-bold flex justify-between items-center">
                    <span>Arquivos selecionados:</span>
                    <button
                      type="button"
                      onClick={isElectron ? handleOpenElectronFileDialog : () => document.querySelector<HTMLInputElement>('input[type="file"]')?.click()}
                      className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-sm px-2 py-1 border border-blue-500 dark:border-blue-400 rounded"
                    >
                      + Adicionar mais
                    </button>
                  </div>
                  {files.map((file, index) => (
                    <div key={index} className="flex items-center justify-between mb-1">
                      <span className={getFileStatusClass(file)}>
                        {getFileStatusIcon(file)} {file.file.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeFile(index)}
                        className="text-red-500 hover:text-red-700 ml-2 z-20"
                        disabled={file.translating}
                      >
                        {file.translating ? "..." : "✕"}
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <div>
                    <div>Arraste seus arquivos SRT aqui</div>
                    <div className="my-3 text-sm">- ou -</div>
                  </div>
                  <div 
                    className="rounded-sm bg-[#d9d9d9] dark:bg-gray-700 py-2 px-2 cursor-pointer hover:bg-[#c9c9c9] dark:hover:bg-gray-600 dark:text-white"
                    onClick={isElectron ? handleOpenElectronFileDialog : () => document.querySelector<HTMLInputElement>('input[type="file"]')?.click()}
                  >
                    Procurar arquivos SRT&hellip;
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="md:h-6"></div>

      {files.length > 0 && (
        <>
          <div>
            <label
              htmlFor="srt-file"
              className="block font-bold md:pl-8 mt-6 md:mt-2 py-4 text-lg text-[#444444] dark:text-gray-200"
            >
              ✅ Pronto para traduzir para Português Brasileiro
            </label>
            <div className="rounded-lg bg-[#fafafa] dark:bg-gray-800 text-[#444444] dark:text-gray-200 py-4 md:py-8 md:px-8 relative flex flex-col gap-4">
              <div className="text-center md:text-left">Os arquivos serão traduzidos para Português Brasileiro e salvos com a extensão .pt.srt</div>
              
              <div className="mt-2">
                <label htmlFor="api-key" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Google Gemini API Key
                </label>
                <div className="mt-1 flex flex-col md:flex-row gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      id="api-key"
                      className={`shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm rounded-md p-2 border ${
                        apiError && apiError.toLowerCase().includes("api key") 
                          ? "border-red-500 bg-red-50" 
                          : localApiKey && localApiKey.length >= 30 
                            ? "border-gray-300 border-opacity-80 bg-white dark:bg-gray-700 dark:border-gray-500" 
                            : "border-gray-300 dark:border-gray-600 dark:bg-gray-700"
                      } ${apiError ? "pr-10 shake-animation" : isValidating ? "pr-10" : ""}`}
                      placeholder="Insira sua API key do Google Gemini"
                      value={localApiKey}
                      onChange={handleApiKeyChange}
                      disabled={isValidating}
                    />
                    {isValidating && (
                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                        <svg className="animate-spin h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      </div>
                    )}
                  </div>
                  <a 
                    href="https://aistudio.google.com/app/apikey" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm md:self-center"
                  >
                    Obter API key
                  </a>
                </div>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  É necessário uma API key do Google Gemini para fazer a tradução. Esta chave será salva localmente no seu navegador.
                  {localApiKey && localApiKey.length < 30 && localApiKey.length > 0 && (
                    <span className="block mt-1 text-amber-600 dark:text-amber-500">
                      ⚠️ Chave API muito curta. Chaves do Google Gemini geralmente têm mais de 30 caracteres.
                    </span>
                  )}
                </p>
              </div>
              
              {apiError && (
                <div className="mt-2 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 p-3 rounded-md border border-red-200 dark:border-red-800">
                  <div className="font-bold">Erro:</div>
                  <div>{apiError}</div>
                  {apiError.toLowerCase().includes("api") && apiError.toLowerCase().includes("key") && (
                    <div className="mt-2 text-sm">
                      <span className="font-semibold">Dica:</span> Certifique-se de que sua chave API do Google Gemini é válida e foi inserida corretamente.{" "}
                      <a 
                        href="https://aistudio.google.com/app/apikey" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline dark:text-blue-400"
                      >
                        Obter uma nova chave API →
                      </a>
                      <ul className="mt-2 ml-4 list-disc">
                        <li>A chave deve ter um formato específico e mais de 30 caracteres</li>
                        <li>Verifique se não há espaços extras antes ou depois da chave</li>
                        <li>Confirme que a chave está ativa em sua conta Google</li>
                        <li>Certifique-se de que sua chave API tem acesso ao modelo Gemini</li>
                        <li>Verifique se a chave foi copiada completa do Google AI Studio</li>
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="h-2"></div>
          </div>
          <button
            disabled={files.length === 0 || isValidating || (!!localApiKey && localApiKey.length > 0 && localApiKey.length < 30) || !files.some(f => !f.translated && !f.translating)}
            className={`${
              apiError && !keyChangedAfterError 
                ? "bg-[#D74C29] hover:bg-[#B23D1F] pulse-animation" 
                : keyChangedAfterError 
                  ? "bg-[#2E8B57] hover:bg-[#1F6E43]" 
                  : "bg-[#444444] hover:bg-[#3a3a3a] dark:bg-gray-700 dark:hover:bg-gray-600"
            } text-white mt-6 font-bold py-2 px-6 rounded-lg disabled:bg-[#eeeeee] dark:disabled:bg-gray-800 disabled:text-[#aaaaaa] dark:disabled:text-gray-600`}
          >
            {isValidating 
              ? "Verificando chave API..." 
              : files.length === 0
                ? "Selecione arquivos para traduzir" 
                : !!localApiKey && localApiKey.length > 0 && localApiKey.length < 30 
                  ? "Chave API muito curta (mínimo 30 caracteres)" 
                  : !files.some(f => !f.translated && !f.translating)
                    ? "Todos os arquivos estão traduzidos" 
                    : apiError && !keyChangedAfterError
                      ? "Tentar novamente com outra chave API" 
                      : keyChangedAfterError
                        ? "Tentar com nova chave API" 
                        : "Traduzir para Português Brasileiro →"}
          </button>
        </>
      )}
    </form>
  );
};

export default SrtForm;
