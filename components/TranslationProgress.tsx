import React from 'react';

interface TranslationProgressProps {
  fileName: string;
  translationProgress: number;
  onCancel: () => void;
}

const TranslationProgress: React.FC<TranslationProgressProps> = ({ 
  fileName, 
  translationProgress,
  onCancel
}) => {
  return (
    <div className="w-full bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 mb-4">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-semibold text-gray-800 dark:text-gray-200 truncate max-w-xs">
          {fileName}
        </h3>
        <span className="text-blue-600 dark:text-blue-400 font-medium">{translationProgress}%</span>
      </div>
      
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
        <div 
          className="bg-blue-600 h-2.5 rounded-full transition-all duration-500 ease-out" 
          style={{ 
            width: `${translationProgress}%`,
            backgroundImage: translationProgress < 100 && translationProgress > 1 ? 
              'linear-gradient(45deg, rgba(59, 130, 246, 0.8) 25%, rgba(37, 99, 235, 1) 25%, rgba(37, 99, 235, 1) 50%, rgba(59, 130, 246, 0.8) 50%, rgba(59, 130, 246, 0.8) 75%, rgba(37, 99, 235, 1) 75%, rgba(37, 99, 235, 1) 100%)' : 
              '',
            backgroundSize: '1rem 1rem',
            animation: translationProgress < 100 && translationProgress > 1 ? 'progress-bar-stripes 1s linear infinite' : 'none',
          }}
        ></div>
      </div>
        
      <div className="flex justify-between mt-3">
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {translationProgress < 100 
            ? translationProgress >= 98 
              ? 'Finalizando processamento...' 
              : translationProgress > 1 && translationProgress < 10
                ? 'Iniciando tradução...'
                : `Traduzindo... (${translationProgress}% concluído)`
            : 'Concluído!'}
        </span>
        
        {translationProgress < 100 && translationProgress < 98 ? (
          <button 
            onClick={onCancel}
            className="text-sm text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 hover:underline"
          >
            Cancelar
          </button>
        ) : (
          <span className="text-sm text-green-600 dark:text-green-400">
            {translationProgress >= 100 ? 'Pronto para download!' : 'Finalizando...'}
          </span>
        )}
      </div>
    </div>
  );
 
};

export default TranslationProgress;
