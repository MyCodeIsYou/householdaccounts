import { createContext, useContext, useEffect, useState } from 'react'

export type ThemeName = 'watercolor' | 'toss' | 'shinhan' | 'cyber' | 'log'

interface ThemeContextValue {
  theme: ThemeName
  setTheme: (theme: ThemeName) => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

const STORAGE_KEY = 'app-theme'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>(() => {
    if (typeof window === 'undefined') return 'watercolor'
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'linux') return 'log'
    if (stored === 'toss' || stored === 'shinhan' || stored === 'watercolor' || stored === 'cyber' || stored === 'log') {
      return stored
    }
    return 'watercolor'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    if (localStorage.getItem(STORAGE_KEY) === 'linux') {
      localStorage.setItem(STORAGE_KEY, 'log')
    }
  }, [theme])

  const setTheme = (newTheme: ThemeName) => {
    setThemeState(newTheme)
    localStorage.setItem(STORAGE_KEY, newTheme)
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
