import en from './locales/en.json' with { type: 'json' }
import fr from './locales/fr.json' with { type: 'json' }

// The interface's languages and texts, shared by the web app (react-i18next) and the server (push notifications,
// with i18next alone). Only the interface: articles stay in their own language. French is the reference: every key
// of fr.json is in en.json (a test checks it), and French says "tu".

// The first is the default, for an install from before languages existed.
export const LANGUAGES = ['fr', 'en'] as const
export type Language = (typeof LANGUAGES)[number]

export const isLanguage = (value: unknown): value is Language => LANGUAGES.includes(value as Language)

export const RESOURCES = { fr: { translation: fr }, en: { translation: en } } as const

// The options both sides start i18next with.
export const I18N_OPTIONS = {
  resources: RESOURCES,
  fallbackLng: 'fr',
  supportedLngs: LANGUAGES,
  // React escapes, and the server's texts go to notifications, not to HTML.
  interpolation: { escapeValue: false },
  returnNull: false
} as const
