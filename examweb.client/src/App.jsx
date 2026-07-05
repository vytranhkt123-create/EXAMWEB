import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ExamFullscreenView } from './components/ExamFullscreenView'
import { LanguageSwitcher } from './components/LanguageSwitcher'
import { LoginView } from './components/LoginView'
import { MathText } from './components/MathText'
import { PracticeMode } from './components/PracticeMode'
import { QuestionContent } from './components/QuestionContent'
import { TestModeDialog } from './components/TestModeDialog'
import { AdminSchedulePanel } from './components/schedule/AdminSchedulePanel'
import { StudentSchedulePanel } from './components/schedule/StudentSchedulePanel'
import { TeacherArena } from './components/arena/TeacherArena'
import { StudentArena } from './components/arena/StudentArena'
import { APP_NAME, MAX_PDF_FILE_SIZE, THEME_STORAGE_KEY } from './config/appConfig'
import { api, authApi, materialFileApi, materialsApi, onlineClassApi, studentsApi, updateTestQuestion } from './services/api'
import { OnlineClassRoom } from './components/online-class/OnlineClassRoom'
import { CourseWorkspace } from './components/online-class/CourseWorkspace'
import { createExamMonitorRoomId, useExamProctoring } from './hooks/useExamProctoring'
import { useOnlineClassSocket } from './hooks/useOnlineClassSocket'
import { useOnlineClassWebRTC } from './hooks/useOnlineClassWebRTC'
import { clearSession, getModeForSession, getPathForMode, getStoredSession, saveSession } from './services/session'
import { formatDateTime } from './utils/datetime'
import { dataUrlToBlob, readFileAsDataUrl } from './utils/file'
import { compressImageFile } from './utils/image'
import { formatRoleLabel } from './utils/roles'
import './App.css'

const initialNewStudent = () => ({
    fullName: '',
    grade: '',
    className: '',
})

const initialQuestionDraft = () => ({
    content: '',
    questionType: 'MultipleChoice',
    imageUrl: '',
    score: 1,
    answers: [
        { content: '', isCorrect: true },
        { content: '', isCorrect: false },
        { content: '', isCorrect: false },
        { content: '', isCorrect: false },
    ],
})

function createQuestionEditDraft(question) {
    const questionType = question?.questionType || 'MultipleChoice'
    const answers = Array.isArray(question?.answers)
        ? question.answers.map((answer) => ({
            id: answer.id,
            content: answer.content || '',
            isCorrect: Boolean(answer.isCorrect),
        }))
        : []

    while (answers.length < (questionType === 'FillInTheBlank' ? 1 : 2)) {
        answers.push({ content: '', isCorrect: false })
    }

    const correctIndex = answers.findIndex((answer) => answer.isCorrect)
    return {
        content: question?.content || '',
        questionType,
        imageUrl: question?.imageUrl || '',
        score: question?.score || 1,
        answers: questionType === 'FillInTheBlank'
            ? answers.map((answer) => ({ ...answer, isCorrect: true }))
            : answers.map((answer, index) => ({
                ...answer,
                isCorrect: correctIndex === -1 ? index === 0 : index === correctIndex,
            })),
    }
}

function buildQuestionPayload(draft) {
    return {
        content: draft.content.trim(),
        questionType: draft.questionType || 'MultipleChoice',
        imageUrl: draft.imageUrl || null,
        score: Number(draft.score),
        answers: draft.answers.map((answer) => ({
            content: answer.content.trim(),
            isCorrect: draft.questionType === 'FillInTheBlank' || answer.isCorrect,
        })),
    }
}

function isFillInTheBlank(questionOrDraft) {
    return questionOrDraft?.questionType === 'FillInTheBlank'
}

function hasAnswerValue(value) {
    return typeof value === 'string' ? value.trim().length > 0 : Boolean(value)
}

function summarizeTestQuestions(test, questions) {
    return {
        ...test,
        questions,
        questionCount: questions.length,
        scoreTotal: questions.reduce((sum, question) => sum + Number(question.score || 0), 0),
    }
}

const initialOnlineClassState = () => ({
    title: 'Lớp học online',
    agenda: 'Ôn tập, giải đáp bài và làm việc trên bảng trắng.',
    isLive: false,
    whiteboardImage: '',
    updatedAt: null,
})

const ADMIN_SECTIONS = [
    { id: 'dashboard', label: 'Tổng quan', icon: '◫' },
    { id: 'students', label: 'Học sinh', icon: '◉' },
    { id: 'tests', label: 'Đề thi', icon: '▤' },
    { id: 'courses', label: 'Khóa học', icon: 'C' },
    { id: 'documents', label: 'Tài liệu PDF', icon: '▣' },
    { id: 'schedule', label: 'Thời khóa biểu', icon: '▦' },
    { id: 'online', label: 'Lớp học ảo', icon: '◍' },
    { id: 'arena', label: 'Đấu trường', icon: '⚡' },
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

const EXAM_VIOLATION_EVENT_TYPES = new Set([
    'FullscreenExited',
    'ScreenShareStopped',
    'TabHidden',
    'WindowBlur',
])

function getMonitorViolationCount(session) {
    return (session.events || []).filter((event) => EXAM_VIOLATION_EVENT_TYPES.has(event.eventType)).length
}

function App() {
    const [auth, setAuth] = useState(getStoredSession)
    const [theme, setTheme] = useState(() => localStorage.getItem(THEME_STORAGE_KEY) || 'light')
    const [tests, setTests] = useState([])
    const [students, setStudents] = useState([])
    const [assignedStudentIds, setAssignedStudentIds] = useState([])
    const [newTestAssignedStudentIds, setNewTestAssignedStudentIds] = useState([])
    const [newStudent, setNewStudent] = useState(initialNewStudent)
    const [studentTest, setStudentTest] = useState(null)
    const [studentTestMode, setStudentTestMode] = useState(null)
    const [adminTest, setAdminTest] = useState(null)
    const [attemptHistory, setAttemptHistory] = useState([])
    const [screenMonitorSessions, setScreenMonitorSessions] = useState([])
    const [selectedAnswers, setSelectedAnswers] = useState({})
    const [submitResult, setSubmitResult] = useState(null)
    const [startedAt, setStartedAt] = useState(null)
    const [timeLeft, setTimeLeft] = useState(null)
    const [newTestName, setNewTestName] = useState('')
    const [newDurationMinutes, setNewDurationMinutes] = useState(30)
    const [newAllowPracticeMode, setNewAllowPracticeMode] = useState(true)
    const [courseTestClassRoomId, setCourseTestClassRoomId] = useState('')
    const [editTestName, setEditTestName] = useState('')
    const [editDurationMinutes, setEditDurationMinutes] = useState(30)
    const [editAllowPracticeMode, setEditAllowPracticeMode] = useState(true)

    const [adminSection, setAdminSection] = useState('dashboard')
    const [adminTestTab, setAdminTestTab] = useState('settings')
    const [pendingTestId, setPendingTestId] = useState(null)
    const [showModeDialog, setShowModeDialog] = useState(false)
    const [showMonitorDialog, setShowMonitorDialog] = useState(false)
    const [showSubmitConfirm, setShowSubmitConfirm] = useState(false)
    const [fullscreenWarning, setFullscreenWarning] = useState('')
    const [isFullscreen, setIsFullscreen] = useState(false)
    const [markedQuestionIds, setMarkedQuestionIds] = useState([])

    const [inputMethod, setInputMethod] = useState('manual')
    const [questionDraft, setQuestionDraft] = useState(initialQuestionDraft)
    const [editingQuestion, setEditingQuestion] = useState(null)
    const [editQuestionDraft, setEditQuestionDraft] = useState(initialQuestionDraft)
    const [jsonDraft, setJsonDraft] = useState('')
    const [materials, setMaterials] = useState([])
    const [onlineClass, setOnlineClass] = useState(initialOnlineClassState)
    const [whiteboardSnapshots, setWhiteboardSnapshots] = useState([])
    const [chatMessages, setChatMessages] = useState([])
    const [onlineNotice, setOnlineNotice] = useState('')
    const [createdStudentCredentials, setCreatedStudentCredentials] = useState(null)

    const [loading, setLoading] = useState(false)
    const [historyLoading, setHistoryLoading] = useState(false)
    const [monitoringLoading, setMonitoringLoading] = useState(false)
    const [authLoading, setAuthLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const submittingRef = useRef(false)
    const examShellRef = useRef(null)
    const mode = getModeForSession(auth)
    const { t } = useTranslation()

    const {
        message: monitoringMessage,
        recordEvent: recordScreenMonitorEvent,
        restart: restartScreenMonitoring,
        sessionId: monitoringSessionId,
        start: startScreenMonitoring,
        status: monitoringStatus,
        stop: stopScreenStream,
    } = useExamProctoring({
        auth,
        enabled: Boolean(auth?.accessToken),
        isSubmittedRef: submittingRef,
        mode,
        onError: (err) => setError(err.message),
        onWarning: setFullscreenWarning,
        result: submitResult,
        studentTest: studentTestMode === 'exam' ? studentTest : null,
    })

    const toggleTheme = useCallback(() => {
        setTheme((current) => (current === 'dark' ? 'light' : 'dark'))
    }, [])

    const answeredCount = useMemo(() => {
        if (!studentTest || studentTestMode !== 'exam') return 0
        return studentTest.questions.filter((question) => hasAnswerValue(selectedAnswers[question.id])).length
    }, [selectedAnswers, studentTest, studentTestMode])

    const isExamRunning = Boolean(studentTestMode === 'exam' && studentTest && !submitResult && studentTest.questions.length > 0)
    const isExamLocked = Boolean(submitResult || (isExamRunning && (monitoringStatus !== 'active' || !isFullscreen)))

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

    const reportExamViolation = useCallback((eventType, message, warning) => {
        if (studentTestMode !== 'exam' || !studentTest || !monitoringSessionId || submitResult || submittingRef.current) return

        setFullscreenWarning(warning)
        recordScreenMonitorEvent(studentTest.id, monitoringSessionId, eventType, message)
    }, [monitoringSessionId, recordScreenMonitorEvent, studentTestMode, submitResult, studentTest])

    const submitTest = useCallback(async ({ allowIncomplete = false, isTimeExpired = false } = {}) => {
        if (!studentTest || submittingRef.current || submitResult) return

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
                    answers: studentTest.questions
                        .filter((question) => hasAnswerValue(selectedAnswers[question.id]))
                        .map((question) => ({
                            questionId: question.id,
                            answerId: isFillInTheBlank(question) ? null : selectedAnswers[question.id],
                            answerText: isFillInTheBlank(question) ? selectedAnswers[question.id] : null,
                        })),
                }),
            })
            // Lưu response nộp bài để chuyển sang giao diện xem kết quả.
            setSubmitResult(data)
            setTimeLeft(0)
            setShowSubmitConfirm(false)
            await exitExamFullscreen()
        } catch (err) {
            submittingRef.current = false
            setError(err.message)
        } finally {
            setSaving(false)
        }
    }, [answeredCount, monitoringSessionId, selectedAnswers, startedAt, studentTest, submitResult])

    useEffect(() => {
        const onFullscreenChange = () => {
            const active = Boolean(document.fullscreenElement || document.webkitFullscreenElement)
            setIsFullscreen(active)

            if (!active && studentTestMode === 'exam' && studentTest && !submitResult && !submittingRef.current) {
                reportExamViolation(
                    'FullscreenExited',
                    'Học sinh thoát chế độ toàn màn hình',
                    'Cảnh báo: Bạn đã thoát chế độ toàn màn hình. Hành vi này đã được ghi nhận.',
                )
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
    }, [reportExamViolation, studentTestMode, submitResult, studentTest])

    useEffect(() => {
        if (studentTestMode !== 'exam' || !studentTest || submitResult || studentTest.questions.length === 0) return undefined

        const timer = window.setTimeout(() => {
            if (examShellRef.current) {
                enterExamFullscreen(examShellRef.current).catch(() => {
                    setError('Không thể bật toàn màn hình. Vui lòng cho phép trình duyệt.')
                })
            }
        }, 120)

        return () => window.clearTimeout(timer)
    }, [studentTestMode, submitResult, studentTest])

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
        document.documentElement.dataset.theme = theme
        localStorage.setItem(THEME_STORAGE_KEY, theme)
    }, [theme])

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
        if (studentTestMode !== 'exam' || !studentTest || submitResult || studentTest.questions.length === 0 || timeLeft === null) return undefined

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
    }, [studentTestMode, submitResult, studentTest, submitTest, timeLeft])

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
        setCourseTestClassRoomId('')
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
        if (mode !== 'admin' || !adminTest || adminTestTab !== 'monitoring') return undefined

        const timer = window.setTimeout(() => {
            loadScreenMonitoring(adminTest.id)
        }, 0)

        return () => window.clearTimeout(timer)
    }, [adminTest, adminTestTab, loadScreenMonitoring, mode])

    async function confirmStartExam(forcedTestId = pendingTestId) {
        if (!forcedTestId) return

        setError('')
        setSubmitResult(null)
        setSelectedAnswers({})
        setMarkedQuestionIds([])
        setLoading(true)
        submittingRef.current = false
        setFullscreenWarning('')
        setShowModeDialog(false)
        setShowMonitorDialog(false)

        try {
            const testId = forcedTestId
            await enterExamFullscreen(document.documentElement)
            await startScreenMonitoring(testId)
            const data = await api(`/${testId}/take`)
            setStudentTest(data)
            setStudentTestMode('exam')
            setStartedAt(new Date())
            setTimeLeft((data.durationMinutes || 30) * 60)
            setShowModeDialog(false)
            setShowMonitorDialog(false)
            setPendingTestId(null)
        } catch (err) {
            stopScreenStream()
            setStudentTestMode(null)
            if (err?.name === 'NotAllowedError') {
                setError('Cần bật toàn màn hình và chia sẻ màn hình để bắt đầu làm bài')
            } else if (!handleAuthFailure(err)) {
                setError(err.message)
            }
        } finally {
            setLoading(false)
        }
    }

    async function startPracticeMode(forcedTestId = pendingTestId) {
        if (!forcedTestId) return

        setError('')
        setSubmitResult(null)
        setSelectedAnswers({})
        setMarkedQuestionIds([])
        setLoading(true)
        submittingRef.current = false
        setFullscreenWarning('')
        setShowModeDialog(false)
        setShowMonitorDialog(false)

        try {
            const testId = forcedTestId
            const data = await api(`/${testId}/practice`)
            setStudentTest(data)
            setStudentTestMode('practice')
            setStartedAt(null)
            setTimeLeft(null)
            setShowModeDialog(false)
            setShowMonitorDialog(false)
            setPendingTestId(null)
        } catch (err) {
            setStudentTestMode(null)
            if (!handleAuthFailure(err)) {
                setError(err.message)
            }
        } finally {
            setLoading(false)
        }
    }

    async function requestOpenStudentTest(testId) {
        if (studentTest) return
        setPendingTestId(testId)
        setShowModeDialog(true)
        setShowMonitorDialog(false)
        setError('')
    }

    function cancelStartExam() {
        setPendingTestId(null)
        setShowModeDialog(false)
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
            setEditAllowPracticeMode(data.allowPracticeMode !== false)
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
                    classRoomId: courseTestClassRoomId || null,
                    durationMinutes,
                    allowPracticeMode: newAllowPracticeMode,
                    assignedStudentIds: newTestAssignedStudentIds,
                }),
            })
            setNewTestName('')
            setNewDurationMinutes(30)
            setNewAllowPracticeMode(true)
            setNewTestAssignedStudentIds([])
            setCourseTestClassRoomId('')
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
                    allowPracticeMode: editAllowPracticeMode,
                    assignedStudentIds,
                }),
            })
            setAdminTest(updated)
            setEditTestName(updated.testName)
            setEditDurationMinutes(updated.durationMinutes)
            setEditAllowPracticeMode(updated.allowPracticeMode !== false)
            setAssignedStudentIds(updated.assignedStudentIds || [])
            await loadTests()
        } catch (err) {
            setError(err.message)
        } finally {
            setSaving(false)
        }
    }

    function openCourseTestCreator(classRoomId) {
        setCourseTestClassRoomId(classRoomId)
        setNewTestName('')
        setNewDurationMinutes(30)
        setNewAllowPracticeMode(true)
        setNewTestAssignedStudentIds([])
        setAdminSection('tests')
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

        const payload = buildQuestionPayload(questionDraft)

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
                const questionType = question.questionType || 'MultipleChoice'
                const payload = {
                    content: String(question.content || '').trim(),
                    questionType,
                    imageUrl: question.imageUrl || null,
                    score: Number(question.score) || 1,
                    answers: Array.isArray(question.answers)
                        ? question.answers.map((answer) => ({
                            content: String(answer.content || '').trim(),
                            isCorrect: questionType === 'FillInTheBlank' || Boolean(answer.isCorrect),
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

    async function deleteQuestion(questionId, event) {
        event?.preventDefault()
        event?.stopPropagation()
        if (!adminTest) return

        const testId = adminTest.id
        setSaving(true)
        setError('')
        try {
            await api(`/${testId}/questions/${questionId}`, { method: 'DELETE' })
            setAdminTest((current) => {
                if (!current || current.id !== testId) return current
                return summarizeTestQuestions(
                    current,
                    current.questions.filter((question) => question.id !== questionId),
                )
            })
            setEditingQuestion((current) => (current?.id === questionId ? null : current))
            await loadTests()
        } catch (err) {
            if (!handleAuthFailure(err)) {
                setError(err.message)
            }
        } finally {
            setSaving(false)
        }
    }

    function startEditQuestion(question, event) {
        event?.preventDefault()
        event?.stopPropagation()
        setError('')
        setEditingQuestion(question)
        setEditQuestionDraft(createQuestionEditDraft(question))
    }

    function closeEditQuestion() {
        setEditingQuestion(null)
        setEditQuestionDraft(initialQuestionDraft())
    }

    function updateEditQuestionAnswer(index, field, value) {
        setEditQuestionDraft((current) => {
            const answers = current.answers.map((answer, answerIndex) => {
                if (field === 'isCorrect') {
                    return { ...answer, isCorrect: answerIndex === index }
                }
                return answerIndex === index ? { ...answer, [field]: value } : answer
            })
            return { ...current, answers }
        })
    }

    function updateEditQuestionDraftType(questionType) {
        setEditQuestionDraft((current) => {
            const nextAnswers = current.answers.length > 0
                ? current.answers
                : [{ content: '', isCorrect: true }]

            if (questionType === 'FillInTheBlank') {
                return {
                    ...current,
                    questionType,
                    answers: nextAnswers.map((answer) => ({ ...answer, isCorrect: true })),
                }
            }

            const answers = nextAnswers.length >= 2
                ? nextAnswers
                : [...nextAnswers, { content: '', isCorrect: false }]
            const correctIndex = answers.findIndex((item) => item.isCorrect)

            return {
                ...current,
                questionType,
                answers: answers.map((answer, index) => ({
                    ...answer,
                    isCorrect: correctIndex === -1 ? index === 0 : index === correctIndex,
                })),
            }
        })
    }

    function addEditQuestionAnswer() {
        setEditQuestionDraft((current) => ({
            ...current,
            answers: [...current.answers, { content: '', isCorrect: isFillInTheBlank(current) }],
        }))
    }

    function removeEditQuestionAnswer(index) {
        setEditQuestionDraft((current) => {
            const minimumAnswers = isFillInTheBlank(current) ? 1 : 2
            if (current.answers.length <= minimumAnswers) return current
            const answers = current.answers.filter((_, answerIndex) => answerIndex !== index)
            if (isFillInTheBlank(current)) {
                return { ...current, answers: answers.map((answer) => ({ ...answer, isCorrect: true })) }
            }
            if (!answers.some((answer) => answer.isCorrect)) {
                answers[0] = { ...answers[0], isCorrect: true }
            }
            return { ...current, answers }
        })
    }

    async function saveEditedQuestion(event) {
        event.preventDefault()
        if (!adminTest || !editingQuestion) return

        const testId = adminTest.id
        const questionId = editingQuestion.id
        const payload = buildQuestionPayload(editQuestionDraft)

        setSaving(true)
        setError('')
        try {
            const updatedQuestion = await updateTestQuestion(testId, questionId, payload)
            setAdminTest((current) => {
                if (!current || current.id !== testId) return current
                return summarizeTestQuestions(
                    current,
                    current.questions.map((question) =>
                        question.id === questionId ? updatedQuestion : question,
                    ),
                )
            })
            closeEditQuestion()
            await loadTests()
        } catch (err) {
            if (!handleAuthFailure(err)) {
                setError(err.message)
            }
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
        const fullName = newStudent.fullName.trim()
        if (!fullName) {
            setError('Họ tên học sinh không được bỏ trống')
            return
        }

        setSaving(true)
        setError('')
        try {
            const created = await studentsApi('', {
                method: 'POST',
                body: JSON.stringify({
                    fullName,
                    grade: newStudent.grade?.trim() || null,
                    className: newStudent.className?.trim() || null,
                }),
            })
            setNewStudent(initialNewStudent())
            setCreatedStudentCredentials({
                displayName: created.displayName,
                username: created.username,
                password: '123456',
            })
            await loadStudents()
        } catch (err) {
            if (!handleAuthFailure(err)) {
                setError(err.message)
            }
        } finally {
            setSaving(false)
        }
    }

    async function changeStudentPassword(studentId, newPassword) {
        setSaving(true)
        setError('')
        try {
            await studentsApi(`/${studentId}/change-password`, {
                method: 'PUT',
                body: JSON.stringify({ newPassword }),
            })
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
            setError('Tệp PDF vượt quá giới hạn 50MB')
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

    async function sendChatMessage(messageInput) {
        const payload = typeof messageInput === 'string'
            ? { text: messageInput, imageDataUrl: null }
            : messageInput || {}
        const cleanText = String(payload.text || '').trim()
        const imageDataUrl = payload.imageDataUrl || null
        if (!cleanText && !imageDataUrl) return
        try {
            const message = await onlineClassApi('/chat', {
                method: 'POST',
                body: JSON.stringify({ text: cleanText, imageDataUrl }),
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
            return
        }
        if (type === 'exam-monitor-event-recorded' && payload?.testId) {
            if (adminTest?.id === payload.testId) {
                loadScreenMonitoring(payload.testId)
            }
        }
    }

    useOnlineClassSocket({
        auth: auth?.accessToken ? auth : null,
        onRealtimeEvent: handleOnlineRealtimeEvent,
    })

    function resetStudentWork() {
        stopScreenStream()
        exitExamFullscreen()
        setStudentTest(null)
        setStudentTestMode(null)
        setSelectedAnswers({})
        setMarkedQuestionIds([])
        setSubmitResult(null)
        setStartedAt(null)
        setTimeLeft(null)
        setPendingTestId(null)
        setShowModeDialog(false)
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

    function updateQuestionDraftType(questionType) {
        setQuestionDraft((current) => {
            const nextAnswers = current.answers.length > 0
                ? current.answers
                : [{ content: '', isCorrect: true }]

            if (questionType === 'FillInTheBlank') {
                return {
                    ...current,
                    questionType,
                    answers: nextAnswers.slice(0, Math.max(1, nextAnswers.length)).map((answer) => ({
                        ...answer,
                        isCorrect: true,
                    })),
                }
            }

            const answers = nextAnswers.length >= 2
                ? nextAnswers
                : [...nextAnswers, { content: '', isCorrect: false }]

            const correctIndex = answers.findIndex((item) => item.isCorrect)

            return {
                ...current,
                questionType,
                answers: answers.map((answer, index) => ({
                    ...answer,
                    isCorrect: correctIndex === -1 ? index === 0 : index === correctIndex,
                })),
            }
        })
    }

    async function handleQuestionImageChange(file, setter) {
        if (!file) return

        setError('')
        try {
            const imageUrl = await compressImageFile(file, { maxBytes: 720_000, maxSize: 1400 })
            setter((current) => ({ ...current, imageUrl }))
        } catch (err) {
            setError(err.message || 'Could not process question image')
        }
    }

    function addDraftAnswer() {
        setQuestionDraft((current) => ({
            ...current,
            answers: [
                ...current.answers,
                { content: '', isCorrect: isFillInTheBlank(current) },
            ],
        }))
    }

    function removeDraftAnswer(index) {
        setQuestionDraft((current) => {
            const minimumAnswers = isFillInTheBlank(current) ? 1 : 2
            if (current.answers.length <= minimumAnswers) return current
            const answers = current.answers.filter((_, answerIndex) => answerIndex !== index)
            if (isFillInTheBlank(current)) {
                return { ...current, answers: answers.map((answer) => ({ ...answer, isCorrect: true })) }
            }
            if (!answers.some((answer) => answer.isCorrect)) {
                answers[0] = { ...answers[0], isCorrect: true }
            }
            return { ...current, answers }
        })
    }

    function updateFillBlankAnswer(questionId, value) {
        if (isExamLocked) return
        setSelectedAnswers((current) => ({
            ...current,
            [questionId]: value,
        }))
    }

    function selectAnswer(questionId, answerId) {
        if (isExamLocked) return
        setSelectedAnswers((current) => ({
            ...current,
            [questionId]: answerId,
        }))
    }

    function toggleQuestionMark(questionId) {
        setMarkedQuestionIds((current) =>
            current.includes(questionId)
                ? current.filter((id) => id !== questionId)
                : [...current, questionId],
        )
    }

    if (!auth) {
        return (
            <div className={`app-shell auth-shell theme-${theme}`}>
                <div className="global-language-row">
                    <LanguageSwitcher />
                </div>
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
                courseTestClassRoomId={courseTestClassRoomId}
                createdStudentCredentials={createdStudentCredentials}
                editQuestionDraft={editQuestionDraft}
                editAllowPracticeMode={editAllowPracticeMode}
                editDurationMinutes={editDurationMinutes}
                editTestName={editTestName}
                editingQuestion={editingQuestion}
                error={error}
                historyLoading={historyLoading}
                inputMethod={inputMethod}
                jsonDraft={jsonDraft}
                loading={loading}
                materials={materials}
                monitoringLoading={monitoringLoading}
                newAllowPracticeMode={newAllowPracticeMode}
                newDurationMinutes={newDurationMinutes}
                newStudent={newStudent}
                newTestAssignedStudentIds={newTestAssignedStudentIds}
                newTestName={newTestName}
                onAddDraftAnswer={addDraftAnswer}
                onAddEditQuestionAnswer={addEditQuestionAnswer}
                onAddMaterial={addMaterial}
                onClearChat={clearChatMessages}
                onAddQuestion={addQuestion}
                onChangeStudentPassword={changeStudentPassword}
                onCloseCreatedStudentCredentials={() => setCreatedStudentCredentials(null)}
                onCloseEditQuestion={closeEditQuestion}
                onCreateStudent={createStudentAccount}
                onCreateTest={createTest}
                onCreateCourseTest={openCourseTestCreator}
                onDeleteMaterial={deleteMaterial}
                onDeleteQuestion={deleteQuestion}
                onDeleteStudent={deleteStudentAccount}
                onDeleteTest={deleteTest}
                onDeleteWhiteboardSnapshot={deleteWhiteboardSnapshot}
                onImportJson={importQuestionsFromJson}
                onLogout={handleLogout}
                onOpenTest={openAdminTest}
                onClearCourseTestContext={() => setCourseTestClassRoomId('')}
                onQuestionImageChange={handleQuestionImageChange}
                onRemoveDraftAnswer={removeDraftAnswer}
                onRemoveEditQuestionAnswer={removeEditQuestionAnswer}
                onSaveEditQuestion={saveEditedQuestion}
                onSaveWhiteboard={saveWhiteboardImage}
                onSendChatMessage={sendChatMessage}
                onSetAdminSection={setAdminSection}
                onSetAdminTestTab={setAdminTestTab}
                onSetInputMethod={setInputMethod}
                onSetQuestionType={updateQuestionDraftType}
                onSetEditQuestionType={updateEditQuestionDraftType}
                onStartEditQuestion={startEditQuestion}
                onToggleOnlineLive={toggleOnlineClassLive}
                onToggleAssignedStudent={toggleAssignedStudent}
                onToggleNewTestAssignedStudent={toggleNewTestAssignedStudent}
                onUpdateOnlineClass={updateOnlineClassSettings}
                onUpdateDraftAnswer={updateDraftAnswer}
                onUpdateEditQuestionAnswer={updateEditQuestionAnswer}
                onUpdateSettings={updateTestSettings}
                onUseWhiteboardSnapshot={useWhiteboardSnapshot}
                onlineClass={onlineClass}
                onlineNotice={onlineNotice}
                questionDraft={questionDraft}
                saving={saving}
                screenMonitorSessions={screenMonitorSessions}
                setEditDurationMinutes={setEditDurationMinutes}
                setEditQuestionDraft={setEditQuestionDraft}
                setEditAllowPracticeMode={setEditAllowPracticeMode}
                setEditTestName={setEditTestName}
                setJsonDraft={setJsonDraft}
                setNewAllowPracticeMode={setNewAllowPracticeMode}
                setNewDurationMinutes={setNewDurationMinutes}
                setNewStudent={setNewStudent}
                setNewTestName={setNewTestName}
                setQuestionDraft={setQuestionDraft}
                students={students}
                tests={tests}
                theme={theme}
                onToggleTheme={toggleTheme}
                chatMessages={chatMessages}
                whiteboardSnapshots={whiteboardSnapshots}
            />
        )
    }

    const pendingTest = pendingTestId ? tests.find((test) => test.id === pendingTestId) : null

    return (
        <div className={`app-shell role-student theme-${theme}`}>
            {!studentTest && (
                <header className="topbar">
                    <div className="brand-block">
                        <p className="eyebrow">{APP_NAME}</p>
                        <h1>Làm bài tại Lớp học thầy Đạt</h1>
                        <p className="subtitle">Chọn đề được giao và làm bài trong thời gian quy định.</p>
                    </div>
                    <div className="session-card">
                        <span className="role-chip student">Học sinh</span>
                        <div>
                            <strong>{auth.displayName || auth.username}</strong>
                            <small>{auth.username}</small>
                        </div>
                        <button className="ghost-button logout-button" onClick={handleLogout} type="button">
                            {t('nav.logout')}
                        </button>
                        <button className="ghost-button logout-button" onClick={toggleTheme} type="button">
                            {theme === 'dark' ? t('nav.light_mode') : t('nav.dark_mode')}
                        </button>
                        <LanguageSwitcher />
                    </div>
                </header>
            )}

            {error && !studentTest && <div className="alert">{error}</div>}

            {studentTest ? (
                studentTestMode === 'practice' ? (
                    <PracticeMode
                        auth={auth}
                        formatScore={formatScore}
                        key={studentTest.id}
                        markedQuestionIds={markedQuestionIds}
                        onReset={resetStudentWork}
                        onToggleQuestionMark={toggleQuestionMark}
                        studentTest={studentTest}
                    />
                ) : studentTestMode === 'arena' ? (
                    <StudentArena
                        auth={auth}
                        onReset={resetStudentWork}
                        studentTest={studentTest}
                        arenaRoomId={pendingTestId}
                    />
                ) : (
                    <ExamFullscreenView
                        answeredCount={answeredCount}
                        auth={auth}
                        error={error}
                        examShellRef={examShellRef}
                        formatDuration={formatDuration}
                        formatLongDuration={formatLongDuration}
                        formatScore={formatScore}
                        fullscreenWarning={fullscreenWarning}
                        isExamLocked={isExamLocked}
                        isExamRunning={isExamRunning}
                        isFullscreen={isFullscreen}
                        markedQuestionIds={markedQuestionIds}
                        monitoringMessage={monitoringMessage}
                        monitoringStatus={monitoringStatus}
                        onReenterFullscreen={() => enterExamFullscreen(examShellRef.current)}
                        onReset={resetStudentWork}
                        onRestartScreenShare={restartScreenMonitoring}
                        onChangeFillBlankAnswer={updateFillBlankAnswer}
                        onSelectAnswer={selectAnswer}
                        onSubmit={handleSubmitClick}
                        onToggleQuestionMark={toggleQuestionMark}
                        submitResult={submitResult}
                        saving={saving}
                        selectedAnswers={selectedAnswers}
                        studentTest={studentTest}
                        timeLeft={timeLeft}
                    />
                )
            ) : (
                <StudentView
                    auth={auth}
                    chatMessages={chatMessages}
                    loading={loading}
                    materials={materials}
                    onSaveWhiteboard={saveWhiteboardImage}
                    onSelectTest={requestOpenStudentTest}
                    onSendChatMessage={sendChatMessage}
                    onUseWhiteboardSnapshot={useWhiteboardSnapshot}
                    onlineClass={onlineClass}
                    onlineNotice={onlineNotice}
                    tests={tests}
                    whiteboardSnapshots={whiteboardSnapshots}
                />
            )}

            {showModeDialog && (
                <TestModeDialog
                    allowPracticeMode={pendingTest?.allowPracticeMode !== false}
                    loading={loading}
                    onCancel={cancelStartExam}
                    onSelectExam={() => confirmStartExam()}
                    onSelectPractice={() => startPracticeMode()}
                    testName={pendingTest?.testName}
                />
            )}

            {showMonitorDialog && (
                <ScreenMonitorConsentDialog
                    loading={loading}
                    onCancel={cancelStartExam}
                    onConfirm={() => confirmStartExam()}
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

function ScreenMonitorConsentDialog({ loading, onCancel, onConfirm, testName }) {
    return (
        <div className="modal-overlay" role="presentation">
            <div aria-labelledby="monitor-dialog-title" aria-modal="true" className="modal-card monitor-dialog" role="dialog">
                <span className="modal-badge">Theo dõi làm bài</span>
                <h2 id="monitor-dialog-title">Bắt đầu làm bài{testName ? `: ${testName}` : ''}</h2>
                <p>
                    Để đảm bảo tính công bằng, hệ thống sẽ chuyển sang <strong>chế độ toàn màn hình</strong> và ghi nhận
                    các lần rời tab hoặc mất focus trong lúc làm bài.
                </p>
                <ul className="modal-checklist">
                    <li>Thầy giáo có thể xem nhật ký cảnh báo trong quá trình bạn làm bài</li>
                    <li>Thoát toàn màn hình, chuyển tab hoặc mất focus sẽ được ghi nhận</li>
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

function StudentView({
    auth,
    chatMessages,
    loading,
    materials,
    onSaveWhiteboard,
    onSelectTest,
    onSendChatMessage,
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
                        <h2>Thông tin học sinh</h2>
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

                <div className="panel-section">
                    <div className="panel-title">
                        <h2>Đấu trường Real-time</h2>
                    </div>
                    <button
                        className="primary-button full-width"
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px' }}
                        onClick={() => {
                            setStudentTest({ id: 'arena-placeholder', questions: [] })
                            setStudentTestMode('arena')
                        }}
                        type="button"
                    >
                        <span>⚡</span> Tham gia Đấu trường
                    </button>
                </div>
            </aside>

            <section className="work-panel">
                <StudentLearningHub
                    auth={auth}
                    chatMessages={chatMessages}
                    materials={materials}
                    onSaveWhiteboard={onSaveWhiteboard}
                    onSelectTest={onSelectTest}
                    onSendChatMessage={onSendChatMessage}
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
    courseTestClassRoomId,
    createdStudentCredentials,
    editQuestionDraft,
    editAllowPracticeMode,
    editDurationMinutes,
    editTestName,
    editingQuestion,
    error,
    historyLoading,
    inputMethod,
    jsonDraft,
    loading,
    materials,
    monitoringLoading,
    newAllowPracticeMode,
    newDurationMinutes,
    newStudent,
    newTestAssignedStudentIds,
    newTestName,
    onAddDraftAnswer,
    onAddEditQuestionAnswer,
    onAddMaterial,
    onClearChat,
    onAddQuestion,
    onChangeStudentPassword,
    onCloseCreatedStudentCredentials,
    onCloseEditQuestion,
    onCreateStudent,
    onCreateTest,
    onCreateCourseTest,
    onDeleteMaterial,
    onDeleteQuestion,
    onDeleteStudent,
    onDeleteTest,
    onDeleteWhiteboardSnapshot,
    onImportJson,
    onLogout,
    onOpenTest,
    onClearCourseTestContext,
    onQuestionImageChange,
    onToggleTheme,
    onRemoveDraftAnswer,
    onRemoveEditQuestionAnswer,
    onSaveEditQuestion,
    onSaveWhiteboard,
    onSendChatMessage,
    onSetAdminSection,
    onSetAdminTestTab,
    onSetInputMethod,
    onSetQuestionType,
    onSetEditQuestionType,
    onStartEditQuestion,
    onToggleOnlineLive,
    onToggleAssignedStudent,
    onToggleNewTestAssignedStudent,
    onUpdateOnlineClass,
    onUpdateDraftAnswer,
    onUpdateEditQuestionAnswer,
    onUpdateSettings,
    onUseWhiteboardSnapshot,
    onlineClass,
    onlineNotice,
    questionDraft,
    saving,
    screenMonitorSessions,
    setEditDurationMinutes,
    setEditQuestionDraft,
    setEditAllowPracticeMode,
    setEditTestName,
    setJsonDraft,
    setNewAllowPracticeMode,
    setNewDurationMinutes,
    setNewStudent,
    setNewTestName,
    setQuestionDraft,
    students,
    tests,
    theme,
    chatMessages,
    whiteboardSnapshots,
}) {
    const { t } = useTranslation()
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
        <div className={`admin-dashboard theme-${theme}`}>
            <aside className="admin-sidebar">
                <div className="admin-brand">
                    <p className="eyebrow">{APP_NAME}</p>
                    <strong>Bảng điều khiển thầy giáo</strong>
                </div>

                <nav aria-label="Menu thầy giáo" className="admin-nav">
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
                        {t('nav.logout')}
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
                            {adminSection === 'courses' && 'Khóa học video'}
                            {adminSection === 'documents' && 'Tài liệu PDF'}
                            {adminSection === 'schedule' && 'Thời khóa biểu'}
                            {adminSection === 'online' && 'Lớp học online'}
                            {adminSection === 'arena' && 'Đấu trường Real-time'}
                            {adminSection === 'test-edit' && (adminTest?.testName || 'Chi tiết đề')}
                        </h1>
                        <p className="subtitle">Bảng điều khiển quản trị lớp học</p>
                    </div>
                    <div className="admin-topbar-actions">
                        <LanguageSwitcher />
                        <button className="ghost-button" onClick={onToggleTheme} type="button">
                            {theme === 'dark' ? t('nav.light_mode') : t('nav.dark_mode')}
                        </button>
                        <span className="role-chip admin">{t('nav.teacher')}</span>
                    </div>
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
                                title="Chào thầy giáo"
                            />
                        </section>
                    )}

                    {adminSection === 'students' && (
                        <StudentManagementPanel
                            createdStudentCredentials={createdStudentCredentials}
                            newStudent={newStudent}
                            onChangeStudentPassword={onChangeStudentPassword}
                            onCloseCreatedCredentials={onCloseCreatedStudentCredentials}
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
                                {courseTestClassRoomId && (
                                    <div className="alert">
                                        <span>This test will be linked to the selected course.</span>
                                        <button className="ghost-button" onClick={onClearCourseTestContext} type="button">
                                            Clear link
                                        </button>
                                    </div>
                                )}
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
                                <label className="practice-toggle">
                                    <input
                                        checked={newAllowPracticeMode}
                                        onChange={(event) => setNewAllowPracticeMode(event.target.checked)}
                                        type="checkbox"
                                    />
                                    <span>Cho phép chế độ luyện tập</span>
                                </label>
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

                    {adminSection === 'courses' && (
                        <CourseWorkspace
                            canManage
                            onCreateCourseTest={onCreateCourseTest}
                            onOpenCourseTest={onOpenTest}
                            students={students}
                        />
                    )}

                    {adminSection === 'schedule' && <AdminSchedulePanel />}

                    {adminSection === 'online' && (
                        <OnlineClassPanel
                            auth={auth}
                            canManage
                            chatMessages={chatMessages}
                            materials={materials}
                            onlineClass={onlineClass}
                            onlineNotice={onlineNotice}
                            onClearChat={onClearChat}
                            onDeleteWhiteboardSnapshot={onDeleteWhiteboardSnapshot}
                            onSaveWhiteboard={onSaveWhiteboard}
                            onSendChatMessage={onSendChatMessage}
                            onToggleOnlineLive={onToggleOnlineLive}
                            onUpdateOnlineClass={onUpdateOnlineClass}
                            onUseWhiteboardSnapshot={onUseWhiteboardSnapshot}
                            whiteboardSnapshots={whiteboardSnapshots}
                        />
                    )}

                    {adminSection === 'arena' && (
                        <TeacherArena
                            auth={auth}
                            loading={loading}
                            tests={tests}
                            error={error}
                            onOpenTest={handleOpenTest}
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
                                        <label className="practice-toggle">
                                            <input
                                                checked={editAllowPracticeMode}
                                                onChange={(event) => setEditAllowPracticeMode(event.target.checked)}
                                                type="checkbox"
                                            />
                                            <span>Cho phép chế độ luyện tập</span>
                                        </label>
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
                                                <p className="field-hint">Supports LaTeX: $$ E = mc^2 $$ or \(\\frac&#123;1&#125;&#123;2&#125;\)</p>
                                            </div>
                                            <div className="form-row compact">
                                                <label htmlFor="question-type">Question type</label>
                                                <select
                                                    id="question-type"
                                                    onChange={(event) => onSetQuestionType(event.target.value)}
                                                    value={questionDraft.questionType}
                                                >
                                                    <option value="MultipleChoice">Multiple choice</option>
                                                    <option value="FillInTheBlank">Fill in the blank</option>
                                                </select>
                                            </div>
                                            <div className="form-row">
                                                <label htmlFor="question-image">Question image</label>
                                                <input
                                                    accept="image/*"
                                                    id="question-image"
                                                    onChange={(event) => onQuestionImageChange(event.target.files?.[0], setQuestionDraft)}
                                                    type="file"
                                                />
                                                {questionDraft.imageUrl && (
                                                    <div className="question-image-preview">
                                                        <img alt="" src={questionDraft.imageUrl} />
                                                        <button
                                                            className="ghost-button compact-button"
                                                            onClick={() => setQuestionDraft((current) => ({ ...current, imageUrl: '' }))}
                                                            type="button"
                                                        >
                                                            Remove image
                                                        </button>
                                                    </div>
                                                )}
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
                                                <label>
                                                    {isFillInTheBlank(questionDraft)
                                                        ? 'Accepted answers / keywords'
                                                        : 'Các đáp án, chọn một đáp án đúng'}
                                                </label>
                                                {questionDraft.answers.map((answer, index) => (
                                                    <div className="answer-edit-row" key={index}>
                                                        <input
                                                            onChange={(event) =>
                                                                onUpdateDraftAnswer(index, 'content', event.target.value)
                                                            }
                                                            placeholder={isFillInTheBlank(questionDraft) ? `Accepted answer ${index + 1}` : `Đáp án ${index + 1}`}
                                                            value={answer.content}
                                                        />
                                                        {!isFillInTheBlank(questionDraft) && (
                                                            <label className="correct-toggle">
                                                                <input
                                                                    checked={answer.isCorrect}
                                                                    name="correct-answer"
                                                                    onChange={() => onUpdateDraftAnswer(index, 'isCorrect', true)}
                                                                    type="radio"
                                                                />
                                                                <span>Đúng</span>
                                                            </label>
                                                        )}
                                                        <button
                                                            className="ghost-button icon-only"
                                                            disabled={questionDraft.answers.length <= (isFillInTheBlank(questionDraft) ? 1 : 2)}
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
                                                    {isFillInTheBlank(questionDraft) ? 'Add accepted answer' : 'Thêm đáp án'}
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
                                                            <span className="question-type-badge">
                                                                {isFillInTheBlank(question) ? 'Fill blank' : 'Multiple choice'}
                                                            </span>
                                                            <span className="score-badge">{formatScore(question.score)} điểm</span>
                                                            <button
                                                                className="ghost-button compact-button"
                                                                disabled={saving}
                                                                onClick={(event) => onStartEditQuestion(question, event)}
                                                                type="button"
                                                            >
                                                                Sửa
                                                            </button>
                                                            <button
                                                                className="delete-button outline"
                                                                disabled={saving}
                                                                onClick={(event) => onDeleteQuestion(question.id, event)}
                                                                type="button"
                                                            >
                                                                Xóa
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <QuestionContent imageUrl={question.imageUrl} text={question.content} />
                                                    <ul className="answer-review">
                                                        {question.answers.map((answer) => (
                                                            <li className={answer.isCorrect ? 'correct' : ''} key={answer.id}>
                                                                <span className={answer.isCorrect ? 'status-tag true' : 'status-tag false'}>
                                                                    {answer.isCorrect ? 'Đúng' : 'Sai'}
                                                                </span>
                                                                <MathText text={answer.content} />
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
                                <ScreenMonitoringPanel auth={auth} loading={monitoringLoading} sessions={screenMonitorSessions} />
                            )}
                        </section>
                    )}
                </div>
            </div>

            <QuestionEditDialog
                draft={editQuestionDraft}
                onAddAnswer={onAddEditQuestionAnswer}
                onCancel={onCloseEditQuestion}
                onRemoveAnswer={onRemoveEditQuestionAnswer}
                onSave={onSaveEditQuestion}
                onSetDraft={setEditQuestionDraft}
                onSetQuestionType={onSetEditQuestionType}
                onQuestionImageChange={onQuestionImageChange}
                onUpdateAnswer={onUpdateEditQuestionAnswer}
                question={editingQuestion}
                saving={saving}
            />
        </div>
    )
}


function QuestionEditDialog({
    draft,
    onAddAnswer,
    onCancel,
    onRemoveAnswer,
    onSave,
    onSetDraft,
    onSetQuestionType,
    onQuestionImageChange,
    onUpdateAnswer,
    question,
    saving,
}) {
    if (!question) return null

    function handleOverlayClick() {
        if (!saving) {
            onCancel()
        }
    }

    return (
        <div className="modal-overlay" onClick={handleOverlayClick} role="presentation">
            <form
                aria-modal="true"
                className="modal-card question-edit-modal"
                onClick={(event) => event.stopPropagation()}
                onSubmit={onSave}
                role="dialog"
            >
                <span className="modal-badge">Câu hỏi</span>
                <h2>Sửa câu hỏi</h2>

                <div className="question-edit-form">
                    <div className="form-row">
                        <label htmlFor="edit-question-content">Nội dung câu hỏi</label>
                        <textarea
                            autoFocus
                            id="edit-question-content"
                            onChange={(event) =>
                                onSetDraft((current) => ({
                                    ...current,
                                    content: event.target.value,
                                }))
                            }
                            required
                            rows="4"
                            value={draft.content}
                        />
                        <p className="field-hint">Supports LaTeX: $$ E = mc^2 $$ or \(\\frac&#123;1&#125;&#123;2&#125;\)</p>
                    </div>

                    <div className="form-row compact">
                        <label htmlFor="edit-question-type">Question type</label>
                        <select
                            id="edit-question-type"
                            onChange={(event) => onSetQuestionType(event.target.value)}
                            value={draft.questionType}
                        >
                            <option value="MultipleChoice">Multiple choice</option>
                            <option value="FillInTheBlank">Fill in the blank</option>
                        </select>
                    </div>

                    <div className="form-row">
                        <label htmlFor="edit-question-image">Question image</label>
                        <input
                            accept="image/*"
                            id="edit-question-image"
                            onChange={(event) => onQuestionImageChange(event.target.files?.[0], onSetDraft)}
                            type="file"
                        />
                        {draft.imageUrl && (
                            <div className="question-image-preview">
                                <img alt="" src={draft.imageUrl} />
                                <button
                                    className="ghost-button compact-button"
                                    onClick={() => onSetDraft((current) => ({ ...current, imageUrl: '' }))}
                                    type="button"
                                >
                                    Remove image
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="form-row compact">
                        <label htmlFor="edit-question-score">Điểm số</label>
                        <input
                            id="edit-question-score"
                            min="0.25"
                            onChange={(event) =>
                                onSetDraft((current) => ({
                                    ...current,
                                    score: event.target.value,
                                }))
                            }
                            required
                            step="0.25"
                            type="number"
                            value={draft.score}
                        />
                    </div>

                    <div className="answer-editor">
                        <label>
                            {isFillInTheBlank(draft)
                                ? 'Accepted answers / keywords'
                                : 'Các đáp án, chọn một đáp án đúng'}
                        </label>
                        {draft.answers.map((answer, index) => (
                            <div className="answer-edit-row" key={answer.id || index}>
                                <input
                                    onChange={(event) => onUpdateAnswer(index, 'content', event.target.value)}
                                    placeholder={isFillInTheBlank(draft) ? `Accepted answer ${index + 1}` : `Đáp án ${index + 1}`}
                                    required
                                    value={answer.content}
                                />
                                {!isFillInTheBlank(draft) && (
                                    <label className="correct-toggle">
                                        <input
                                            checked={answer.isCorrect}
                                            name={`edit-correct-answer-${question.id}`}
                                            onChange={() => onUpdateAnswer(index, 'isCorrect', true)}
                                            type="radio"
                                        />
                                        <span>Đúng</span>
                                    </label>
                                )}
                                <button
                                    className="ghost-button icon-only"
                                    disabled={saving || draft.answers.length <= (isFillInTheBlank(draft) ? 1 : 2)}
                                    onClick={() => onRemoveAnswer(index)}
                                    type="button"
                                >
                                    Xóa
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="modal-actions question-edit-actions">
                    <button className="ghost-button" onClick={onAddAnswer} type="button">
                        {isFillInTheBlank(draft) ? 'Add accepted answer' : 'Thêm đáp án'}
                    </button>
                    <span className="question-edit-spacer" />
                    <button className="ghost-button" disabled={saving} onClick={onCancel} type="button">
                        Hủy
                    </button>
                    <button className="primary-button" disabled={saving} type="submit">
                        {saving ? 'Đang lưu...' : 'Lưu'}
                    </button>
                </div>
            </form>
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
    onSelectTest,
    onSendChatMessage,
    onUseWhiteboardSnapshot,
    onlineClass,
    onlineNotice,
    whiteboardSnapshots,
}) {
    const [activeTab, setActiveTab] = useState('classroom')

    return (
        <div className="learning-hub">
            <div className="student-hub-tabs">
                <button
                    className={activeTab === 'classroom' ? 'active' : ''}
                    onClick={() => setActiveTab('classroom')}
                    type="button"
                >
                    Lớp học của tôi
                </button>
                <button
                    className={activeTab === 'courses' ? 'active' : ''}
                    onClick={() => setActiveTab('courses')}
                    type="button"
                >
                    Khóa học video
                </button>
                <button
                    className={activeTab === 'schedule' ? 'active' : ''}
                    onClick={() => setActiveTab('schedule')}
                    type="button"
                >
                    Thời khóa biểu
                </button>
                <button
                    className={activeTab === 'materials' ? 'active' : ''}
                    onClick={() => setActiveTab('materials')}
                    type="button"
                >
                    Tài liệu PDF
                </button>
            </div>

            {activeTab === 'classroom' ? (
                <OnlineClassPanel
                    auth={auth}
                    chatMessages={chatMessages}
                    materials={materials}
                    onlineClass={onlineClass}
                    onlineNotice={onlineNotice}
                    onSaveWhiteboard={onSaveWhiteboard}
                    onSendChatMessage={onSendChatMessage}
                    onUseWhiteboardSnapshot={onUseWhiteboardSnapshot}
                    whiteboardSnapshots={whiteboardSnapshots}
                />
            ) : activeTab === 'courses' ? (
                <CourseWorkspace onTakeCourseTest={onSelectTest} />
            ) : activeTab === 'schedule' ? (
                <StudentSchedulePanel auth={auth} />
            ) : (
                <MaterialLibrary materials={materials} />
            )}
        </div>
    )
}

function MaterialLibrary({ canManage = false, materials, onDeleteMaterial }) {
    const [selectedId, setSelectedId] = useState('')
    const selectedMaterial = materials.find((material) => material.id === selectedId) || materials[0]

    async function downloadMaterial(material) {
        if (!material?.id) return

        const blob = await materialFileApi(material.id)
        const objectUrl = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.download = material.fileName || 'document.pdf'
        link.href = objectUrl
        document.body.appendChild(link)
        link.click()
        link.remove()
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0)
    }

    if (materials.length === 0) {
        return (
            <section className="admin-panel material-library">
                <EmptyState
                    marker="PDF"
                    title="Chưa có tài liệu"
                    text={canManage ? 'Thầy giáo thêm PDF ở form bên trái, học sinh sẽ xem được trong mục tài liệu.' : 'Thầy giáo chưa thêm tài liệu PDF cho lớp.'}
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
                            <button className="ghost-button" onClick={() => downloadMaterial(selectedMaterial)} type="button">
                                Tải PDF
                            </button>
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
                    <PdfPreview material={selectedMaterial} />
                </div>
            </div>
        </section>
    )
}

function PdfPreview({ material }) {
    const [pdfUrl, setPdfUrl] = useState('')
    const [previewError, setPreviewError] = useState('')

    useEffect(() => {
        if (!material?.id) return undefined

        let isActive = true
        let objectUrl = ''

        async function loadPdf() {
            setPdfUrl('')
            setPreviewError('')

            try {
                const blob = await materialFileApi(material.id)
                objectUrl = URL.createObjectURL(blob)
            } catch (err) {
                if (!material.dataUrl) {
                    if (isActive) setPreviewError(err.message)
                    return
                }

                try {
                    objectUrl = URL.createObjectURL(dataUrlToBlob(material.dataUrl))
                } catch {
                    if (isActive) setPreviewError('Không thể mở trực tiếp tài liệu PDF này')
                    return
                }
            }

            if (isActive) {
                setPdfUrl(objectUrl)
            } else if (objectUrl) {
                URL.revokeObjectURL(objectUrl)
            }
        }

        loadPdf()

        return () => {
            isActive = false
            if (objectUrl) URL.revokeObjectURL(objectUrl)
        }
    }, [material])

    return (
        <div className="pdf-viewer">
            {pdfUrl ? (
                <iframe
                    className="pdf-viewer-frame"
                    src={pdfUrl}
                    title={material.title}
                />
            ) : (
                <div className="pdf-viewer-state">
                    {previewError || 'Đang mở tài liệu PDF...'}
                </div>
            )}
        </div>
    )
}

function OnlineClassPanel({
    auth,
    canManage = false,
    onlineClass,
    onlineNotice,
    onToggleOnlineLive,
    onUpdateOnlineClass,
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
                        canManage={canManage}
                    />
                </div>
            </div>
        </section>
    )
}

function MeetingDevicePanel({
    auth,
    canManage = false,
}) {
    return (
        <OnlineClassRoom
            auth={auth}
            canManage={canManage}
        />
    )
}

function ClassroomSlidesPanel({ materials, onSelectMaterial, selectedMaterial, selectedMaterialId }) {
    if (materials.length === 0) {
        return (
            <div className="classroom-empty-stage">
                <strong>Chưa có slide/PDF</strong>
                <span>Thầy giáo có thể thêm tài liệu trong mục Tài liệu PDF.</span>
            </div>
        )
    }

    return (
        <div className="classroom-slides-panel">
            <div className="classroom-slide-list">
                {materials.map((material) => (
                    <button
                        className={selectedMaterialId === material.id ? 'active' : ''}
                        key={material.id}
                        onClick={() => onSelectMaterial(material.id)}
                        type="button"
                    >
                        <strong>{material.title}</strong>
                        <span>{material.fileName}</span>
                    </button>
                ))}
            </div>
            {selectedMaterial && (
                <div className="classroom-slide-preview">
                    <PdfPreview material={selectedMaterial} />
                </div>
            )}
        </div>
    )
}

function WhiteboardTool({
    canEdit,
    initialImage,
    onRealtimeClear,
    onRealtimeDraw,
    onSave,
    remoteEvent,
}) {
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

    function drawRemoteSegment(segment) {
        const canvas = canvasRef.current
        if (!canvas || !segment?.from || !segment?.to) return

        const context = canvas.getContext('2d')
        context.save()
        context.lineCap = 'round'
        context.lineJoin = 'round'
        context.lineWidth = segment.tool === 'eraser' ? (segment.lineWidth || 5) * 2.4 : (segment.lineWidth || 5)
        context.strokeStyle = segment.color || '#111827'
        context.globalCompositeOperation = segment.tool === 'eraser' ? 'destination-out' : 'source-over'
        context.beginPath()
        context.moveTo(segment.from.x, segment.from.y)
        context.lineTo(segment.to.x, segment.to.y)
        context.stroke()
        context.restore()
    }

    useEffect(() => {
        if (!remoteEvent) return

        if (remoteEvent.type === 'whiteboard-clear') {
            resetCanvas()
            return
        }

        if (remoteEvent.type === 'whiteboard-draw' && remoteEvent.payload) {
            drawRemoteSegment(remoteEvent.payload)
        }
    }, [remoteEvent, resetCanvas])

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
        const previousPoint = pointsRef.current[pointsRef.current.length - 1] || point
        pointsRef.current.push(point)
        const context = prepareContext()
        onRealtimeDraw?.({
            color,
            from: previousPoint,
            lineWidth,
            to: point,
            tool,
        })

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
        onRealtimeClear?.()
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
    const [imageDataUrl, setImageDataUrl] = useState('')
    const [imageError, setImageError] = useState('')
    const [imageProcessing, setImageProcessing] = useState(false)
    const fileInputRef = useRef(null)

    async function handleImageChange(event) {
        const file = event.target.files?.[0]
        if (!file) return

        setImageError('')
        setImageProcessing(true)
        try {
            const compressed = await compressImageFile(file)
            setImageDataUrl(compressed)
        } catch (err) {
            setImageDataUrl('')
            setImageError(err.message || 'Không thể xử lý ảnh')
        } finally {
            setImageProcessing(false)
        }
    }

    function clearSelectedImage() {
        setImageDataUrl('')
        setImageError('')
        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
    }

    async function handleSubmit(event) {
        event.preventDefault()
        if ((!messageText.trim() && !imageDataUrl) || disabled || imageProcessing) return
        await onSendMessage({ text: messageText, imageDataUrl })
        setMessageText('')
        clearSelectedImage()
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
                                <span>{formatRoleLabel(message.role)} · {formatDateTime(message.createdAt)}</span>
                            </div>
                            {message.text && <p>{message.text}</p>}
                            {message.imageDataUrl && (
                                <img
                                    alt={`Ảnh từ ${message.authorName}`}
                                    className="chat-message-image"
                                    src={message.imageDataUrl}
                                />
                            )}
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
                {imageDataUrl && (
                    <div className="chat-image-preview">
                        <img alt="Ảnh chuẩn bị gửi" src={imageDataUrl} />
                        <button className="ghost-button" onClick={clearSelectedImage} type="button">
                            Bỏ ảnh
                        </button>
                    </div>
                )}
                {imageError && <p className="chat-form-alert" role="alert">{imageError}</p>}
                <div className="button-row">
                    <label className={`chat-image-picker ${disabled || imageProcessing ? 'disabled' : ''}`}>
                        <input
                            accept="image/*"
                            disabled={disabled || imageProcessing}
                            onChange={handleImageChange}
                            ref={fileInputRef}
                            type="file"
                        />
                        {imageProcessing ? 'Đang nén ảnh...' : 'Thêm ảnh'}
                    </label>
                    {showManageActions && (
                        <button className="ghost-button" disabled={messages.length === 0} onClick={onClearChat} type="button">
                            Xóa chat
                        </button>
                    )}
                    <button className="primary-button" disabled={disabled || imageProcessing || (!messageText.trim() && !imageDataUrl)} type="submit">
                        Gửi
                    </button>
                </div>
            </form>
        </section>
    )
}

function StudentManagementPanel({
    createdStudentCredentials,
    newStudent,
    onChangeStudentPassword,
    onCloseCreatedCredentials,
    onCreateStudent,
    onDeleteStudent,
    saving,
    setNewStudent,
    students,
}) {
    const [passwordDialogStudent, setPasswordDialogStudent] = useState(null)
    const [newPassword, setNewPassword] = useState('')
    const [passwordError, setPasswordError] = useState('')
    const [toastMessage, setToastMessage] = useState('')

    useEffect(() => {
        if (!toastMessage) return undefined

        const timer = window.setTimeout(() => setToastMessage(''), 3200)
        return () => window.clearTimeout(timer)
    }, [toastMessage])

    function updateField(field, value) {
        setNewStudent((current) => ({ ...current, [field]: value }))
    }

    function openPasswordDialog(student) {
        setPasswordDialogStudent(student)
        setNewPassword('')
        setPasswordError('')
    }

    function closePasswordDialog() {
        if (saving) return
        setPasswordDialogStudent(null)
        setNewPassword('')
        setPasswordError('')
    }

    async function handlePasswordSubmit(event) {
        event.preventDefault()
        const cleanPassword = newPassword.trim()
        if (!cleanPassword) {
            setPasswordError('Nhập mật khẩu mới')
            return
        }

        const targetStudent = passwordDialogStudent
        if (!targetStudent) return

        setPasswordError('')
        const changed = await onChangeStudentPassword(targetStudent.id, cleanPassword)
        if (changed) {
            closePasswordDialog()
            setToastMessage(`Đã đổi mật khẩu cho ${targetStudent.displayName}`)
        }
    }

    return (
        <section className="panel-section student-management">
            <div className="panel-title">
                <h2>Tài khoản học sinh</h2>
                <span className="badge-count">{students.length}</span>
            </div>

            {toastMessage && (
                <div className="student-toast" role="status">
                    {toastMessage}
                </div>
            )}

            <form className="student-create-form" onSubmit={onCreateStudent}>
                <label htmlFor="student-full-name">Họ và tên</label>
                <input
                    id="student-full-name"
                    onChange={(event) => updateField('fullName', event.target.value)}
                    placeholder="Nguyễn Văn A"
                    value={newStudent.fullName}
                />
                <p className="field-hint">
                    Tên đăng nhập sẽ được sinh tự động. Mật khẩu mặc định là 123456.
                </p>
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
                    disabled={saving || !newStudent.fullName.trim()}
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
                            <div className="student-row-actions">
                                <button
                                    className="ghost-button student-password-button"
                                    onClick={() => openPasswordDialog(student)}
                                    type="button"
                                >
                                    <KeyIcon />
                                    Đổi mật khẩu
                                </button>
                                <button
                                    className="delete-button outline"
                                    onClick={() => onDeleteStudent(student.id)}
                                    type="button"
                                >
                                    Xóa
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {createdStudentCredentials && (
                <CreatedStudentCredentialsModal
                    credentials={createdStudentCredentials}
                    onClose={onCloseCreatedCredentials}
                />
            )}

            {passwordDialogStudent && (
                <ChangeStudentPasswordModal
                    error={passwordError}
                    newPassword={newPassword}
                    onCancel={closePasswordDialog}
                    onChangePassword={setNewPassword}
                    onSubmit={handlePasswordSubmit}
                    saving={saving}
                    student={passwordDialogStudent}
                />
            )}
        </section>
    )
}

function KeyIcon() {
    return (
        <svg aria-hidden="true" fill="none" focusable="false" viewBox="0 0 24 24">
            <path
                d="M14.5 9.5a4.5 4.5 0 1 1-1.35 3.2L4 21.85 2.15 20 11.3 10.85A4.5 4.5 0 0 1 14.5 9.5Z"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
            />
            <path
                d="m6.5 19.5 2 2M8.75 17.25l2 2M15.75 8.25h.01"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
            />
        </svg>
    )
}

function CreatedStudentCredentialsModal({ credentials, onClose }) {
    return (
        <div className="modal-overlay" role="presentation">
            <div aria-labelledby="created-student-title" aria-modal="true" className="modal-card account-modal" role="dialog">
                <span className="modal-badge">Tài khoản mới</span>
                <h2 id="created-student-title">Tạo thành công!</h2>
                <p className="modal-copy">
                    Gửi thông tin đăng nhập dưới đây cho học sinh.
                </p>
                <div className="generated-account-summary">
                    <div>
                        <span>Học sinh</span>
                        <strong>{credentials.displayName}</strong>
                    </div>
                    <div>
                        <span>Tên đăng nhập</span>
                        <code>{credentials.username}</code>
                    </div>
                    <div>
                        <span>Mật khẩu</span>
                        <code>{credentials.password}</code>
                    </div>
                </div>
                <div className="modal-actions">
                    <button className="primary-button" onClick={onClose} type="button">
                        Đã hiểu
                    </button>
                </div>
            </div>
        </div>
    )
}

function ChangeStudentPasswordModal({
    error,
    newPassword,
    onCancel,
    onChangePassword,
    onSubmit,
    saving,
    student,
}) {
    return (
        <div className="modal-overlay" role="presentation">
            <div aria-labelledby="change-password-title" aria-modal="true" className="modal-card account-modal" role="dialog">
                <span className="modal-badge">Đổi mật khẩu</span>
                <h2 id="change-password-title">{student.displayName}</h2>
                <form className="change-password-form" onSubmit={onSubmit}>
                    <label className="form-row" htmlFor="student-new-password">
                        <span>Mật khẩu mới</span>
                        <input
                            autoFocus
                            id="student-new-password"
                            onChange={(event) => onChangePassword(event.target.value)}
                            placeholder="Nhập mật khẩu mới"
                            type="password"
                            value={newPassword}
                        />
                    </label>
                    {error && <p className="chat-form-alert" role="alert">{error}</p>}
                    <div className="modal-actions">
                        <button className="ghost-button" disabled={saving} onClick={onCancel} type="button">
                            Hủy
                        </button>
                        <button className="primary-button" disabled={saving || !newPassword.trim()} type="submit">
                            {saving ? 'Đang lưu...' : 'Lưu'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
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

function ScreenMonitoringPanel({ auth, sessions, loading }) {
    const [selectedSessionId, setSelectedSessionId] = useState('')
    const selectedSession = useMemo(
        () => sessions.find((session) => session.sessionId === selectedSessionId) || null,
        [selectedSessionId, sessions],
    )

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
                    {sessions.map((session) => {
                        const violationCount = getMonitorViolationCount(session)
                        const hasWarning = violationCount > 0 || EXAM_VIOLATION_EVENT_TYPES.has(session.lastEventType)
                        return (
                            <article
                                className={`monitor-card ${selectedSessionId === session.sessionId ? 'selected' : ''}`}
                                key={session.sessionId}
                            >
                                <div className="monitor-card-head">
                                    <div>
                                        <strong>{session.studentName}</strong>
                                        <span>{formatDateTime(session.lastSeenAt)}</span>
                                    </div>
                                    <span className={hasWarning ? 'status-chip danger' : session.isActive ? 'status-chip' : 'status-chip warning'}>
                                        {hasWarning
                                            ? `${Math.max(violationCount, 1)} cảnh báo`
                                            : session.isActive
                                                ? 'Đang thi'
                                                : 'Không hoạt động'}
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
                                        <div
                                            className={`monitor-event ${EXAM_VIOLATION_EVENT_TYPES.has(event.eventType) ? 'warning' : ''}`}
                                            key={event.id}
                                        >
                                            <span>{getMonitorEventText(event.eventType)}</span>
                                            <time>{formatDateTime(event.createdAt)}</time>
                                        </div>
                                    ))}
                                </div>
                                <button
                                    className="primary-button full-width"
                                    onClick={() => setSelectedSessionId(session.sessionId)}
                                    type="button"
                                >
                                    Xem trực tiếp
                                </button>
                            </article>
                        )
                    })}
                </div>
            )}
            {selectedSession && (
                <ExamMonitorLivePanel
                    auth={auth}
                    onClose={() => setSelectedSessionId('')}
                    session={selectedSession}
                />
            )}
        </section>
    )
}

function ExamMonitorLivePanel({ auth, onClose, session }) {
    const roomId = useMemo(
        () => createExamMonitorRoomId(session.testId, session.sessionId),
        [session.sessionId, session.testId],
    )
    const [liveError, setLiveError] = useState('')
    const {
        isJoined,
        joinMeeting,
        leaveMeeting,
        mediaError,
        peerList,
    } = useOnlineClassWebRTC({
        auth,
        roomId,
        enabled: Boolean(auth?.accessToken),
        autoStartMedia: false,
        mediaConstraints: null,
        receiveOnly: true,
        onRoomError: setLiveError,
    })

    useEffect(() => {
        joinMeeting(roomId)
        return () => {
            leaveMeeting()
        }
    }, [joinMeeting, leaveMeeting, roomId])

    const streamPeers = peerList.filter((peer) => peer.stream)

    return (
        <div className="monitor-live-panel">
            <div className="monitor-live-head">
                <div>
                    <p className="eyebrow">Live screen</p>
                    <h3>{session.studentName}</h3>
                    <span>{isJoined ? 'Đang kết nối WebRTC' : 'Đang vào phòng giám sát'}</span>
                </div>
                <button className="ghost-button" onClick={onClose} type="button">
                    Đóng
                </button>
            </div>
            {(liveError || mediaError) && (
                <p className="monitor-live-alert" role="alert">
                    {liveError || mediaError}
                </p>
            )}
            {streamPeers.length === 0 ? (
                <div className="monitor-live-empty">
                    <strong>Đang chờ phiên làm bài của học sinh</strong>
                    <span>Học sinh cần đang làm bài trong chế độ toàn màn hình.</span>
                </div>
            ) : (
                <div className="monitor-live-grid">
                    {streamPeers.map((peer) => (
                        <MonitorLiveVideo key={peer.connectionId} peer={peer} studentName={session.studentName} />
                    ))}
                </div>
            )}
        </div>
    )
}

function MonitorLiveVideo({ peer, studentName }) {
    const videoRef = useRef(null)

    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.srcObject = peer.stream || null
        }
    }, [peer.stream])

    return (
        <div className="monitor-live-video">
            <video autoPlay playsInline ref={videoRef} />
            <span>{studentName || peer.displayName}</span>
        </div>
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
                    {loading ? 'Đang tải lịch sử...' : 'Chưa có học sinh nào nộp đề này'}
                </div>
            ) : (
                <div className="history-table-wrap">
                    <table className="history-table">
                        <thead>
                            <tr>
                                <th>Học sinh</th>
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
