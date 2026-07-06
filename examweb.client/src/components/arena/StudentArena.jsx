import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ARENA_PHASES, useArenaSocket } from '../../hooks/useArenaSocket'
import { MathText } from '../MathText'

const FEEDBACK_DELAY_MS = 3000

const ANSWER_THEMES = [
    { key: 'red', symbol: '▲', label: 'A' },
    { key: 'blue', symbol: '◆', label: 'B' },
    { key: 'gold', symbol: '●', label: 'C' },
    { key: 'green', symbol: '■', label: 'D' },
]

function formatScore(value) {
    return Number(value || 0).toLocaleString('vi-VN', { maximumFractionDigits: 0 })
}

function getPhase(roomState) {
    if (!roomState) return ARENA_PHASES.LOBBY
    if (roomState.gameOver) return ARENA_PHASES.PODIUM
    if (roomState.phase) return roomState.phase
    if (roomState.currentQuestionIndex === -1) return ARENA_PHASES.LOBBY
    return roomState.showAnswers ? ARENA_PHASES.RESULT : ARENA_PHASES.IN_GAME
}

function getRemainingMs(target, now) {
    if (!target) return 0
    return Math.max(0, Date.parse(target) - now)
}

function getPlayerRank(roomState) {
    if (roomState?.currentPlayer?.rank) return roomState.currentPlayer.rank
    const connectionId = roomState?.currentPlayer?.connectionId
    return roomState?.leaderboard?.find((player) => player.connectionId === connectionId)?.rank || null
}

function getServerQuestionIndex(roomState) {
    const index = roomState?.currentPlayer?.currentQuestionIndex ?? roomState?.currentQuestionIndex ?? 0
    return Number.isFinite(Number(index)) ? Number(index) : 0
}

export function StudentArena({
    arenaRoomId,
    auth,
    onClose,
    setStudentTest,
    setStudentTestMode,
}) {
    const [pin, setPin] = useState(arenaRoomId || '')
    const [name, setName] = useState(() => auth?.displayName || '')
    const [joined, setJoined] = useState(false)
    const [now, setNow] = useState(() => Date.now())
    const [isAnswering, setIsAnswering] = useState(true)
    const [answerFeedback, setAnswerFeedback] = useState(null)
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
    const [waitingForOthers, setWaitingForOthers] = useState(false)
    const handledFeedbackKeyRef = useRef('')

    const {
        isConnected,
        roomState,
        error,
        setError,
        joinRoom,
        submitAnswer,
        requestStudentQuestion,
    } = useArenaSocket()

    const phase = getPhase(roomState)
    const currentPlayer = roomState?.currentPlayer
    const currentQuestion = roomState?.currentQuestion
    const totalQuestions = Number(roomState?.totalQuestions || 0)
    const leaderboard = roomState?.leaderboard || []
    const myRank = getPlayerRank(roomState)
    const serverQuestionIndex = getServerQuestionIndex(roomState)

    useEffect(() => {
        const timer = window.setInterval(() => setNow(Date.now()), 150)
        return () => window.clearInterval(timer)
    }, [])

    useEffect(() => {
        if (phase !== ARENA_PHASES.IN_GAME && phase !== ARENA_PHASES.WAITING_FOR_OTHERS) return undefined

        const syncTimer = window.setTimeout(() => {
            const safeIndex = Math.max(0, serverQuestionIndex)
            const isFinished = Boolean(currentPlayer?.isFinished || safeIndex >= totalQuestions)

            setCurrentQuestionIndex(safeIndex)
            setWaitingForOthers(isFinished || phase === ARENA_PHASES.WAITING_FOR_OTHERS)

            if (!isFinished && !currentPlayer?.hasAnswered) {
                setIsAnswering(true)
                setAnswerFeedback(null)
                handledFeedbackKeyRef.current = ''
            }
        }, 0)

        return () => window.clearTimeout(syncTimer)
    }, [
        currentPlayer?.hasAnswered,
        currentPlayer?.isFinished,
        phase,
        serverQuestionIndex,
        totalQuestions,
    ])

    useEffect(() => {
        if (
            !joined ||
            phase !== ARENA_PHASES.IN_GAME ||
            waitingForOthers ||
            currentQuestion ||
            currentQuestionIndex >= totalQuestions
        ) {
            return undefined
        }

        const requestTimer = window.setTimeout(() => {
            requestStudentQuestion(currentQuestionIndex)
        }, 0)

        return () => window.clearTimeout(requestTimer)
    }, [
        currentQuestion,
        currentQuestionIndex,
        joined,
        phase,
        requestStudentQuestion,
        totalQuestions,
        waitingForOthers,
    ])

    const moveToNextQuestion = useCallback(() => {
        const nextIndex = currentQuestionIndex + 1

        setAnswerFeedback(null)
        handledFeedbackKeyRef.current = ''

        if (nextIndex >= totalQuestions) {
            setCurrentQuestionIndex(nextIndex)
            setIsAnswering(false)
            setWaitingForOthers(true)
            requestStudentQuestion(nextIndex)
            return
        }

        setCurrentQuestionIndex(nextIndex)
        setIsAnswering(false)
        setWaitingForOthers(false)
        requestStudentQuestion(nextIndex)
    }, [currentQuestionIndex, requestStudentQuestion, totalQuestions])

    useEffect(() => {
        const hasServerFeedback = currentPlayer?.selectedAnswerId &&
            typeof currentPlayer.lastAnswerCorrect === 'boolean' &&
            currentPlayer.currentQuestionIndex === currentQuestionIndex

        if (!hasServerFeedback) return undefined

        const feedbackKey = [
            currentQuestionIndex,
            currentPlayer.selectedAnswerId,
            currentPlayer.lastAnswerCorrect,
            currentPlayer.scoreDelta,
        ].join(':')

        if (handledFeedbackKeyRef.current === feedbackKey) return undefined
        handledFeedbackKeyRef.current = feedbackKey

        const nextFeedback = {
            isPending: false,
            selectedAnswerId: currentPlayer.selectedAnswerId,
            isCorrect: currentPlayer.lastAnswerCorrect,
            scoreDelta: currentPlayer.scoreDelta || 0,
            speedBonus: currentPlayer.speedBonus || 0,
            streakBonus: currentPlayer.streakBonus || 0,
            streak: currentPlayer.streak || 0,
            rank: currentPlayer.rank || null,
        }

        const showFeedbackTimer = window.setTimeout(() => {
            setAnswerFeedback(nextFeedback)
        }, 0)
        const nextQuestionTimer = window.setTimeout(() => {
            moveToNextQuestion()
        }, FEEDBACK_DELAY_MS)

        return () => {
            window.clearTimeout(showFeedbackTimer)
            window.clearTimeout(nextQuestionTimer)
        }
    }, [
        currentPlayer?.currentQuestionIndex,
        currentPlayer?.lastAnswerCorrect,
        currentPlayer?.rank,
        currentPlayer?.scoreDelta,
        currentPlayer?.selectedAnswerId,
        currentPlayer?.speedBonus,
        currentPlayer?.streak,
        currentPlayer?.streakBonus,
        currentQuestionIndex,
        moveToNextQuestion,
    ])

    const countdownRemaining = Math.ceil(getRemainingMs(roomState?.countdownEndsAt, now) / 1000)
    const questionRemainingMs = getRemainingMs(roomState?.questionEndsAt, now)
    const questionDurationMs = Math.max(1, Number(roomState?.questionDurationSeconds || 20) * 1000)
    const timePercent = Math.max(0, Math.min(100, (questionRemainingMs / questionDurationMs) * 100))
    const selectedAnswerId = answerFeedback?.selectedAnswerId || currentPlayer?.selectedAnswerId
    const selectedAnswer = useMemo(
        () => currentQuestion?.answers?.find((answer) => answer.id === selectedAnswerId) || null,
        [currentQuestion?.answers, selectedAnswerId],
    )
    const correctAnswer = currentQuestion?.answers?.find((answer) => answer.isCorrect)

    const handleJoin = (event) => {
        event.preventDefault()
        const normalizedPin = pin.trim()
        const normalizedName = name.trim()

        if (!normalizedPin || !normalizedName) {
            setError('Vui lòng nhập mã PIN và tên hiển thị.')
            return
        }

        setError(null)
        const sent = joinRoom(normalizedPin, normalizedName, 'player')
        if (sent) {
            setJoined(true)
        }
    }

    const handleAnswerSelect = (answer) => {
        if (!answer?.id || !isAnswering || answerFeedback || waitingForOthers) return

        setIsAnswering(false)
        setAnswerFeedback({
            isPending: true,
            selectedAnswerId: answer.id,
            isCorrect: null,
            scoreDelta: 0,
            speedBonus: 0,
            streakBonus: 0,
            streak: currentPlayer?.streak || 0,
            rank: myRank,
        })

        const sent = submitAnswer(answer.id, currentQuestionIndex)
        if (!sent) {
            setIsAnswering(true)
            setAnswerFeedback(null)
        }
    }

    const handleClose = () => {
        if (typeof onClose === 'function') {
            onClose()
            return
        }

        setStudentTest?.(null)
        setStudentTestMode?.(null)
    }

    if (!joined || !roomState) {
        return (
            <main className="arena-player-shell arena-join-stage">
                <section className="arena-join-card" aria-labelledby="arena-join-title">
                    <div className="arena-logo-mark">A</div>
                    <p className="arena-kicker">Đấu trường realtime</p>
                    <h1 id="arena-join-title">Vào phòng Arena</h1>
                    <p className="arena-muted">Nhập PIN từ giáo viên, đặt biệt danh thật nổi bật và sẵn sàng đua điểm.</p>

                    {error && <p className="arena-alert" role="alert">{error}</p>}

                    <form className="arena-join-form" onSubmit={handleJoin}>
                        <label htmlFor="arena-pin">Mã PIN</label>
                        <input
                            autoComplete="off"
                            id="arena-pin"
                            inputMode="numeric"
                            maxLength={6}
                            onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 6))}
                            placeholder="123456"
                            value={pin}
                        />

                        <label htmlFor="arena-name">Biệt danh</label>
                        <input
                            autoComplete="nickname"
                            id="arena-name"
                            maxLength={40}
                            onChange={(event) => setName(event.target.value)}
                            placeholder="Tên của bạn"
                            value={name}
                        />

                        <button className="arena-primary-btn" disabled={!isConnected} type="submit">
                            {isConnected ? 'Tham gia' : 'Đang kết nối...'}
                        </button>
                    </form>

                    <button className="arena-link-btn" onClick={handleClose} type="button">
                        Quay lại
                    </button>
                </section>
            </main>
        )
    }

    if (phase === ARENA_PHASES.LOBBY) {
        return (
            <main className="arena-player-shell arena-waiting-stage">
                <section className="arena-waiting-card">
                    <p className="arena-kicker">Đã vào phòng</p>
                    <h1>{roomState.testName || 'Arena'}</h1>
                    <div className="arena-pin-display">
                        <span>PIN</span>
                        <strong>{roomState.roomId || pin}</strong>
                    </div>
                    <p className="arena-muted">
                        Bạn đang thi đấu với tên <strong>{currentPlayer?.name}</strong>. Chờ giáo viên bắt đầu trận.
                    </p>
                    <div className="arena-pulse-row" aria-live="polite">
                        <span />
                        Đang chờ tín hiệu Start
                    </div>
                </section>
            </main>
        )
    }

    if (phase === ARENA_PHASES.COUNTDOWN) {
        return (
            <main className="arena-player-shell arena-countdown-stage">
                <section className="arena-countdown-card" aria-live="assertive">
                    <p className="arena-kicker">Chuẩn bị</p>
                    <div className="arena-countdown-number">{Math.max(1, countdownRemaining || 1)}</div>
                    <h1>Sắp bắt đầu</h1>
                    <p className="arena-muted">Giữ mắt trên màn hình, trả lời càng nhanh điểm càng cao.</p>
                </section>
            </main>
        )
    }

    if (phase === ARENA_PHASES.PODIUM) {
        const podium = (roomState.podium?.length ? roomState.podium : leaderboard).slice(0, 3)
        return (
            <main className="arena-player-shell arena-podium-stage">
                <section className="arena-student-podium">
                    <p className="arena-kicker">Kết thúc trận</p>
                    <h1>Podium</h1>

                    <div className="arena-podium-row">
                        {podium.map((player, index) => (
                            <article className={`arena-podium-card rank-${index + 1}`} key={player.connectionId || player.name}>
                                <span>#{player.rank}</span>
                                <strong>{player.name}</strong>
                                <small>{formatScore(player.score)} điểm</small>
                            </article>
                        ))}
                    </div>

                    <div className="arena-my-result">
                        <span>Thành tích của bạn</span>
                        <strong>{formatScore(currentPlayer?.score)} điểm</strong>
                        <small>{myRank ? `Hạng #${myRank}` : 'Chưa có hạng'}</small>
                    </div>

                    <button className="arena-danger-btn" onClick={handleClose} type="button">
                        Rời Arena
                    </button>
                </section>
            </main>
        )
    }

    const showWaitingForOthers = waitingForOthers ||
        phase === ARENA_PHASES.WAITING_FOR_OTHERS ||
        (currentPlayer?.isFinished && !answerFeedback)

    if (showWaitingForOthers) {
        return (
            <main className="arena-player-shell arena-waiting-stage">
                <section className="arena-waiting-card arena-complete-card">
                    <p className="arena-kicker">Hoàn thành</p>
                    <h1>Bạn đã hoàn thành!</h1>
                    <p className="arena-muted">Đang đợi các bạn khác trả lời xong. Bảng xếp hạng sẽ cập nhật liên tục.</p>

                    <div className="arena-my-result">
                        <span>Điểm hiện tại</span>
                        <strong>{formatScore(currentPlayer?.score)} điểm</strong>
                        <small>{myRank ? `Hạng #${myRank}` : 'Đang xếp hạng'}</small>
                    </div>

                    <div className="arena-pulse-row" aria-live="polite">
                        <span />
                        Đang chờ Podium
                    </div>
                </section>
            </main>
        )
    }

    const feedbackIsFinal = answerFeedback && !answerFeedback.isPending
    const feedbackClass = feedbackIsFinal
        ? answerFeedback.isCorrect ? 'correct' : 'wrong'
        : ''
    const flashClass = feedbackClass ? `arena-flash-${feedbackClass}` : ''
    const answerLocked = !isAnswering || Boolean(answerFeedback)

    return (
        <main className={`arena-player-shell arena-game-stage ${flashClass}`}>
            <section className="arena-player-hud">
                <div>
                    <span>Câu {currentQuestionIndex + 1}/{totalQuestions}</span>
                    <strong>{currentPlayer?.name}</strong>
                </div>
                <div className="arena-score-pill">
                    <span>Điểm</span>
                    <strong>{formatScore(currentPlayer?.score)}</strong>
                </div>
                <div className="arena-score-pill">
                    <span>Hạng</span>
                    <strong>{myRank ? `#${myRank}` : '--'}</strong>
                </div>
            </section>

            <div className="arena-time-track" aria-label="Thời gian còn lại">
                <span style={{ width: `${timePercent}%` }} />
            </div>

            <section className="arena-question-card">
                <div className="arena-question-text">
                    <MathText text={currentQuestion?.content || ''} />
                </div>
                {currentQuestion?.imageUrl && (
                    <img
                        alt=""
                        className="arena-question-image"
                        loading="lazy"
                        src={currentQuestion.imageUrl}
                    />
                )}
            </section>

            <section className="arena-answer-grid" aria-label="Các đáp án">
                {(currentQuestion?.answers || []).map((answer, index) => {
                    const theme = ANSWER_THEMES[index % ANSWER_THEMES.length]
                    const selected = answer.id === selectedAnswerId
                    const showCorrect = feedbackIsFinal && answer.isCorrect
                    const showWrong = feedbackIsFinal && selected && !answerFeedback.isCorrect

                    return (
                        <button
                            className={[
                                'arena-answer-card',
                                `theme-${theme.key}`,
                                selected ? 'selected' : '',
                                showCorrect ? 'is-correct' : '',
                                showWrong ? 'is-wrong' : '',
                                answerLocked ? 'is-locked' : '',
                            ].filter(Boolean).join(' ')}
                            disabled={answerLocked}
                            key={answer.id}
                            onClick={() => handleAnswerSelect(answer)}
                            type="button"
                        >
                            <span className="arena-answer-symbol">{theme.symbol}</span>
                            <span className="arena-answer-copy">
                                <MathText text={answer.content} />
                            </span>
                        </button>
                    )
                })}
            </section>

            {answerFeedback && (
                <section className={`arena-answer-feedback ${answerFeedback.isPending ? 'pending' : feedbackClass}`} aria-live="polite">
                    <span>
                        {answerFeedback.isPending
                            ? 'Đang chấm điểm'
                            : answerFeedback.isCorrect
                                ? 'Chính xác'
                                : 'Chưa đúng'}
                    </span>
                    <strong>
                        {answerFeedback.isPending
                            ? '...'
                            : answerFeedback.isCorrect
                                ? `+${formatScore(answerFeedback.scoreDelta)} điểm`
                                : '+0 điểm'}
                    </strong>
                    <div className="arena-bonus-row">
                        <small>Streak {answerFeedback.streak || 0}</small>
                        <small>Speed +{formatScore(answerFeedback.speedBonus)}</small>
                        {answerFeedback.rank && <small>Hạng #{answerFeedback.rank}</small>}
                    </div>
                    {feedbackIsFinal && (
                        <small className="arena-feedback-note">
                            {selectedAnswer ? `Bạn chọn: ${selectedAnswer.content}` : 'Đã gửi câu trả lời'}
                            {!answerFeedback.isCorrect && correctAnswer ? ` · Đáp án đúng: ${correctAnswer.content}` : ''}
                        </small>
                    )}
                </section>
            )}
        </main>
    )
}
