import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

const APP_NAME = 'Lớp học thầy Đạt'
const AUTH_STORAGE_KEY = 'examWebAuth'
const ADMIN_ROLE = 'Admin'
const MAX_PDF_FILE_SIZE = 12 * 1024 * 1024

const API_BASE_URL = "https://examweb-api-dat-d5fkfybja3buccdz.southeastasia-01.azurewebsites.net/"

const initialNewStudent = () => ({
    username: '',
    password: '',
    displayName: '',
    grade: '',
    className: '',
})

function isSessionValid(session) {
    if (!session?.accessToken || !session?.role) return false
    if (!session.expiredAt) return true
    const expiresAt = new Date(session.expiredAt).getTime()
    return Number.isFinite(expiresAt) ? expiresAt > Date.now() : true
}

function getStoredSession() {
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

function saveSession(session) {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session))
}

function clearSession() {
    localStorage.removeItem(AUTH_STORAGE_KEY)
}

function getModeForSession(session) {
    return session?.role === ADMIN_ROLE ? 'admin' : 'student'
}

function getPathForMode(mode) {
    return mode === 'admin' ? '/admin' : '/'
}

const initialQuestionDraft = () => ({
    content: '',
    score: 1,
    answers: [
        { content: '', isCorrect: true },
        { content: '', isCorrect: false },
        { content: '', isCorrect: false },
        { content: '', isCorrect: false },
    ],
})

const initialOnlineClassState = () => ({
    title: 'Lớp học online',
    agenda: 'Ôn tập, giải đáp bài và làm việc trên bảng trắng.',
    isLive: false,
    whiteboardImage: '',
    updatedAt: null,
})

function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result)
        reader.onerror = () => reject(new Error('Không thể đọc tệp đã chọn'))
        reader.readAsDataURL(file)
    })
}

async function requestJson(url, options = {}) {
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

async function authApi(path = '', options = {}) {
    return requestJson(`${API_BASE_URL}/api/auth${path}`, options)
}

async function api(path = '', options = {}) {
    const session = getStoredSession()
    return requestJson(`${API_BASE_URL}/api/tests${path}`, {
        ...options,
        headers: {
            ...(session?.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {}),
            ...options.headers,
        },
    })
}

async function studentsApi(path = '', options = {}) {
    const session = getStoredSession()
    return requestJson(`${API_BASE_URL}/api/students${path}`, {
        ...options,
        headers: {
            ...(session?.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {}),
            ...options.headers,
        },
    })
}

async function materialsApi(path = '', options = {}) {
    const session = getStoredSession()
    return requestJson(`${API_BASE_URL}/api/materials${path}`, {
        ...options,
        headers: {
            ...(session?.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {}),
            ...options.headers,
        },
    })
}

async function onlineClassApi(path = '', options = {}) {
    const session = getStoredSession()
    return requestJson(`${API_BASE_URL}/api/online-class${path}`, {
        ...options,
        headers: {
            ...(session?.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {}),
            ...options.headers,
        },
    })
}

function getOnlineClassSocketUrl(session) {
    if (!session?.accessToken) return ''
    const baseUrl = API_BASE_URL || window.location.origin
    const url = new URL('/ws/online-class', baseUrl)
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
    url.searchParams.set('access_token', session.accessToken)
    return url.toString()
}

const ADMIN_SECTIONS = [
    { id: 'dashboard', label: 'Tổng quan', icon: '◫' },
    { id: 'students', label: 'Học sinh', icon: '◉' },
    { id: 'tests', label: 'Đề thi', icon: '▤' },
    { id: 'documents', label: 'Tài liệu PDF', icon: '▣' },
    { id: 'online', label: 'Lớp online', icon: '◍' },
]

const ADMIN_TEST_TABS = [
    { id: 'settings', label: 'Cài đặt' },
    { id: 'questions', label: 'Câu hỏi' },
    { id: 'history', label: 'Lịch sử' },
    { id: 'monitoring', label: 'Theo dõi' },
]

async function enterExamFullscreen(element) {
    const target = element || document.documentElement
    if (target.requestFullscreen) {
        await target.requestFullscreen()
    } else if (target.webkitRequestFullscreen) {
        await target.webkitRequestFullscreen()
    }
}

async function exitExamFullscreen() {
    if (document.fullscreenElement || document.webkitFullscreenElement) {
        if (document.exitFullscreen) {
            await document.exitFullscreen()
        } else if (document.webkitExitFullscreen) {
            await document.webkitExitFullscreen()
        }
    }
}

function formatStudentLabel(student) {
    const parts = [student.displayName]
    if (student.grade) parts.push(`Khối ${student.grade}`)
    if (student.className) parts.push(`Lớp ${student.className}`)
    return parts.join(' · ')
}

function formatScore(value) {
    return Number(value || 0).toLocaleString('vi-VN', {
        maximumFractionDigits: 2,
    })
}

function formatFileSize(bytes) {
    const value = Number(bytes) || 0
    if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`
    return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

function formatDuration(totalSeconds) {
    if (totalSeconds === null || totalSeconds === undefined) return '--:--'
    const safeSeconds = Math.max(0, Number(totalSeconds) || 0)
    const minutes = Math.floor(safeSeconds / 60)
    const seconds = safeSeconds % 60
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

function formatLongDuration(totalSeconds) {
    if (totalSeconds === null || totalSeconds === undefined) return 'Chưa ghi nhận'
    const safeSeconds = Math.max(0, Number(totalSeconds) || 0)
    const minutes = Math.floor(safeSeconds / 60)
    const seconds = safeSeconds % 60
    return `${minutes} phút ${seconds.toString().padStart(2, '0')} giây`
}

function formatDateTime(value) {
    if (!value) return 'Chưa ghi nhận'
    return new Intl.DateTimeFormat('vi-VN', {
        dateStyle: 'short',
        timeStyle: 'short',
    }).format(new Date(value))
}

function createSessionId() {
    if (window.crypto?.randomUUID) {
        return window.crypto.randomUUID()
    }
    return `monitor-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function getMonitorStatusText(status) {
    const labels = {
        idle: 'Chưa bật',
        active: 'Đang theo dõi',
        stopped: 'Đã dừng chia sẻ',
        submitted: 'Đã nộp bài',
    }
    return labels[status] || status
}

function getMonitorEventText(eventType) {
    const labels = {
        FullscreenExited: 'Thoát toàn màn hình',
        ScreenShareStarted: 'Bắt đầu chia sẻ',
        Snapshot: 'Ảnh chụp',
        TabHidden: 'Rời khỏi tab',
        TabVisible: 'Quay lại tab',
        WindowBlur: 'Mất focus',
        ScreenShareStopped: 'Dừng chia sẻ',
    }
    return labels[eventType] || eventType
}

function App() {
    const [auth, setAuth] = useState(getStoredSession)
    const [tests, setTests] = useState([])
    const [students, setStudents] = useState([])
    const [assignedStudentIds, setAssignedStudentIds] = useState([])
    const [newTestAssignedStudentIds, setNewTestAssignedStudentIds] = useState([])
    const [newStudent, setNewStudent] = useState(initialNewStudent)
    const [studentTest, setStudentTest] = useState(null)
    const [adminTest, setAdminTest] = useState(null)
    const [attemptHistory, setAttemptHistory] = useState([])
    const [screenMonitorSessions, setScreenMonitorSessions] = useState([])
    const [selectedAnswers, setSelectedAnswers] = useState({})
    const [result, setResult] = useState(null)
    const [startedAt, setStartedAt] = useState(null)
    const [timeLeft, setTimeLeft] = useState(null)
    const [monitoringSessionId, setMonitoringSessionId] = useState('')
    const [monitoringStatus, setMonitoringStatus] = useState('idle')
    const [monitoringMessage, setMonitoringMessage] = useState('')
    const [newTestName, setNewTestName] = useState('')
    const [newDurationMinutes, setNewDurationMinutes] = useState(30)
    const [editTestName, setEditTestName] = useState('')
    const [editDurationMinutes, setEditDurationMinutes] = useState(30)

    const [adminSection, setAdminSection] = useState('dashboard')
    const [adminTestTab, setAdminTestTab] = useState('settings')
    const [pendingTestId, setPendingTestId] = useState(null)
    const [showMonitorDialog, setShowMonitorDialog] = useState(false)
    const [showSubmitConfirm, setShowSubmitConfirm] = useState(false)
    const [fullscreenWarning, setFullscreenWarning] = useState('')
    const [isFullscreen, setIsFullscreen] = useState(false)

    const [inputMethod, setInputMethod] = useState('manual')
    const [questionDraft, setQuestionDraft] = useState(initialQuestionDraft)
    const [jsonDraft, setJsonDraft] = useState('')
    const [materials, setMaterials] = useState([])
    const [onlineClass, setOnlineClass] = useState(initialOnlineClassState)
    const [whiteboardSnapshots, setWhiteboardSnapshots] = useState([])
    const [chatMessages, setChatMessages] = useState([])
    const [onlineNotice, setOnlineNotice] = useState('')

    const [loading, setLoading] = useState(false)
    const [historyLoading, setHistoryLoading] = useState(false)
    const [monitoringLoading, setMonitoringLoading] = useState(false)
    const [authLoading, setAuthLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const submittingRef = useRef(false)
    const screenStreamRef = useRef(null)
    const screenVideoRef = useRef(null)
    const examShellRef = useRef(null)
    const mode = getModeForSession(auth)

    const answeredCount = useMemo(() => {
        if (!studentTest) return 0
        return studentTest.questions.filter((question) => selectedAnswers[question.id]).length
    }, [selectedAnswers, studentTest])

    const isExamLocked = Boolean(result)
    const isExamRunning = Boolean(studentTest && !result && studentTest.questions.length > 0)

    const handleAuthFailure = useCallback((err) => {
        if (err?.status === 401) {
            clearSession()
            setAuth(null)
            setError('Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.')
            return true
        }
        return false
    }, [])

    const loadTests = useCallback(async () => {
        setLoading(true)
        setError('')
        try {
            const data = await api()
            setTests(data)
        } catch (err) {
            if (!handleAuthFailure(err)) {
                setError(err.message)
            }
        } finally {
            setLoading(false)
        }
    }, [handleAuthFailure])

    const loadStudents = useCallback(async () => {
        if (getModeForSession(getStoredSession()) !== 'admin') return
        try {
            const data = await studentsApi()
            setStudents(data)
        } catch (err) {
            if (!handleAuthFailure(err)) {
                setError(err.message)
            }
        }
    }, [handleAuthFailure])

    const loadMaterials = useCallback(async () => {
        try {
            const data = await materialsApi()
            setMaterials(data)
        } catch (err) {
            if (!handleAuthFailure(err)) {
                setError(err.message)
            }
        }
    }, [handleAuthFailure])

    const loadOnlineClass = useCallback(async () => {
        try {
            const data = await onlineClassApi()
            setOnlineClass({ ...initialOnlineClassState(), ...data })
        } catch (err) {
            if (!handleAuthFailure(err)) {
                setError(err.message)
            }
        }
    }, [handleAuthFailure])

    const loadWhiteboardSnapshots = useCallback(async () => {
        try {
            const data = await onlineClassApi('/whiteboard/snapshots')
            setWhiteboardSnapshots(data)
        } catch (err) {
            if (!handleAuthFailure(err)) {
                setError(err.message)
            }
        }
    }, [handleAuthFailure])

    const loadChatMessages = useCallback(async () => {
        try {
            const data = await onlineClassApi('/chat')
            setChatMessages(data)
        } catch (err) {
            if (!handleAuthFailure(err)) {
                setError(err.message)
            }
        }
    }, [handleAuthFailure])

    const loadOnlineClassData = useCallback(async () => {
        await Promise.all([
            loadMaterials(),
            loadOnlineClass(),
            loadWhiteboardSnapshots(),
            loadChatMessages(),
        ])
    }, [loadChatMessages, loadMaterials, loadOnlineClass, loadWhiteboardSnapshots])

    const stopScreenStream = useCallback(() => {
        if (screenStreamRef.current) {
            screenStreamRef.current.getTracks().forEach((track) => track.stop())
        }
        screenStreamRef.current = null
        screenVideoRef.current = null
    }, [])

    const recordScreenMonitorEvent = useCallback(async (testId, sessionId, eventType, message, imageDataUrl = null) => {
        if (!testId || !sessionId) return

        try {
            await api(`/${testId}/monitoring`, {
                method: 'POST',
                body: JSON.stringify({
                    sessionId,
                    eventType,
                    message,
                    imageDataUrl,
                }),
            })
        } catch (err) {
            setMonitoringMessage(err.message)
        }
    }, [])

    const captureScreenImage = useCallback(() => {
        const video = screenVideoRef.current
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
    }, [])

    const sendScreenSnapshot = useCallback(async () => {
        if (!studentTest || !monitoringSessionId || result || monitoringStatus !== 'active') return

        const imageDataUrl = captureScreenImage()
        if (!imageDataUrl) return

        await recordScreenMonitorEvent(
            studentTest.id,
            monitoringSessionId,
            'Snapshot',
            'Ảnh chụp màn hình định kỳ',
            imageDataUrl,
        )
    }, [captureScreenImage, monitoringSessionId, monitoringStatus, recordScreenMonitorEvent, result, studentTest])

    const submitTest = useCallback(async ({ allowIncomplete = false, isTimeExpired = false } = {}) => {
        if (!studentTest || submittingRef.current || result) return

        if (!allowIncomplete && answeredCount !== studentTest.questions.length) {
            setError('Hãy chọn đáp án cho tất cả câu hỏi trước khi nộp bài')
            return
        }

        submittingRef.current = true
        setSaving(true)
        setError('')

        try {
            const durationSeconds = startedAt
                ? Math.max(0, Math.round((Date.now() - startedAt.getTime()) / 1000))
                : null

            const data = await api(`/${studentTest.id}/submit`, {
                method: 'POST',
                body: JSON.stringify({
                    monitoringSessionId: monitoringSessionId || null,
                    durationSeconds,
                    isTimeExpired,
                    answers: Object.entries(selectedAnswers).map(([questionId, answerId]) => ({
                        questionId,
                        answerId,
                    })),
                }),
            })
            setResult(data)
            setTimeLeft(0)
            setShowSubmitConfirm(false)
            await exitExamFullscreen()
        } catch (err) {
            submittingRef.current = false
            setError(err.message)
        } finally {
            setSaving(false)
        }
    }, [answeredCount, monitoringSessionId, result, selectedAnswers, startedAt, studentTest])

    useEffect(() => {
        const onFullscreenChange = () => {
            const active = Boolean(document.fullscreenElement || document.webkitFullscreenElement)
            setIsFullscreen(active)

            if (!active && studentTest && !result) {
                setFullscreenWarning('Cảnh báo: Bạn đã thoát chế độ toàn màn hình. Hành vi này có thể bị admin ghi nhận.')
                if (monitoringSessionId) {
                    recordScreenMonitorEvent(
                        studentTest.id,
                        monitoringSessionId,
                        'FullscreenExited',
                        'Học viên thoát chế độ toàn màn hình',
                    )
                }
            } else if (active) {
                setFullscreenWarning('')
            }
        }

        document.addEventListener('fullscreenchange', onFullscreenChange)
        document.addEventListener('webkitfullscreenchange', onFullscreenChange)
        return () => {
            document.removeEventListener('fullscreenchange', onFullscreenChange)
            document.removeEventListener('webkitfullscreenchange', onFullscreenChange)
        }
    }, [monitoringSessionId, recordScreenMonitorEvent, result, studentTest])

    useEffect(() => {
        if (!studentTest || result || studentTest.questions.length === 0) return undefined

        const timer = window.setTimeout(() => {
            if (examShellRef.current) {
                enterExamFullscreen(examShellRef.current).catch(() => {
                    setError('Không thể bật toàn màn hình. Vui lòng cho phép trình duyệt.')
                })
            }
        }, 120)

        return () => window.clearTimeout(timer)
    }, [result, studentTest])

    useEffect(() => {
        document.title = APP_NAME

        const syncRoute = () => {
            if (!auth) return
            const nextMode = getModeForSession(auth)
            const nextPath = getPathForMode(nextMode)
            if (window.location.pathname !== nextPath) {
                window.history.replaceState({}, '', nextPath)
            }
            setError('')
        }

        window.addEventListener('popstate', syncRoute)
        return () => {
            window.removeEventListener('popstate', syncRoute)
        }
    }, [auth])

    useEffect(() => {
        if (!auth) {
            return
        }

        const nextMode = getModeForSession(auth)
        const nextPath = getPathForMode(nextMode)
        if (window.location.pathname !== nextPath) {
            window.history.replaceState({}, '', nextPath)
        }

        const initialLoad = window.setTimeout(() => {
            loadTests()
            loadOnlineClassData()
            if (getModeForSession(auth) === 'admin') {
                loadStudents()
            }
        }, 0)
        return () => window.clearTimeout(initialLoad)
    }, [auth, loadOnlineClassData, loadStudents, loadTests])

    useEffect(() => {
        if (!studentTest || !monitoringSessionId || result || monitoringStatus !== 'active') return undefined

        const initialSnapshot = window.setTimeout(sendScreenSnapshot, 1600)
        const interval = window.setInterval(sendScreenSnapshot, 20000)

        return () => {
            window.clearTimeout(initialSnapshot)
            window.clearInterval(interval)
        }
    }, [monitoringSessionId, monitoringStatus, result, sendScreenSnapshot, studentTest])

    useEffect(() => {
        if (!studentTest || !monitoringSessionId || result) return undefined

        const reportVisibility = () => {
            const eventType = document.hidden ? 'TabHidden' : 'TabVisible'
            const message = document.hidden ? 'Học viên rời khỏi tab làm bài' : 'Học viên quay lại tab làm bài'
            recordScreenMonitorEvent(studentTest.id, monitoringSessionId, eventType, message)
        }

        const reportBlur = () => {
            recordScreenMonitorEvent(studentTest.id, monitoringSessionId, 'WindowBlur', 'Cửa sổ làm bài mất focus')
        }

        document.addEventListener('visibilitychange', reportVisibility)
        window.addEventListener('blur', reportBlur)

        return () => {
            document.removeEventListener('visibilitychange', reportVisibility)
            window.removeEventListener('blur', reportBlur)
        }
    }, [monitoringSessionId, recordScreenMonitorEvent, result, studentTest])

    useEffect(() => {
        if (!result) return undefined

        const timer = window.setTimeout(() => {
            stopScreenStream()
            setMonitoringStatus('submitted')
            setMonitoringMessage('Đã nộp bài')
        }, 0)

        return () => window.clearTimeout(timer)
    }, [result, stopScreenStream])

    useEffect(() => {
        if (!studentTest || result || studentTest.questions.length === 0 || timeLeft === null) return undefined

        if (timeLeft <= 0) {
            const submitTimer = window.setTimeout(() => {
                submitTest({ allowIncomplete: true, isTimeExpired: true })
            }, 0)
            return () => window.clearTimeout(submitTimer)
        }

        const timer = window.setTimeout(() => {
            setTimeLeft((current) => (current === null ? null : Math.max(0, current - 1)))
        }, 1000)

        return () => window.clearTimeout(timer)
    }, [result, studentTest, submitTest, timeLeft])

    async function handleLogin(event, credentials) {
        event.preventDefault()
        setAuthLoading(true)
        setError('')

        try {
            const session = await authApi('/login', {
                method: 'POST',
                body: JSON.stringify({
                    username: credentials.username.trim(),
                    password: credentials.password,
                }),
            })

            if (!session?.accessToken || !session?.role) {
                throw new Error('Phản hồi đăng nhập không hợp lệ. Hãy khởi động lại backend và thử lại.')
            }

            saveSession(session)
            setAuth(session)
            window.history.replaceState({}, '', getPathForMode(getModeForSession(session)))
        } catch (err) {
            clearSession()
            setAuth(null)
            setError(err.message)
        } finally {
            setAuthLoading(false)
        }
    }

    function handleLogout() {
        stopScreenStream()
        exitExamFullscreen()
        clearSession()
        setAuth(null)
        setTests([])
        setAdminTest(null)
        setAdminSection('dashboard')
        setAttemptHistory([])
        setScreenMonitorSessions([])
        setMaterials([])
        setOnlineClass(initialOnlineClassState())
        setWhiteboardSnapshots([])
        setChatMessages([])
        resetStudentWork()
        window.history.replaceState({}, '', '/')
        setError('')
    }

    async function loadAttemptHistory(testId) {
        setHistoryLoading(true)
        try {
            const data = await api(`/${testId}/attempts`)
            setAttemptHistory(data)
        } catch (err) {
            setAttemptHistory([])
            setError(err.message)
        } finally {
            setHistoryLoading(false)
        }
    }

    const loadScreenMonitoring = useCallback(async (testId) => {
        setMonitoringLoading(true)
        try {
            const data = await api(`/${testId}/monitoring`)
            setScreenMonitorSessions(data)
        } catch (err) {
            setScreenMonitorSessions([])
            setError(err.message)
        } finally {
            setMonitoringLoading(false)
        }
    }, [])

    useEffect(() => {
        if (mode !== 'admin' || !adminTest) return undefined

        const interval = window.setInterval(() => {
            loadScreenMonitoring(adminTest.id)
        }, 15000)

        return () => window.clearInterval(interval)
    }, [adminTest, loadScreenMonitoring, mode])

    async function startScreenMonitoring(testId) {
        if (!navigator.mediaDevices?.getDisplayMedia) {
            throw new Error('Trình duyệt chưa hỗ trợ chia sẻ màn hình')
        }

        const sessionId = createSessionId()
        const stream = await navigator.mediaDevices.getDisplayMedia({
            audio: false,
            video: {
                frameRate: { ideal: 2, max: 5 },
                width: { ideal: 1280 },
                height: { ideal: 720 },
            },
        })

        const video = document.createElement('video')
        video.muted = true
        video.playsInline = true
        video.srcObject = stream
        await video.play()

        screenStreamRef.current = stream
        screenVideoRef.current = video
        setMonitoringSessionId(sessionId)
        setMonitoringStatus('active')
        setMonitoringMessage('Đang chia sẻ màn hình')

        stream.getVideoTracks().forEach((track) => {
            track.addEventListener('ended', () => {
                setMonitoringStatus('stopped')
                setMonitoringMessage('Học viên đã dừng chia sẻ màn hình')
                recordScreenMonitorEvent(testId, sessionId, 'ScreenShareStopped', 'Học viên đã dừng chia sẻ màn hình')
            }, { once: true })
        })

        return sessionId
    }

    async function confirmStartExam() {
        if (!pendingTestId) return

        setError('')
        setResult(null)
        setSelectedAnswers({})
        setLoading(true)
        submittingRef.current = false
        setFullscreenWarning('')

        try {
            const testId = pendingTestId
            const sessionId = await startScreenMonitoring(testId)
            const data = await api(`/${testId}/take`)
            setStudentTest(data)
            setStartedAt(new Date())
            setTimeLeft((data.durationMinutes || 30) * 60)
            setShowMonitorDialog(false)
            setPendingTestId(null)
            await recordScreenMonitorEvent(testId, sessionId, 'ScreenShareStarted', 'Bắt đầu theo dõi màn hình')
        } catch (err) {
            stopScreenStream()
            setMonitoringSessionId('')
            setMonitoringStatus('idle')
            setMonitoringMessage('')
            if (err?.name === 'NotAllowedError') {
                setError('Cần bật chia sẻ màn hình để bắt đầu làm bài')
            } else if (!handleAuthFailure(err)) {
                setError(err.message)
            }
        } finally {
            setLoading(false)
        }
    }

    function requestOpenStudentTest(testId) {
        if (isExamRunning) return
        setPendingTestId(testId)
        setShowMonitorDialog(true)
        setError('')
    }

    function cancelStartExam() {
        setPendingTestId(null)
        setShowMonitorDialog(false)
    }

    function handleSubmitClick() {
        if (!studentTest || isExamLocked) return

        if (answeredCount < studentTest.questions.length) {
            setShowSubmitConfirm(true)
            return
        }

        submitTest({ allowIncomplete: true })
    }

    function confirmSubmitIncomplete() {
        submitTest({ allowIncomplete: true })
    }

    async function openAdminTest(testId, tab = 'settings') {
        setError('')
        setLoading(true)
        setAdminSection('test-edit')
        setAdminTestTab(tab)
        try {
            const data = await api(`/${testId}`)
            setAdminTest(data)
            setEditTestName(data.testName)
            setEditDurationMinutes(data.durationMinutes || 30)
            setAssignedStudentIds(data.assignedStudentIds || [])
            await loadAttemptHistory(testId)
            await loadScreenMonitoring(testId)
        } catch (err) {
            if (!handleAuthFailure(err)) {
                setError(err.message)
            }
        } finally {
            setLoading(false)
        }
    }

    async function createTest(event) {
        event.preventDefault()
        const testName = newTestName.trim()
        const durationMinutes = Number(newDurationMinutes)

        if (!testName) {
            setError('Tên đề không được bỏ trống')
            return
        }

        setSaving(true)
        setError('')
        try {
            const created = await api('', {
                method: 'POST',
                body: JSON.stringify({
                    testName,
                    durationMinutes,
                    assignedStudentIds: newTestAssignedStudentIds,
                }),
            })
            setNewTestName('')
            setNewDurationMinutes(30)
            setNewTestAssignedStudentIds([])
            await loadTests()
            await openAdminTest(created.id, 'questions')
        } catch (err) {
            setError(err.message)
        } finally {
            setSaving(false)
        }
    }

    async function updateTestSettings(event) {
        event.preventDefault()
        if (!adminTest) return

        const testName = editTestName.trim()
        const durationMinutes = Number(editDurationMinutes)
        if (!testName) {
            setError('Tên đề không được bỏ trống')
            return
        }

        setSaving(true)
        setError('')
        try {
            const updated = await api(`/${adminTest.id}`, {
                method: 'PUT',
                body: JSON.stringify({
                    testName,
                    durationMinutes,
                    assignedStudentIds,
                }),
            })
            setAdminTest(updated)
            setEditTestName(updated.testName)
            setEditDurationMinutes(updated.durationMinutes)
            setAssignedStudentIds(updated.assignedStudentIds || [])
            await loadTests()
        } catch (err) {
            setError(err.message)
        } finally {
            setSaving(false)
        }
    }

    async function deleteTest(testId) {
        if (!window.confirm('Xóa đề này?')) return

        setSaving(true)
        setError('')
        try {
            await api(`/${testId}`, { method: 'DELETE' })
            if (adminTest?.id === testId) {
                setAdminTest(null)
                setAttemptHistory([])
                setScreenMonitorSessions([])
            }
            if (studentTest?.id === testId) resetStudentWork()
            await loadTests()
        } catch (err) {
            setError(err.message)
        } finally {
            setSaving(false)
        }
    }

    async function addQuestion(event) {
        event.preventDefault()
        if (!adminTest) {
            setError('Hãy chọn đề trước')
            return
        }

        const payload = {
            content: questionDraft.content.trim(),
            score: Number(questionDraft.score),
            answers: questionDraft.answers.map((answer) => ({
                content: answer.content.trim(),
                isCorrect: answer.isCorrect,
            })),
        }

        setSaving(true)
        setError('')
        try {
            await api(`/${adminTest.id}/questions`, {
                method: 'POST',
                body: JSON.stringify(payload),
            })
            setQuestionDraft(initialQuestionDraft())
            await loadTests()
            await openAdminTest(adminTest.id)
        } catch (err) {
            setError(err.message)
        } finally {
            setSaving(false)
        }
    }

    async function importQuestionsFromJson(event) {
        event.preventDefault()
        if (!adminTest) {
            setError('Hãy chọn đề trước')
            return
        }

        let parsedData
        try {
            parsedData = JSON.parse(jsonDraft)
            if (!Array.isArray(parsedData)) throw new Error('JSON phải là một mảng')
        } catch (err) {
            setError(`Lỗi định dạng JSON: ${err.message}`)
            return
        }

        setSaving(true)
        setError('')

        try {
            for (const question of parsedData) {
                const payload = {
                    content: String(question.content || '').trim(),
                    score: Number(question.score) || 1,
                    answers: Array.isArray(question.answers)
                        ? question.answers.map((answer) => ({
                            content: String(answer.content || '').trim(),
                            isCorrect: Boolean(answer.isCorrect),
                        }))
                        : [],
                }
                await api(`/${adminTest.id}/questions`, {
                    method: 'POST',
                    body: JSON.stringify(payload),
                })
            }
            setJsonDraft('')
            await loadTests()
            await openAdminTest(adminTest.id)
        } catch (err) {
            setError(`Quá trình import bị gián đoạn: ${err.message}`)
        } finally {
            setSaving(false)
        }
    }

    async function deleteQuestion(questionId) {
        if (!adminTest) return

        setSaving(true)
        setError('')
        try {
            await api(`/${adminTest.id}/questions/${questionId}`, { method: 'DELETE' })
            await loadTests()
            await openAdminTest(adminTest.id)
        } catch (err) {
            setError(err.message)
        } finally {
            setSaving(false)
        }
    }

    function toggleAssignedStudent(studentId) {
        setAssignedStudentIds((current) =>
            current.includes(studentId)
                ? current.filter((id) => id !== studentId)
                : [...current, studentId],
        )
    }

    function toggleNewTestAssignedStudent(studentId) {
        setNewTestAssignedStudentIds((current) =>
            current.includes(studentId)
                ? current.filter((id) => id !== studentId)
                : [...current, studentId],
        )
    }

    async function createStudentAccount(event) {
        event.preventDefault()
        setSaving(true)
        setError('')
        try {
            await studentsApi('', {
                method: 'POST',
                body: JSON.stringify(newStudent),
            })
            setNewStudent(initialNewStudent())
            await loadStudents()
        } catch (err) {
            if (!handleAuthFailure(err)) {
                setError(err.message)
            }
        } finally {
            setSaving(false)
        }
    }

    async function deleteStudentAccount(studentId) {
        if (!window.confirm('Xóa tài khoản học sinh này?')) return

        setSaving(true)
        setError('')
        try {
            await studentsApi(`/${studentId}`, { method: 'DELETE' })
            setAssignedStudentIds((current) => current.filter((id) => id !== studentId))
            await loadStudents()
        } catch (err) {
            if (!handleAuthFailure(err)) {
                setError(err.message)
            }
        } finally {
            setSaving(false)
        }
    }

    async function addMaterial({ title, description, file }) {
        const cleanTitle = title.trim()
        if (!cleanTitle) {
            setError('Tên tài liệu không được bỏ trống')
            return false
        }
        if (!file) {
            setError('Hãy chọn tệp PDF')
            return false
        }
        if (file.type !== 'application/pdf') {
            setError('Chỉ hỗ trợ tài liệu PDF')
            return false
        }
        if (file.size > MAX_PDF_FILE_SIZE) {
            setError('Tệp PDF vượt quá giới hạn 12MB')
            return false
        }

        setSaving(true)
        setError('')
        try {
            const dataUrl = await readFileAsDataUrl(file)
            await materialsApi('', {
                method: 'POST',
                body: JSON.stringify({
                    title: cleanTitle,
                    description: description.trim(),
                    fileName: file.name,
                    dataUrl,
                }),
            })
            await loadMaterials()
            setOnlineNotice('Đã lưu tài liệu PDF lên hệ thống')
            return true
        } catch (err) {
            if (!handleAuthFailure(err)) {
                setError(err.message)
            }
            return false
        } finally {
            setSaving(false)
        }
    }

    async function deleteMaterial(materialId) {
        if (!window.confirm('Xóa tài liệu này?')) return
        setSaving(true)
        setError('')
        try {
            await materialsApi(`/${materialId}`, { method: 'DELETE' })
            await loadMaterials()
        } catch (err) {
            if (!handleAuthFailure(err)) {
                setError(err.message)
            }
        } finally {
            setSaving(false)
        }
    }

    async function updateOnlineClassSettings(settings) {
        setSaving(true)
        setError('')
        try {
            const updated = await onlineClassApi('/settings', {
                method: 'PUT',
                body: JSON.stringify({
                    title: settings.title.trim() || 'Lớp học online',
                    agenda: settings.agenda.trim(),
                }),
            })
            setOnlineClass({ ...initialOnlineClassState(), ...updated })
            setOnlineNotice('Đã lưu thông tin lớp online')
        } catch (err) {
            if (!handleAuthFailure(err)) {
                setError(err.message)
            }
        } finally {
            setSaving(false)
        }
    }

    async function toggleOnlineClassLive() {
        setSaving(true)
        setError('')
        try {
            const updated = await onlineClassApi('/live', {
                method: 'POST',
                body: JSON.stringify({ isLive: !onlineClass.isLive }),
            })
            setOnlineClass({ ...initialOnlineClassState(), ...updated })
            setOnlineNotice(updated.isLive ? 'Đã mở lớp online' : 'Đã kết thúc lớp online')
        } catch (err) {
            if (!handleAuthFailure(err)) {
                setError(err.message)
            }
        } finally {
            setSaving(false)
        }
    }

    async function saveWhiteboardImage(dataUrl) {
        setSaving(true)
        setError('')
        try {
            await onlineClassApi('/whiteboard', {
                method: 'POST',
                body: JSON.stringify({ dataUrl }),
            })
            await Promise.all([loadOnlineClass(), loadWhiteboardSnapshots()])
            setOnlineNotice('Đã lưu bảng trắng lên hệ thống')
        } catch (err) {
            if (!handleAuthFailure(err)) {
                setError(err.message)
            }
        } finally {
            setSaving(false)
        }
    }

    async function useWhiteboardSnapshot(snapshotId) {
        setSaving(true)
        setError('')
        try {
            const updated = await onlineClassApi(`/whiteboard/snapshots/${snapshotId}/use`, {
                method: 'POST',
            })
            setOnlineClass({ ...initialOnlineClassState(), ...updated })
            setOnlineNotice('Đã mở lại bản lưu bảng trắng')
        } catch (err) {
            if (!handleAuthFailure(err)) {
                setError(err.message)
            }
        } finally {
            setSaving(false)
        }
    }

    async function deleteWhiteboardSnapshot(snapshotId) {
        setSaving(true)
        setError('')
        try {
            await onlineClassApi(`/whiteboard/snapshots/${snapshotId}`, { method: 'DELETE' })
            await loadWhiteboardSnapshots()
        } catch (err) {
            if (!handleAuthFailure(err)) {
                setError(err.message)
            }
        } finally {
            setSaving(false)
        }
    }

    async function sendChatMessage(text) {
        const cleanText = text.trim()
        if (!cleanText) return
        try {
            const message = await onlineClassApi('/chat', {
                method: 'POST',
                body: JSON.stringify({ text: cleanText }),
            })
            setChatMessages((current) =>
                current.some((item) => item.id === message.id)
                    ? current
                    : [...current, message].slice(-160),
            )
        } catch (err) {
            if (!handleAuthFailure(err)) {
                setError(err.message)
            }
        }
    }

    async function clearChatMessages() {
        if (!window.confirm('Xóa toàn bộ chat của lớp online?')) return
        setSaving(true)
        setError('')
        try {
            await onlineClassApi('/chat', { method: 'DELETE' })
            setChatMessages([])
        } catch (err) {
            if (!handleAuthFailure(err)) {
                setError(err.message)
            }
        } finally {
            setSaving(false)
        }
    }

    function handleOnlineRealtimeEvent(type, payload) {
        if (type === 'materials-updated') {
            loadMaterials()
            return
        }
        if (type === 'online-class-updated' && payload) {
            setOnlineClass({ ...initialOnlineClassState(), ...payload })
            return
        }
        if (type === 'whiteboard-updated') {
            if (payload?.onlineClass) {
                setOnlineClass({ ...initialOnlineClassState(), ...payload.onlineClass })
            }
            loadWhiteboardSnapshots()
            return
        }
        if (type === 'whiteboard-snapshots-updated') {
            loadWhiteboardSnapshots()
            return
        }
        if (type === 'chat-message' && payload?.id) {
            setChatMessages((current) =>
                current.some((item) => item.id === payload.id)
                    ? current
                    : [...current, payload].slice(-160),
            )
            return
        }
        if (type === 'chat-cleared') {
            setChatMessages([])
        }
    }

    function resetStudentWork() {
        stopScreenStream()
        exitExamFullscreen()
        setStudentTest(null)
        setSelectedAnswers({})
        setResult(null)
        setStartedAt(null)
        setTimeLeft(null)
        setMonitoringSessionId('')
        setMonitoringStatus('idle')
        setMonitoringMessage('')
        setPendingTestId(null)
        setShowMonitorDialog(false)
        setShowSubmitConfirm(false)
        setFullscreenWarning('')
        setIsFullscreen(false)
        setError('')
        submittingRef.current = false
    }

    function updateDraftAnswer(index, field, value) {
        setQuestionDraft((current) => {
            const answers = current.answers.map((answer, answerIndex) => {
                if (field === 'isCorrect') {
                    return { ...answer, isCorrect: answerIndex === index }
                }
                return answerIndex === index ? { ...answer, [field]: value } : answer
            })
            return { ...current, answers }
        })
    }

    function addDraftAnswer() {
        setQuestionDraft((current) => ({
            ...current,
            answers: [...current.answers, { content: '', isCorrect: false }],
        }))
    }

    function removeDraftAnswer(index) {
        setQuestionDraft((current) => {
            if (current.answers.length <= 2) return current
            const answers = current.answers.filter((_, answerIndex) => answerIndex !== index)
            if (!answers.some((answer) => answer.isCorrect)) {
                answers[0] = { ...answers[0], isCorrect: true }
            }
            return { ...current, answers }
        })
    }

    function selectAnswer(questionId, answerId) {
        if (isExamLocked) return
        setSelectedAnswers((current) => ({
            ...current,
            [questionId]: answerId,
        }))
    }

    if (!auth) {
        return (
            <div className="app-shell auth-shell">
                <LoginView error={error} loading={authLoading} onLogin={handleLogin} />
            </div>
        )
    }

    if (mode === 'admin') {
        return (
            <AdminDashboard
                adminSection={adminSection}
                adminTest={adminTest}
                adminTestTab={adminTestTab}
                assignedStudentIds={assignedStudentIds}
                attemptHistory={attemptHistory}
                auth={auth}
                editDurationMinutes={editDurationMinutes}
                editTestName={editTestName}
                error={error}
                historyLoading={historyLoading}
                inputMethod={inputMethod}
                jsonDraft={jsonDraft}
                loading={loading}
                materials={materials}
                monitoringLoading={monitoringLoading}
                newDurationMinutes={newDurationMinutes}
                newStudent={newStudent}
                newTestAssignedStudentIds={newTestAssignedStudentIds}
                newTestName={newTestName}
                onAddDraftAnswer={addDraftAnswer}
                onAddMaterial={addMaterial}
                onClearChat={clearChatMessages}
                onAddQuestion={addQuestion}
                onCreateStudent={createStudentAccount}
                onCreateTest={createTest}
                onDeleteMaterial={deleteMaterial}
                onDeleteQuestion={deleteQuestion}
                onDeleteStudent={deleteStudentAccount}
                onDeleteTest={deleteTest}
                onDeleteWhiteboardSnapshot={deleteWhiteboardSnapshot}
                onImportJson={importQuestionsFromJson}
                onLogout={handleLogout}
                onOpenTest={openAdminTest}
                onRemoveDraftAnswer={removeDraftAnswer}
                onSaveWhiteboard={saveWhiteboardImage}
                onSendChatMessage={sendChatMessage}
                onRealtimeEvent={handleOnlineRealtimeEvent}
                onSetAdminSection={setAdminSection}
                onSetAdminTestTab={setAdminTestTab}
                onSetInputMethod={setInputMethod}
                onToggleOnlineLive={toggleOnlineClassLive}
                onToggleAssignedStudent={toggleAssignedStudent}
                onToggleNewTestAssignedStudent={toggleNewTestAssignedStudent}
                onUpdateOnlineClass={updateOnlineClassSettings}
                onUpdateDraftAnswer={updateDraftAnswer}
                onUpdateSettings={updateTestSettings}
                onUseWhiteboardSnapshot={useWhiteboardSnapshot}
                onlineClass={onlineClass}
                onlineNotice={onlineNotice}
                questionDraft={questionDraft}
                saving={saving}
                screenMonitorSessions={screenMonitorSessions}
                setEditDurationMinutes={setEditDurationMinutes}
                setEditTestName={setEditTestName}
                setJsonDraft={setJsonDraft}
                setNewDurationMinutes={setNewDurationMinutes}
                setNewStudent={setNewStudent}
                setNewTestName={setNewTestName}
                setQuestionDraft={setQuestionDraft}
                students={students}
                tests={tests}
                chatMessages={chatMessages}
                whiteboardSnapshots={whiteboardSnapshots}
            />
        )
    }

    const pendingTest = pendingTestId ? tests.find((test) => test.id === pendingTestId) : null

    return (
        <div className="app-shell role-student">
            {!studentTest && (
                <header className="topbar">
                    <div className="brand-block">
                        <p className="eyebrow">{APP_NAME}</p>
                        <h1>Làm bài tại Lớp học thầy Đạt</h1>
                        <p className="subtitle">Chọn đề được giao và làm bài trong thời gian quy định.</p>
                    </div>
                    <div className="session-card">
                        <span className="role-chip student">Học viên</span>
                        <div>
                            <strong>{auth.displayName || auth.username}</strong>
                            <small>{auth.username}</small>
                        </div>
                        <button className="ghost-button logout-button" onClick={handleLogout} type="button">
                            Đăng xuất
                        </button>
                    </div>
                </header>
            )}

            {error && !studentTest && <div className="alert">{error}</div>}

            {studentTest ? (
                <ExamFullscreenView
                    answeredCount={answeredCount}
                    auth={auth}
                    error={error}
                    examShellRef={examShellRef}
                    fullscreenWarning={fullscreenWarning}
                    isExamLocked={isExamLocked}
                    isExamRunning={isExamRunning}
                    isFullscreen={isFullscreen}
                    monitoringMessage={monitoringMessage}
                    monitoringStatus={monitoringStatus}
                    onReenterFullscreen={() => enterExamFullscreen(examShellRef.current)}
                    onReset={resetStudentWork}
                    onSelectAnswer={selectAnswer}
                    onSubmit={handleSubmitClick}
                    result={result}
                    saving={saving}
                    selectedAnswers={selectedAnswers}
                    studentTest={studentTest}
                    timeLeft={timeLeft}
                />
            ) : (
                <StudentView
                    auth={auth}
                    chatMessages={chatMessages}
                    loading={loading}
                    materials={materials}
                    onSaveWhiteboard={saveWhiteboardImage}
                    onSelectTest={requestOpenStudentTest}
                    onSendChatMessage={sendChatMessage}
                    onRealtimeEvent={handleOnlineRealtimeEvent}
                    onUseWhiteboardSnapshot={useWhiteboardSnapshot}
                    onlineClass={onlineClass}
                    onlineNotice={onlineNotice}
                    tests={tests}
                    whiteboardSnapshots={whiteboardSnapshots}
                />
            )}

            {showMonitorDialog && (
                <ScreenMonitorConsentDialog
                    loading={loading}
                    onCancel={cancelStartExam}
                    onConfirm={confirmStartExam}
                    testName={pendingTest?.testName}
                />
            )}

            {showSubmitConfirm && studentTest && (
                <SubmitConfirmDialog
                    answeredCount={answeredCount}
                    onCancel={() => setShowSubmitConfirm(false)}
                    onConfirm={confirmSubmitIncomplete}
                    questionCount={studentTest.questions.length}
                    saving={saving}
                />
            )}
        </div>
    )
}

function LoginView({ error, loading, onLogin }) {
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

function ScreenMonitorConsentDialog({ loading, onCancel, onConfirm, testName }) {
    return (
        <div className="modal-overlay" role="presentation">
            <div aria-labelledby="monitor-dialog-title" aria-modal="true" className="modal-card monitor-dialog" role="dialog">
                <span className="modal-badge">Theo dõi làm bài</span>
                <h2 id="monitor-dialog-title">Bắt đầu làm bài{testName ? `: ${testName}` : ''}</h2>
                <p>
                    Để đảm bảo tính công bằng, hệ thống sẽ yêu cầu <strong>chia sẻ màn hình</strong> và
                    chuyển sang <strong>chế độ toàn màn hình</strong> chỉ hiển thị đề thi.
                </p>
                <ul className="modal-checklist">
                    <li>Admin có thể xem ảnh chụp màn hình định kỳ</li>
                    <li>Thoát toàn màn hình sẽ hiện cảnh báo và được ghi nhận</li>
                    <li>Bạn có thể nộp bài khi chưa làm hết câu hỏi</li>
                </ul>
                <div className="modal-actions">
                    <button className="ghost-button" disabled={loading} onClick={onCancel} type="button">
                        Hủy
                    </button>
                    <button className="primary-button" disabled={loading} onClick={onConfirm} type="button">
                        {loading ? 'Đang khởi tạo...' : 'Đồng ý và bắt đầu'}
                    </button>
                </div>
            </div>
        </div>
    )
}

function SubmitConfirmDialog({ answeredCount, onCancel, onConfirm, questionCount, saving }) {
    const remaining = questionCount - answeredCount
    return (
        <div className="modal-overlay" role="presentation">
            <div aria-labelledby="submit-dialog-title" aria-modal="true" className="modal-card" role="dialog">
                <h2 id="submit-dialog-title">Xác nhận nộp bài</h2>
                <p>
                    Bạn mới trả lời <strong>{answeredCount}/{questionCount}</strong> câu.
                    Còn <strong>{remaining}</strong> câu chưa chọn đáp án. Bạn vẫn muốn nộp bài?
                </p>
                <div className="modal-actions">
                    <button className="ghost-button" disabled={saving} onClick={onCancel} type="button">
                        Tiếp tục làm
                    </button>
                    <button className="primary-button" disabled={saving} onClick={onConfirm} type="button">
                        {saving ? 'Đang nộp...' : 'Vẫn nộp bài'}
                    </button>
                </div>
            </div>
        </div>
    )
}

function ExamFullscreenView({
    answeredCount,
    auth,
    error,
    examShellRef,
    fullscreenWarning,
    isExamLocked,
    isExamRunning,
    isFullscreen,
    monitoringMessage,
    monitoringStatus,
    onReenterFullscreen,
    onReset,
    onSelectAnswer,
    onSubmit,
    result,
    saving,
    selectedAnswers,
    studentTest,
    timeLeft,
}) {
    return (
        <div className="exam-fullscreen-shell" ref={examShellRef}>
            <header className="exam-fullscreen-topbar">
                <div>
                    <p className="eyebrow">{APP_NAME}</p>
                    <strong>{studentTest.testName}</strong>
                    <span>{auth.displayName}</span>
                </div>
                <div className="exam-fullscreen-meta">
                    <span className={`monitor-pill ${monitoringStatus}`}>{getMonitorStatusText(monitoringStatus)}</span>
                    <span className={`timer-pill ${timeLeft !== null && timeLeft <= 60 && !result ? 'danger' : ''}`}>
                        {result ? 'Đã nộp bài' : formatDuration(timeLeft)}
                    </span>
                    {!isFullscreen && isExamRunning && (
                        <button className="ghost-button" onClick={onReenterFullscreen} type="button">
                            Vào lại toàn màn hình
                        </button>
                    )}
                </div>
            </header>

            {fullscreenWarning && (
                <div className="fullscreen-warning" role="alert">
                    <strong>⚠ Cảnh báo</strong>
                    <span>{fullscreenWarning}</span>
                    <button className="ghost-button" onClick={onReenterFullscreen} type="button">
                        Vào lại toàn màn hình
                    </button>
                </div>
            )}

            {error && <div className="alert exam-alert">{error}</div>}

            <main className="exam-fullscreen-body">
                {studentTest.questions.length === 0 ? (
                    <EmptyState
                        marker="!"
                        title="Đề chưa có câu hỏi"
                        text="Admin cần thêm câu hỏi trước khi học viên có thể làm bài."
                    />
                ) : (
                    <div className="question-stack">
                        {studentTest.questions.map((question, index) => (
                            <article className="question-block" key={question.id}>
                                <div className="question-head">
                                    <h3>Câu {index + 1}</h3>
                                    <span className="score-badge">{formatScore(question.score)} điểm</span>
                                </div>
                                <p className="question-content">{question.content}</p>
                                <div className="answer-grid">
                                    {question.answers.map((answer) => (
                                        <label
                                            className={`answer-option ${selectedAnswers[question.id] === answer.id ? 'selected' : ''}`}
                                            key={answer.id}
                                        >
                                            <input
                                                checked={selectedAnswers[question.id] === answer.id}
                                                disabled={isExamLocked}
                                                name={question.id}
                                                onChange={() => onSelectAnswer(question.id, answer.id)}
                                                type="radio"
                                            />
                                            <span className="answer-text">{answer.content}</span>
                                        </label>
                                    ))}
                                </div>
                            </article>
                        ))}
                    </div>
                )}

                {result && (
                    <div className="result-panel">
                        <div className="result-score-info">
                            <p className="eyebrow">Kết quả</p>
                            <strong>
                                {formatScore(result.score)} / {formatScore(result.scoreTotal)} điểm
                            </strong>
                            <span>
                                Đúng {result.correctCount}/{result.questionCount} câu · {formatLongDuration(result.durationSeconds)}
                            </span>
                        </div>
                        <span className={result.isTimeExpired ? 'result-badge warning' : 'result-badge'}>
                            {result.isTimeExpired ? 'Tự nộp khi hết giờ' : 'Đã nộp bài'}
                        </span>
                    </div>
                )}
            </main>

            <footer className="exam-fullscreen-footer">
                <div className="progress-text">
                    Đã chọn <strong>{answeredCount}</strong> / {studentTest.questions.length} câu
                    {monitoringMessage && <span className="monitor-note"> · {monitoringMessage}</span>}
                </div>
                <div className="button-row">
                    {(result || isExamRunning) && (
                        <button className="ghost-button" onClick={onReset} type="button">
                            {result ? 'Về danh sách đề' : 'Thoát bài'}
                        </button>
                    )}
                    <button
                        className="primary-button"
                        disabled={saving || isExamLocked || studentTest.questions.length === 0}
                        onClick={onSubmit}
                        type="button"
                    >
                        Nộp bài
                    </button>
                </div>
            </footer>
        </div>
    )
}

function StudentView({
    auth,
    chatMessages,
    loading,
    materials,
    onSaveWhiteboard,
    onSelectTest,
    onSendChatMessage,
    onRealtimeEvent,
    onUseWhiteboardSnapshot,
    onlineClass,
    onlineNotice,
    tests,
    whiteboardSnapshots,
}) {
    const profileParts = [
        auth.grade ? `Khối ${auth.grade}` : null,
        auth.className ? `Lớp ${auth.className}` : null,
    ].filter(Boolean)

    return (
        <main className="content-grid">
            <aside className="side-panel">
                <div className="panel-section">
                    <div className="panel-title">
                        <h2>Thông tin học viên</h2>
                    </div>
                    <div className="student-profile-card">
                        <strong>{auth.displayName}</strong>
                        <span>{profileParts.join(' · ') || 'Chưa có thông tin lớp'}</span>
                        <small>Tài khoản: {auth.username}</small>
                    </div>
                </div>

                <div className="panel-section">
                    <div className="panel-title">
                        <h2>Đề được giao</h2>
                        <span className="badge-count">{tests.length}</span>
                    </div>
                    <TestList
                        disabled={loading}
                        emptyText={loading ? 'Đang tải...' : 'Chưa có đề được giao cho bạn'}
                        tests={tests}
                        onSelect={onSelectTest}
                    />
                </div>
            </aside>

            <section className="work-panel">
                <StudentLearningHub
                    auth={auth}
                    chatMessages={chatMessages}
                    materials={materials}
                    onSaveWhiteboard={onSaveWhiteboard}
                    onSendChatMessage={onSendChatMessage}
                    onRealtimeEvent={onRealtimeEvent}
                    onUseWhiteboardSnapshot={onUseWhiteboardSnapshot}
                    onlineClass={onlineClass}
                    onlineNotice={onlineNotice}
                    whiteboardSnapshots={whiteboardSnapshots}
                />
            </section>
        </main>
    )
}

function AdminDashboard({
    adminSection,
    adminTest,
    adminTestTab,
    assignedStudentIds,
    attemptHistory,
    auth,
    editDurationMinutes,
    editTestName,
    error,
    historyLoading,
    inputMethod,
    jsonDraft,
    loading,
    materials,
    monitoringLoading,
    newDurationMinutes,
    newStudent,
    newTestAssignedStudentIds,
    newTestName,
    onAddDraftAnswer,
    onAddMaterial,
    onClearChat,
    onAddQuestion,
    onCreateStudent,
    onCreateTest,
    onDeleteMaterial,
    onDeleteQuestion,
    onDeleteStudent,
    onDeleteTest,
    onDeleteWhiteboardSnapshot,
    onImportJson,
    onLogout,
    onOpenTest,
    onRemoveDraftAnswer,
    onRealtimeEvent,
    onSaveWhiteboard,
    onSendChatMessage,
    onSetAdminSection,
    onSetAdminTestTab,
    onSetInputMethod,
    onToggleOnlineLive,
    onToggleAssignedStudent,
    onToggleNewTestAssignedStudent,
    onUpdateOnlineClass,
    onUpdateDraftAnswer,
    onUpdateSettings,
    onUseWhiteboardSnapshot,
    onlineClass,
    onlineNotice,
    questionDraft,
    saving,
    screenMonitorSessions,
    setEditDurationMinutes,
    setEditTestName,
    setJsonDraft,
    setNewDurationMinutes,
    setNewStudent,
    setNewTestName,
    setQuestionDraft,
    students,
    tests,
    chatMessages,
    whiteboardSnapshots,
}) {
    const totalQuestions = tests.reduce((sum, test) => sum + (test.questionCount || 0), 0)

    function handleSelectSection(sectionId) {
        onSetAdminSection(sectionId)
        if (sectionId !== 'test-edit' && sectionId !== 'tests') {
            // keep adminTest when switching away from test-edit
        }
    }

    function handleOpenTest(testId) {
        onOpenTest(testId)
    }

    return (
        <div className="admin-dashboard">
            <aside className="admin-sidebar">
                <div className="admin-brand">
                    <p className="eyebrow">{APP_NAME}</p>
                    <strong>Admin Dashboard</strong>
                </div>

                <nav aria-label="Admin menu" className="admin-nav">
                    {ADMIN_SECTIONS.map((item) => (
                        <button
                            className={`admin-nav-item ${adminSection === item.id ? 'active' : ''}`}
                            key={item.id}
                            onClick={() => handleSelectSection(item.id)}
                            type="button"
                        >
                            <span aria-hidden="true">{item.icon}</span>
                            {item.label}
                        </button>
                    ))}
                    {adminTest && (
                        <button
                            className={`admin-nav-item ${adminSection === 'test-edit' ? 'active' : ''}`}
                            onClick={() => onSetAdminSection('test-edit')}
                            type="button"
                        >
                            <span aria-hidden="true">✎</span>
                            Chi tiết đề
                        </button>
                    )}
                </nav>

                <div className="admin-sidebar-user">
                    <strong>{auth.displayName}</strong>
                    <small>{auth.username}</small>
                    <button className="ghost-button full-width" onClick={onLogout} type="button">
                        Đăng xuất
                    </button>
                </div>
            </aside>

            <div className="admin-main">
                <header className="admin-topbar">
                    <div>
                        <h1>
                            {adminSection === 'dashboard' && 'Tổng quan'}
                            {adminSection === 'students' && 'Quản lý học sinh'}
                            {adminSection === 'tests' && 'Quản lý đề thi'}
                            {adminSection === 'documents' && 'Tài liệu PDF'}
                            {adminSection === 'online' && 'Lớp học online'}
                            {adminSection === 'test-edit' && (adminTest?.testName || 'Chi tiết đề')}
                        </h1>
                        <p className="subtitle">Bảng điều khiển quản trị lớp học</p>
                    </div>
                    <span className="role-chip admin">Admin</span>
                </header>

                {error && <div className="alert admin-alert">{error}</div>}

                <div className="admin-content">
                    {adminSection === 'dashboard' && (
                        <section className="admin-dashboard-overview">
                            <div className="stat-grid">
                                <article className="stat-card">
                                    <span>Học sinh</span>
                                    <strong>{students.length}</strong>
                                </article>
                                <article className="stat-card">
                                    <span>Đề thi</span>
                                    <strong>{tests.length}</strong>
                                </article>
                                <article className="stat-card">
                                    <span>Tổng câu hỏi</span>
                                    <strong>{totalQuestions}</strong>
                                </article>
                                <article className="stat-card">
                                    <span>Đề đang mở</span>
                                    <strong>{adminTest ? 1 : 0}</strong>
                                </article>
                                <article className="stat-card">
                                    <span>Tài liệu PDF</span>
                                    <strong>{materials.length}</strong>
                                </article>
                                <article className="stat-card">
                                    <span>Lớp online</span>
                                    <strong>{onlineClass.isLive ? 'Live' : 'Tắt'}</strong>
                                </article>
                            </div>
                            <EmptyState
                                marker="AD"
                                text="Dùng menu bên trái để quản lý học sinh, tạo đề, thêm tài liệu PDF và mở lớp học online."
                                title="Chào admin"
                            />
                        </section>
                    )}

                    {adminSection === 'students' && (
                        <StudentManagementPanel
                            newStudent={newStudent}
                            onCreateStudent={onCreateStudent}
                            onDeleteStudent={onDeleteStudent}
                            saving={saving}
                            setNewStudent={setNewStudent}
                            students={students}
                        />
                    )}

                    {adminSection === 'tests' && (
                        <div className="admin-tests-layout">
                            <form className="create-test admin-panel" onSubmit={onCreateTest}>
                                <div className="panel-title">
                                    <h2>Tạo đề mới</h2>
                                </div>
                                <label htmlFor="test-name">Tên đề thi</label>
                                <input
                                    id="test-name"
                                    onChange={(event) => setNewTestName(event.target.value)}
                                    placeholder="Ví dụ: Đề kiểm tra Toán 15 phút"
                                    value={newTestName}
                                />
                                <label htmlFor="test-duration">Thời gian làm bài (phút)</label>
                                <input
                                    id="test-duration"
                                    max="240"
                                    min="1"
                                    onChange={(event) => setNewDurationMinutes(event.target.value)}
                                    type="number"
                                    value={newDurationMinutes}
                                />
                                <StudentAssignmentPanel
                                    assignedStudentIds={newTestAssignedStudentIds}
                                    onToggleAssignedStudent={onToggleNewTestAssignedStudent}
                                    students={students}
                                    title="Học sinh được giao đề"
                                />
                                <button className="primary-button" disabled={saving} type="submit">
                                    Tạo đề
                                </button>
                            </form>

                            <section className="admin-panel">
                                <div className="panel-title">
                                    <h2>Danh sách đề</h2>
                                    <span className="badge-count">{tests.length}</span>
                                </div>
                                <TestList
                                    canDelete
                                    emptyText={loading ? 'Đang tải...' : 'Chưa có đề thi'}
                                    selectedId={adminTest?.id}
                                    tests={tests}
                                    onDelete={onDeleteTest}
                                    onSelect={handleOpenTest}
                                />
                            </section>
                        </div>
                    )}

                    {adminSection === 'documents' && (
                        <AdminDocumentsPanel
                            materials={materials}
                            onAddMaterial={onAddMaterial}
                            onDeleteMaterial={onDeleteMaterial}
                            saving={saving}
                        />
                    )}

                    {adminSection === 'online' && (
                        <OnlineClassPanel
                            auth={auth}
                            canManage
                            chatMessages={chatMessages}
                            onlineClass={onlineClass}
                            onlineNotice={onlineNotice}
                            onClearChat={onClearChat}
                            onDeleteWhiteboardSnapshot={onDeleteWhiteboardSnapshot}
                            onRealtimeEvent={onRealtimeEvent}
                            onSaveWhiteboard={onSaveWhiteboard}
                            onSendChatMessage={onSendChatMessage}
                            onToggleOnlineLive={onToggleOnlineLive}
                            onUpdateOnlineClass={onUpdateOnlineClass}
                            onUseWhiteboardSnapshot={onUseWhiteboardSnapshot}
                            whiteboardSnapshots={whiteboardSnapshots}
                        />
                    )}

                    {adminSection === 'test-edit' && !adminTest && (
                        <EmptyState
                            marker="?"
                            text="Vào mục Đề thi và chọn một đề để chỉnh sửa."
                            title="Chưa chọn đề"
                        />
                    )}

                    {adminSection === 'test-edit' && adminTest && (
                        <section className="admin-test-edit">
                            <div className="admin-tab-bar">
                                {ADMIN_TEST_TABS.map((tab) => (
                                    <button
                                        className={adminTestTab === tab.id ? 'active' : ''}
                                        key={tab.id}
                                        onClick={() => onSetAdminTestTab(tab.id)}
                                        type="button"
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>

                            <div className="exam-heading">
                                <div>
                                    <p className="eyebrow">Quản lý đề</p>
                                    <h2>{adminTest.testName}</h2>
                                </div>
                                <div className="stats">
                                    <span className="badge">{adminTest.questionCount} câu</span>
                                    <span className="badge highlight">{formatScore(adminTest.scoreTotal)} điểm</span>
                                    <span className="badge">{adminTest.durationMinutes} phút</span>
                                </div>
                            </div>

                            {adminTestTab === 'settings' && (
                                <>
                                    <form className="settings-form admin-panel" onSubmit={onUpdateSettings}>
                                        <div className="form-row">
                                            <label htmlFor="edit-test-name">Tên đề thi</label>
                                            <input
                                                id="edit-test-name"
                                                onChange={(event) => setEditTestName(event.target.value)}
                                                value={editTestName}
                                            />
                                        </div>
                                        <div className="form-row compact">
                                            <label htmlFor="edit-duration">Thời gian (phút)</label>
                                            <input
                                                id="edit-duration"
                                                max="240"
                                                min="1"
                                                onChange={(event) => setEditDurationMinutes(event.target.value)}
                                                type="number"
                                                value={editDurationMinutes}
                                            />
                                        </div>
                                        <button className="primary-button" disabled={saving} type="submit">
                                            Lưu cài đặt
                                        </button>
                                    </form>
                                    <div className="admin-panel">
                                        <StudentAssignmentPanel
                                            assignedStudentIds={assignedStudentIds}
                                            onToggleAssignedStudent={onToggleAssignedStudent}
                                            students={students}
                                            title="Học sinh được giao đề này"
                                        />
                                    </div>
                                </>
                            )}

                            {adminTestTab === 'questions' && (
                                <>
                                    <div className="import-tabs">
                                        <button
                                            className={inputMethod === 'manual' ? 'active' : ''}
                                            onClick={() => onSetInputMethod('manual')}
                                            type="button"
                                        >
                                            Nhập thủ công
                                        </button>
                                        <button
                                            className={inputMethod === 'json' ? 'active' : ''}
                                            onClick={() => onSetInputMethod('json')}
                                            type="button"
                                        >
                                            Import JSON
                                        </button>
                                    </div>

                                    {inputMethod === 'manual' ? (
                                        <form className="question-form admin-panel" onSubmit={onAddQuestion}>
                                            <div className="form-row">
                                                <label htmlFor="question-content">Nội dung câu hỏi</label>
                                                <textarea
                                                    id="question-content"
                                                    onChange={(event) =>
                                                        setQuestionDraft((current) => ({
                                                            ...current,
                                                            content: event.target.value,
                                                        }))
                                                    }
                                                    rows="3"
                                                    value={questionDraft.content}
                                                />
                                            </div>
                                            <div className="form-row compact">
                                                <label htmlFor="question-score">Điểm số</label>
                                                <input
                                                    id="question-score"
                                                    min="0.25"
                                                    onChange={(event) =>
                                                        setQuestionDraft((current) => ({
                                                            ...current,
                                                            score: event.target.value,
                                                        }))
                                                    }
                                                    step="0.25"
                                                    type="number"
                                                    value={questionDraft.score}
                                                />
                                            </div>
                                            <div className="answer-editor">
                                                <label>Các đáp án, chọn một đáp án đúng</label>
                                                {questionDraft.answers.map((answer, index) => (
                                                    <div className="answer-edit-row" key={index}>
                                                        <input
                                                            onChange={(event) =>
                                                                onUpdateDraftAnswer(index, 'content', event.target.value)
                                                            }
                                                            placeholder={`Đáp án ${index + 1}`}
                                                            value={answer.content}
                                                        />
                                                        <label className="correct-toggle">
                                                            <input
                                                                checked={answer.isCorrect}
                                                                name="correct-answer"
                                                                onChange={() => onUpdateDraftAnswer(index, 'isCorrect', true)}
                                                                type="radio"
                                                            />
                                                            <span>Đúng</span>
                                                        </label>
                                                        <button
                                                            className="ghost-button icon-only"
                                                            disabled={questionDraft.answers.length <= 2}
                                                            onClick={() => onRemoveDraftAnswer(index)}
                                                            type="button"
                                                        >
                                                            Xóa
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="action-row">
                                                <button className="ghost-button" onClick={onAddDraftAnswer} type="button">
                                                    Thêm đáp án
                                                </button>
                                                <button className="primary-button" disabled={saving} type="submit">
                                                    Lưu câu hỏi
                                                </button>
                                            </div>
                                        </form>
                                    ) : (
                                        <form className="question-form admin-panel json-form" onSubmit={onImportJson}>
                                            <textarea
                                                className="code-textarea"
                                                onChange={(event) => setJsonDraft(event.target.value)}
                                                placeholder="Dán JSON mảng câu hỏi..."
                                                rows="8"
                                                value={jsonDraft}
                                            />
                                            <button className="primary-button" disabled={saving || !jsonDraft.trim()} type="submit">
                                                Import JSON
                                            </button>
                                        </form>
                                    )}

                                    <div className="question-stack admin-questions">
                                        {adminTest.questions.length === 0 ? (
                                            <EmptyState marker="Q" text="Thêm câu hỏi thủ công hoặc import JSON." title="Chưa có câu hỏi" />
                                        ) : (
                                            adminTest.questions.map((question, index) => (
                                                <article className="question-block" key={question.id}>
                                                    <div className="question-head">
                                                        <h3>Câu {index + 1}</h3>
                                                        <div className="row-actions">
                                                            <span className="score-badge">{formatScore(question.score)} điểm</span>
                                                            <button
                                                                className="delete-button outline"
                                                                disabled={saving}
                                                                onClick={() => onDeleteQuestion(question.id)}
                                                                type="button"
                                                            >
                                                                Xóa
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <p className="question-content">{question.content}</p>
                                                    <ul className="answer-review">
                                                        {question.answers.map((answer) => (
                                                            <li className={answer.isCorrect ? 'correct' : ''} key={answer.id}>
                                                                <span className={answer.isCorrect ? 'status-tag true' : 'status-tag false'}>
                                                                    {answer.isCorrect ? 'Đúng' : 'Sai'}
                                                                </span>
                                                                {answer.content}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </article>
                                            ))
                                        )}
                                    </div>
                                </>
                            )}

                            {adminTestTab === 'history' && (
                                <AttemptHistory attempts={attemptHistory} loading={historyLoading} />
                            )}

                            {adminTestTab === 'monitoring' && (
                                <ScreenMonitoringPanel loading={monitoringLoading} sessions={screenMonitorSessions} />
                            )}
                        </section>
                    )}
                </div>
            </div>
        </div>
    )
}


function AdminDocumentsPanel({ materials, onAddMaterial, onDeleteMaterial, saving }) {
    const fileInputRef = useRef(null)
    const [draft, setDraft] = useState({ title: '', description: '', file: null })

    function updateDraft(field, value) {
        setDraft((current) => ({ ...current, [field]: value }))
    }

    async function handleSubmit(event) {
        event.preventDefault()
        const saved = await onAddMaterial(draft)
        if (!saved) return
        setDraft({ title: '', description: '', file: null })
        if (fileInputRef.current) fileInputRef.current.value = ''
    }

    return (
        <section className="document-admin-layout">
            <form className="admin-panel document-upload-form" onSubmit={handleSubmit}>
                <div className="panel-title">
                    <h2>Thêm tài liệu PDF</h2>
                    <span className="badge-count">PDF</span>
                </div>
                <label htmlFor="material-title">Tên tài liệu</label>
                <input
                    id="material-title"
                    onChange={(event) => updateDraft('title', event.target.value)}
                    placeholder="Ví dụ: Bài giảng hàm số"
                    value={draft.title}
                />
                <label htmlFor="material-description">Ghi chú</label>
                <textarea
                    id="material-description"
                    onChange={(event) => updateDraft('description', event.target.value)}
                    placeholder="Nội dung chính hoặc hướng dẫn học sinh đọc tài liệu"
                    rows="3"
                    value={draft.description}
                />
                <label htmlFor="material-file">Tệp PDF</label>
                <input
                    accept="application/pdf"
                    id="material-file"
                    onChange={(event) => updateDraft('file', event.target.files?.[0] || null)}
                    ref={fileInputRef}
                    type="file"
                />
                <p className="field-hint">Tài liệu được lưu trên hệ thống, hỗ trợ PDF dưới {formatFileSize(MAX_PDF_FILE_SIZE)}.</p>
                <button className="primary-button" disabled={saving} type="submit">
                    {saving ? 'Đang lưu...' : 'Lưu tài liệu'}
                </button>
            </form>

            <MaterialLibrary
                canManage
                materials={materials}
                onDeleteMaterial={onDeleteMaterial}
            />
        </section>
    )
}

function StudentLearningHub({
    auth,
    chatMessages,
    materials,
    onSaveWhiteboard,
    onSendChatMessage,
    onRealtimeEvent,
    onUseWhiteboardSnapshot,
    onlineClass,
    onlineNotice,
    whiteboardSnapshots,
}) {
    return (
        <div className="learning-hub">
            <OnlineClassPanel
                auth={auth}
                chatMessages={chatMessages}
                onlineClass={onlineClass}
                onlineNotice={onlineNotice}
                onSaveWhiteboard={onSaveWhiteboard}
                onSendChatMessage={onSendChatMessage}
                onRealtimeEvent={onRealtimeEvent}
                onUseWhiteboardSnapshot={onUseWhiteboardSnapshot}
                whiteboardSnapshots={whiteboardSnapshots}
            />
            <MaterialLibrary materials={materials} />
        </div>
    )
}

function MaterialLibrary({ canManage = false, materials, onDeleteMaterial }) {
    const [selectedId, setSelectedId] = useState('')
    const selectedMaterial = materials.find((material) => material.id === selectedId) || materials[0]

    if (materials.length === 0) {
        return (
            <section className="admin-panel material-library">
                <EmptyState
                    marker="PDF"
                    title="Chưa có tài liệu"
                    text={canManage ? 'Admin thêm PDF ở form bên trái, học sinh sẽ xem được trong mục tài liệu.' : 'Admin chưa thêm tài liệu PDF cho lớp.'}
                />
            </section>
        )
    }

    return (
        <section className="admin-panel material-library">
            <div className="panel-title">
                <h2>{canManage ? 'Kho tài liệu' : 'Tài liệu PDF'}</h2>
                <span className="badge-count">{materials.length}</span>
            </div>

            <div className="material-layout">
                <div className="material-list">
                    {materials.map((material) => (
                        <button
                            className={`material-item ${selectedMaterial?.id === material.id ? 'active' : ''}`}
                            key={material.id}
                            onClick={() => setSelectedId(material.id)}
                            type="button"
                        >
                            <strong>{material.title}</strong>
                            <span>{material.fileName} · {formatFileSize(material.fileSize)}</span>
                            <small>{formatDateTime(material.createdAt)}</small>
                        </button>
                    ))}
                </div>

                <div className="material-preview">
                    <div className="material-preview-head">
                        <div>
                            <h3>{selectedMaterial.title}</h3>
                            <p>{selectedMaterial.description || 'Không có ghi chú'}</p>
                        </div>
                        <div className="row-actions">
                            <a className="ghost-button" download={selectedMaterial.fileName} href={selectedMaterial.dataUrl}>
                                Tải PDF
                            </a>
                            {canManage && (
                                <button
                                    className="delete-button outline"
                                    onClick={() => onDeleteMaterial(selectedMaterial.id)}
                                    type="button"
                                >
                                    Xóa
                                </button>
                            )}
                        </div>
                    </div>
                    <iframe
                        className="pdf-viewer"
                        src={selectedMaterial.dataUrl}
                        title={selectedMaterial.title}
                    />
                </div>
            </div>
        </section>
    )
}

function OnlineClassPanel({
    auth,
    canManage = false,
    chatMessages,
    onlineClass,
    onlineNotice,
    onClearChat,
    onDeleteWhiteboardSnapshot,
    onRealtimeEvent,
    onSaveWhiteboard,
    onSendChatMessage,
    onToggleOnlineLive,
    onUpdateOnlineClass,
    onUseWhiteboardSnapshot,
    whiteboardSnapshots,
}) {
    function handleSettingsSubmit(event) {
        event.preventDefault()
        const formData = new FormData(event.currentTarget)
        onUpdateOnlineClass({
            title: String(formData.get('title') || ''),
            agenda: String(formData.get('agenda') || ''),
        })
    }

    return (
        <section className="online-class-panel">
            <div className="online-class-head admin-panel">
                <div>
                    <p className="eyebrow">{onlineClass.isLive ? 'Đang live' : 'Chưa mở lớp'}</p>
                    <h2>{onlineClass.title}</h2>
                    <p>{onlineClass.agenda || 'Chưa có nội dung buổi học'}</p>
                    {onlineClass.updatedAt && <small>Cập nhật: {formatDateTime(onlineClass.updatedAt)}</small>}
                </div>
                <span className={onlineClass.isLive ? 'status-chip' : 'status-chip warning'}>
                    {onlineClass.isLive ? 'Lớp đang mở' : 'Lớp chưa mở'}
                </span>
            </div>

            {onlineNotice && <div className="online-notice">{onlineNotice}</div>}

            {canManage && (
                <form className="admin-panel online-settings-form" onSubmit={handleSettingsSubmit}>
                    <div className="form-row">
                        <label htmlFor="online-title">Tên buổi học</label>
                        <input
                            defaultValue={onlineClass.title}
                            id="online-title"
                            key={`title-${onlineClass.updatedAt || 'initial'}`}
                            name="title"
                        />
                    </div>
                    <div className="form-row">
                        <label htmlFor="online-agenda">Nội dung</label>
                        <textarea
                            defaultValue={onlineClass.agenda}
                            id="online-agenda"
                            key={`agenda-${onlineClass.updatedAt || 'initial'}`}
                            name="agenda"
                            rows="3"
                        />
                    </div>
                    <div className="button-row">
                        <button className="ghost-button" type="submit">Lưu thông tin</button>
                        <button className="primary-button" onClick={onToggleOnlineLive} type="button">
                            {onlineClass.isLive ? 'Kết thúc lớp' : 'Mở lớp online'}
                        </button>
                    </div>
                </form>
            )}

            <div className="online-room-grid">
                <div className="online-main-column">
                    <MeetingDevicePanel
                        auth={auth}
                        onRealtimeEvent={onRealtimeEvent}
                        onlineClass={onlineClass}
                    />
                    <WhiteboardTool
                        canEdit={canManage || onlineClass.isLive}
                        initialImage={onlineClass.whiteboardImage}
                        onSave={onSaveWhiteboard}
                    />
                    <WhiteboardSnapshotList
                        canManage={canManage}
                        onDeleteSnapshot={onDeleteWhiteboardSnapshot}
                        onUseSnapshot={onUseWhiteboardSnapshot}
                        snapshots={whiteboardSnapshots}
                    />
                </div>
                <ClassChatPanel
                    disabled={!canManage && !onlineClass.isLive}
                    messages={chatMessages}
                    onClearChat={onClearChat}
                    onSendMessage={onSendChatMessage}
                    showManageActions={canManage}
                />
            </div>
        </section>
    )
}

function MeetingDevicePanel({ auth, onRealtimeEvent, onlineClass }) {
    const localVideoRef = useRef(null)
    const streamRef = useRef(null)
    const socketRef = useRef(null)
    const peerConnectionsRef = useRef(new Map())
    const connectionIdRef = useRef('')
    const realtimeHandlerRef = useRef(onRealtimeEvent)
    const [cameraOn, setCameraOn] = useState(false)
    const [micOn, setMicOn] = useState(false)
    const [mediaError, setMediaError] = useState('')
    const [socketStatus, setSocketStatus] = useState('Đang kết nối')
    const [peers, setPeers] = useState({})

    useEffect(() => {
        realtimeHandlerRef.current = onRealtimeEvent
    }, [onRealtimeEvent])

    const sendSignal = useCallback((type, targetConnectionId, payload) => {
        const socket = socketRef.current
        if (!socket || socket.readyState !== WebSocket.OPEN) return
        socket.send(JSON.stringify({ type, targetConnectionId, payload }))
    }, [])

    const upsertPeer = useCallback((connectionId, patch) => {
        setPeers((current) => ({
            ...current,
            [connectionId]: {
                connectionId,
                displayName: 'Người tham gia',
                role: 'User',
                stream: null,
                connectionState: 'new',
                ...(current[connectionId] || {}),
                ...patch,
            },
        }))
    }, [])

    const removePeer = useCallback((connectionId) => {
        const peerConnection = peerConnectionsRef.current.get(connectionId)
        if (peerConnection) {
            peerConnection.close()
            peerConnectionsRef.current.delete(connectionId)
        }
        setPeers((current) => {
            const next = { ...current }
            delete next[connectionId]
            return next
        })
    }, [])

    const createAndSendOffer = useCallback(async (connectionId) => {
        const peerConnection = peerConnectionsRef.current.get(connectionId)
        if (!peerConnection) return
        const offer = await peerConnection.createOffer()
        await peerConnection.setLocalDescription(offer)
        sendSignal('offer', connectionId, offer)
    }, [sendSignal])

    const createPeerConnection = useCallback((peer, shouldOffer = false) => {
        if (!peer?.connectionId || peer.connectionId === connectionIdRef.current) return null
        const existing = peerConnectionsRef.current.get(peer.connectionId)
        if (existing) {
            upsertPeer(peer.connectionId, peer)
            return existing
        }

        const peerConnection = new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
        })

        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => {
                peerConnection.addTrack(track, streamRef.current)
            })
        }

        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                sendSignal('ice-candidate', peer.connectionId, event.candidate)
            }
        }

        peerConnection.ontrack = (event) => {
            upsertPeer(peer.connectionId, {
                ...peer,
                stream: event.streams[0],
            })
        }

        peerConnection.onconnectionstatechange = () => {
            upsertPeer(peer.connectionId, {
                ...peer,
                connectionState: peerConnection.connectionState,
            })
        }

        peerConnectionsRef.current.set(peer.connectionId, peerConnection)
        upsertPeer(peer.connectionId, peer)

        if (shouldOffer) {
            window.setTimeout(() => {
                createAndSendOffer(peer.connectionId).catch(() => {
                    setMediaError('Không thể tạo kết nối video với người tham gia')
                })
            }, 120)
        }

        return peerConnection
    }, [createAndSendOffer, sendSignal, upsertPeer])

    const renegotiatePeers = useCallback(async () => {
        for (const connectionId of peerConnectionsRef.current.keys()) {
            await createAndSendOffer(connectionId)
        }
    }, [createAndSendOffer])

    const attachLocalStreamToPeers = useCallback((stream) => {
        peerConnectionsRef.current.forEach((peerConnection) => {
            const senderTracks = peerConnection.getSenders().map((sender) => sender.track).filter(Boolean)
            stream.getTracks().forEach((track) => {
                if (!senderTracks.includes(track)) {
                    peerConnection.addTrack(track, stream)
                }
            })
        })
    }, [])

    useEffect(() => () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop())
        }
        peerConnectionsRef.current.forEach((peerConnection) => peerConnection.close())
        socketRef.current?.close()
    }, [])

    useEffect(() => {
        if (!auth?.accessToken) return undefined

        const socket = new WebSocket(getOnlineClassSocketUrl(auth))
        socketRef.current = socket
        const peerConnections = peerConnectionsRef.current

        socket.onopen = () => setSocketStatus('Realtime đã kết nối')
        socket.onclose = () => setSocketStatus('Realtime đã ngắt')
        socket.onerror = () => setSocketStatus('Realtime lỗi kết nối')

        socket.onmessage = async (event) => {
            const message = JSON.parse(event.data)
            const { type, payload } = message

            if ([
                'materials-updated',
                'online-class-updated',
                'whiteboard-updated',
                'whiteboard-snapshots-updated',
                'chat-message',
                'chat-cleared',
            ].includes(type)) {
                realtimeHandlerRef.current?.(type, payload)
                return
            }

            if (type === 'connected') {
                connectionIdRef.current = payload.connectionId
                payload.peers?.forEach((peer) => createPeerConnection(peer, true))
                return
            }

            if (type === 'peer-joined') {
                createPeerConnection(payload, true)
                return
            }

            if (type === 'peer-left') {
                removePeer(payload.connectionId)
                return
            }

            if (type === 'offer') {
                const peer = {
                    connectionId: payload.fromConnectionId,
                    displayName: payload.fromDisplayName,
                    role: 'User',
                }
                const peerConnection = createPeerConnection(peer, false)
                if (!peerConnection) return
                await peerConnection.setRemoteDescription(new RTCSessionDescription(payload.payload))
                const answer = await peerConnection.createAnswer()
                await peerConnection.setLocalDescription(answer)
                sendSignal('answer', peer.connectionId, answer)
                return
            }

            if (type === 'answer') {
                const peerConnection = peerConnectionsRef.current.get(payload.fromConnectionId)
                if (peerConnection) {
                    await peerConnection.setRemoteDescription(new RTCSessionDescription(payload.payload))
                }
                return
            }

            if (type === 'ice-candidate') {
                const peerConnection = peerConnectionsRef.current.get(payload.fromConnectionId)
                if (peerConnection && payload.payload) {
                    await peerConnection.addIceCandidate(new RTCIceCandidate(payload.payload))
                }
            }
        }

        return () => {
            socket.close()
            if (socketRef.current === socket) {
                socketRef.current = null
            }
            peerConnections.forEach((peerConnection) => peerConnection.close())
            peerConnections.clear()
            setPeers({})
        }
    }, [auth, createPeerConnection, removePeer, sendSignal])

    async function startMedia() {
        if (!navigator.mediaDevices?.getUserMedia) {
            setMediaError('Trình duyệt chưa hỗ trợ camera/micro')
            return null
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
            streamRef.current = stream
            if (localVideoRef.current) localVideoRef.current.srcObject = stream
            setCameraOn(stream.getVideoTracks().some((track) => track.enabled))
            setMicOn(stream.getAudioTracks().some((track) => track.enabled))
            setMediaError('')
            attachLocalStreamToPeers(stream)
            await renegotiatePeers()
            return stream
        } catch {
            setMediaError('Không thể bật camera hoặc micro. Hãy kiểm tra quyền trình duyệt.')
            return null
        }
    }

    async function toggleCamera() {
        const stream = streamRef.current || await startMedia()
        if (!stream) return
        const next = !cameraOn
        stream.getVideoTracks().forEach((track) => {
            track.enabled = next
        })
        setCameraOn(next)
        await renegotiatePeers()
    }

    async function toggleMicrophone() {
        const stream = streamRef.current || await startMedia()
        if (!stream) return
        const next = !micOn
        stream.getAudioTracks().forEach((track) => {
            track.enabled = next
        })
        setMicOn(next)
        await renegotiatePeers()
    }

    async function stopMedia() {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop())
        }
        streamRef.current = null
        if (localVideoRef.current) localVideoRef.current.srcObject = null
        peerConnectionsRef.current.forEach((peerConnection) => {
            peerConnection.getSenders().forEach((sender) => {
                if (sender.track) {
                    peerConnection.removeTrack(sender)
                }
            })
        })
        setCameraOn(false)
        setMicOn(false)
        await renegotiatePeers()
    }

    const peerList = Object.values(peers)

    return (
        <section className="meeting-panel admin-panel">
            <div className="panel-title">
                <h2>Phòng video</h2>
                <span className={onlineClass.isLive ? 'status-chip' : 'status-chip warning'}>
                    {onlineClass.isLive ? 'Lớp đang mở' : 'Lớp chưa mở'}
                </span>
            </div>
            <div className="meeting-status-row">
                <span>{socketStatus}</span>
                <span>{peerList.length} người khác</span>
            </div>
            <div className="video-grid">
                <div className="video-tile local">
                    <video autoPlay muted playsInline ref={localVideoRef} />
                    {!cameraOn && <span>Camera đang tắt</span>}
                    <strong>{auth?.displayName || auth?.username || 'Bạn'} · Bạn</strong>
                </div>
                {peerList.map((peer) => (
                    <RemoteVideoTile key={peer.connectionId} peer={peer} />
                ))}
            </div>
            {mediaError && <p className="field-hint danger-text">{mediaError}</p>}
            <div className="media-controls">
                <button className={cameraOn ? 'primary-button' : 'ghost-button'} onClick={toggleCamera} type="button">
                    {cameraOn ? 'Tắt cam' : 'Bật cam'}
                </button>
                <button className={micOn ? 'primary-button' : 'ghost-button'} onClick={toggleMicrophone} type="button">
                    {micOn ? 'Tắt micro' : 'Bật micro'}
                </button>
                <button className="ghost-button" onClick={stopMedia} type="button">
                    Dừng thiết bị
                </button>
            </div>
        </section>
    )
}

function RemoteVideoTile({ peer }) {
    const videoRef = useRef(null)

    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.srcObject = peer.stream || null
        }
    }, [peer.stream])

    return (
        <div className="video-tile">
            <video autoPlay playsInline ref={videoRef} />
            {!peer.stream && <span>Đang chờ video</span>}
            <strong>{peer.displayName}</strong>
            <small>{peer.connectionState || 'new'}</small>
        </div>
    )
}

function WhiteboardTool({ canEdit, initialImage, onSave }) {
    const canvasRef = useRef(null)
    const imageInputRef = useRef(null)
    const drawingRef = useRef(false)
    const pointsRef = useRef([])
    const [tool, setTool] = useState('pen')
    const [color, setColor] = useState('#111827')
    const [lineWidth, setLineWidth] = useState(5)
    const [smoothInk, setSmoothInk] = useState(true)

    const resetCanvas = useCallback((imageDataUrl = '') => {
        const canvas = canvasRef.current
        if (!canvas) return
        const context = canvas.getContext('2d')
        context.save()
        context.globalCompositeOperation = 'source-over'
        context.fillStyle = '#ffffff'
        context.fillRect(0, 0, canvas.width, canvas.height)
        context.restore()

        if (!imageDataUrl) return
        const image = new Image()
        image.onload = () => {
            const scale = Math.min(canvas.width / image.width, canvas.height / image.height)
            const width = image.width * scale
            const height = image.height * scale
            const x = (canvas.width - width) / 2
            const y = (canvas.height - height) / 2
            context.drawImage(image, x, y, width, height)
        }
        image.src = imageDataUrl
    }, [])

    useEffect(() => {
        resetCanvas(initialImage)
    }, [initialImage, resetCanvas])

    function getCanvasPoint(event) {
        const canvas = canvasRef.current
        const rect = canvas.getBoundingClientRect()
        return {
            x: ((event.clientX - rect.left) / rect.width) * canvas.width,
            y: ((event.clientY - rect.top) / rect.height) * canvas.height,
        }
    }

    function prepareContext() {
        const context = canvasRef.current.getContext('2d')
        context.lineCap = 'round'
        context.lineJoin = 'round'
        context.lineWidth = tool === 'eraser' ? lineWidth * 2.4 : lineWidth
        context.strokeStyle = color
        context.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over'
        return context
    }

    function beginDraw(event) {
        if (!canEdit) return
        event.preventDefault()
        canvasRef.current.setPointerCapture?.(event.pointerId)
        const point = getCanvasPoint(event)
        drawingRef.current = true
        pointsRef.current = [point]
        const context = prepareContext()
        context.beginPath()
        context.moveTo(point.x, point.y)
        context.lineTo(point.x + 0.1, point.y + 0.1)
        context.stroke()
    }

    function draw(event) {
        if (!drawingRef.current || !canEdit) return
        event.preventDefault()
        const point = getCanvasPoint(event)
        pointsRef.current.push(point)
        const context = prepareContext()

        if (smoothInk && pointsRef.current.length > 2) {
            const previous = pointsRef.current[pointsRef.current.length - 2]
            const current = pointsRef.current[pointsRef.current.length - 1]
            const midpoint = {
                x: (previous.x + current.x) / 2,
                y: (previous.y + current.y) / 2,
            }
            context.quadraticCurveTo(previous.x, previous.y, midpoint.x, midpoint.y)
            context.stroke()
            return
        }

        context.lineTo(point.x, point.y)
        context.stroke()
    }

    function endDraw(event) {
        if (!drawingRef.current) return
        event.preventDefault()
        drawingRef.current = false
        pointsRef.current = []
        const context = canvasRef.current.getContext('2d')
        context.closePath()
        context.globalCompositeOperation = 'source-over'
    }

    function clearBoard() {
        if (!canEdit) return
        resetCanvas()
    }

    function saveBoard() {
        const canvas = canvasRef.current
        if (!canvas) return
        onSave(canvas.toDataURL('image/png'))
    }

    function downloadBoard() {
        const canvas = canvasRef.current
        if (!canvas) return
        const link = document.createElement('a')
        link.download = 'bang-trang.png'
        link.href = canvas.toDataURL('image/png')
        link.click()
    }

    async function insertImage(event) {
        const file = event.target.files?.[0]
        if (!file) return
        const dataUrl = await readFileAsDataUrl(file)
        const canvas = canvasRef.current
        const context = canvas.getContext('2d')
        const image = new Image()
        image.onload = () => {
            const maxWidth = canvas.width * 0.7
            const maxHeight = canvas.height * 0.7
            const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1)
            const width = image.width * scale
            const height = image.height * scale
            const x = (canvas.width - width) / 2
            const y = (canvas.height - height) / 2
            context.drawImage(image, x, y, width, height)
        }
        image.src = dataUrl
        if (imageInputRef.current) imageInputRef.current.value = ''
    }

    return (
        <section className="whiteboard-panel admin-panel">
            <div className="whiteboard-toolbar">
                <div>
                    <h2>Bảng trắng</h2>
                    <span>{canEdit ? 'Có thể viết và lưu bảng' : 'Chỉ xem khi lớp chưa mở'}</span>
                </div>
                <div className="whiteboard-tools">
                    <button className={tool === 'pen' ? 'primary-button' : 'ghost-button'} disabled={!canEdit} onClick={() => setTool('pen')} type="button">
                        Bút
                    </button>
                    <button className={tool === 'eraser' ? 'primary-button' : 'ghost-button'} disabled={!canEdit} onClick={() => setTool('eraser')} type="button">
                        Tẩy
                    </button>
                    <label className="color-control">
                        Màu
                        <input disabled={!canEdit} onChange={(event) => setColor(event.target.value)} type="color" value={color} />
                    </label>
                    <label className="range-control">
                        Nét
                        <input disabled={!canEdit} max="24" min="2" onChange={(event) => setLineWidth(Number(event.target.value))} type="range" value={lineWidth} />
                    </label>
                    <label className="smooth-toggle">
                        <input checked={smoothInk} disabled={!canEdit} onChange={(event) => setSmoothInk(event.target.checked)} type="checkbox" />
                        Đẹp chữ
                    </label>
                </div>
            </div>

            <div className="whiteboard-canvas-wrap">
                <canvas
                    aria-label="Bảng trắng lớp học"
                    className="whiteboard-canvas"
                    height="720"
                    onPointerCancel={endDraw}
                    onPointerDown={beginDraw}
                    onPointerLeave={endDraw}
                    onPointerMove={draw}
                    onPointerUp={endDraw}
                    ref={canvasRef}
                    width="1280"
                />
            </div>

            <div className="whiteboard-actions">
                <input
                    accept="image/*"
                    className="hidden-file"
                    disabled={!canEdit}
                    onChange={insertImage}
                    ref={imageInputRef}
                    type="file"
                />
                <button className="ghost-button" disabled={!canEdit} onClick={() => imageInputRef.current?.click()} type="button">
                    Chèn ảnh
                </button>
                <button className="ghost-button" disabled={!canEdit} onClick={clearBoard} type="button">
                    Xóa bảng
                </button>
                <button className="ghost-button" onClick={downloadBoard} type="button">
                    Tải PNG
                </button>
                <button className="primary-button" disabled={!canEdit} onClick={saveBoard} type="button">
                    Lưu bảng
                </button>
            </div>
        </section>
    )
}

function WhiteboardSnapshotList({ canManage = false, onDeleteSnapshot, onUseSnapshot, snapshots }) {
    return (
        <section className="admin-panel snapshot-panel">
            <div className="panel-title">
                <h2>Bản lưu bảng trắng</h2>
                <span className="badge-count">{snapshots.length}</span>
            </div>
            {snapshots.length === 0 ? (
                <div className="empty-list">Chưa có bản lưu bảng trắng</div>
            ) : (
                <div className="snapshot-grid">
                    {snapshots.map((snapshot) => (
                        <article className="snapshot-card" key={snapshot.id}>
                            <img alt={snapshot.title} src={snapshot.dataUrl} />
                            <div>
                                <strong>{snapshot.title}</strong>
                                <span>{snapshot.authorName} · {formatDateTime(snapshot.createdAt)}</span>
                            </div>
                            <div className="row-actions">
                                <button className="ghost-button" onClick={() => onUseSnapshot(snapshot.id)} type="button">
                                    Mở
                                </button>
                                {canManage && (
                                    <button className="delete-button outline" onClick={() => onDeleteSnapshot(snapshot.id)} type="button">
                                        Xóa
                                    </button>
                                )}
                            </div>
                        </article>
                    ))}
                </div>
            )}
        </section>
    )
}

function ClassChatPanel({ disabled = false, messages, onClearChat, onSendMessage, showManageActions = false }) {
    const [messageText, setMessageText] = useState('')

    function handleSubmit(event) {
        event.preventDefault()
        if (!messageText.trim() || disabled) return
        onSendMessage(messageText)
        setMessageText('')
    }

    return (
        <section className="class-chat-panel admin-panel">
            <div className="panel-title">
                <h2>Chat lớp học</h2>
                <span className="badge-count">{messages.length}</span>
            </div>
            <div className="chat-list" role="log">
                {messages.length === 0 ? (
                    <div className="empty-list">Chưa có tin nhắn</div>
                ) : (
                    messages.map((message) => (
                        <article className="chat-message" key={message.id}>
                            <div>
                                <strong>{message.authorName}</strong>
                                <span>{message.role} · {formatDateTime(message.createdAt)}</span>
                            </div>
                            <p>{message.text}</p>
                        </article>
                    ))
                )}
            </div>
            <form className="chat-form" onSubmit={handleSubmit}>
                <textarea
                    disabled={disabled}
                    onChange={(event) => setMessageText(event.target.value)}
                    placeholder={disabled ? 'Lớp chưa mở' : 'Nhập tin nhắn...'}
                    rows="3"
                    value={messageText}
                />
                <div className="button-row">
                    {showManageActions && (
                        <button className="ghost-button" disabled={messages.length === 0} onClick={onClearChat} type="button">
                            Xóa chat
                        </button>
                    )}
                    <button className="primary-button" disabled={disabled || !messageText.trim()} type="submit">
                        Gửi
                    </button>
                </div>
            </form>
        </section>
    )
}

function StudentManagementPanel({ newStudent, onCreateStudent, onDeleteStudent, saving, setNewStudent, students }) {
    function updateField(field, value) {
        setNewStudent((current) => ({ ...current, [field]: value }))
    }

    return (
        <section className="panel-section student-management">
            <div className="panel-title">
                <h2>Tài khoản học sinh</h2>
                <span className="badge-count">{students.length}</span>
            </div>

            <form className="student-create-form" onSubmit={onCreateStudent}>
                <label htmlFor="student-username">Tài khoản đăng nhập</label>
                <input
                    id="student-username"
                    onChange={(event) => updateField('username', event.target.value)}
                    placeholder="vd: hs001"
                    value={newStudent.username}
                />
                <label htmlFor="student-password">Mật khẩu</label>
                <input
                    id="student-password"
                    onChange={(event) => updateField('password', event.target.value)}
                    placeholder="Mật khẩu ban đầu"
                    type="password"
                    value={newStudent.password}
                />
                <label htmlFor="student-display-name">Họ và tên</label>
                <input
                    id="student-display-name"
                    onChange={(event) => updateField('displayName', event.target.value)}
                    placeholder="Nguyễn Văn A"
                    value={newStudent.displayName}
                />
                <div className="form-row compact">
                    <div>
                        <label htmlFor="student-grade">Khối</label>
                        <input
                            id="student-grade"
                            onChange={(event) => updateField('grade', event.target.value)}
                            placeholder="10"
                            value={newStudent.grade}
                        />
                    </div>
                    <div>
                        <label htmlFor="student-class">Lớp</label>
                        <input
                            id="student-class"
                            onChange={(event) => updateField('className', event.target.value)}
                            placeholder="A1"
                            value={newStudent.className}
                        />
                    </div>
                </div>
                <button
                    className="primary-button full-width"
                    disabled={saving || !newStudent.username.trim() || !newStudent.password || !newStudent.displayName.trim()}
                    type="submit"
                >
                    Tạo tài khoản
                </button>
            </form>

            {students.length === 0 ? (
                <div className="empty-list">Chưa có học sinh</div>
            ) : (
                <div className="student-list">
                    {students.map((student) => (
                        <div className="student-row" key={student.id}>
                            <div>
                                <strong>{student.displayName}</strong>
                                <span>{formatStudentLabel(student)}</span>
                                <small>{student.username}</small>
                            </div>
                            <button
                                className="delete-button outline"
                                onClick={() => onDeleteStudent(student.id)}
                                type="button"
                            >
                                Xóa
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </section>
    )
}

function StudentAssignmentPanel({ assignedStudentIds, onToggleAssignedStudent, students, title }) {
    return (
        <div className="student-assignment">
            <label>{title}</label>
            {students.length === 0 ? (
                <p className="field-hint">Tạo tài khoản học sinh trước khi giao đề.</p>
            ) : (
                <div className="assignment-list">
                    {students.map((student) => (
                        <label className="assignment-option" key={student.id}>
                            <input
                                checked={assignedStudentIds.includes(student.id)}
                                onChange={() => onToggleAssignedStudent(student.id)}
                                type="checkbox"
                            />
                            <span>{formatStudentLabel(student)}</span>
                        </label>
                    ))}
                </div>
            )}
        </div>
    )
}

function ScreenMonitoringPanel({ sessions, loading }) {
    return (
        <section className="monitor-panel">
            <div className="panel-title">
                <h2>Theo dõi màn hình</h2>
                <span className="badge-count">{sessions.length}</span>
            </div>
            {sessions.length === 0 ? (
                <div className="empty-list">
                    {loading ? 'Đang tải phiên theo dõi...' : 'Chưa có phiên theo dõi màn hình'}
                </div>
            ) : (
                <div className="monitor-grid">
                    {sessions.map((session) => (
                        <article className="monitor-card" key={session.sessionId}>
                            <div className="monitor-card-head">
                                <div>
                                    <strong>{session.studentName}</strong>
                                    <span>{formatDateTime(session.lastSeenAt)}</span>
                                </div>
                                <span className={session.isActive ? 'status-chip' : 'status-chip warning'}>
                                    {session.isActive ? 'Đang hoạt động' : 'Không hoạt động'}
                                </span>
                            </div>
                            <div className="monitor-preview">
                                {session.lastImageDataUrl ? (
                                    <img alt={`Màn hình của ${session.studentName}`} src={session.lastImageDataUrl} />
                                ) : (
                                    <span>Chưa có ảnh chụp</span>
                                )}
                            </div>
                            <div className="monitor-events">
                                {session.events.map((event) => (
                                    <div className="monitor-event" key={event.id}>
                                        <span>{getMonitorEventText(event.eventType)}</span>
                                        <time>{formatDateTime(event.createdAt)}</time>
                                    </div>
                                ))}
                            </div>
                        </article>
                    ))}
                </div>
            )}
        </section>
    )
}

function AttemptHistory({ attempts, loading }) {
    return (
        <section className="history-panel">
            <div className="panel-title">
                <h2>Lịch sử làm bài</h2>
                <span className="badge-count">{attempts.length}</span>
            </div>
            {attempts.length === 0 ? (
                <div className="empty-list">
                    {loading ? 'Đang tải lịch sử...' : 'Chưa có học viên nào nộp đề này'}
                </div>
            ) : (
                <div className="history-table-wrap">
                    <table className="history-table">
                        <thead>
                            <tr>
                                <th>Học viên</th>
                                <th>Khối / Lớp</th>
                                <th>Điểm</th>
                                <th>Số câu đúng</th>
                                <th>Thời gian làm</th>
                                <th>Trạng thái</th>
                                <th>Nộp lúc</th>
                            </tr>
                        </thead>
                        <tbody>
                            {attempts.map((attempt) => (
                                <tr key={attempt.id}>
                                    <td>{attempt.studentName}</td>
                                    <td>
                                        {[attempt.grade ? `Khối ${attempt.grade}` : null, attempt.className ? `Lớp ${attempt.className}` : null]
                                            .filter(Boolean)
                                            .join(' · ') || '--'}
                                    </td>
                                    <td>{formatScore(attempt.score)} / {formatScore(attempt.scoreTotal)}</td>
                                    <td>{attempt.correctCount}/{attempt.questionCount}</td>
                                    <td>{formatLongDuration(attempt.durationSeconds)}</td>
                                    <td>
                                        <span className={attempt.isTimeExpired ? 'status-chip warning' : 'status-chip'}>
                                            {attempt.isTimeExpired ? 'Hết giờ' : 'Đã nộp'}
                                        </span>
                                    </td>
                                    <td>{formatDateTime(attempt.submittedAt)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    )
}

function TestList({ canDelete = false, disabled = false, emptyText, onDelete, onSelect, selectedId, tests }) {
    if (tests.length === 0) {
        return <div className="empty-list">{emptyText}</div>
    }

    return (
        <div className="test-list">
            {tests.map((test) => (
                <div className={`test-row ${selectedId === test.id ? 'selected' : ''}`} key={test.id}>
                    <button disabled={disabled} onClick={() => onSelect(test.id)} type="button">
                        <strong>{test.testName}</strong>
                        <span className="test-meta">
                            {test.questionCount} câu · {formatScore(test.scoreTotal)} điểm · {test.durationMinutes || 30} phút
                        </span>
                    </button>
                    {canDelete && (
                        <button
                            aria-label={`Xóa ${test.testName}`}
                            className="delete-button-icon"
                            onClick={() => onDelete(test.id)}
                            title="Xóa đề này"
                            type="button"
                        >
                            Xóa
                        </button>
                    )}
                </div>
            ))}
        </div>
    )
}

function EmptyState({ text, title, marker }) {
    return (
        <div className="empty-state">
            <div className="empty-icon" aria-hidden="true">{marker || APP_NAME.slice(0, 2)}</div>
            <h2>{title}</h2>
            <p>{text}</p>
        </div>
    )
}

export default App
