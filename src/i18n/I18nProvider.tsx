import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { I18nContext, type I18nContextValue } from './context'
import { normalizeLanguage } from './languages'
import { en, translations } from './translations'

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState(() => {
    const requested = new URLSearchParams(window.location.search).get('lang')
    if (requested) return normalizeLanguage(requested)
    const saved = localStorage.getItem('flashcards-pwa-language')
    return normalizeLanguage(saved || 'en')
  })

  useEffect(() => {
    localStorage.setItem('flashcards-pwa-language', language)
    document.documentElement.lang = language
    document.documentElement.dir = ['ar', 'ur', 'fa'].includes(language) ? 'rtl' : 'ltr'
  }, [language])

  const value = useMemo<I18nContextValue>(() => {
    const dictionary = translations[language] ?? en
    return {
      language,
      setLanguage: (next) => setLanguageState(normalizeLanguage(next)),
      t: (key, ...args) => {
        const template = (dictionary[key] ?? en[key] ?? key).replace(/\\n/g, '\n').replace(/¥n/g, '\n')
        return args.reduce<string>((text, arg, index) => text.replaceAll(`{${index}}`, String(arg)), template)
      },
    }
  }, [language])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}
