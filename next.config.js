/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Utilizar API key do ambiente quando disponível
  env: {
    // Não incluir chaves de API diretamente no código
    // Usar arquivo .env.local para definir OPENAI_API_KEY ou GEMINI_API_KEY
    // Adicionar variável que controla o modo de build para que o código cliente saiba como operar
    NEXT_BUILD_MODE: process.env.NEXT_BUILD_MODE || 'dynamic'
  },
  // Configuração condicional para exportação estática baseada no ambiente
  ...(process.env.NEXT_BUILD_MODE === 'static' ? {
    output: 'export',
    distDir: 'out',
    // Desabilitar caracteres especiais na exportação estática para evitar problemas de rota
    trailingSlash: true,
  } : {}),
  // Desativar o image optimizer para permitir exportação estática
  images: {
    unoptimized: true
  },
  webpack(config) {
    config.experiments = {
      asyncWebAssembly: true,
      layers: true,
    };

    return config;
  },
};

module.exports = nextConfig;
