import { useEffect, useMemo, useRef } from 'react'

function getInitials(value) {
    const cleanValue = String(value || 'Guest').trim()
    return cleanValue
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join('') || 'G'
}

function RemoteVideoTile({ peer }) {
    const videoRef = useRef(null)
    const hasVideo = Boolean(peer.stream?.getVideoTracks().some((track) => track.enabled))

    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.srcObject = peer.stream || null
        }
    }, [peer.stream])

    return (
        <div className={`meet-video-tile ${peer.isSpeaking ? 'is-speaking' : ''}`}>
            {peer.stream ? <video autoPlay playsInline ref={videoRef} /> : null}
            {!hasVideo && (
                <div className="meet-video-avatar" aria-hidden="true">
                    {getInitials(peer.displayName)}
                </div>
            )}
            <div className="meet-video-label">
                <strong>{peer.displayName || 'Participant'}</strong>
                <span>{peer.isSpeaking ? 'Speaking' : peer.connectionState || 'online'}</span>
            </div>
        </div>
    )
}

export function VideoGrid({
    auth,
    cameraOn,
    isLocalSpeaking,
    isScreenSharing,
    localVideoRef,
    peerList,
    screenVideoRef,
}) {
    const displayName = auth?.displayName || auth?.username || 'You'
    const totalTiles = 1 + peerList.length
    const layoutClass = useMemo(() => {
        if (totalTiles <= 1) return 'meet-video-grid--solo'
        if (totalTiles === 2) return 'meet-video-grid--duo'
        if (totalTiles <= 4) return 'meet-video-grid--compact'
        return 'meet-video-grid--many'
    }, [totalTiles])

    if (isScreenSharing) {
        return (
            <div className="meet-video-grid meet-video-grid--screen">
                <div className="meet-video-tile meet-video-tile--featured is-presenting">
                    <video autoPlay muted playsInline ref={screenVideoRef} />
                    <div className="meet-video-label">
                        <strong>Your screen</strong>
                        <span>Presenting</span>
                    </div>
                </div>
                <div className="meet-video-grid meet-video-grid--thumbs">
                    <div className={`meet-video-tile meet-video-tile--local ${isLocalSpeaking ? 'is-speaking' : ''}`}>
                        <video autoPlay muted playsInline ref={localVideoRef} />
                        {!cameraOn && (
                            <div className="meet-video-avatar" aria-hidden="true">
                                {getInitials(displayName)}
                            </div>
                        )}
                        <div className="meet-video-label">
                            <strong>{displayName}</strong>
                            <span>{isLocalSpeaking ? 'Speaking' : cameraOn ? 'Camera on' : 'Camera off'}</span>
                        </div>
                    </div>
                    {peerList.map((peer) => (
                        <RemoteVideoTile key={peer.connectionId} peer={peer} />
                    ))}
                </div>
            </div>
        )
    }

    return (
        <div
            className={`meet-video-grid ${layoutClass}`}
            data-participants={totalTiles}
            style={{ '--meet-tiles': totalTiles }}
        >
            <div className={`meet-video-tile meet-video-tile--local ${isLocalSpeaking ? 'is-speaking' : ''}`}>
                <video autoPlay muted playsInline ref={localVideoRef} />
                {!cameraOn && (
                    <div className="meet-video-avatar" aria-hidden="true">
                        {getInitials(displayName)}
                    </div>
                )}
                <div className="meet-video-label">
                    <strong>{displayName} (you)</strong>
                    <span>{isLocalSpeaking ? 'Speaking' : cameraOn ? 'Camera on' : 'Camera off'}</span>
                </div>
            </div>
            {peerList.map((peer) => (
                <RemoteVideoTile key={peer.connectionId} peer={peer} />
            ))}
        </div>
    )
}
