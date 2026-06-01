export const APP_NAME = 'Lớp học thầy Đạt'
export const AUTH_STORAGE_KEY = 'examWebAuth'
export const THEME_STORAGE_KEY = 'examWebTheme'
export const ADMIN_ROLE = 'Admin'
export const MAX_PDF_FILE_SIZE = 12 * 1024 * 1024

export const DEFAULT_API_BASE_URL = 'https://examweb-api-dat-d5fkfybja3buccdz.southeastasia-01.azurewebsites.net'
export const DEFAULT_RTC_ICE_SERVERS = [
    { urls: ['stun:stun.l.google.com:19302', 'stun:global.stun.twilio.com:3478'] },
]

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

export function parseRtcIceServers(value) {
    if (!value) return DEFAULT_RTC_ICE_SERVERS

    try {
        const parsed = JSON.parse(value)
        return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_RTC_ICE_SERVERS
    } catch {
        return DEFAULT_RTC_ICE_SERVERS
    }
}

export const API_BASE_URL = normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL)
export const RTC_ICE_SERVERS = parseRtcIceServers(import.meta.env.VITE_RTC_ICE_SERVERS)
