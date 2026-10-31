import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { I18nContext, type I18nContextValue } from './context'
import { normalizeLanguage } from './languages'
import { en, translations } from './translations'
import { getPreference, setPreference } from '../storage/preferences'

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState(() => {
    const requested = new URLSearchParams(window.location.search).get('lang')
    if (requested) return normalizeLanguage(requested)
    const saved = getPreference('flashcards-pwa-language')
    return normalizeLanguage(saved || 'en')
  })

  useEffect(() => {
    setPreference('flashcards-pwa-language', language)
    document.documentElement.lang = language
    document.documentElement.dir = ['ar', 'ur', 'fa'].includes(language) ? 'rtl' : 'ltr'
    const manifest = document.querySelector<HTMLLinkElement>('link[rel="manifest"]')
    if (manifest && import.meta.env.PROD) manifest.href = `${import.meta.env.BASE_URL}manifest-${language}.webmanifest`
  }, [language])

  const value = useMemo<I18nContextValue>(() => {
    const dictionary = translations[language] ?? en
    return {
      language,
      setLanguage: (next) => setLanguageState(normalizeLanguage(next)),
      t: (key, ...args) => {
        const template = (dictionary[key] ?? en[key] ?? key).replace(/\\n/g, '\n').replace(/¥n/g, '\n')
        return template.replace(/\{(\d+)\}/g, (token, index: string) => Number(index) < args.length ? String(args[Number(index)]) : token)
      },
    }
  }, [language])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}
