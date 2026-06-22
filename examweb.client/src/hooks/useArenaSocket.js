import { useState, useEffect, useRef, useCallback } from 'react'
import { getArenaSocketUrl } from '../services/api'
import { getStoredSession } from '../services/session'

export function useArenaSocket() {
    const [isConnected, setIsConnected] = useState(false)
    const [roomState, setRoomState] = useState(null)
    const [error, setError] = useState(null)
    const socketRef = useRef(null)
    const session = getStoredSession()

    const sendSocketMessage = useCallback((type, payload) => {
        const socket = socketRef.current
        if (!socket || socket.readyState !== WebSocket.OPEN) return false
        try {
            socket.send(JSON.stringify({ type, payload }))
            return true
        } catch (err) {
            console.error('[ArenaSocket] Failed to send message:', err)
            return false
        }
    }, [])

    const joinRoom = useCallback((pin, name, role = 'player') => {
        sendSocketMessage('join-room', { roomId: pin, name, role })
    }, [sendSocketMessage])

    const nextQuestion = useCallback(() => {
        sendSocketMessage('next-question', {})
    }, [sendSocketMessage])

    const submitAnswer = useCallback((answerId) => {
        sendSocketMessage('submit-answer', { answerId })
    }, [sendSocketMessage])

    const showResults = useCallback(() => {
        sendSocketMessage('show-results', {})
    }, [sendSocketMessage])

    const showLeaderboard = useCallback(() => {
        sendSocketMessage('show-leaderboard', {})
    }, [sendSocketMessage])

    useEffect(() => {
        const url = getArenaSocketUrl(session)
        const socket = new WebSocket(url)
        socketRef.current = socket

        socket.onopen = () => {
            setIsConnected(true)
            setError(null)
            console.log('[ArenaSocket] WebSocket connected')
        }

        socket.onclose = () => {
            setIsConnected(false)
            console.log('[ArenaSocket] WebSocket disconnected')
        }

        socket.onerror = (err) => {
            console.error('[ArenaSocket] WebSocket error:', err)
            setError('Lỗi kết nối máy chủ realtime')
        }

        socket.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data)
                const { type, payload } = message

                if (type === 'room-state') {
                    setRoomState(payload)
                } else if (type === 'error') {
                    setError(payload.message)
                } else if (type === 'connected') {
                    // Handled internally
                } else if (type === 'player-joined' || type === 'player-left') {
                    // Update room state players list
                    setRoomState((prev) => {
                        if (!prev) return null
                        return {
                            ...prev,
                            players: payload.players
                        }
                    })
                } else if (type === 'player-answered') {
                    setRoomState((prev) => {
                        if (!prev) return null
                        return {
                            ...prev,
                            answeredCount: payload.answeredCount,
                            totalPlayers: payload.totalPlayers
                        }
                    })
                } else if (type === 'answer-submitted') {
                    setRoomState((prev) => {
                        if (!prev) return null
                        return {
                            ...prev,
                            currentPlayer: {
                                ...prev.currentPlayer,
                                hasAnswered: true,
                                selectedAnswerId: payload.selectedAnswerId
                            }
                        }
                    })
                } else if (type === 'game-over') {
                    setRoomState((prev) => {
                        if (!prev) return null
                        return {
                            ...prev,
                            leaderboard: payload.leaderboard,
                            gameOver: true
                        }
                    })
                } else if (type === 'leaderboard') {
                    setRoomState((prev) => {
                        if (!prev) return null
                        return {
                            ...prev,
                            leaderboard: payload.leaderboard
                        }
                    })
                } else if (type === 'host-disconnected') {
                    setError(payload.message)
                }
            } catch (err) {
                console.error('[ArenaSocket] Error parsing message:', err)
            }
        }

        return () => {
            socket.close()
        }
    }, [])

    return {
        isConnected,
        roomState,
        error,
        setError,
        joinRoom,
        submitAnswer,
        nextQuestion,
        showResults,
        showLeaderboard
    }
}
