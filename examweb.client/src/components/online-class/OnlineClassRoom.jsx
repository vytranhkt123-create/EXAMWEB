import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { onlineClassApi } from '../../services/api'
import { useOnlineClassWebRTC } from '../../hooks/useOnlineClassWebRTC'
import { VideoGrid } from './VideoGrid'
import { RoomControls } from './RoomControls'
import { RoomSidebar } from './RoomSidebar'
import { RoomManagementPanel } from './RoomManagementPanel'

async function enterRoomFullscreen(element) {
    const target = element || document.documentElement
    if (target?.requestFullscreen) {
        await target.requestFullscreen()
    } else if (target?.webkitRequestFullscreen) {
        await target.webkitRequestFullscreen()
    }
}

async function exitRoomFullscreen() {
    if (document.fullscreenElement || document.webkitFullscreenElement) {
        if (document.exitFullscreen) {
            await document.exitFullscreen()
        } else if (document.webkitExitFullscreen) {
            await document.webkitExitFullscreen()
        }
    }
}

export function OnlineClassRoom({
    auth,
    canManage = false,
    chatDisabled = false,
    onLeaveRoom,
    onRealtimeEvent,
    onWhiteboardEvent,
}) {
    const shellRef = useRef(null)
    const realtimeEventHandlerRef = useRef(onRealtimeEvent)
    const [rooms, setRooms] = useState([])
    const [roomsLoading, setRoomsLoading] = useState(true)
    const [roomsError, setRoomsError] = useState('')
    const [selectedRoomId, setSelectedRoomId] = useState('')
    const [accessDenied, setAccessDenied] = useState('')
    const [sidebarOpen, setSidebarOpen] = useState(true)
    const [joining, setJoining] = useState(false)
    const [roomChatMessages, setRoomChatMessages] = useState([])
    const [roomChatLoading, setRoomChatLoading] = useState(false)
    const [roomChatError, setRoomChatError] = useState('')

    const selectedRoom = useMemo(
        () => rooms.find((room) => room.id === selectedRoomId) || null,
        [rooms, selectedRoomId],
    )

    const canJoinSelectedRoom = Boolean(
        selectedRoom &&
        (selectedRoom.isMember || canManage) &&
        (selectedRoom.isLive || canManage),
    )

    const leaveMeetingRef = useRef(async () => {})
    const handleSocketRealtimeEvent = useCallback((type, payload) => {
        realtimeEventHandlerRef.current?.(type, payload)
    }, [])

    const handleRoomError = useCallback(async (message) => {
        setAccessDenied(message || 'Bạn không có quyền vào phòng học này')
        await leaveMeetingRef.current()
        await exitRoomFullscreen()
    }, [])

    const {
        cameraOn,
        isJoined,
        isLocalSpeaking,
        isScreenSharing,
        joinMeeting,
        leaveMeeting,
        localVideoRef,
        mediaError,
        micOn,
        peerList,
        screenVideoRef,
        setMediaError,
        startScreenShare,
        stopScreenShare,
        toggleCamera,
        toggleMicrophone,
    } = useOnlineClassWebRTC({
        auth,
        roomId: selectedRoomId,
        enabled: Boolean(auth?.accessToken),
        onRoomError: handleRoomError,
        onRealtimeEvent: handleSocketRealtimeEvent,
        onWhiteboardEvent,
    })

    useEffect(() => {
        leaveMeetingRef.current = leaveMeeting
    }, [leaveMeeting])

    const loadRooms = useCallback(async (preferredRoomId = '') => {
        setRoomsLoading(true)
        setRoomsError('')
        try {
            const data = await onlineClassApi('/rooms')
            const list = Array.isArray(data) ? data : []
            setRooms(list)
            setSelectedRoomId((current) => {
                if (preferredRoomId && list.some((room) => room.id === preferredRoomId)) return preferredRoomId
                if (current && list.some((room) => room.id === current)) return current
                return list[0]?.id || ''
            })
        } catch (err) {
            setRoomsError(err.message || 'Không tải được danh sách phòng học')
            setRooms([])
        } finally {
            setRoomsLoading(false)
        }
    }, [])

    useEffect(() => {
        const timer = window.setTimeout(() => {
            loadRooms()
        }, 0)
        return () => window.clearTimeout(timer)
    }, [loadRooms])

    const loadRoomChat = useCallback(async (roomId) => {
        if (!roomId) {
            setRoomChatMessages([])
            return
        }

        setRoomChatLoading(true)
        setRoomChatError('')
        try {
            const data = await onlineClassApi(`/chat?roomId=${encodeURIComponent(roomId)}`)
            setRoomChatMessages(Array.isArray(data) ? data : [])
        } catch (err) {
            setRoomChatMessages([])
            setRoomChatError(err.message || 'Could not load room chat')
        } finally {
            setRoomChatLoading(false)
        }
    }, [])

    useEffect(() => {
        if (!isJoined || !selectedRoomId) return undefined
        const timer = window.setTimeout(() => {
            loadRoomChat(selectedRoomId)
        }, 0)
        return () => window.clearTimeout(timer)
    }, [isJoined, loadRoomChat, selectedRoomId])

    const handleRealtimeRoomEvent = useCallback((type, payload) => {
        if (type === 'chat-message' && payload?.id) {
            if (!payload.roomId || payload.roomId === selectedRoomId) {
                setRoomChatMessages((current) =>
                    current.some((item) => item.id === payload.id)
                        ? current
                        : [...current, payload].slice(-160),
                )
            }
            return
        } else if (type === 'chat-cleared') {
            if (!payload?.roomId || payload.roomId === selectedRoomId) {
                setRoomChatMessages([])
            }
            return
        } else if (type === 'online-class-rooms-updated') {
            loadRooms(selectedRoomId)
        }

        onRealtimeEvent?.(type, payload)
    }, [loadRooms, onRealtimeEvent, selectedRoomId])

    useEffect(() => {
        realtimeEventHandlerRef.current = handleRealtimeRoomEvent
    }, [handleRealtimeRoomEvent])

    const sendRoomChatMessage = useCallback(async (messageInput) => {
        const payload = typeof messageInput === 'string'
            ? { text: messageInput, imageDataUrl: null }
            : messageInput || {}
        const cleanText = String(payload.text || '').trim()
        const imageDataUrl = payload.imageDataUrl || null
        if ((!cleanText && !imageDataUrl) || !selectedRoomId) return

        const message = await onlineClassApi('/chat', {
            method: 'POST',
            body: JSON.stringify({ text: cleanText, imageDataUrl, roomId: selectedRoomId }),
        })
        setRoomChatMessages((current) =>
            current.some((item) => item.id === message.id)
                ? current
                : [...current, message].slice(-160),
        )
    }, [selectedRoomId])

    const clearRoomChatMessages = useCallback(async () => {
        if (!selectedRoomId || !window.confirm('Clear chat for this room?')) return
        await onlineClassApi(`/chat?roomId=${encodeURIComponent(selectedRoomId)}`, { method: 'DELETE' })
        setRoomChatMessages([])
    }, [selectedRoomId])

    async function handleJoinRoom() {
        if (!selectedRoomId || !canJoinSelectedRoom) return

        const allowed = rooms.some(
            (room) => room.id === selectedRoomId && (room.isMember || canManage),
        )
        if (!allowed) {
            setAccessDenied('Tài khoản chưa được thầy giáo gán vào phòng học này.')
            return
        }

        setAccessDenied('')
        setJoining(true)
        setMediaError('')

        try {
            const ok = await joinMeeting(selectedRoomId)
            if (ok) {
                try {
                    await enterRoomFullscreen(shellRef.current)
                } catch {
                    setMediaError('Không bật được toàn màn hình — phòng vẫn hoạt động bình thường.')
                }
            }
        } finally {
            setJoining(false)
        }
    }

    async function handleLeaveRoom() {
        await leaveMeeting()
        await exitRoomFullscreen()
        setAccessDenied('')
        onLeaveRoom?.()
    }

    function handleToggleScreenShare() {
        if (isScreenSharing) {
            stopScreenShare()
        } else {
            startScreenShare()
        }
    }

    if (isJoined && selectedRoom) {
        return (
            <section className="meet-room-shell meet-room-shell--active" ref={shellRef}>
                <header className="meet-room-header">
                    <div>
                        <p className="meet-room-eyebrow">Phòng học trực tuyến</p>
                        <h2>{selectedRoom.name}</h2>
                        <span className="meet-room-meta">
                            {peerList.length > 0
                                ? `${peerList.length + 1} người đang tham gia`
                                : 'Chỉ có bạn trong phòng'}
                        </span>
                    </div>
                    <button
                        aria-expanded={sidebarOpen}
                        className="ghost-button meet-sidebar-toggle"
                        onClick={() => setSidebarOpen((open) => !open)}
                        type="button"
                    >
                        {sidebarOpen ? 'Ẩn sidebar' : 'Hiện sidebar'}
                    </button>
                </header>

                <div className={`meet-room-body ${sidebarOpen ? 'meet-room-body--sidebar' : ''}`}>
                    <div className="meet-room-stage">
                        <VideoGrid
                            auth={auth}
                            cameraOn={cameraOn}
                            isLocalSpeaking={isLocalSpeaking}
                            isScreenSharing={isScreenSharing}
                            localVideoRef={localVideoRef}
                            peerList={peerList}
                            screenVideoRef={screenVideoRef}
                        />
                        {(mediaError || accessDenied) && (
                            <p className="meet-room-alert" role="alert">
                                {accessDenied || mediaError}
                            </p>
                        )}
                    </div>

                    {sidebarOpen && (
                        <RoomSidebar
                            auth={auth}
                            chatDisabled={chatDisabled || roomChatLoading || (!canManage && !selectedRoom.isLive)}
                            chatError={roomChatError}
                            messages={roomChatMessages}
                            onClearChat={clearRoomChatMessages}
                            onSendMessage={sendRoomChatMessage}
                            peerList={peerList}
                            showManageActions={canManage}
                        />
                    )}
                </div>

                <RoomControls
                    cameraOn={cameraOn}
                    isScreenSharing={isScreenSharing}
                    micOn={micOn}
                    onLeave={handleLeaveRoom}
                    onToggleCamera={toggleCamera}
                    onToggleMicrophone={toggleMicrophone}
                    onToggleScreenShare={handleToggleScreenShare}
                />
            </section>
        )
    }

    return (
        <section className="meet-room-shell meet-room-shell--lobby">
            <header className="meet-room-header">
                <div>
                    <p className="meet-room-eyebrow">Phòng học trực tuyến</p>
                    <h2>Chọn phòng để tham gia</h2>
                    <p className="meet-room-lead">
                        Chỉ các phòng bạn được thầy giáo gán mới xuất hiện trong danh sách.
                    </p>
                </div>
                <button className="ghost-button" disabled={roomsLoading} onClick={() => loadRooms()} type="button">
                    Làm mới
                </button>
            </header>

            {roomsLoading && <p className="meet-room-status">Đang tải phòng học…</p>}
            {roomsError && <p className="meet-room-alert" role="alert">{roomsError}</p>}
            {accessDenied && <p className="meet-room-alert" role="alert">{accessDenied}</p>}

            {!roomsLoading && rooms.length === 0 && !roomsError && (
                <div className="meet-room-empty">
                    <strong>Chưa có phòng học</strong>
                    <p>
                        {canManage
                            ? 'Hãy tạo phòng mới và gán học sinh từ trang quản trị.'
                            : 'Liên hệ thầy giáo để được thêm vào phòng học.'}
                    </p>
                </div>
            )}

            {canManage && (
                <RoomManagementPanel
                    onRoomsChanged={loadRooms}
                    onSelectRoom={(roomId) => {
                        setSelectedRoomId(roomId)
                        setAccessDenied('')
                    }}
                    rooms={rooms}
                    selectedRoomId={selectedRoomId}
                />
            )}

            {rooms.length > 0 && (
                <div className="meet-room-picker">
                    <label className="form-row" htmlFor="meet-room-select">
                        <span>Phòng học</span>
                        <select
                            id="meet-room-select"
                            onChange={(event) => {
                                setSelectedRoomId(event.target.value)
                                setAccessDenied('')
                            }}
                            value={selectedRoomId}
                        >
                            {rooms.map((room) => (
                                <option key={room.id} value={room.id}>
                                    {room.name}
                                    {!room.isLive && !canManage ? ' (chưa mở)' : ''}
                                </option>
                            ))}
                        </select>
                    </label>

                    {selectedRoom && (
                        <div className="meet-room-card">
                            <h3>{selectedRoom.name}</h3>
                            {selectedRoom.description && <p>{selectedRoom.description}</p>}
                            <div className="meet-room-card-meta">
                                <span className={selectedRoom.isLive ? 'status-chip' : 'status-chip warning'}>
                                    {selectedRoom.isLive ? 'Đang mở' : 'Chưa mở'}
                                </span>
                                <span className="badge">{selectedRoom.memberCount} thành viên</span>
                            </div>
                            {!selectedRoom.isMember && !canManage && (
                                <p className="meet-room-alert">
                                    Bạn chưa được gán vào phòng này.
                                </p>
                            )}
                            <button
                                className="primary-button full-width"
                                disabled={!canJoinSelectedRoom || joining}
                                onClick={handleJoinRoom}
                                type="button"
                            >
                                {joining
                                    ? 'Đang vào phòng…'
                                    : canJoinSelectedRoom
                                        ? 'Tham gia phòng'
                                        : selectedRoom.isLive === false && !canManage
                                            ? 'Chờ thầy giáo mở phòng'
                                            : 'Không có quyền tham gia'}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </section>
    )
}
