import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import '@fontsource-variable/source-serif-4/opsz.css'
import '@fontsource-variable/source-serif-4/opsz-italic.css'
import '@fontsource-variable/inter'
import '@fontsource-variable/jetbrains-mono'
import './index.css'
import App from './App'
import { KatexMacrosProvider } from './lib/katexMacros'
import { initTheme } from './lib/theme'

initTheme()

// a page opened before a new version was published asks for files that are gone: one reload brings the new version
window.addEventListener('vite:preloadError', (e) => {
  try {
    if (sessionStorage.getItem('iepg-reloaded') === '1') return
    sessionStorage.setItem('iepg-reloaded', '1')
  } catch {
    return
  }
  e.preventDefault()
  window.location.reload()
})

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <KatexMacrosProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </KatexMacrosProvider>
    </QueryClientProvider>
  </StrictMode>,
)
