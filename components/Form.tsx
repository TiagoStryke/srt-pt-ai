'use client';

import React, { FormEvent, useEffect, useState } from "react";
import DebugConsole from "./DebugConsole";

interface TranslationState {
  status: 'idle' | 'translating' | 'quota_error' | 'retry' | 'complete' | 'error';
  translated: number;
  total: number;
  percentage: number;
  currentChunk?: number;
  totalChunks?: number;
  message: string;
  retryAfter?: number;
  result?: string;
}

function classNames(...classes: any[]) {
  return classes.filter(Boolean).join(" ");
}

const LANGUAGES = ['Brazilian Portuguese'];

const SrtForm: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [language, setLanguage] = useState<string>("Brazilian Portuguese");
  const [apiKey, setApiKey] = useState<string>('');
  const [dragging, setDragging] = useState<boolean>(false);
  const [translationState, setTranslationState] = useState<TranslationState>({
    status: 'idle',
    translated: 0,
    total: 0,
    percentage: 0,
    message: 'Ready to translate'
  });

  // Load API key from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedKey = localStorage.getItem('gemini_api_key');
      if (savedKey) {
        setApiKey(savedKey);
      }
    }
  }, []);

  // Save API key to localStorage when it changes
  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newKey = e.target.value;
    setApiKey(newKey);
    if (typeof window !== 'undefined') {
      localStorage.setItem('gemini_api_key', newKey);
    }
  };

  const readFileContents = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        resolve(content);
      };
      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };
      reader.readAsText(file);
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!file || !apiKey.trim()) {
      alert('Please select a file and enter your API key');
      return;
    }

    if (translationState.status === 'translating') {
      return; // Already translating
    }

    try {
      // Read file content
      const content = await readFileContents(file);
      
      // Reset translation state
      setTranslationState({
        status: 'translating',
        translated: 0,
        total: 0,
        percentage: 0,
        message: 'Starting translation...'
      });

      // Start Server-Sent Events connection
      const response = await fetch('/api', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content,
          language,
          apiKey
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('Failed to get response reader');
      }

      let finalResult = '';
      let buffer = ''; // Buffer to accumulate incomplete lines

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        // Decode the chunk and add to buffer
        buffer += decoder.decode(value, { stream: true });
        
        // Split by double newline to get complete SSE messages
        const messages = buffer.split('\n\n');
        
        // Keep the last incomplete message in buffer
        buffer = messages.pop() || '';
        
        // Process complete messages
        for (const message of messages) {
          const lines = message.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const jsonStr = line.slice(6).trim();
                if (jsonStr) { // Only parse non-empty JSON
                  const data = JSON.parse(jsonStr);
                  
                  if (data.type === 'result') {
                    finalResult = data.content;
                    // Update the translation state with the final result
                    setTranslationState(prev => ({
                      ...prev,
                      result: finalResult
                    }));
                  } else if (data.type && data.translated !== undefined) {
                    setTranslationState({
                      status: data.type,
                      translated: data.translated || 0,
                      total: data.total || 0,
                      percentage: data.percentage || 0,
                      currentChunk: data.currentChunk,
                      totalChunks: data.totalChunks,
                      message: data.message || '',
                      retryAfter: data.retryAfter
                    });
                  }
                }
              } catch (parseError) {
                // Silently skip malformed SSE data
              }
            }
          }
        }
      }

      // Process any remaining data in buffer
      if (buffer.trim()) {
        const lines = buffer.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const jsonStr = line.slice(6).trim();
              if (jsonStr) {
                const data = JSON.parse(jsonStr);
                if (data.type === 'result') {
                  finalResult = data.content;
                  setTranslationState(prev => ({
                    ...prev,
                    result: finalResult
                  }));
                }
              }
            } catch (parseError) {
              // Silently skip malformed final SSE data
            }
          }
        }
      }

      // If we have a final result, store it
      if (finalResult) {
        setTranslationState(prev => ({
          ...prev,
          result: finalResult
        }));
      }

    } catch (error) {
      setTranslationState({
        status: 'error',
        translated: 0,
        total: 0,
        percentage: 0,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  };

  const handleDownload = () => {
    if (!translationState.result || translationState.status !== 'complete') {
      alert('Translation result not available. Please wait for translation to complete.');
      return;
    }

    const blob = new Blob([translationState.result], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = file ? file.name.replace('.srt', '_translated.srt') : 'translated.srt';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      const fileName = droppedFile.name;
      const fileExtension = fileName.split(".").pop()?.toLowerCase();
      
      if (fileExtension === "srt") {
        setFile(droppedFile);
      } else {
        alert("Please select only .srt files");
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      const fileName = selectedFile.name;
      const fileExtension = fileName.split(".").pop()?.toLowerCase();
      
      if (fileExtension === "srt") {
        setFile(selectedFile);
      } else {
        alert("Please select only .srt files");
      }
    }
  };

  const canDownload = translationState.status === 'complete' && 
                    translationState.percentage === 100 && 
                    !!translationState.result;

  return (
    <div className="flex flex-col px-4 mt-6 w-full md:px-0">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Step 1: File Selection */}
        <div>
          <label
            htmlFor="srt-file"
            className="block font-bold py-4 md:pl-8 text-lg text-[#444444] dark:text-gray-200"
          >
            {file ? "✅" : "👉"} Step 1: Choose your SRT subtitle file
          </label>
          <div
            id="srt-file"
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={`w-full border-2 ${
              dragging ? "border-blue-300 dark:border-blue-500" : "border-transparent"
            } md:rounded-lg bg-[#EFEFEF] dark:bg-gray-800 px-12 relative`}
          >
            <div className="flex flex-col items-center justify-center py-12">
              <div className="text-6xl mb-4">📁</div>
              <p className="text-lg text-gray-600 dark:text-gray-300 mb-4">
                Drag and drop your .srt file here or click to select
              </p>
              <input
                type="file"
                accept=".srt"
                onChange={handleFileChange}
                className="hidden"
                id="file-input"
              />
              <label
                htmlFor="file-input"
                className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded cursor-pointer transition-colors"
              >
                Select File
              </label>
              {file && (
                <div className="mt-4 text-center">
                  <p className="text-green-600 dark:text-green-400 font-semibold">
                    ✅ {file.name}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Step 2: API Key */}
        <div>
          <label
            htmlFor="api-key"
            className="block font-bold py-4 md:pl-8 text-lg text-[#444444] dark:text-gray-200"
          >
            {apiKey ? "✅" : "👉"} Step 2: Enter your Google Gemini API Key
          </label>
          <div className="md:px-8">
            <input
              type="password"
              id="api-key"
              value={apiKey}
              onChange={handleApiKeyChange}
              placeholder="Enter your Gemini API key..."
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              Get your free API key from{' '}
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:text-blue-600 underline"
              >
                Google AI Studio
              </a>
            </p>
          </div>
        </div>

        {/* Step 3: Language Selection */}
        <div>
          <label
            htmlFor="language"
            className="block font-bold py-4 md:pl-8 text-lg text-[#444444] dark:text-gray-200"
          >
            {language ? "✅" : "👉"} Step 3: Select Target Language
          </label>
          <div className="md:px-8">
            <select
              id="language"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {LANGUAGES.map((lang) => (
                <option key={lang} value={lang}>
                  {lang}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Submit Button */}
        <div className="md:px-8">
          <button
            type="submit"
            disabled={!file || !apiKey.trim() || translationState.status === 'translating'}
            className={classNames(
              "w-full py-4 px-6 rounded-lg font-semibold text-lg transition-all duration-200",
              !file || !apiKey.trim() || translationState.status === 'translating'
                ? "bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                : "bg-blue-500 hover:bg-blue-600 text-white shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            )}
          >
            {translationState.status === 'translating' 
              ? '🔄 Translating...' 
              : '🚀 Start Translation'
            }
          </button>
        </div>
      </form>

      {/* Debug Console - Show when translation starts */}
      {translationState.status !== 'idle' && (
        <div className="mt-8">
          <DebugConsole
            translated={translationState.translated}
            total={translationState.total}
            percentage={translationState.percentage}
            currentChunk={translationState.currentChunk}
            totalChunks={translationState.totalChunks}
            message={translationState.message}
            status={translationState.status}
            retryAfter={translationState.retryAfter}
          />
        </div>
      )}

      {/* Download Button - Only show when 100% complete */}
      {canDownload && (
        <div className="mt-6 md:px-8">
          <button
            onClick={handleDownload}
            className="w-full py-4 px-6 rounded-lg font-semibold text-lg bg-green-500 hover:bg-green-600 text-white shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200"
          >
            ⬇️ Download Translated File
          </button>
        </div>
      )}
    </div>
  );
};

export default SrtForm;
