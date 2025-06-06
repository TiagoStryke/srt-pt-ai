'use client';

import { useEffect, useState } from "react";

export default function ThemeToggle() {
  // Estado para controlar o tema atual
  const [darkMode, setDarkMode] = useState<boolean>(false);

  // Efeito para inicializar o tema baseado na preferência do usuário
  useEffect(() => {
    // Verifica se há preferência salva no localStorage
    const savedTheme = localStorage.getItem('theme');
    
    // Verifica preferência do sistema
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    // Inicializa com preferência salva, se não existir usa a preferência do sistema
    const initialDarkMode = savedTheme 
      ? savedTheme === 'dark' 
      : prefersDark;
    
    setDarkMode(initialDarkMode);
    
    // Aplica o tema inicialmente
    applyTheme(initialDarkMode);
  }, []);

  // Função para aplicar o tema
  const applyTheme = (isDark: boolean) => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.setAttribute('data-theme', 'light');
    }
  };

  // Função para alternar o tema
  const toggleTheme = () => {
    const newDarkMode = !darkMode;
    setDarkMode(newDarkMode);
    
    // Salva a preferência do usuário
    localStorage.setItem('theme', newDarkMode ? 'dark' : 'light');
    
    // Aplica o tema
    applyTheme(newDarkMode);
  };

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-full bg-white dark:bg-gray-800 transition-colors duration-300 shadow hover:shadow-md border border-gray-200 dark:border-gray-700 flex items-center justify-center"
      aria-label={darkMode ? "Mudar para tema claro" : "Mudar para tema escuro"}
      title={darkMode ? "Mudar para tema claro" : "Mudar para tema escuro"}
    >
      {darkMode ? (
        // Ícone sol - mais elegante
        <span className="text-lg text-amber-400" role="img" aria-label="Sol">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="5"></circle>
            <line x1="12" y1="1" x2="12" y2="3"></line>
            <line x1="12" y1="21" x2="12" y2="23"></line>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
            <line x1="1" y1="12" x2="3" y2="12"></line>
            <line x1="21" y1="12" x2="23" y2="12"></line>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
          </svg>
        </span>
      ) : (
        // Ícone lua - mais elegante
        <span className="text-lg text-indigo-400" role="img" aria-label="Lua">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
          </svg>
        </span>
      )}
    </button>
  );
}
