import { useEffect, useState } from 'react'
import { ARENA_PHASES, useArenaSocket } from '../../hooks/useArenaSocket'
import { arenaApi } from '../../services/api'

const EMPTY_ARRAY = []

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

function getRemainingSeconds(target, now) {
    if (!target) return 0
    return Math.max(0, Math.ceil((Date.parse(target) - now) / 1000))
}

function getStats(roomState) {
    const stats = roomState?.answerStats || {}
    return {
        answeredCount: stats.answeredCount ?? roomState?.answeredCount ?? 0,
        totalPlayers: stats.totalPlayers ?? roomState?.totalPlayers ?? roomState?.players?.length ?? 0,
        correctCount: stats.correctCount ?? 0,
        wrongCount: stats.wrongCount ?? 0,
        pendingCount: stats.pendingCount ?? 0,
        accuracyPercent: stats.accuracyPercent ?? 0,
    }
}

export function TeacherArena({
    testId,
    tests = [],
    loading = false,
    error: parentError,
    onOpenTest,
    onClose,
}) {
    const [activeTestId, setActiveTestId] = useState(testId || null)

    if (activeTestId) {
        return (
            <TeacherArenaRoom
                key={activeTestId}
                onBack={() => {
                    setActiveTestId(null)
                    onClose?.()
                }}
                testId={activeTestId}
            />
        )
    }

    return (
        <section className="arena-selector admin-panel">
            <div className="panel-title">
                <div>
                    <p className="eyebrow">Arena realtime</p>
                    <h2>Chọn đề để mở phòng đấu</h2>
                </div>
                <span className="badge-count">{tests.length}</span>
            </div>

            {parentError && <div className="alert admin-alert">{parentError}</div>}

            {loading ? (
                <div className="arena-loading-panel">
                    <span className="arena-spinner" />
                    <strong>Đang tải danh sách đề thi...</strong>
                </div>
            ) : tests.length === 0 ? (
                <div className="empty-state">
                    <span className="empty-marker">A</span>
                    <h3>Chưa có đề thi để tạo Arena</h3>
                    <p>Tạo đề và thêm câu hỏi trước, sau đó quay lại để mở phòng đấu realtime.</p>
                </div>
            ) : (
                <div className="arena-test-grid">
                    {tests.map((test) => {
                        const questionCount = test.questionCount || 0
                        const canStart = questionCount > 0

                        return (
                            <article className="arena-test-card" key={test.id}>
                                <div>
                                    <span>{questionCount} câu hỏi</span>
                                    <h3>{test.testName}</h3>
                                    <p>{test.durationMinutes ? `${test.durationMinutes} phút` : 'Arena không giới hạn theo bài thi thường'}</p>
                                </div>
                                <div className="arena-test-actions">
                                    {onOpenTest && (
                                        <button className="ghost-button" onClick={() => onOpenTest(test.id)} type="button">
                                            Xem đề
                                        </button>
                                    )}
                                    <button
                                        className="primary-button"
                                        disabled={!canStart}
                                        onClick={() => setActiveTestId(test.id)}
                                        type="button"
                                    >
                                        Mở Arena
                                    </button>
                                </div>
                            </article>
                        )
                    })}
                </div>
            )}
        </section>
    )
}

function TeacherArenaRoom({ testId, onBack }) {
    const [roomId, setRoomId] = useState(null)
    const [creatingRoom, setCreatingRoom] = useState(false)
    const [apiError, setApiError] = useState(null)
    const [now, setNow] = useState(() => Date.now())

    const {
        isConnected,
        roomState,
        error: socketError,
        joinRoom,
        startGame,
        nextQuestion,
        showResults,
    } = useArenaSocket()

    const error = apiError || socketError
    const phase = getPhase(roomState)
    const stats = getStats(roomState)
    const players = roomState?.players || EMPTY_ARRAY
    const leaderboard = roomState?.leaderboard || EMPTY_ARRAY
    const countdownRemaining = getRemainingSeconds(roomState?.countdownEndsAt, now)
    const topThree = leaderboard.slice(0, 3)

    useEffect(() => {
        const timer = window.setInterval(() => setNow(Date.now()), 250)
        return () => window.clearInterval(timer)
    }, [])

    useEffect(() => {
        if (!testId) return undefined

        let cancelled = false

        Promise.resolve()
            .then(() => {
                if (cancelled) return null

                setCreatingRoom(true)
                setApiError(null)
                return arenaApi(`/create-room/${encodeURIComponent(testId)}`, { method: 'POST' })
            })
            .then((data) => {
                if (!data || cancelled) return
                setRoomId(data.roomId)
            })
            .catch((err) => {
                if (cancelled) return
                console.error('Error creating arena room:', err)
                setApiError(err.message || 'Không thể tạo phòng Arena.')
            })
            .finally(() => {
                if (cancelled) return
                setCreatingRoom(false)
            })

        return () => {
            cancelled = true
        }
    }, [testId])

    useEffect(() => {
        if (isConnected && roomId) {
            joinRoom(roomId, 'Giáo viên', 'host')
        }
    }, [isConnected, roomId, joinRoom])

    if (creatingRoom) {
        return (
            <section className="arena-teacher-shell arena-loading-panel">
                <span className="arena-spinner" />
                <strong>Đang khởi tạo phòng Arena...</strong>
            </section>
        )
    }

    if (error) {
        return (
            <section className="arena-teacher-shell arena-error-panel">
                <h2>Không mở được Arena</h2>
                <p>{error}</p>
                <button className="primary-button" onClick={onBack} type="button">
                    Quay lại
                </button>
            </section>
        )
    }

    if (!roomState) {
        return (
            <section className="arena-teacher-shell arena-loading-panel">
                <span className="arena-spinner" />
                <strong>Đang kết nối tới phòng realtime...</strong>
            </section>
        )
    }

    if (phase === ARENA_PHASES.LOBBY) {
        return (
            <main className="arena-teacher-shell arena-lobby-layout">
                <section className="arena-host-card">
                    <div className="arena-room-head">
                        <div>
                            <p className="arena-kicker">Lobby</p>
                            <h1>{roomState.testName}</h1>
                        </div>
                        <button className="arena-link-btn light" onClick={onBack} type="button">
                            Thoát
                        </button>
                    </div>

                    <div className="arena-host-pin">
                        <span>Mã PIN</span>
                        <strong>{roomId || roomState.roomId}</strong>
                    </div>

                    <div className="arena-lobby-actions">
                        <div>
                            <span>Người chơi</span>
                            <strong>{players.length}</strong>
                        </div>
                        <button
                            className="arena-primary-btn"
                            disabled={players.length === 0}
                            onClick={startGame}
                            type="button"
                        >
                            Start
                        </button>
                    </div>
                </section>

                <section className="arena-player-roster">
                    <div className="arena-section-title">
                        <span>Danh sách học sinh</span>
                        <strong>{players.length}</strong>
                    </div>
                    {players.length === 0 ? (
                        <div className="arena-empty-roster">
                            <strong>Chờ học sinh nhập PIN</strong>
                            <span>Danh sách sẽ cập nhật realtime khi học sinh vào phòng.</span>
                        </div>
                    ) : (
                        <div className="arena-roster-grid">
                            {players.map((player) => (
                                <div className="arena-roster-chip" key={player.connectionId}>
                                    <span>{player.name.slice(0, 1).toUpperCase()}</span>
                                    <strong>{player.name}</strong>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </main>
        )
    }

    if (phase === ARENA_PHASES.COUNTDOWN) {
        return (
            <main className="arena-teacher-shell arena-countdown-stage">
                <section className="arena-countdown-card">
                    <p className="arena-kicker">Game starting</p>
                    <div className="arena-countdown-number">{Math.max(1, countdownRemaining || 1)}</div>
                    <h1>Chuẩn bị câu đầu tiên</h1>
                    <p className="arena-muted">{players.length} học sinh đã sẵn sàng.</p>
                </section>
            </main>
        )
    }

    if (phase === ARENA_PHASES.PODIUM) {
        return (
            <main className="arena-teacher-shell arena-podium-stage">
                <section className="arena-podium-board">
                    <p className="arena-kicker">Kết thúc Arena</p>
                    <h1>Top 3</h1>
                    <div className="arena-podium-row">
                        {topThree.map((player, index) => (
                            <article className={`arena-podium-card rank-${index + 1}`} key={player.connectionId || player.name}>
                                <span>#{player.rank}</span>
                                <strong>{player.name}</strong>
                                <small>{formatScore(player.score)} điểm</small>
                            </article>
                        ))}
                    </div>
                    <LeaderboardPanel leaderboard={leaderboard} />
                    <button className="arena-danger-btn" onClick={onBack} type="button">
                        Đóng Arena
                    </button>
                </section>
            </main>
        )
    }

    const isResultPhase = phase === ARENA_PHASES.RESULT

    return (
        <main className="arena-teacher-shell arena-live-layout">
            <header className="arena-live-header">
                <div>
                    <p className="arena-kicker">{isResultPhase ? 'Kết quả câu hỏi' : 'Đang thi đấu'}</p>
                    <h1>Câu {Number(roomState.currentQuestionIndex || 0) + 1}/{roomState.totalQuestions || 0}</h1>
                    <span>PIN {roomId || roomState.roomId}</span>
                </div>
                <div className="arena-live-actions">
                    <button className="arena-link-btn light" onClick={onBack} type="button">
                        Kết thúc
                    </button>
                    {isResultPhase ? (
                        <button className="arena-primary-btn" onClick={nextQuestion} type="button">
                            {Number(roomState.currentQuestionIndex || 0) + 1 >= Number(roomState.totalQuestions || 0)
                                ? 'Xem Podium'
                                : 'Câu tiếp theo'}
                        </button>
                    ) : (
                        <button className="arena-danger-btn" onClick={showResults} type="button">
                            Chốt câu
                        </button>
                    )}
                </div>
            </header>

            <section className="arena-live-grid">
                <LeaderboardPanel leaderboard={leaderboard} />
                <StatsPanel stats={stats} />
            </section>
        </main>
    )
}

function LeaderboardPanel({ leaderboard = [] }) {
    const maxScore = Math.max(1, ...leaderboard.map((player) => Number(player.score || 0)))

    return (
        <section className="arena-leaderboard-panel">
            <div className="arena-section-title">
                <span>Leaderboard realtime</span>
                <strong>{leaderboard.length}</strong>
            </div>

            {leaderboard.length === 0 ? (
                <div className="arena-empty-roster">
                    <strong>Chưa có điểm số</strong>
                    <span>Leaderboard sẽ nhảy vị trí ngay khi học sinh trả lời.</span>
                </div>
            ) : (
                <div className="arena-leaderboard-list">
                    {leaderboard.map((player) => {
                        const width = Math.max(8, (Number(player.score || 0) / maxScore) * 100)
                        return (
                            <article className="arena-leaderboard-row" key={player.connectionId || player.name}>
                                <div className="arena-rank-badge">#{player.rank}</div>
                                <div className="arena-leaderboard-main">
                                    <div className="arena-leaderboard-meta">
                                        <strong>{player.name}</strong>
                                        <span>
                                            {formatScore(player.score)} điểm
                                            {player.scoreDelta > 0 ? ` +${formatScore(player.scoreDelta)}` : ''}
                                        </span>
                                    </div>
                                    <div className="arena-score-bar">
                                        <span style={{ width: `${width}%` }} />
                                    </div>
                                </div>
                                <div className={[
                                    'arena-answer-state',
                                    player.lastAnswerCorrect === true ? 'correct' : '',
                                    player.lastAnswerCorrect === false ? 'wrong' : '',
                                    player.hasAnswered ? 'answered' : '',
                                ].filter(Boolean).join(' ')}>
                                    {player.lastAnswerCorrect === true
                                        ? 'Đúng'
                                        : player.lastAnswerCorrect === false
                                            ? 'Sai'
                                            : player.hasAnswered
                                                ? 'Đã gửi'
                                                : '...'}
                                </div>
                            </article>
                        )
                    })}
                </div>
            )}
        </section>
    )
}

function StatsPanel({ stats }) {
    const safeTotal = Math.max(1, stats.totalPlayers || 0)
    const answeredPercent = Math.min(100, (stats.answeredCount / safeTotal) * 100)
    const correctPercent = Math.min(100, (stats.correctCount / safeTotal) * 100)
    const wrongPercent = Math.min(100, (stats.wrongCount / safeTotal) * 100)

    return (
        <aside className="arena-stats-panel">
            <div className="arena-section-title">
                <span>Thống kê câu hiện tại</span>
                <strong>{stats.accuracyPercent}%</strong>
            </div>

            <div className="arena-stat-ring">
                <strong>{stats.answeredCount}/{stats.totalPlayers}</strong>
                <span>đã trả lời</span>
            </div>

            <div className="arena-stat-bars">
                <StatBar label="Đã trả lời" value={stats.answeredCount} percent={answeredPercent} tone="answered" />
                <StatBar label="Đúng" value={stats.correctCount} percent={correctPercent} tone="correct" />
                <StatBar label="Sai" value={stats.wrongCount} percent={wrongPercent} tone="wrong" />
                <StatBar label="Đang nghĩ" value={stats.pendingCount} percent={100 - answeredPercent} tone="pending" />
            </div>
        </aside>
    )
}

function StatBar({ label, value, percent, tone }) {
    return (
        <div className={`arena-stat-bar ${tone}`}>
            <div>
                <span>{label}</span>
                <strong>{value}</strong>
            </div>
            <div className="arena-stat-track">
                <span style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} />
            </div>
        </div>
    )
}
