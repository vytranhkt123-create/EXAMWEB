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
            setLocalError('Nhập tên đăng nhập và mật khẩu.')
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
                    <span>Sử dụng tài khoản do thầy giáo cấp.</span>
                </header>

                {(visibleError || (touched && !canSubmit && !loading)) && (
                    <div className="login-inline-error" role="alert">
                        {visibleError || 'Nhập đầy đủ thông tin để tiếp tục.'}
                    </div>
                )}

                <form className="login-form" onSubmit={handleSubmit}>
                    <label className="form-row" htmlFor="login-email">
                        <span>Tên đăng nhập hoặc email</span>
                        <input
                            autoComplete="username"
                            id="login-email"
                            onChange={(event) => updateCredential('email', event.target.value)}
                            placeholder="Nhập tài khoản"
                            type="text"
                            value={credentials.email}
                        />
                    </label>
                    <label className="form-row" htmlFor="login-password">
                        <span>Mật khẩu</span>
                        <input
                            autoComplete="current-password"
                            id="login-password"
                            onChange={(event) => updateCredential('password', event.target.value)}
                            placeholder="Nhập mật khẩu"
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
                                Đang đăng nhập
                            </>
                        ) : (
                            'Đăng nhập'
                        )}
                    </button>
                </form>

                <p className="login-form-footer">
                    Liên hệ thầy giáo nếu tài khoản của bạn bị khóa hoặc chưa được tạo.
                </p>
            </section>
        </main>
    )
}
