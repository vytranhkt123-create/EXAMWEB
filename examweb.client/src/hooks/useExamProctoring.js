import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../services/api'

function createSessionId() {
    if (window.crypto?.randomUUID) {
        return window.crypto.randomUUID()
    }
    return `monitor-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function createExamMonitorRoomId(testId, sessionId) {
    return `exam-monitor:${testId}:${sessionId}`
}

export function useExamProctoring({
    enabled = true,
    isSubmittedRef,
    onError,
    onMessage,
    onWarning,
    result,
    studentTest,
}) {
    const [sessionId, setSessionId] = useState('')
    const [roomId, setRoomId] = useState('')
    const [status, setStatus] = useState('idle')
    const [message, setMessage] = useState('')
    const monitorRef = useRef({ testId: '', sessionId: '' })

    const setStatusMessage = useCallback((nextStatus, nextMessage = '') => {
        setStatus(nextStatus)
        setMessage(nextMessage)
        if (nextMessage) onMessage?.(nextMessage)
    }, [onMessage])

    const stop = useCallback(({ submitted = false } = {}) => {
        monitorRef.current = { testId: '', sessionId: '' }
        setRoomId('')
        setSessionId('')
        setStatusMessage(submitted ? 'submitted' : 'idle', submitted ? 'Đã nộp bài' : '')
    }, [setStatusMessage])

    const recordEvent = useCallback(async (testId, activeSessionId, eventType, eventMessage) => {
        if (!enabled || !testId || !activeSessionId) return

        const payload = {
            testId,
            sessionId: activeSessionId,
            eventType,
            message: eventMessage,
            imageDataUrl: null,
        }

        try {
            await api(`/${testId}/monitoring`, {
                method: 'POST',
                body: JSON.stringify(payload),
            })
        } catch (err) {
            setMessage(err.message || 'Không thể ghi nhận sự kiện giám sát')
            onError?.(err)
        }
    }, [enabled, onError])

    const start = useCallback(async (testId) => {
        if (!enabled || !testId) return ''

        const nextSessionId = createSessionId()
        const nextRoomId = createExamMonitorRoomId(testId, nextSessionId)
        monitorRef.current = { testId, sessionId: nextSessionId }
        setRoomId(nextRoomId)
        setSessionId(nextSessionId)
        setStatusMessage('active', 'Đang giám sát toàn màn hình và chuyển tab')

        await recordEvent(testId, nextSessionId, 'MonitoringStarted', 'Học viên bắt đầu phiên làm bài')
        return nextSessionId
    }, [enabled, recordEvent, setStatusMessage])

    const restart = useCallback(async () => {
        const current = monitorRef.current
        if (!current.testId || !current.sessionId) return

        setStatusMessage('active', 'Đang giám sát toàn màn hình và chuyển tab')
        onWarning?.('')
        await recordEvent(current.testId, current.sessionId, 'MonitoringResumed', 'Học viên tiếp tục phiên giám sát')
    }, [onWarning, recordEvent, setStatusMessage])

    const reportViolation = useCallback((eventType, eventMessage, warning) => {
        const current = monitorRef.current
        if (!enabled || !studentTest || result || isSubmittedRef?.current || !current.sessionId) return

        onWarning?.(warning)
        setStatusMessage('active', eventMessage)
        recordEvent(current.testId, current.sessionId, eventType, eventMessage)
    }, [enabled, isSubmittedRef, onWarning, recordEvent, result, setStatusMessage, studentTest])

    useEffect(() => {
        if (!enabled || !studentTest || !sessionId || result) return undefined

        const reportVisibility = () => {
            if (document.hidden) {
                reportViolation(
                    'TabHidden',
                    'Học viên rời khỏi tab làm bài',
                    'Cảnh báo: Bạn đã rời khỏi tab làm bài. Hành vi này đã được ghi nhận.',
                )
                return
            }

            recordEvent(studentTest.id, sessionId, 'TabVisible', 'Học viên quay lại tab làm bài')
        }

        const reportBlur = () => {
            reportViolation(
                'WindowBlur',
                'Cửa sổ làm bài bị mất focus',
                'Cảnh báo: Cửa sổ làm bài bị mất focus. Hành vi này đã được ghi nhận.',
            )
        }

        document.addEventListener('visibilitychange', reportVisibility)
        window.addEventListener('blur', reportBlur)

        return () => {
            document.removeEventListener('visibilitychange', reportVisibility)
            window.removeEventListener('blur', reportBlur)
        }
    }, [enabled, recordEvent, reportViolation, result, sessionId, studentTest])

    useEffect(() => {
        if (!result) return undefined

        const timer = window.setTimeout(() => {
            stop({ submitted: true })
        }, 0)

        return () => window.clearTimeout(timer)
    }, [result, stop])

    return {
        message,
        recordEvent,
        restart,
        roomId,
        sessionId,
        start,
        status,
        stop,
    }
}
