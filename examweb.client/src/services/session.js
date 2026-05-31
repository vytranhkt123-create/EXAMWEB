import { ADMIN_ROLE, AUTH_STORAGE_KEY } from '../config/appConfig'

export function isSessionValid(session) {
    if (!session?.accessToken || !session?.role) return false
    if (!session.expiredAt) return true
    const expiresAt = new Date(session.expiredAt).getTime()
    return Number.isFinite(expiresAt) ? expiresAt > Date.now() : true
}

export function getStoredSession() {
    try {
        const rawSession = localStorage.getItem(AUTH_STORAGE_KEY)
        if (!rawSession) return null
        const session = JSON.parse(rawSession)
        if (isSessionValid(session)) return session
    } catch {
        // Ignore invalid local storage data and fall back to the login screen.
    }

    localStorage.removeItem(AUTH_STORAGE_KEY)
    return null
}

export function saveSession(session) {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session))
}

export function clearSession() {
    localStorage.removeItem(AUTH_STORAGE_KEY)
}

export function getModeForSession(session) {
    return session?.role === ADMIN_ROLE ? 'admin' : 'student'
}

export function getPathForMode(mode) {
    return mode === 'admin' ? '/admin' : '/'
}
