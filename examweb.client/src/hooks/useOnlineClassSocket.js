import { useCallback, useEffect, useRef } from 'react'
import { getOnlineClassSocketUrl } from '../services/api'

const CLASS_EVENTS = new Set([
    'materials-updated',
    'online-class-updated',
    'whiteboard-updated',
    'whiteboard-snapshots-updated',
    'chat-message',
    'chat-cleared',
    'exam-monitor-event-recorded',
])

export function useOnlineClassSocket({
    auth,
    connectionIdRef: providedConnectionIdRef,
    isJoinedRef,
    roomIdRef,
    onAnswer,
    onDisconnected,
    onIceCandidate,
    onMeetingPeers,
    onOffer,
    onPeerJoined,
    onPeerLeft,
    onRealtimeEvent,
    onRoomError,
    onWhiteboardEvent,
}) {
    const socketRef = useRef(null)
    const reconnectTimerRef = useRef(null)
    const reconnectAttemptRef = useRef(0)
    const internalConnectionIdRef = useRef('')
    const connectionIdRef = providedConnectionIdRef || internalConnectionIdRef
    const handlersRef = useRef({})

    useEffect(() => {
        handlersRef.current = {
            onAnswer,
            onDisconnected,
            onIceCandidate,
            onMeetingPeers,
            onOffer,
            onPeerJoined,
            onPeerLeft,
            onRealtimeEvent,
            onRoomError,
            onWhiteboardEvent,
        }
    }, [
        onAnswer,
        onDisconnected,
        onIceCandidate,
        onMeetingPeers,
        onOffer,
        onPeerJoined,
        onPeerLeft,
        onRealtimeEvent,
        onRoomError,
        onWhiteboardEvent,
    ])

    const sendSocketMessage = useCallback((message) => {
        const socket = socketRef.current
        if (!socket || socket.readyState !== WebSocket.OPEN) return false
        socket.send(JSON.stringify(message))
        return true
    }, [])

    const joinRoom = useCallback((roomId) => {
        if (!roomId) return false
        if (roomIdRef) roomIdRef.current = roomId
        return sendSocketMessage({ type: 'join-room', roomId })
    }, [roomIdRef, sendSocketMessage])

    const leaveRoom = useCallback(() => {
        if (roomIdRef) roomIdRef.current = ''
        return sendSocketMessage({ type: 'leave-room' })
    }, [roomIdRef, sendSocketMessage])

    const sendSignal = useCallback((type, targetConnectionId, payload) => {
        return sendSocketMessage({ type, targetConnectionId, payload })
    }, [sendSocketMessage])

    const sendRoomEvent = useCallback((type, payload) => {
        return sendSocketMessage({ type, payload })
    }, [sendSocketMessage])

    useEffect(() => {
        if (!auth?.accessToken) return undefined

        let disposed = false

        function clearReconnectTimer() {
            if (reconnectTimerRef.current) {
                window.clearTimeout(reconnectTimerRef.current)
                reconnectTimerRef.current = null
            }
        }

        function scheduleReconnect() {
            if (disposed) return
            clearReconnectTimer()
            const delay = Math.min(1200 * 2 ** reconnectAttemptRef.current, 10000)
            reconnectAttemptRef.current += 1
            reconnectTimerRef.current = window.setTimeout(connectSocket, delay)
        }

        function reconnectJoinRoom(socket) {
            if (!isJoinedRef?.current) return
            const roomId = roomIdRef?.current
            if (roomId) {
                socket.send(JSON.stringify({ type: 'join-room', roomId }))
            }
        }

        function connectSocket() {
            if (disposed) return

            const socketUrl = getOnlineClassSocketUrl(auth)
            if (!socketUrl) return

            console.log('[ExamWeb] Connecting realtime socket…')
            const socket = new WebSocket(socketUrl)
            socketRef.current = socket

            socket.onopen = () => {
                reconnectAttemptRef.current = 0
                console.log('[ExamWeb] Realtime socket connected')
                reconnectJoinRoom(socket)
            }

            socket.onclose = () => {
                if (socketRef.current === socket) {
                    socketRef.current = null
                }
                handlersRef.current.onDisconnected?.()
                console.log('[ExamWeb] Realtime socket closed, reconnecting…')
                scheduleReconnect()
            }

            socket.onerror = () => {
                console.log('[ExamWeb] Realtime socket error')
            }

            socket.onmessage = async (event) => {
                let message
                try {
                    message = JSON.parse(event.data)
                } catch {
                    return
                }

                const { type, payload } = message
                const handlers = handlersRef.current

                if (CLASS_EVENTS.has(type)) {
                    handlers.onRealtimeEvent?.(type, payload)
                    return
                }

                if (type === 'connected') {
                    connectionIdRef.current = payload.connectionId
                    return
                }

                if (type === 'room-error') {
                    handlers.onRoomError?.(payload?.message || 'Không thể vào phòng học')
                    return
                }

                if (type === 'meeting-peers') {
                    if (isJoinedRef?.current) handlers.onMeetingPeers?.(payload.peers || [], payload)
                    return
                }

                if (type === 'peer-joined') {
                    if (isJoinedRef?.current) handlers.onPeerJoined?.(payload)
                    return
                }

                if (type === 'peer-left') {
                    handlers.onPeerLeft?.(payload.connectionId)
                    return
                }

                if (type === 'whiteboard-draw' || type === 'whiteboard-clear') {
                    handlers.onWhiteboardEvent?.(type, payload)
                    return
                }

                if (!isJoinedRef?.current) return

                if (type === 'offer') {
                    await handlers.onOffer?.(payload)
                    return
                }

                if (type === 'answer') {
                    await handlers.onAnswer?.(payload)
                    return
                }

                if (type === 'ice-candidate') {
                    await handlers.onIceCandidate?.(payload)
                }
            }
        }

        connectSocket()

        return () => {
            disposed = true
            clearReconnectTimer()
            socketRef.current?.close()
            socketRef.current = null
            handlersRef.current.onDisconnected?.()
        }
    }, [auth, connectionIdRef, isJoinedRef, roomIdRef])

    return {
        connectionIdRef,
        joinRoom,
        leaveRoom,
        sendRoomEvent,
        sendSignal,
    }
}
