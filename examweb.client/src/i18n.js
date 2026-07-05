import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import HttpBackend from 'i18next-http-backend'
import { initReactI18next } from 'react-i18next'

i18n
    .use(HttpBackend)
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        backend: {
            loadPath: '/locales/{{lng}}/{{ns}}.json',
        },
        debug: false,
        detection: {
            caches: ['localStorage'],
            order: ['localStorage', 'navigator', 'htmlTag'],
        },
        fallbackLng: 'vi',
        interpolation: {
            escapeValue: false,
        },
        load: 'languageOnly',
        react: {
            useSuspense: false,
        },
        supportedLngs: ['vi', 'en'],
    })

export default i18n
