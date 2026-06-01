import { useState } from 'react'
import { APP_NAME } from '../config/appConfig'

export function LoginView({ error, loading, onLogin }) {
    const [credentials, setCredentials] = useState({ email: '', password: '' })
    const [touched, setTouched] = useState(false)
    const [localError, setLocalError] = useState('')
    const [dismissedError, setDismissedError] = useState('')
    const visibleError = localError || (error && error !== dismissedError ? error : '')

    function updateCredential(field, value) {
        setCredentials((current) => ({ ...current, [field]: value }))
        setLocalError('')
        setDismissedError(error || '')
    }

    function handleSubmit(event) {
        event.preventDefault()
        setTouched(true)

        if (!credentials.email.trim() || !credentials.password) {
            setLocalError('Enter your username and password.')
            return
        }

        onLogin(event, {
            username: credentials.email.trim(),
            password: credentials.password,
        })
        setDismissedError('')
    }

    const canSubmit =
        credentials.email.trim().length > 0 && credentials.password.length > 0 && !loading

    return (
        <main className="login-page modern-login">
            <section className="login-ambient" aria-hidden="true">
                <span className="login-orbit orbit-a" />
                <span className="login-orbit orbit-b" />
                <span className="login-orbit orbit-c" />
                <div className="login-preview-shell">
                    <div className="login-preview-topbar">
                        <span />
                        <span />
                        <span />
                    </div>
                    <div className="login-preview-grid">
                        <div className="login-preview-tile large" />
                        <div className="login-preview-tile warning" />
                        <div className="login-preview-tile success" />
                        <div className="login-preview-tile wide" />
                    </div>
                </div>
            </section>

            <section className="login-glass-panel" aria-label="Sign in">
                <div className="login-wordmark">
                    <span className="login-logo-mark">E</span>
                    <strong>{APP_NAME}</strong>
                </div>

                <header className="login-form-header">
                    <p className="login-brand-eyebrow">Secure exam workspace</p>
                    <h1>Sign in to continue</h1>
                    <span>Use the account issued by your administrator.</span>
                </header>

                {(visibleError || (touched && !canSubmit && !loading)) && (
                    <div className="login-inline-error" role="alert">
                        {visibleError || 'Enter both fields to continue.'}
                    </div>
                )}

                <form className="login-form" onSubmit={handleSubmit}>
                    <label className="form-row" htmlFor="login-email">
                        <span>Username or email</span>
                        <input
                            autoComplete="username"
                            id="login-email"
                            onChange={(event) => updateCredential('email', event.target.value)}
                            placeholder="admin or student@example.com"
                            type="text"
                            value={credentials.email}
                        />
                    </label>
                    <label className="form-row" htmlFor="login-password">
                        <span>Password</span>
                        <input
                            autoComplete="current-password"
                            id="login-password"
                            onChange={(event) => updateCredential('password', event.target.value)}
                            placeholder="Enter password"
                            type="password"
                            value={credentials.password}
                        />
                    </label>
                    <button
                        className="primary-button full-width login-submit"
                        disabled={!canSubmit}
                        type="submit"
                    >
                        {loading ? (
                            <>
                                <span className="login-spinner" aria-hidden="true" />
                                Signing in
                            </>
                        ) : (
                            'Sign in'
                        )}
                    </button>
                </form>

                <p className="login-form-footer">
                    Contact your class administrator if your account is locked or missing.
                </p>
            </section>
        </main>
    )
}
