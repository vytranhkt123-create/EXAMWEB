import { useState } from 'react'
import { APP_NAME } from '../config/appConfig'

function LoginIllustration() {
    return (
        <svg
            aria-hidden="true"
            className="login-illustration"
            fill="none"
            viewBox="0 0 480 360"
            xmlns="http://www.w3.org/2000/svg"
        >
            <rect fill="rgba(255,255,255,0.12)" height="200" rx="16" width="280" x="100" y="40" />
            <rect fill="rgba(255,255,255,0.22)" height="12" rx="6" width="120" x="130" y="68" />
            <rect fill="rgba(255,255,255,0.16)" height="8" rx="4" width="180" x="130" y="92" />
            <rect fill="rgba(255,255,255,0.16)" height="8" rx="4" width="150" x="130" y="110" />
            <circle cx="156" cy="150" fill="rgba(52,211,153,0.9)" r="10" />
            <rect fill="rgba(255,255,255,0.2)" height="8" rx="4" width="130" x="176" y="144" />
            <circle cx="156" cy="178" fill="rgba(52,211,153,0.9)" r="10" />
            <rect fill="rgba(255,255,255,0.2)" height="8" rx="4" width="110" x="176" y="172" />
            <circle cx="156" cy="206" fill="rgba(255,255,255,0.35)" r="10" />
            <rect fill="rgba(255,255,255,0.14)" height="8" rx="4" width="140" x="176" y="200" />
            <rect fill="rgba(245,158,11,0.85)" height="56" rx="12" width="88" x="292" y="168" />
            <path
                d="M316 196h40M336 176v40"
                stroke="white"
                strokeLinecap="round"
                strokeWidth="4"
            />
            <rect fill="rgba(37,99,235,0.75)" height="72" rx="10" width="56" x="56" y="228" />
            <rect fill="rgba(255,255,255,0.35)" height="6" rx="3" width="32" x="68" y="244" />
            <rect fill="rgba(255,255,255,0.35)" height="6" rx="3" width="24" x="68" y="258" />
            <rect fill="rgba(255,255,255,0.35)" height="6" rx="3" width="28" x="68" y="272" />
            <circle cx="400" cy="88" fill="rgba(251,191,36,0.9)" r="28" />
            <path
                d="M388 88l8 8 16-16"
                stroke="#1e3a5f"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="3"
            />
        </svg>
    )
}

export function LoginView({ error, loading, onLogin }) {
    const [credentials, setCredentials] = useState({ email: '', password: '' })

    function updateCredential(field, value) {
        setCredentials((current) => ({ ...current, [field]: value }))
    }

    function handleSubmit(event) {
        onLogin(event, {
            username: credentials.email.trim(),
            password: credentials.password,
        })
    }

    function handleForgotPassword(event) {
        event.preventDefault()
    }

    const canSubmit =
        credentials.email.trim().length > 0 && credentials.password.length > 0 && !loading

    return (
        <main className="login-page">
            <section className="login-brand">
                <div className="login-brand-inner">
                    <div className="login-logo-mark" aria-hidden="true">
                        <span>E</span>
                    </div>
                    <p className="login-brand-eyebrow">Nền tảng thi &amp; học trực tuyến</p>
                    <h1 className="login-brand-title">{APP_NAME}</h1>
                    <p className="login-brand-lead">
                        Làm bài thi an toàn, theo dõi tiến độ và học tập trực tuyến trên một hệ thống thống nhất.
                    </p>
                    <LoginIllustration />
                    <ul className="login-feature-list">
                        <li>
                            <strong>Thi trực tuyến</strong>
                            <span>Làm bài có giới hạn thời gian, chấm điểm tự động</span>
                        </li>
                        <li>
                            <strong>Lớp học số</strong>
                            <span>Tài liệu, bảng trắng và học nhóm realtime</span>
                        </li>
                        <li>
                            <strong>Quản lý tập trung</strong>
                            <span>Admin giao đề, học viên chỉ thấy nội dung được phép</span>
                        </li>
                    </ul>
                </div>
            </section>

            <section className="login-form-panel" aria-label="Đăng nhập">
                <div className="login-form-card">
                    <header className="login-form-header">
                        <h2>Chào mừng trở lại</h2>
                        <p>Đăng nhập bằng email và mật khẩu được cấp.</p>
                    </header>

                    {error && (
                        <div className="alert login-alert" role="alert">
                            {error}
                        </div>
                    )}

                    <form className="login-form" onSubmit={handleSubmit}>
                        <div className="form-row">
                            <label htmlFor="login-email">Email</label>
                            <input
                                autoComplete="username"
                                id="login-email"
                                onChange={(event) => updateCredential('email', event.target.value)}
                                placeholder="email@example.com hoặc tài khoản"
                                type="text"
                                value={credentials.email}
                            />
                        </div>
                        <div className="form-row">
                            <div className="login-password-row">
                                <label htmlFor="login-password">Mật khẩu</label>
                                <a
                                    className="login-forgot-link"
                                    href="#"
                                    onClick={handleForgotPassword}
                                >
                                    Quên mật khẩu?
                                </a>
                            </div>
                            <input
                                autoComplete="current-password"
                                id="login-password"
                                onChange={(event) => updateCredential('password', event.target.value)}
                                placeholder="Nhập mật khẩu"
                                type="password"
                                value={credentials.password}
                            />
                        </div>
                        <button
                            className="primary-button full-width login-submit"
                            disabled={!canSubmit}
                            type="submit"
                        >
                            {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
                        </button>
                    </form>

                    <p className="login-form-footer">
                        Cần tài khoản? Liên hệ quản trị viên lớp học để được cấp quyền truy cập.
                    </p>
                </div>
            </section>
        </main>
    )
}
