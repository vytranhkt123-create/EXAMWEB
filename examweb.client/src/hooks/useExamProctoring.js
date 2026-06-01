import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../services/api'
import { useOnlineClassWebRTC } from './useOnlineClassWebRTC'

const EXAM_SCREEN_SHARE_CONSTRAINTS = {
    audio: false,
    video: {
        frameRate: { ideal: 8, max: 15 },
        width: { ideal: 1280 },
        height: { ideal: 720 },
    },
}

function createSessionId() {
    if (window.crypto?.randomUUID) {
        return window.crypto.randomUUID()
    }
    return `monitor-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function createExamMonitorRoomId(testId, sessionId) {
    return `exam-monitor:${testId}:${sessionId}`
}

async function attachScreenPreview(stream) {
    const video = document.createElement('video')
    video.muted = true
    video.playsInline = true
    video.srcObject = stream
    await video.play()
    return video
}

function captureScreenImage(video) {
    if (!video || video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
        return null
    }

    const canvas = document.createElement('canvas')
    const width = 480
    const height = Math.max(1, Math.round((video.videoHeight / video.videoWidth) * width))
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) return null
    context.drawImage(video, 0, 0, width, height)
    return canvas.toDataURL('image/jpeg', 0.58)
}

export function useExamProctoring({
    auth,
    enabled = true,
    isSubmittedRef,
    mode,
    onError,
    onMessage,
    onWarning,
    result,
    snapshotIntervalMs = 60_000,
    studentTest,
}) {
    const [sessionId, setSessionId] = useState('')
    const [roomId, setRoomId] = useState('')
    const [status, setStatus] = useState('idle')
    const [message, setMessage] = useState('')
    const screenStreamRef = useRef(null)
    const screenVideoRef = useRef(null)
    const monitorRef = useRef({ testId: '', sessionId: '' })
    const recordEventRef = useRef(() => {})
    const intentionalStopRef = useRef(false)

    const setStatusMessage = useCallback((nextStatus, nextMessage = '') => {
        setStatus(nextStatus)
        setMessage(nextMessage)
        if (nextMessage) onMessage?.(nextMessage)
    }, [onMessage])

    const {
        joinMeeting,
        leaveMeeting,
        sendRoomEvent,
        startScreenShare,
    } = useOnlineClassWebRTC({
        auth,
        roomId,
        enabled: Boolean(enabled && auth?.accessToken && mode !== 'admin'),
        autoStartMedia: false,
        mediaConstraints: null,
        screenShareConstraints: EXAM_SCREEN_SHARE_CONSTRAINTS,
        onRoomError: (roomError) => {
            setStatusMessage('stopped', roomError || 'Could not connect proctoring room')
        },
        onScreenShareStopped: () => {
            const current = monitorRef.current
            if (!current.testId || !current.sessionId || isSubmittedRef?.current || intentionalStopRef.current) return

            setStatusMessage('stopped', 'Screen sharing stopped')
            onWarning?.('Screen sharing stopped. Turn it back on to continue the exam.')
            recordEventRef.current(
                current.testId,
                current.sessionId,
                'ScreenShareStopped',
                'Student stopped screen sharing',
            )
        },
    })

    const stop = useCallback(({ submitted = false } = {}) => {
        intentionalStopRef.current = true
        if (screenStreamRef.current) {
            screenStreamRef.current.getTracks().forEach((track) => track.stop())
        }
        screenStreamRef.current = null
        screenVideoRef.current = null
        monitorRef.current = { testId: '', sessionId: '' }
        setRoomId('')
        setSessionId('')
        leaveMeeting()
        setStatusMessage(submitted ? 'submitted' : 'idle', submitted ? 'Exam submitted' : '')
        window.setTimeout(() => {
            intentionalStopRef.current = false
        }, 0)
    }, [leaveMeeting, setStatusMessage])

    const recordEvent = useCallback(async (testId, activeSessionId, eventType, eventMessage, imageDataUrl = null) => {
        if (!testId || !activeSessionId) return

        const payload = {
            testId,
            sessionId: activeSessionId,
            eventType,
            message: eventMessage,
            imageDataUrl,
        }

        if (sendRoomEvent('exam-monitor-event', payload)) {
            return
        }

        try {
            await api(`/${testId}/monitoring`, {
                method: 'POST',
                body: JSON.stringify(payload),
            })
        } catch (err) {
            setStatusMessage('stopped', err.message || 'Could not record proctoring event')
            onError?.(err)
        }
    }, [onError, sendRoomEvent, setStatusMessage])

    useEffect(() => {
        recordEventRef.current = recordEvent
    }, [recordEvent])

    const start = useCallback(async (testId) => {
        if (!navigator.mediaDevices?.getDisplayMedia) {
            throw new Error('Screen sharing is not supported by this browser')
        }

        const nextSessionId = createSessionId()
        const nextRoomId = createExamMonitorRoomId(testId, nextSessionId)
        intentionalStopRef.current = false
        monitorRef.current = { testId, sessionId: nextSessionId }
        setRoomId(nextRoomId)
        setSessionId(nextSessionId)

        if (!navigator.mediaDevices?.getDisplayMedia) {
            setStatusMessage('active', 'Làm bài trên thiết bị di động (Không share màn hình)')
            await recordEvent(testId, nextSessionId, 'MobileDevice', 'Học viên làm bài trên thiết bị không hỗ trợ share màn hình')
            return nextSessionId
        }

        setStatusMessage('starting', 'Connecting proctoring session')

        await joinMeeting(nextRoomId)
        const stream = await startScreenShare()
        if (!stream) {
            throw new Error('Screen sharing is required to start the exam')
        }

        screenStreamRef.current = stream
        screenVideoRef.current = await attachScreenPreview(stream)
        setStatusMessage('active', 'Screen sharing active')

        await recordEvent(testId, nextSessionId, 'ScreenShareStarted', 'Screen monitoring started')
        return nextSessionId
    }, [joinMeeting, recordEvent, setStatusMessage, startScreenShare])

    const restart = useCallback(async () => {
        const current = monitorRef.current
        if (!current.testId || !current.sessionId) return

        if (!navigator.mediaDevices?.getDisplayMedia) {
            setStatusMessage('active', 'Làm bài trên thiết bị di động')
            onWarning?.('')
            return
        }

        try {
            setStatusMessage('starting', 'Restarting screen sharing')
            const stream = await startScreenShare()
            if (!stream) {
                throw new Error('Screen sharing is required to continue the exam')
            }

            screenStreamRef.current = stream
            screenVideoRef.current = await attachScreenPreview(stream)
            setStatusMessage('active', 'Screen sharing active')
            onWarning?.('')
            await recordEvent(current.testId, current.sessionId, 'ScreenShareStarted', 'Student restarted screen sharing')
        } catch (err) {
            setStatusMessage('stopped', err.message || 'Could not restart screen sharing')
            onError?.(err)
        }
    }, [onError, onWarning, recordEvent, setStatusMessage, startScreenShare])

    const sendSnapshot = useCallback(async () => {
        const current = monitorRef.current
        if (!studentTest || result || status !== 'active' || !current.sessionId) return

        const imageDataUrl = captureScreenImage(screenVideoRef.current)
        if (!imageDataUrl) return

        await recordEvent(
            current.testId,
            current.sessionId,
            'Snapshot',
            'Periodic screen snapshot',
            imageDataUrl,
        )
    }, [recordEvent, result, status, studentTest])

    const reportViolation = useCallback((eventType, eventMessage, warning) => {
        const current = monitorRef.current
        if (!studentTest || result || isSubmittedRef?.current || !current.sessionId) return

        onWarning?.(warning)
        setStatusMessage(status === 'active' ? 'active' : status, eventMessage)
        recordEvent(current.testId, current.sessionId, eventType, eventMessage)
    }, [isSubmittedRef, onWarning, recordEvent, result, setStatusMessage, status, studentTest])

    useEffect(() => {
        if (!studentTest || !sessionId || result || status !== 'active') return undefined

        const initialSnapshot = window.setTimeout(sendSnapshot, 2000)
        const interval = window.setInterval(sendSnapshot, snapshotIntervalMs)

        return () => {
            window.clearTimeout(initialSnapshot)
            window.clearInterval(interval)
        }
    }, [result, sendSnapshot, sessionId, snapshotIntervalMs, status, studentTest])

    useEffect(() => {
        if (!studentTest || !sessionId || result) return undefined

        const reportVisibility = () => {
            if (document.hidden) {
                reportViolation(
                    'TabHidden',
                    'Student left the exam tab',
                    'You left the exam tab. This has been recorded.',
                )
                return
            }

            recordEvent(studentTest.id, sessionId, 'TabVisible', 'Student returned to the exam tab')
        }

        const reportBlur = () => {
            reportViolation(
                'WindowBlur',
                'Exam window lost focus',
                'The exam window lost focus. This has been recorded.',
            )
        }

        document.addEventListener('visibilitychange', reportVisibility)
        window.addEventListener('blur', reportBlur)

        return () => {
            document.removeEventListener('visibilitychange', reportVisibility)
            window.removeEventListener('blur', reportBlur)
        }
    }, [recordEvent, reportViolation, result, sessionId, studentTest])

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
