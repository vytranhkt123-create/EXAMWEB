import { useTranslation } from 'react-i18next'
import i18n from '../i18n'

const languages = [
    { code: 'vi', label: 'VI' },
    { code: 'en', label: 'EN' },
]

export function LanguageSwitcher() {
    const { i18n: instance } = useTranslation()
    const currentLanguage = instance.resolvedLanguage || instance.language || 'vi'

    return (
        <div className="language-switcher" aria-label="Language switcher">
            {languages.map((language) => (
                <button
                    className={currentLanguage.startsWith(language.code) ? 'ghost-button active' : 'ghost-button'}
                    key={language.code}
                    onClick={() => i18n.changeLanguage(language.code)}
                    type="button"
                >
                    {language.label}
                </button>
            ))}
        </div>
    )
}
