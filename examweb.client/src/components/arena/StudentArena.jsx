import { useEffect, useMemo, useState } from 'react'
import { ARENA_PHASES, useArenaSocket } from '../../hooks/useArenaSocket'
import { MathText } from '../MathText'

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

    const {
        isConnected,
        roomState,
        error,
        setError,
        joinRoom,
        submitAnswer,
    } = useArenaSocket()

    const phase = getPhase(roomState)
    const currentPlayer = roomState?.currentPlayer
    const currentQuestion = roomState?.currentQuestion
    const leaderboard = roomState?.leaderboard || []
    const myRank = getPlayerRank(roomState)

    useEffect(() => {
        const timer = window.setInterval(() => setNow(Date.now()), 150)
        return () => window.clearInterval(timer)
    }, [])

    const countdownRemaining = Math.ceil(getRemainingMs(roomState?.countdownEndsAt, now) / 1000)
    const questionRemainingMs = getRemainingMs(roomState?.questionEndsAt, now)
    const questionDurationMs = Math.max(1, Number(roomState?.questionDurationSeconds || 20) * 1000)
    const timePercent = Math.max(0, Math.min(100, (questionRemainingMs / questionDurationMs) * 100))
    const selectedAnswer = useMemo(
        () => currentQuestion?.answers?.find((answer) => answer.id === currentPlayer?.selectedAnswerId) || null,
        [currentQuestion?.answers, currentPlayer?.selectedAnswerId],
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

    const hasAnswered = Boolean(currentPlayer?.hasAnswered)
    const isResultPhase = phase === ARENA_PHASES.RESULT
    const resultIsCorrect = currentPlayer?.lastAnswerCorrect === true
    const resultClass = resultIsCorrect ? 'correct' : 'wrong'
    const flashClass = phase === ARENA_PHASES.IN_GAME &&
        hasAnswered &&
        typeof currentPlayer?.lastAnswerCorrect === 'boolean'
        ? `arena-flash-${resultClass}`
        : ''

    return (
        <main className={`arena-player-shell arena-game-stage ${flashClass}`}>
            <section className="arena-player-hud">
                <div>
                    <span>Câu {Number(roomState.currentQuestionIndex || 0) + 1}/{roomState.totalQuestions || 0}</span>
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

            {!isResultPhase && (
                <div className="arena-time-track" aria-label="Thời gian còn lại">
                    <span style={{ width: `${timePercent}%` }} />
                </div>
            )}

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
                    const selected = answer.id === currentPlayer?.selectedAnswerId
                    const showCorrect = isResultPhase && answer.isCorrect
                    const showWrong = isResultPhase && selected && !answer.isCorrect

                    return (
                        <button
                            className={[
                                'arena-answer-card',
                                `theme-${theme.key}`,
                                selected ? 'selected' : '',
                                showCorrect ? 'is-correct' : '',
                                showWrong ? 'is-wrong' : '',
                            ].filter(Boolean).join(' ')}
                            disabled={hasAnswered || isResultPhase}
                            key={answer.id}
                            onClick={() => submitAnswer(answer.id)}
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

            {hasAnswered && !isResultPhase && (
                <section className={`arena-answer-feedback ${resultClass}`} aria-live="polite">
                    <span>{resultIsCorrect ? 'Chính xác' : 'Chưa đúng'}</span>
                    <strong>{resultIsCorrect ? `+${formatScore(currentPlayer?.scoreDelta)} điểm` : '+0 điểm'}</strong>
                    <div className="arena-bonus-row">
                        <small>Streak {currentPlayer?.streak || 0}</small>
                        <small>Speed +{formatScore(currentPlayer?.speedBonus)}</small>
                        {myRank && <small>Hạng #{myRank}</small>}
                    </div>
                </section>
            )}

            {isResultPhase && (
                <section className={`arena-result-panel ${resultClass}`} aria-live="polite">
                    <div>
                        <span>{resultIsCorrect ? 'Câu này bạn làm đúng' : 'Câu này chưa chính xác'}</span>
                        <strong>{resultIsCorrect ? `+${formatScore(currentPlayer?.scoreDelta)} điểm` : '+0 điểm'}</strong>
                        <small>
                            {selectedAnswer
                                ? `Bạn chọn: ${selectedAnswer.content}`
                                : 'Bạn chưa chọn đáp án.'}
                        </small>
                        {!resultIsCorrect && correctAnswer && <small>Đáp án đúng: {correctAnswer.content}</small>}
                    </div>
                    <div className="arena-mini-leaderboard">
                        {leaderboard.slice(0, 5).map((player) => (
                            <div
                                className={player.connectionId === currentPlayer?.connectionId ? 'current' : ''}
                                key={player.connectionId || player.name}
                            >
                                <span>#{player.rank} {player.name}</span>
                                <strong>{formatScore(player.score)}</strong>
                            </div>
                        ))}
                    </div>
                </section>
            )}
        </main>
    )
}
