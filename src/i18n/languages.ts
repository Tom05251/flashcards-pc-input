export interface SupportedLanguage {
  code: string
  displayName: string
  beta?: boolean
}

export const supportedLanguages: SupportedLanguage[] = [
  { code: 'en', displayName: 'English' },
  { code: 'ja', displayName: '日本語' },
  { code: 'hi', displayName: 'हिन्दी', beta: true },
  { code: 'bn', displayName: 'বাংলা', beta: true },
  { code: 'ta', displayName: 'தமிழ்', beta: true },
  { code: 'id', displayName: 'Bahasa Indonesia', beta: true },
  { code: 'fr', displayName: 'Français', beta: true },
  { code: 'de', displayName: 'Deutsch', beta: true },
  { code: 'es', displayName: 'Español', beta: true },
  { code: 'ko', displayName: '한국어', beta: true },
  { code: 'th', displayName: 'ไทย', beta: true },
  { code: 'vi', displayName: 'Tiếng Việt', beta: true },
  { code: 'zh-Hans', displayName: '简体中文', beta: true },
  { code: 'ar', displayName: 'العربية', beta: true },
  { code: 'pt', displayName: 'Português', beta: true },
  { code: 'ru', displayName: 'Русский', beta: true },
  { code: 'zh-Hant', displayName: '繁體中文', beta: true },
  { code: 'it', displayName: 'Italiano', beta: true },
  { code: 'tr', displayName: 'Türkçe', beta: true },
  { code: 'ur', displayName: 'اردو', beta: true },
  { code: 'fa', displayName: 'فارسی', beta: true },
  { code: 'nl', displayName: 'Nederlands', beta: true },
  { code: 'pl', displayName: 'Polski', beta: true },
  { code: 'uk', displayName: 'Українська', beta: true },
  { code: 'ro', displayName: 'Română', beta: true },
  { code: 'cs', displayName: 'Čeština', beta: true },
  { code: 'sv', displayName: 'Svenska', beta: true },
  { code: 'el', displayName: 'Ελληνικά', beta: true },
  { code: 'hu', displayName: 'Magyar', beta: true },
  { code: 'da', displayName: 'Dansk', beta: true },
  { code: 'fi', displayName: 'Suomi', beta: true },
  { code: 'no', displayName: 'Norsk', beta: true },
  { code: 'bg', displayName: 'Български', beta: true },
  { code: 'hr', displayName: 'Hrvatski', beta: true },
  { code: 'sk', displayName: 'Slovenčina', beta: true },
  { code: 'sl', displayName: 'Slovenščina', beta: true },
  { code: 'lt', displayName: 'Lietuvių', beta: true },
  { code: 'lv', displayName: 'Latviešu', beta: true },
  { code: 'et', displayName: 'Eesti', beta: true },
]

export function normalizeLanguage(code?: string | null): string {
  if (!code) return 'en'
  const normalized = code.replace('_', '-').toLowerCase()
  if (normalized === 'zh-hans' || normalized.startsWith('zh-cn') || normalized.startsWith('zh-sg')) return 'zh-Hans'
  if (normalized === 'zh-hant' || normalized.startsWith('zh-tw') || normalized.startsWith('zh-hk') || normalized.startsWith('zh-mo')) return 'zh-Hant'
  if (normalized.startsWith('zh')) return 'zh-Hans'
  if (normalized.startsWith('nb') || normalized.startsWith('nn')) return 'no'
  const base = normalized.split('-')[0]
  return supportedLanguages.some((language) => language.code.toLowerCase() === base) ? base : 'en'
}

export function suggestedLanguage(): string {
  for (const code of navigator.languages ?? [navigator.language]) {
    const normalized = normalizeLanguage(code)
    if (normalized !== 'en') return normalized
  }
  return normalizeLanguage(navigator.language)
}
