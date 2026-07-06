import { useCallback, useEffect, useRef, useState } from 'react'
import * as signalR from '@microsoft/signalr'
import { getChatHubUrl } from '../services/api'

export function useChatSocket({
    auth,
    onMessageDeleted,
    onMessageEdited,
    onMessageReacted,
    onMessageReceived,
    onMessageSeen,
    onTyping,
} = {}) {
    const connectionRef = useRef(null)
    const handlersRef = useRef({})
    const joinedRoomsRef = useRef(new Set())
    const [connectionState, setConnectionState] = useState('disconnected')
    const [onlineUsers, setOnlineUsers] = useState([])

    useEffect(() => {
        handlersRef.current = {
            onMessageDeleted,
            onMessageEdited,
            onMessageReacted,
            onMessageReceived,
            onMessageSeen,
            onTyping,
        }
    }, [
        onMessageDeleted,
        onMessageEdited,
        onMessageReacted,
        onMessageReceived,
        onMessageSeen,
        onTyping,
    ])

    useEffect(() => {
        if (!auth?.accessToken) {
            setConnectionState('disconnected')
            setOnlineUsers([])
            return undefined
        }

        let disposed = false
        const connection = new signalR.HubConnectionBuilder()
            .withUrl(getChatHubUrl(), {
                accessTokenFactory: () => auth.accessToken,
            })
            .withAutomaticReconnect([0, 1500, 4000, 9000, 15000])
            .configureLogging(signalR.LogLevel.Warning)
            .build()

        connectionRef.current = connection

        connection.on('PresenceSnapshot', (users = []) => {
            setOnlineUsers(Array.isArray(users) ? users : [])
        })

        connection.on('UserPresenceChanged', (presence) => {
            if (!presence?.accountId) return
            setOnlineUsers((current) => {
                const withoutUser = current.filter((item) => item.accountId !== presence.accountId)
                return presence.isOnline
                    ? [...withoutUser, presence].sort((first, second) => first.displayName.localeCompare(second.displayName))
                    : withoutUser
            })
        })

        connection.on('ReceiveMessage', (message) => handlersRef.current.onMessageReceived?.(message))
        connection.on('MessageEdited', (message) => handlersRef.current.onMessageEdited?.(message))
        connection.on('MessageDeleted', (message) => handlersRef.current.onMessageDeleted?.(message))
        connection.on('MessageReacted', (message) => handlersRef.current.onMessageReacted?.(message))
        connection.on('MessageSeen', (read) => handlersRef.current.onMessageSeen?.(read))
        connection.on('UserTyping', (typing) => handlersRef.current.onTyping?.(typing))

        connection.onreconnecting(() => {
            if (!disposed) setConnectionState('reconnecting')
        })

        async function joinKnownRooms() {
            for (const roomId of joinedRoomsRef.current) {
                try {
                    await connection.invoke('JoinRoom', roomId)
                } catch {
                    // Ignore stale rooms; the next user action will refresh access.
                }
            }
        }

        connection.onreconnected(async () => {
            if (disposed) return
            setConnectionState('connected')
            await joinKnownRooms()
        })

        connection.onclose(() => {
            if (!disposed) setConnectionState('disconnected')
        })

        async function start() {
            setConnectionState('connecting')
            try {
                await connection.start()
                if (!disposed) {
                    setConnectionState('connected')
                    await joinKnownRooms()
                }
            } catch {
                if (!disposed) setConnectionState('disconnected')
            }
        }

        start()

        return () => {
            disposed = true
            connectionRef.current = null
            setConnectionState('disconnected')
            setOnlineUsers([])
            connection.stop()
        }
    }, [auth])

    const invoke = useCallback(async (methodName, ...args) => {
        const connection = connectionRef.current
        if (!connection || connection.state !== signalR.HubConnectionState.Connected) {
            throw new Error('Chat socket is not connected')
        }

        return connection.invoke(methodName, ...args)
    }, [])

    const joinRoom = useCallback(async (roomId) => {
        if (!roomId) return
        joinedRoomsRef.current.add(roomId)
        await invoke('JoinRoom', roomId)
    }, [invoke])

    const leaveRoom = useCallback(async (roomId) => {
        if (!roomId) return
        joinedRoomsRef.current.delete(roomId)
        try {
            await invoke('LeaveRoom', roomId)
        } catch {
            // The room is local UI state; leaving can be best-effort during reconnects.
        }
    }, [invoke])

    const sendMessage = useCallback((roomId, text) => {
        return invoke('SendMessage', { roomId, text })
    }, [invoke])

    const editMessage = useCallback((messageId, text) => {
        return invoke('EditMessage', messageId, { text })
    }, [invoke])

    const deleteMessage = useCallback((messageId) => {
        return invoke('DeleteMessage', messageId)
    }, [invoke])

    const reactToMessage = useCallback((messageId, emoji) => {
        return invoke('ReactToMessage', messageId, { emoji })
    }, [invoke])

    const markRead = useCallback((roomId, lastMessageId) => {
        return invoke('MarkRead', roomId, { lastMessageId })
    }, [invoke])

    const sendTyping = useCallback((roomId, isTyping) => {
        return invoke('Typing', roomId, isTyping)
    }, [invoke])

    return {
        connectionState,
        deleteMessage,
        editMessage,
        joinRoom,
        leaveRoom,
        markRead,
        onlineUsers,
        reactToMessage,
        sendMessage,
        sendTyping,
    }
}
