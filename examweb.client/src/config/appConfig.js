export const APP_NAME = 'Lớp học thầy Đạt'
export const AUTH_STORAGE_KEY = 'examWebAuth'
export const THEME_STORAGE_KEY = 'examWebTheme'
export const ADMIN_ROLE = 'Admin'
export const MAX_PDF_FILE_SIZE = 50 * 1024 * 1024

export const DEFAULT_API_BASE_URL = 'https://examweb-api-dat-d5fkfybja3buccdz.southeastasia-01.azurewebsites.net'
export const DEFAULT_RTC_ICE_SERVERS = [
    { urls: ['stun:stun.l.google.com:19302', 'stun:global.stun.twilio.com:3478'] },
]
export const DEFAULT_RTC_ICE_CANDIDATE_BATCH_MS = 80
export const DEFAULT_RTC_ICE_DISCONNECTED_RESTART_MS = 2500
export const DEFAULT_RTC_ICE_FAILED_RESTART_MS = 300
export const DEFAULT_RTC_ICE_RESTART_MAX_ATTEMPTS = 3

export function normalizeBaseUrl(value) {
    const rawValue = String(value || '').trim()
    const fallback = window.location.origin
    const baseValue = (rawValue || fallback).replace(/\/+$/, '')

    try {
        const url = new URL(baseValue)
        const isLocalHost = ['localhost', '127.0.0.1', '::1'].includes(url.hostname)
        if (url.protocol === 'http:' && !isLocalHost) {
            url.protocol = 'https:'
        }
        return url.toString().replace(/\/+$/, '')
    } catch {
        return baseValue
    }
}

function parseList(value) {
    if (!value) return []
    if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean)
    return String(value)
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
}

function normalizeIceServer(server) {
    if (!server || typeof server !== 'object') return null

    const urls = Array.isArray(server.urls)
        ? server.urls.map((url) => String(url || '').trim()).filter(Boolean)
        : String(server.urls || '').trim()

    const urlList = Array.isArray(urls) ? urls : [urls].filter(Boolean)
    if (urlList.length === 0) return null

    const hasTurnUrl = urlList.some((url) => url.startsWith('turn:') || url.startsWith('turns:'))
    if (hasTurnUrl && (!server.username || !server.credential)) {
        return null
    }

    return {
        ...server,
        urls: Array.isArray(server.urls) ? urlList : urlList[0],
    }
}

export function parseRtcIceServers(value, fallback = DEFAULT_RTC_ICE_SERVERS) {
    if (!value) return fallback

    try {
        const parsed = JSON.parse(value)
        if (!Array.isArray(parsed)) return fallback
        const servers = parsed.map(normalizeIceServer).filter(Boolean)
        return servers.length > 0 ? servers : fallback
    } catch {
        return fallback
    }
}

export function buildRtcIceServers({
    explicitIceServers,
    turnCredential,
    turnUrls,
    turnUsername,
} = {}) {
    if (explicitIceServers) {
        return parseRtcIceServers(explicitIceServers)
    }

    const urls = parseList(turnUrls)
    const username = String(turnUsername || '').trim()
    const credential = String(turnCredential || '').trim()
    if (urls.length === 0 || !username || !credential) {
        return DEFAULT_RTC_ICE_SERVERS
    }

    return [
        ...DEFAULT_RTC_ICE_SERVERS,
        {
            urls,
            username,
            credential,
        },
    ]
}

export function parseRtcIceTransportPolicy(value) {
    const policy = String(value || '').trim().toLowerCase()
    return policy === 'relay' ? 'relay' : 'all'
}

export function parsePositiveInteger(value, fallback) {
    const parsed = Number.parseInt(value, 10)
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

export const API_BASE_URL = normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL)
export const RTC_ICE_SERVERS = buildRtcIceServers({
    explicitIceServers: import.meta.env.VITE_RTC_ICE_SERVERS,
    turnCredential: import.meta.env.VITE_RTC_TURN_CREDENTIAL,
    turnUrls: import.meta.env.VITE_RTC_TURN_URLS,
    turnUsername: import.meta.env.VITE_RTC_TURN_USERNAME,
})
export const RTC_ICE_TRANSPORT_POLICY = parseRtcIceTransportPolicy(import.meta.env.VITE_RTC_ICE_TRANSPORT_POLICY)
export const RTC_ICE_CANDIDATE_BATCH_MS = parsePositiveInteger(
    import.meta.env.VITE_RTC_ICE_CANDIDATE_BATCH_MS,
    DEFAULT_RTC_ICE_CANDIDATE_BATCH_MS,
)
export const RTC_ICE_DISCONNECTED_RESTART_MS = parsePositiveInteger(
    import.meta.env.VITE_RTC_ICE_DISCONNECTED_RESTART_MS,
    DEFAULT_RTC_ICE_DISCONNECTED_RESTART_MS,
)
export const RTC_ICE_FAILED_RESTART_MS = parsePositiveInteger(
    import.meta.env.VITE_RTC_ICE_FAILED_RESTART_MS,
    DEFAULT_RTC_ICE_FAILED_RESTART_MS,
)
export const RTC_ICE_RESTART_MAX_ATTEMPTS = parsePositiveInteger(
    import.meta.env.VITE_RTC_ICE_RESTART_MAX_ATTEMPTS,
    DEFAULT_RTC_ICE_RESTART_MAX_ATTEMPTS,
)
export const RTC_CONFIGURATION = {
    iceServers: RTC_ICE_SERVERS,
    iceTransportPolicy: RTC_ICE_TRANSPORT_POLICY,
    bundlePolicy: 'max-bundle',
}
