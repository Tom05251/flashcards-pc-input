import { createContext } from 'react'

export interface I18nContextValue {
  language: string
  setLanguage: (language: string) => void
  t: (key: string, ...args: Array<string | number>) => string
}

export const I18nContext = createContext<I18nContextValue | null>(null)
