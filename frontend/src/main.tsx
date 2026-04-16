import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { ThemeProvider } from './contexts/ThemeContext'
import { EntityProvider } from './contexts/EntityContext'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <EntityProvider>
        <App />
      </EntityProvider>
    </ThemeProvider>
  </React.StrictMode>,
)
