import { API_BASE_URL } from '../config/appConfig'
import { getStoredSession } from './session'

export function buildApiUrl(path = '') {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`
    return `${API_BASE_URL}${normalizedPath}`
}

export async function requestJson(url, options = {}) {
    const { headers, ...requestOptions } = options

    let response
    try {
        response = await fetch(url, {
            ...requestOptions,
            headers: {
                'Content-Type': 'application/json',
                ...headers,
            },
        })
    } catch {
        throw new Error('Không kết nối được máy chủ')
    }

    if (!response.ok) {
        let message = response.status === 401
            ? 'Tên đăng nhập hoặc mật khẩu không đúng'
            : response.status === 403
                ? 'Tài khoản này không có quyền thực hiện thao tác'
                : 'Không thể xử lý yêu cầu'
        try {
            const body = await response.json()
            message = body.message || message
        } catch {
            message = `${message} (${response.status})`
        }
        const error = new Error(message)
        error.status = response.status
        throw error
    }

    if (response.status === 204) {
        return null
    }

    return response.json()
}

export async function requestBlob(url, options = {}) {
    const { headers, ...requestOptions } = options

    let response
    try {
        response = await fetch(url, {
            ...requestOptions,
            headers: {
                ...headers,
            },
        })
    } catch {
        throw new Error('Không kết nối được máy chủ')
    }

    if (!response.ok) {
        let message = response.status === 401
            ? 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn'
            : response.status === 403
                ? 'Tài khoản này không có quyền xem tài liệu'
                : 'Không thể tải tài liệu PDF'
        try {
            const body = await response.json()
            message = body.message || message
        } catch {
            message = `${message} (${response.status})`
        }
        const error = new Error(message)
        error.status = response.status
        throw error
    }

    return response.blob()
}

function withAuthHeaders(options = {}, extraHeaders = {}) {
    const session = getStoredSession()
    return {
        ...options,
        headers: {
            ...extraHeaders,
            ...(session?.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {}),
            ...options.headers,
        },
    }
}

export function authApi(path = '', options = {}) {
    return requestJson(buildApiUrl(`/api/auth${path}`), options)
}

export function api(path = '', options = {}) {
    return requestJson(buildApiUrl(`/api/tests${path}`), withAuthHeaders(options))
}

export function studentsApi(path = '', options = {}) {
    return requestJson(buildApiUrl(`/api/students${path}`), withAuthHeaders(options))
}

export function materialsApi(path = '', options = {}) {
    return requestJson(buildApiUrl(`/api/materials${path}`), withAuthHeaders(options))
}

export function materialFileApi(materialId, options = {}) {
    return requestBlob(
        buildApiUrl(`/api/materials/${encodeURIComponent(materialId)}/file`),
        withAuthHeaders(options, { Accept: 'application/pdf' }),
    )
}

export function onlineClassApi(path = '', options = {}) {
    return requestJson(buildApiUrl(`/api/online-class${path}`), withAuthHeaders(options))
}

export function getOnlineClassSocketUrl(session) {
    if (!session?.accessToken) return ''
    const url = new URL('/ws/online-class', API_BASE_URL || window.location.origin)
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
    url.searchParams.set('access_token', session.accessToken)
    return url.toString()
}
