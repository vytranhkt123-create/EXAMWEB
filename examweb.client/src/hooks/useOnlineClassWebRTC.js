import { useCallback, useEffect, useRef, useState } from 'react'
import { RTC_ICE_SERVERS } from '../config/appConfig'
import { useOnlineClassSocket } from './useOnlineClassSocket'

const DEFAULT_MEDIA_CONSTRAINTS = { video: true, audio: true }
const DEFAULT_SCREEN_SHARE_CONSTRAINTS = { video: true, audio: true }

function stopStreamTracks(stream) {
    if (!stream) return
    stream.getTracks().forEach((track) => track.stop())
}

export function useOnlineClassWebRTC({
    auth,
    roomId,
    enabled = true,
    autoStartMedia = true,
    mediaConstraints = DEFAULT_MEDIA_CONSTRAINTS,
    receiveOnly = false,
    screenShareConstraints = DEFAULT_SCREEN_SHARE_CONSTRAINTS,
    onRoomError,
    onRealtimeEvent,
    onScreenShareStopped,
    onWhiteboardEvent,
}) {
    const localVideoRef = useRef(null)
    const screenVideoRef = useRef(null)
    const streamRef = useRef(null)
    const screenStreamRef = useRef(null)
    const peerConnectionsRef = useRef(new Map())
    const connectionIdRef = useRef('')
    const isJoinedRef = useRef(false)
    const roomIdRef = useRef('')
    const socketActionsRef = useRef({
        joinRoom: () => false,
        leaveRoom: () => false,
        sendSignal: () => false,
        sendRoomEvent: () => false,
    })
    const onScreenShareStoppedRef = useRef(onScreenShareStopped)

    const [cameraOn, setCameraOn] = useState(false)
    const [isJoined, setIsJoined] = useState(false)
    const [isScreenSharing, setIsScreenSharing] = useState(false)
    const [mediaError, setMediaError] = useState('')
    const [micOn, setMicOn] = useState(false)
    const [peers, setPeers] = useState({})

    const peerList = Object.values(peers)

    useEffect(() => {
        isJoinedRef.current = isJoined
    }, [isJoined])

    useEffect(() => {
        roomIdRef.current = roomId || ''
    }, [roomId])

    useEffect(() => {
        onScreenShareStoppedRef.current = onScreenShareStopped
    }, [onScreenShareStopped])

    useEffect(() => {
        if (screenVideoRef.current) {
            screenVideoRef.current.srcObject = screenStreamRef.current
        }
    }, [isScreenSharing])

    const sendSignalToPeer = useCallback((type, targetConnectionId, payload) => {
        return socketActionsRef.current.sendSignal(type, targetConnectionId, payload)
    }, [])

    const upsertPeer = useCallback((connectionId, patch) => {
        setPeers((current) => ({
            ...current,
            [connectionId]: {
                connectionId,
                displayName: 'Người tham gia',
                role: 'User',
                stream: null,
                connectionState: 'new',
                ...(current[connectionId] || {}),
                ...patch,
            },
        }))
    }, [])

    const removePeer = useCallback((connectionId) => {
        const peerConnection = peerConnectionsRef.current.get(connectionId)
        if (peerConnection) {
            peerConnection.close()
            peerConnectionsRef.current.delete(connectionId)
        }
        setPeers((current) => {
            const next = { ...current }
            delete next[connectionId]
            return next
        })
    }, [])

    const closePeerConnections = useCallback(() => {
        peerConnectionsRef.current.forEach((peerConnection) => peerConnection.close())
        peerConnectionsRef.current.clear()
        setPeers({})
    }, [])

    const addOutgoingTracks = useCallback((peerConnection) => {
        const primaryStream = screenStreamRef.current || streamRef.current

        if (primaryStream) {
            primaryStream.getTracks().forEach((track) => {
                peerConnection.addTrack(track, primaryStream)
            })
        }

        if (screenStreamRef.current && streamRef.current) {
            streamRef.current.getAudioTracks().forEach((track) => {
                peerConnection.addTrack(track, streamRef.current)
            })
        }

        if (!primaryStream && receiveOnly) {
            peerConnection.addTransceiver('video', { direction: 'recvonly' })
            peerConnection.addTransceiver('audio', { direction: 'recvonly' })
        }
    }, [receiveOnly])

    const createAndSendOffer = useCallback(async (connectionId) => {
        const peerConnection = peerConnectionsRef.current.get(connectionId)
        if (!peerConnection) return
        const offer = await peerConnection.createOffer()
        await peerConnection.setLocalDescription(offer)
        sendSignalToPeer('offer', connectionId, offer)
    }, [sendSignalToPeer])

    const createPeerConnection = useCallback((peer, shouldOffer = false) => {
        if (!isJoinedRef.current || !peer?.connectionId || peer.connectionId === connectionIdRef.current) {
            return null
        }

        const existing = peerConnectionsRef.current.get(peer.connectionId)
        if (existing) {
            upsertPeer(peer.connectionId, peer)
            return existing
        }

        const peerConnection = new RTCPeerConnection({ iceServers: RTC_ICE_SERVERS })

        addOutgoingTracks(peerConnection)

        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                sendSignalToPeer('ice-candidate', peer.connectionId, event.candidate)
            }
        }

        peerConnection.ontrack = (event) => {
            upsertPeer(peer.connectionId, {
                ...peer,
                stream: event.streams[0],
            })
        }

        peerConnection.onconnectionstatechange = () => {
            upsertPeer(peer.connectionId, {
                ...peer,
                connectionState: peerConnection.connectionState,
            })
        }

        peerConnectionsRef.current.set(peer.connectionId, peerConnection)
        upsertPeer(peer.connectionId, peer)

        if (shouldOffer) {
            window.setTimeout(() => {
                createAndSendOffer(peer.connectionId).catch(() => {
                    setMediaError('Không thể tạo kết nối video với người tham gia')
                })
            }, 120)
        }

        return peerConnection
    }, [addOutgoingTracks, createAndSendOffer, sendSignalToPeer, upsertPeer])

    const handleMeetingPeers = useCallback((meetingPeers) => {
        meetingPeers.forEach((peer) => createPeerConnection(peer, false))
    }, [createPeerConnection])

    const handlePeerJoined = useCallback((peer) => {
        createPeerConnection(peer, true)
    }, [createPeerConnection])

    const handleOffer = useCallback(async (payload) => {
        const peer = {
            connectionId: payload.fromConnectionId,
            displayName: payload.fromDisplayName,
            role: payload.fromRole || 'User',
        }
        const peerConnection = createPeerConnection(peer, false)
        if (!peerConnection) return
        await peerConnection.setRemoteDescription(new RTCSessionDescription(payload.payload))
        const answer = await peerConnection.createAnswer()
        await peerConnection.setLocalDescription(answer)
        sendSignalToPeer('answer', peer.connectionId, answer)
    }, [createPeerConnection, sendSignalToPeer])

    const handleAnswer = useCallback(async (payload) => {
        const peerConnection = peerConnectionsRef.current.get(payload.fromConnectionId)
        if (peerConnection) {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(payload.payload))
        }
    }, [])

    const handleIceCandidate = useCallback(async (payload) => {
        const peerConnection = peerConnectionsRef.current.get(payload.fromConnectionId)
        if (peerConnection && payload.payload) {
            await peerConnection.addIceCandidate(new RTCIceCandidate(payload.payload))
        }
    }, [])

    const {
        joinRoom: socketJoinRoom,
        leaveRoom: socketLeaveRoom,
        sendRoomEvent,
        sendSignal,
    } = useOnlineClassSocket({
        auth: enabled ? auth : null,
        connectionIdRef,
        isJoinedRef,
        roomIdRef,
        onAnswer: handleAnswer,
        onDisconnected: closePeerConnections,
        onIceCandidate: handleIceCandidate,
        onMeetingPeers: handleMeetingPeers,
        onOffer: handleOffer,
        onPeerJoined: handlePeerJoined,
        onPeerLeft: removePeer,
        onRealtimeEvent,
        onRoomError,
        onWhiteboardEvent,
    })

    useEffect(() => {
        socketActionsRef.current = {
            joinRoom: socketJoinRoom,
            leaveRoom: socketLeaveRoom,
            sendSignal,
            sendRoomEvent,
        }
    }, [socketJoinRoom, socketLeaveRoom, sendRoomEvent, sendSignal])

    const renegotiatePeers = useCallback(async () => {
        for (const connectionId of peerConnectionsRef.current.keys()) {
            await createAndSendOffer(connectionId)
        }
    }, [createAndSendOffer])

    const attachLocalStreamToPeers = useCallback((stream) => {
        peerConnectionsRef.current.forEach((peerConnection) => {
            const senderTracks = peerConnection.getSenders().map((sender) => sender.track).filter(Boolean)
            stream.getTracks().forEach((track) => {
                if (!senderTracks.includes(track)) {
                    peerConnection.addTrack(track, stream)
                }
            })
        })
    }, [])

    const replaceOutgoingVideoTrack = useCallback(async (track) => {
        const replaceTasks = []
        let replacedCount = 0
        peerConnectionsRef.current.forEach((peerConnection) => {
            peerConnection.getSenders()
                .filter((sender) => sender.track?.kind === 'video')
                .forEach((sender) => {
                    replacedCount += 1
                    replaceTasks.push(sender.replaceTrack(track))
                })
        })
        await Promise.all(replaceTasks)
        return replacedCount
    }, [])

    const stopMedia = useCallback(async ({ renegotiate = true } = {}) => {
        stopStreamTracks(screenStreamRef.current)
        screenStreamRef.current = null
        stopStreamTracks(streamRef.current)
        streamRef.current = null

        if (localVideoRef.current) localVideoRef.current.srcObject = null
        if (screenVideoRef.current) screenVideoRef.current.srcObject = null

        peerConnectionsRef.current.forEach((peerConnection) => {
            peerConnection.getSenders().forEach((sender) => {
                if (sender.track) peerConnection.removeTrack(sender)
            })
        })

        setCameraOn(false)
        setMicOn(false)
        setIsScreenSharing(false)

        if (renegotiate) {
            await renegotiatePeers()
        }
    }, [renegotiatePeers])

    const startMedia = useCallback(async () => {
        if (!mediaConstraints) {
            return null
        }

        if (!navigator.mediaDevices?.getUserMedia) {
            setMediaError('Trình duyệt chưa hỗ trợ camera/micro')
            return null
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia(mediaConstraints)
            streamRef.current = stream
            if (!isScreenSharing && localVideoRef.current) {
                localVideoRef.current.srcObject = stream
            }
            setCameraOn(stream.getVideoTracks().some((track) => track.enabled))
            setMicOn(stream.getAudioTracks().some((track) => track.enabled))
            setMediaError('')
            attachLocalStreamToPeers(stream)
            await renegotiatePeers()
            return stream
        } catch {
            setMediaError('Không thể bật camera hoặc micro. Hãy kiểm tra quyền trình duyệt.')
            return null
        }
    }, [attachLocalStreamToPeers, isScreenSharing, mediaConstraints, renegotiatePeers])

    const stopScreenShare = useCallback(async ({ notify = false } = {}) => {
        stopStreamTracks(screenStreamRef.current)
        screenStreamRef.current = null
        setIsScreenSharing(false)

        const cameraTrack = streamRef.current?.getVideoTracks()?.[0] || null
        await replaceOutgoingVideoTrack(cameraTrack)
        if (localVideoRef.current) localVideoRef.current.srcObject = streamRef.current
        if (screenVideoRef.current) screenVideoRef.current.srcObject = null
        if (notify) {
            onScreenShareStoppedRef.current?.()
        }
    }, [replaceOutgoingVideoTrack])

    const startScreenShare = useCallback(async () => {
        if (!navigator.mediaDevices?.getDisplayMedia) {
            setMediaError('Trình duyệt chưa hỗ trợ chia sẻ màn hình')
            return null
        }

        try {
            const displayStream = await navigator.mediaDevices.getDisplayMedia(screenShareConstraints)
            screenStreamRef.current = displayStream
            const screenTrack = displayStream.getVideoTracks()[0]
            if (screenTrack) {
                screenTrack.onended = () => {
                    stopScreenShare({ notify: true })
                }
                const replacedCount = await replaceOutgoingVideoTrack(screenTrack)
                if (replacedCount === 0) {
                    attachLocalStreamToPeers(displayStream)
                    await renegotiatePeers()
                }
            } else {
                attachLocalStreamToPeers(displayStream)
                await renegotiatePeers()
            }
            if (screenVideoRef.current) screenVideoRef.current.srcObject = displayStream
            if (localVideoRef.current) localVideoRef.current.srcObject = displayStream
            setIsScreenSharing(true)
            setMediaError('')
            return displayStream
        } catch {
            setMediaError('Bạn cần chọn màn hình hoặc tab để chia sẻ.')
            return null
        }
    }, [attachLocalStreamToPeers, renegotiatePeers, replaceOutgoingVideoTrack, screenShareConstraints, stopScreenShare])

    const toggleCamera = useCallback(async () => {
        const stream = streamRef.current || await startMedia()
        if (!stream) return
        const next = !cameraOn
        stream.getVideoTracks().forEach((track) => {
            track.enabled = next
        })
        setCameraOn(next)
        await renegotiatePeers()
    }, [cameraOn, renegotiatePeers, startMedia])

    const toggleMicrophone = useCallback(async () => {
        const stream = streamRef.current || await startMedia()
        if (!stream) return
        const next = !micOn
        stream.getAudioTracks().forEach((track) => {
            track.enabled = next
        })
        setMicOn(next)
        await renegotiatePeers()
    }, [micOn, renegotiatePeers, startMedia])

    const joinMeeting = useCallback(async (targetRoomId) => {
        if (!targetRoomId) return false

        roomIdRef.current = targetRoomId
        isJoinedRef.current = true
        setIsJoined(true)
        setMediaError('')

        const joined = socketActionsRef.current.joinRoom(targetRoomId)
        if (!joined) {
            setMediaError('Chưa kết nối được máy chủ realtime. Đang thử lại…')
        }

        if (autoStartMedia) {
            await startMedia()
        }
        return true
    }, [autoStartMedia, startMedia])

    const leaveMeeting = useCallback(async () => {
        isJoinedRef.current = false
        roomIdRef.current = ''
        socketActionsRef.current.leaveRoom()
        setIsJoined(false)
        await stopMedia({ renegotiate: false })
        closePeerConnections()
    }, [closePeerConnections, stopMedia])

    useEffect(() => {
        return () => {
            isJoinedRef.current = false
            roomIdRef.current = ''
            socketActionsRef.current.leaveRoom()
            stopMedia({ renegotiate: false })
            closePeerConnections()
        }
    }, [closePeerConnections, stopMedia])

    return {
        cameraOn,
        connectionIdRef,
        isJoined,
        isScreenSharing,
        joinMeeting,
        leaveMeeting,
        localVideoRef,
        mediaError,
        micOn,
        peerList,
        screenVideoRef,
        sendRoomEvent,
        setMediaError,
        startScreenShare,
        stopScreenShare,
        toggleCamera,
        toggleMicrophone,
    }
}
