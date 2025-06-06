import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './custom.css'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Tradutor de Legendas para Português Brasileiro',
  description: 'Ferramenta para traduzir legendas SRT para português brasileiro utilizando inteligência artificial',
  icons: {
    icon: '/favicon.ico',
    apple: '/icon.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="apple-touch-icon" href="/icon.png" />
        <meta name="theme-color" content="#444444" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var savedTheme = localStorage.getItem('theme');
                  var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  var initialTheme = savedTheme ? savedTheme : (prefersDark ? 'dark' : 'light');
                  
                  if (initialTheme === 'dark') {
                    document.documentElement.classList.add('dark');
                    document.documentElement.setAttribute('data-theme', 'dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                    document.documentElement.setAttribute('data-theme', 'light');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className={`${inter.className} bg-white dark:bg-dark text-gray-900 dark:text-dark transition-colors duration-200`}>
        {children}
      </body>
    </html>
  )
}
