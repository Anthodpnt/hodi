import i18next from 'i18next'
import { I18N_OPTIONS, type Language } from '../shared/i18n.ts'

// The few texts the server writes itself (push notifications), from the same locale files as the app, in the
// language of the profile they go to.
const instance = i18next.createInstance()
void instance.init({ ...I18N_OPTIONS, lng: 'fr', initAsync: false })

export const textsIn = (language: Language) => instance.getFixedT(language)
