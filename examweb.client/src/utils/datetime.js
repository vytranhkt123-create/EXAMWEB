const DEFAULT_LOCALE = 'vi-VN'
const ISO_DATE_TIME_WITHOUT_ZONE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,7})?)?$/
const HAS_TIME_ZONE = /(?:Z|[+-]\d{2}:?\d{2})$/i

function normalizeBackendDateValue(value) {
    if (typeof value !== 'string') return value

    const trimmed = value.trim()
    if (!trimmed) return trimmed

    if (ISO_DATE_TIME_WITHOUT_ZONE.test(trimmed) && !HAS_TIME_ZONE.test(trimmed)) {
        return `${trimmed}Z`
    }

    return trimmed
}

export function parseBackendDate(value) {
    if (value instanceof Date) return value
    if (value === null || value === undefined || value === '') return null

    const date = new Date(normalizeBackendDateValue(value))
    return Number.isNaN(date.getTime()) ? null : date
}

export function formatLocalDate(value, options, fallback = 'Chưa ghi nhận') {
    const date = parseBackendDate(value)
    if (!date) return fallback

    return new Intl.DateTimeFormat(DEFAULT_LOCALE, options).format(date)
}

export function formatDateTime(value, options, fallback = 'Chưa ghi nhận') {
    return formatLocalDate(
        value,
        options || {
            dateStyle: 'short',
            timeStyle: 'short',
        },
        fallback,
    )
}

export function formatDate(value, options, fallback = 'Chưa ghi nhận') {
    return formatLocalDate(
        value,
        options || {
            dateStyle: 'short',
        },
        fallback,
    )
}

export function formatTime(value, options, fallback = 'Chưa ghi nhận') {
    return formatLocalDate(
        value,
        options || {
            hour: '2-digit',
            minute: '2-digit',
        },
        fallback,
    )
}

export function toDateTimeLocalInputValue(value) {
    const date = parseBackendDate(value)
    if (!date) return ''

    const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000)
    return localDate.toISOString().slice(0, 16)
}

export function toUtcIsoString(value) {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? '' : date.toISOString()
}
