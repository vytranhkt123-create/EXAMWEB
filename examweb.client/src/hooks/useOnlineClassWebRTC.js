import { useCallback, useEffect, useRef, useState } from 'react'
import { RTC_ICE_SERVERS } from '../config/appConfig'
import { useOnlineClassSocket } from './useOnlineClassSocket'

const DEFAULT_MEDIA_CONSTRAINTS = { video: true, audio: true }
const DEFAULT_SCREEN_SHARE_CONSTRAINTS = { video: true, audio: true }

function stopStreamTracks(stream) {
    if (!stream) return
    stream.getTracks().forEach((track) => track.stop())
}

function getAudioContextCtor() {
    return window.AudioContext || window.webkitAudioContext
}

function getAudioLevel(dataArray) {
    if (!dataArray.length) return 0
    let sum = 0
    for (const value of dataArray) {
        const centered = value - 128
        sum += centered * centered
    }
    return Math.min(1, Math.sqrt(sum / dataArray.length) / 64)
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
    const pendingIceCandidatesRef = useRef(new Map())
    const audioMonitorStopsRef = useRef(new Map())
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
    const [localAudioLevel, setLocalAudioLevel] = useState(0)
    const [isLocalSpeaking, setIsLocalSpeaking] = useState(false)

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
        const stopAudioMonitor = audioMonitorStopsRef.current.get(connectionId)
        stopAudioMonitor?.()
        audioMonitorStopsRef.current.delete(connectionId)
        pendingIceCandidatesRef.current.delete(connectionId)
        setPeers((current) => {
            const next = { ...current }
            delete next[connectionId]
            return next
        })
    }, [])

    const stopAudioMonitor = useCallback((monitorId) => {
        const stop = audioMonitorStopsRef.current.get(monitorId)
        stop?.()
        audioMonitorStopsRef.current.delete(monitorId)
        if (monitorId === 'local') {
            setLocalAudioLevel(0)
            setIsLocalSpeaking(false)
        }
    }, [])

    const startAudioMonitor = useCallback((monitorId, stream, { local = false } = {}) => {
        const AudioContextCtor = getAudioContextCtor()
        if (!AudioContextCtor || !stream?.getAudioTracks().some((track) => track.readyState === 'live')) {
            return
        }

        stopAudioMonitor(monitorId)

        const audioContext = new AudioContextCtor()
        const source = audioContext.createMediaStreamSource(stream)
        const analyser = audioContext.createAnalyser()
        analyser.fftSize = 512
        source.connect(analyser)

        const dataArray = new Uint8Array(analyser.frequencyBinCount)
        let frameId = 0
        let stopped = false

        const tick = () => {
            if (stopped) return
            analyser.getByteTimeDomainData(dataArray)
            const audioLevel = getAudioLevel(dataArray)
            const isSpeaking = audioLevel > 0.12

            if (local) {
                setLocalAudioLevel(audioLevel)
                setIsLocalSpeaking(isSpeaking)
            } else {
                upsertPeer(monitorId, { audioLevel, isSpeaking })
            }

            frameId = window.requestAnimationFrame(tick)
        }

        tick()

        audioMonitorStopsRef.current.set(monitorId, () => {
            stopped = true
            if (frameId) window.cancelAnimationFrame(frameId)
            source.disconnect()
            audioContext.close().catch(() => {})
        })
    }, [stopAudioMonitor, upsertPeer])

    const closePeerConnections = useCallback(() => {
        peerConnectionsRef.current.forEach((peerConnection) => peerConnection.close())
        peerConnectionsRef.current.clear()
        pendingIceCandidatesRef.current.clear()
        audioMonitorStopsRef.current.forEach((stop, monitorId) => {
            if (monitorId !== 'local') stop()
        })
        Array.from(audioMonitorStopsRef.current.keys())
            .filter((monitorId) => monitorId !== 'local')
            .forEach((monitorId) => audioMonitorStopsRef.current.delete(monitorId))
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

    const flushPendingIceCandidates = useCallback(async (connectionId) => {
        const peerConnection = peerConnectionsRef.current.get(connectionId)
        const pendingCandidates = pendingIceCandidatesRef.current.get(connectionId) || []
        if (!peerConnection?.remoteDescription || pendingCandidates.length === 0) return

        pendingIceCandidatesRef.current.delete(connectionId)
        await Promise.all(
            pendingCandidates.map((candidate) =>
                peerConnection.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {}),
            ),
        )
    }, [])

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
            startAudioMonitor(peer.connectionId, event.streams[0])
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
    }, [addOutgoingTracks, createAndSendOffer, sendSignalToPeer, startAudioMonitor, upsertPeer])

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
        await flushPendingIceCandidates(peer.connectionId)
        const answer = await peerConnection.createAnswer()
        await peerConnection.setLocalDescription(answer)
        sendSignalToPeer('answer', peer.connectionId, answer)
    }, [createPeerConnection, flushPendingIceCandidates, sendSignalToPeer])

    const handleAnswer = useCallback(async (payload) => {
        const peerConnection = peerConnectionsRef.current.get(payload.fromConnectionId)
        if (peerConnection) {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(payload.payload))
            await flushPendingIceCandidates(payload.fromConnectionId)
        }
    }, [flushPendingIceCandidates])

    const handleIceCandidate = useCallback(async (payload) => {
        const peerConnection = peerConnectionsRef.current.get(payload.fromConnectionId)
        if (peerConnection && payload.payload) {
            if (!peerConnection.remoteDescription) {
                const pendingCandidates = pendingIceCandidatesRef.current.get(payload.fromConnectionId) || []
                pendingCandidates.push(payload.payload)
                pendingIceCandidatesRef.current.set(payload.fromConnectionId, pendingCandidates)
                return
            }
            await peerConnection.addIceCandidate(new RTCIceCandidate(payload.payload)).catch(() => {})
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
        stopAudioMonitor('local')

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
    }, [renegotiatePeers, stopAudioMonitor])

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
            if (streamRef.current && streamRef.current !== stream) {
                stopStreamTracks(streamRef.current)
            }
            streamRef.current = stream
            stream.getVideoTracks().forEach((track) => {
                track.onended = () => setCameraOn(false)
            })
            stream.getAudioTracks().forEach((track) => {
                track.onended = () => {
                    setMicOn(false)
                    setIsLocalSpeaking(false)
                    setLocalAudioLevel(0)
                }
            })
            if (!isScreenSharing && localVideoRef.current) {
                localVideoRef.current.srcObject = stream
            }
            setCameraOn(stream.getVideoTracks().some((track) => track.enabled))
            setMicOn(stream.getAudioTracks().some((track) => track.enabled))
            setMediaError('')
            startAudioMonitor('local', stream, { local: true })
            attachLocalStreamToPeers(stream)
            await renegotiatePeers()
            return stream
        } catch {
            setMediaError('Không thể bật camera hoặc micro. Hãy kiểm tra quyền trình duyệt.')
            return null
        }
    }, [attachLocalStreamToPeers, isScreenSharing, mediaConstraints, renegotiatePeers, startAudioMonitor])

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
            if (localVideoRef.current && streamRef.current) {
                localVideoRef.current.srcObject = streamRef.current
            }

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
        if (!next) {
            setIsLocalSpeaking(false)
            setLocalAudioLevel(0)
        }
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
        isLocalSpeaking,
        isScreenSharing,
        joinMeeting,
        leaveMeeting,
        localAudioLevel,
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
