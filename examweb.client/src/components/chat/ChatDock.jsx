import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { chatApi } from '../../services/api'
import { useChatSocket } from '../../hooks/useChatSocket'
import { ChatBox } from './ChatBox'
import './Chat.css'

const MAX_OPEN_BOXES = 3

function upsertById(items, nextItem) {
    if (!nextItem?.id) return items
    const exists = items.some((item) => item.id === nextItem.id)
    return exists
        ? items.map((item) => (item.id === nextItem.id ? { ...item, ...nextItem } : item))
        : [nextItem, ...items]
}

function mergeMessageList(messages, nextMessage) {
    if (!nextMessage?.id) return messages
    const exists = messages.some((message) => message.id === nextMessage.id)
    const nextMessages = exists
        ? messages.map((message) => (message.id === nextMessage.id ? nextMessage : message))
        : [...messages, nextMessage]

    return nextMessages.sort((first, second) => new Date(first.createdAt) - new Date(second.createdAt))
}

export function ChatDock({ auth }) {
    const [contacts, setContacts] = useState([])
    const [rooms, setRooms] = useState([])
    const [openRoomIds, setOpenRoomIds] = useState([])
    const [messagesByRoom, setMessagesByRoom] = useState({})
    const [pageInfoByRoom, setPageInfoByRoom] = useState({})
    const [loadingRooms, setLoadingRooms] = useState({})
    const [typingByRoom, setTypingByRoom] = useState({})
    const [trayOpen, setTrayOpen] = useState(false)
    const [search, setSearch] = useState('')
    const [error, setError] = useState('')
    const typingTimersRef = useRef({})
    const lastMarkedReadRef = useRef({})

    const currentUser = useMemo(() => ({
        accountId: auth?.accountId,
        displayName: auth?.displayName,
        role: auth?.role,
        username: auth?.username,
    }), [auth])

    const mergeIncomingMessage = useCallback((message) => {
        if (!message?.roomId) return
        setMessagesByRoom((current) => ({
            ...current,
            [message.roomId]: mergeMessageList(current[message.roomId] || [], message),
        }))
        setRooms((current) =>
            current.map((room) =>
                room.id === message.roomId
                    ? { ...room, lastMessage: message, lastMessageAt: message.createdAt }
                    : room,
            ),
        )
    }, [])

    const handleRead = useCallback((read) => {
        if (!read?.roomId || !read.accountId) return
        setMessagesByRoom((current) => {
            const messages = current[read.roomId] || []
            return {
                ...current,
                [read.roomId]: messages.map((message) => {
                    if (read.lastMessageId && message.id !== read.lastMessageId) return message
                    const receipts = (message.readReceipts || []).filter((receipt) => receipt.accountId !== read.accountId)
                    return {
                        ...message,
                        readReceipts: [...receipts, { accountId: read.accountId, seenAt: read.seenAt }],
                    }
                }),
            }
        })
    }, [])

    const handleRemoteTyping = useCallback((typing) => {
        if (!typing?.roomId || typing.accountId === currentUser.accountId) return

        const key = `${typing.roomId}:${typing.accountId}`
        if (typingTimersRef.current[key]) {
            window.clearTimeout(typingTimersRef.current[key])
            delete typingTimersRef.current[key]
        }

        setTypingByRoom((current) => {
            const roomTyping = current[typing.roomId] || {}
            const nextRoomTyping = { ...roomTyping }
            if (typing.isTyping) {
                nextRoomTyping[typing.accountId] = typing
            } else {
                delete nextRoomTyping[typing.accountId]
            }
            return { ...current, [typing.roomId]: nextRoomTyping }
        })

        if (typing.isTyping) {
            typingTimersRef.current[key] = window.setTimeout(() => {
                setTypingByRoom((current) => {
                    const roomTyping = current[typing.roomId] || {}
                    const nextRoomTyping = { ...roomTyping }
                    delete nextRoomTyping[typing.accountId]
                    return { ...current, [typing.roomId]: nextRoomTyping }
                })
            }, 1800)
        }
    }, [currentUser.accountId])

    const {
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
    } = useChatSocket({
        auth,
        onMessageDeleted: mergeIncomingMessage,
        onMessageEdited: mergeIncomingMessage,
        onMessageReacted: mergeIncomingMessage,
        onMessageReceived: mergeIncomingMessage,
        onMessageSeen: handleRead,
        onTyping: handleRemoteTyping,
    })

    const onlineAccountIds = useMemo(
        () => new Set(onlineUsers.map((user) => user.accountId)),
        [onlineUsers],
    )

    const openRooms = useMemo(
        () => openRoomIds
            .map((roomId) => rooms.find((room) => room.id === roomId))
            .filter(Boolean),
        [openRoomIds, rooms],
    )

    const filteredContacts = useMemo(() => {
        const query = search.trim().toLowerCase()
        if (!query) return contacts
        return contacts.filter((contact) =>
            `${contact.displayName} ${contact.username} ${contact.className || ''}`
                .toLowerCase()
                .includes(query),
        )
    }, [contacts, search])

    const loadRooms = useCallback(async () => {
        const data = await chatApi('/rooms')
        setRooms(Array.isArray(data) ? data : [])
    }, [])

    const loadContacts = useCallback(async () => {
        const data = await chatApi('/contacts')
        setContacts(Array.isArray(data) ? data : [])
    }, [])

    useEffect(() => {
        if (!auth?.accessToken) return undefined
        let disposed = false
        async function load() {
            try {
                const [roomData, contactData] = await Promise.all([
                    chatApi('/rooms'),
                    chatApi('/contacts'),
                ])
                if (disposed) return
                setRooms(Array.isArray(roomData) ? roomData : [])
                setContacts(Array.isArray(contactData) ? contactData : [])
            } catch (err) {
                if (!disposed) setError(err.message)
            }
        }
        load()
        return () => {
            disposed = true
        }
    }, [auth])

    const loadMessages = useCallback(async (roomId, before = null) => {
        if (!roomId) return
        setLoadingRooms((current) => ({ ...current, [roomId]: true }))
        setError('')
        try {
            const query = before ? `?before=${encodeURIComponent(before)}` : ''
            const page = await chatApi(`/rooms/${encodeURIComponent(roomId)}/messages${query}`)
            setMessagesByRoom((current) => ({
                ...current,
                [roomId]: before
                    ? [...(page.messages || []), ...(current[roomId] || [])]
                    : page.messages || [],
            }))
            setPageInfoByRoom((current) => ({
                ...current,
                [roomId]: {
                    hasMore: Boolean(page.hasMore),
                    nextBefore: page.nextBefore,
                },
            }))
        } catch (err) {
            setError(err.message)
        } finally {
            setLoadingRooms((current) => ({ ...current, [roomId]: false }))
        }
    }, [])

    const openRoom = useCallback(async (room) => {
        if (!room?.id) return
        setRooms((current) => upsertById(current, room))
        setOpenRoomIds((current) => [room.id, ...current.filter((roomId) => roomId !== room.id)].slice(0, MAX_OPEN_BOXES))
        joinRoom(room.id).catch(() => {})
        if (!messagesByRoom[room.id]) {
            await loadMessages(room.id)
        }
    }, [joinRoom, loadMessages, messagesByRoom])

    async function openDirectChat(contact) {
        setError('')
        try {
            const room = await chatApi('/direct', {
                method: 'POST',
                body: JSON.stringify({ targetAccountId: contact.accountId }),
            })
            await openRoom(room)
            await loadRooms()
            setTrayOpen(false)
        } catch (err) {
            setError(err.message)
        }
    }

    async function openExistingRoom(room) {
        await openRoom(room)
        setTrayOpen(false)
    }

    async function closeRoom(roomId) {
        setOpenRoomIds((current) => current.filter((id) => id !== roomId))
        leaveRoom(roomId).catch(() => {})
    }

    async function handleSend(roomId, text) {
        try {
            await sendMessage(roomId, text)
        } catch {
            const message = await chatApi('/messages', {
                method: 'POST',
                body: JSON.stringify({ roomId, text }),
            })
            mergeIncomingMessage(message)
        }
    }

    async function handleEdit(messageId, text) {
        try {
            await editMessage(messageId, text)
        } catch {
            const message = await chatApi(`/messages/${encodeURIComponent(messageId)}`, {
                method: 'PUT',
                body: JSON.stringify({ text }),
            })
            mergeIncomingMessage(message)
        }
    }

    async function handleDelete(messageId) {
        try {
            await deleteMessage(messageId)
        } catch {
            const message = await chatApi(`/messages/${encodeURIComponent(messageId)}`, { method: 'DELETE' })
            mergeIncomingMessage(message)
        }
    }

    async function handleReact(messageId, emoji) {
        try {
            await reactToMessage(messageId, emoji)
        } catch {
            const message = await chatApi(`/messages/${encodeURIComponent(messageId)}/reactions`, {
                method: 'POST',
                body: JSON.stringify({ emoji }),
            })
            mergeIncomingMessage(message)
        }
    }

    async function handleSendTyping(roomId, isTyping) {
        try {
            await sendTyping(roomId, isTyping)
        } catch {
            // Typing is ephemeral; it is safe to drop during reconnects.
        }
    }

    useEffect(() => {
        openRoomIds.forEach((roomId) => {
            const messages = messagesByRoom[roomId] || []
            const lastMessage = messages[messages.length - 1]
            if (!lastMessage || lastMarkedReadRef.current[roomId] === lastMessage.id) return

            lastMarkedReadRef.current[roomId] = lastMessage.id
            markRead(roomId, lastMessage.id).catch(() => {
                chatApi(`/rooms/${encodeURIComponent(roomId)}/read`, {
                    method: 'POST',
                    body: JSON.stringify({ lastMessageId: lastMessage.id }),
                }).catch(() => {})
            })
        })
    }, [markRead, messagesByRoom, openRoomIds])

    if (!auth?.accessToken) {
        return null
    }

    return (
        <div className="chat-dock">
            <div className="chat-box-stack">
                {openRooms.map((room) => (
                    <ChatBox
                        connectionState={connectionState}
                        currentUser={currentUser}
                        hasMore={Boolean(pageInfoByRoom[room.id]?.hasMore)}
                        key={room.id}
                        loading={Boolean(loadingRooms[room.id])}
                        messages={messagesByRoom[room.id] || []}
                        onClose={closeRoom}
                        onDelete={handleDelete}
                        onEdit={handleEdit}
                        onLoadOlder={() => loadMessages(room.id, pageInfoByRoom[room.id]?.nextBefore)}
                        onReact={handleReact}
                        onSend={handleSend}
                        onTyping={handleSendTyping}
                        onlineAccountIds={onlineAccountIds}
                        room={room}
                        typingUsers={Object.values(typingByRoom[room.id] || {})}
                    />
                ))}
            </div>

            {trayOpen && (
                <section className="chat-tray">
                    <header>
                        <strong>Tin nhắn</strong>
                        <button className="chat-close-button" onClick={() => setTrayOpen(false)} type="button">
                            ×
                        </button>
                    </header>
                    <input
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Tìm người hoặc phòng..."
                        value={search}
                    />
                    {error && <p className="chat-error">{error}</p>}

                    {rooms.length > 0 && (
                        <div className="chat-tray-section">
                            <span>Cuộc trò chuyện</span>
                            {rooms.slice(0, 8).map((room) => (
                                <button key={room.id} onClick={() => openExistingRoom(room)} type="button">
                                    <strong>{room.title}</strong>
                                    {room.lastMessage && <small>{room.lastMessage.text || 'Tin nhắn đã xóa'}</small>}
                                </button>
                            ))}
                        </div>
                    )}

                    <div className="chat-tray-section">
                        <span>Liên hệ</span>
                        {filteredContacts.slice(0, 16).map((contact) => (
                            <button key={contact.accountId} onClick={() => openDirectChat(contact)} type="button">
                                <i className={onlineAccountIds.has(contact.accountId) ? 'online' : ''}>
                                    {contact.avatarText || contact.displayName?.slice(0, 1) || '?'}
                                </i>
                                <strong>{contact.displayName}</strong>
                                <small>{contact.role === 'Admin' ? 'Giáo viên' : [contact.grade, contact.className].filter(Boolean).join(' · ')}</small>
                            </button>
                        ))}
                    </div>
                </section>
            )}

            <button className="chat-launcher" onClick={() => setTrayOpen((open) => !open)} type="button">
                <span>{onlineUsers.length}</span>
                Chat
            </button>
        </div>
    )
}
