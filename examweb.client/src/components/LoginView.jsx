import { useState } from 'react'
import { APP_NAME } from '../config/appConfig'

export function LoginView({ error, loading, onLogin }) {
    const [credentials, setCredentials] = useState({ username: '', password: '' })

    function updateCredential(field, value) {
        setCredentials((current) => ({ ...current, [field]: value }))
    }

    return (
        <main className="login-layout">
            <section className="login-hero">
                <p className="eyebrow">ExamWeb</p>
                <h1>{APP_NAME}</h1>
                <p>
                    Đăng nhập bằng tài khoản được cấp. Admin sẽ vào khu quản lý đề thi, học viên chỉ thấy màn hình làm bài.
                </p>
                <div className="role-preview-list" aria-label="Phân quyền tài khoản">
                    <div>
                        <span>Admin</span>
                        <strong>Quản lý đề, câu hỏi và lịch sử nộp bài</strong>
                    </div>
                    <div>
                        <span>Học viên</span>
                        <strong>Chỉ chọn đề và làm bài được giao</strong>
                    </div>
                </div>
            </section>

            <section className="login-panel" aria-label="Đăng nhập">
                <div className="login-panel-head">
                    <span className="login-badge">Bảo mật lớp học</span>
                    <h2>Đăng nhập</h2>
                </div>

                {error && <div className="alert login-alert">{error}</div>}

                <form className="login-form" onSubmit={(event) => onLogin(event, credentials)}>
                    <div className="form-row">
                        <label htmlFor="login-username">Tài khoản</label>
                        <input
                            autoComplete="username"
                            id="login-username"
                            onChange={(event) => updateCredential('username', event.target.value)}
                            placeholder="admin hoặc tài khoản học sinh"
                            value={credentials.username}
                        />
                    </div>
                    <div className="form-row">
                        <label htmlFor="login-password">Mật khẩu</label>
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
                        disabled={loading || !credentials.username.trim() || !credentials.password}
                        type="submit"
                    >
                        {loading ? 'Đang đăng nhập...' : 'Vào lớp học'}
                    </button>
                </form>
            </section>
        </main>
    )
}
