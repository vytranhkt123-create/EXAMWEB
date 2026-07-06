import { useCallback, useEffect, useRef, useState } from 'react'
import { getArenaSocketUrl } from '../services/api'
import { getStoredSession } from '../services/session'

export const ARENA_PHASES = {
    LOBBY: 'Lobby',
    COUNTDOWN: 'Countdown',
    IN_GAME: 'InGame',
    RESULT: 'Result',
    WAITING_FOR_OTHERS: 'WaitingForOthers',
    PODIUM: 'Podium',
}

const EVENT_ALIASES = {
    connected: 'Connected',
    error: 'Error',
    'room-state': 'RoomState',
    roomstate: 'RoomState',
    'player-joined': 'PlayerJoined',
    playerjoined: 'PlayerJoined',
    'player-left': 'PlayerLeft',
    playerleft: 'PlayerLeft',
    'game-started': 'GameStarted',
    gamestarted: 'GameStarted',
    'question-shown': 'QuestionShown',
    questionshown: 'QuestionShown',
    'answer-submitted': 'AnswerSubmitted',
    answersubmitted: 'AnswerSubmitted',
    'player-answered': 'AnswerSubmitted',
    playeranswered: 'AnswerSubmitted',
    leaderboard: 'LeaderboardUpdated',
    'leaderboard-updated': 'LeaderboardUpdated',
    leaderboardupdated: 'LeaderboardUpdated',
    'question-result': 'QuestionResult',
    questionresult: 'QuestionResult',
    'game-over': 'GameOver',
    gameover: 'GameOver',
    'host-disconnected': 'HostDisconnected',
    hostdisconnected: 'HostDisconnected',
    pong: 'Pong',
}

function normalizeEventType(type = '') {
    const exact = EVENT_ALIASES[type]
    if (exact) return exact

    const compact = String(type).replace(/[-_]/g, '').toLowerCase()
    return EVENT_ALIASES[compact] || type
}

function mergeRoomState(previous, patch = {}) {
    if (!previous) return patch

    const next = {
        ...previous,
        ...patch,
    }

    if (previous.currentPlayer || patch.currentPlayer) {
        next.currentPlayer = {
            ...(previous.currentPlayer || {}),
            ...(patch.currentPlayer || {}),
        }
    }

    if (patch.answerStats) {
        next.answeredCount = patch.answerStats.answeredCount
        next.totalPlayers = patch.answerStats.totalPlayers
    }

    return next
}

function updateCurrentPlayerFromLeaderboard(currentPlayer, leaderboard) {
    if (!currentPlayer || !Array.isArray(leaderboard)) return currentPlayer

    const entry = leaderboard.find((player) => player.connectionId === currentPlayer.connectionId)
    if (!entry) return currentPlayer

    return {
        ...currentPlayer,
        rank: entry.rank,
        score: entry.score,
        scoreDelta: entry.scoreDelta,
        lastAnswerCorrect: entry.lastAnswerCorrect,
        streak: entry.streak,
        speedBonus: entry.speedBonus,
        streakBonus: entry.streakBonus,
        lastAnswerMs: entry.responseMs,
    }
}

export function useArenaSocket() {
    const [isConnected, setIsConnected] = useState(false)
    const [roomState, setRoomState] = useState(null)
    const [error, setError] = useState(null)
    const [lastEvent, setLastEvent] = useState(null)
    const socketRef = useRef(null)

    const sendSocketMessage = useCallback((type, payload = {}) => {
        const socket = socketRef.current
        if (!socket || socket.readyState !== WebSocket.OPEN) {
            setError('Chưa kết nối tới phòng Arena realtime.')
            return false
        }

        try {
            socket.send(JSON.stringify({ type, payload }))
            return true
        } catch (err) {
            console.error('[ArenaSocket] Failed to send message:', err)
            setError('Không gửi được dữ liệu tới phòng Arena.')
            return false
        }
    }, [])

    const joinRoom = useCallback((pin, name, role = 'player') => {
        return sendSocketMessage('JoinRoom', { roomId: pin, name, role })
    }, [sendSocketMessage])

    const startGame = useCallback(() => {
        return sendSocketMessage('StartGame')
    }, [sendSocketMessage])

    const nextQuestion = useCallback(() => {
        return sendSocketMessage('NextQuestion')
    }, [sendSocketMessage])

    const submitAnswer = useCallback((answerId, questionIndex = null) => {
        return sendSocketMessage('SubmitAnswer', {
            answerId,
            ...(Number.isInteger(questionIndex) ? { questionIndex } : {}),
        })
    }, [sendSocketMessage])

    const requestStudentQuestion = useCallback((questionIndex) => {
        return sendSocketMessage('GetStudentQuestion', { questionIndex })
    }, [sendSocketMessage])

    const showResults = useCallback(() => {
        return sendSocketMessage('ShowResults')
    }, [sendSocketMessage])

    const showLeaderboard = useCallback(() => {
        return sendSocketMessage('ShowLeaderboard')
    }, [sendSocketMessage])

    useEffect(() => {
        const session = getStoredSession()
        const url = getArenaSocketUrl(session)
        const socket = new WebSocket(url)
        socketRef.current = socket

        socket.onopen = () => {
            setIsConnected(true)
            setError(null)
        }

        socket.onclose = () => {
            setIsConnected(false)
        }

        socket.onerror = (err) => {
            console.error('[ArenaSocket] WebSocket error:', err)
            setError('Lỗi kết nối máy chủ realtime.')
        }

        socket.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data)
                const type = normalizeEventType(message.type)
                const payload = message.payload || {}

                setLastEvent({ type, payload, receivedAt: Date.now() })

                if (type === 'Connected' || type === 'Pong') {
                    return
                }

                if (type === 'Error') {
                    setError(payload.message || 'Arena gặp lỗi realtime.')
                    return
                }

                if (type === 'RoomState') {
                    setRoomState(payload)
                    return
                }

                if (type === 'PlayerJoined' || type === 'PlayerLeft') {
                    setRoomState((previous) => mergeRoomState(previous, {
                        players: payload.players,
                        leaderboard: payload.leaderboard,
                        answerStats: payload.answerStats,
                    }))
                    return
                }

                if (type === 'GameStarted') {
                    setRoomState((previous) => mergeRoomState(previous, {
                        phase: ARENA_PHASES.COUNTDOWN,
                        countdownSeconds: payload.countdownSeconds,
                        countdownEndsAt: payload.countdownEndsAt,
                    }))
                    return
                }

                if (type === 'QuestionShown') {
                    setRoomState((previous) => mergeRoomState(previous, {
                        phase: ARENA_PHASES.IN_GAME,
                        showAnswers: false,
                        currentQuestionIndex: payload.currentQuestionIndex,
                        totalQuestions: payload.totalQuestions,
                        questionDurationSeconds: payload.questionDurationSeconds,
                        questionEndsAt: payload.questionEndsAt,
                        answerStats: payload.answerStats,
                        leaderboard: payload.leaderboard,
                    }))
                    return
                }

                if (type === 'AnswerSubmitted') {
                    setRoomState((previous) => {
                        if (!previous) return previous

                        const isCurrentPlayer = previous.currentPlayer?.connectionId === payload.connectionId
                        return mergeRoomState(previous, {
                            answerStats: payload.answerStats,
                            currentPlayer: isCurrentPlayer
                                ? {
                                    hasAnswered: true,
                                    selectedAnswerId: payload.selectedAnswerId,
                                    lastAnswerCorrect: payload.isCorrect,
                                    score: payload.score,
                                    scoreDelta: payload.scoreDelta,
                                    streak: payload.streak,
                                    speedBonus: payload.speedBonus,
                                    streakBonus: payload.streakBonus,
                                    lastAnswerMs: payload.responseMs,
                                    currentQuestionIndex: payload.questionIndex,
                                    isFinished: payload.isFinished,
                                    rank: payload.rank,
                                    previousRank: payload.previousRank,
                                }
                                : undefined,
                        })
                    })
                    return
                }

                if (type === 'LeaderboardUpdated') {
                    setRoomState((previous) => {
                        if (!previous) {
                            return {
                                leaderboard: payload.leaderboard,
                                answerStats: payload.answerStats,
                            }
                        }

                        return {
                            ...mergeRoomState(previous, {
                                leaderboard: payload.leaderboard,
                                answerStats: payload.answerStats,
                            }),
                            currentPlayer: updateCurrentPlayerFromLeaderboard(previous.currentPlayer, payload.leaderboard),
                        }
                    })
                    return
                }

                if (type === 'QuestionResult') {
                    setRoomState((previous) => mergeRoomState(previous, {
                        phase: ARENA_PHASES.RESULT,
                        showAnswers: true,
                        answerStats: payload.answerStats,
                        leaderboard: payload.leaderboard,
                    }))
                    return
                }

                if (type === 'GameOver') {
                    setRoomState((previous) => mergeRoomState(previous, {
                        phase: ARENA_PHASES.PODIUM,
                        gameOver: true,
                        leaderboard: payload.leaderboard,
                        podium: payload.podium,
                    }))
                    return
                }

                if (type === 'HostDisconnected') {
                    setError(payload.message || 'Giáo viên đã rời phòng.')
                }
            } catch (err) {
                console.error('[ArenaSocket] Error parsing message:', err)
            }
        }

        return () => {
            if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
                socket.close()
            }
        }
    }, [])

    return {
        isConnected,
        roomState,
        error,
        lastEvent,
        setError,
        joinRoom,
        startGame,
        submitAnswer,
        requestStudentQuestion,
        nextQuestion,
        showResults,
        showLeaderboard,
    }
}
