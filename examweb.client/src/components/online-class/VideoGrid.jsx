import { useEffect, useRef } from 'react'

function RemoteVideoTile({ peer }) {
    const videoRef = useRef(null)

    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.srcObject = peer.stream || null
        }
    }, [peer.stream])

    return (
        <div className="meet-video-tile">
            <video autoPlay playsInline ref={videoRef} />
            {!peer.stream && <span className="meet-video-placeholder">Đang chờ video</span>}
            <div className="meet-video-label">
                <strong>{peer.displayName}</strong>
            </div>
        </div>
    )
}

export function VideoGrid({
    auth,
    cameraOn,
    isScreenSharing,
    localVideoRef,
    peerList,
    screenVideoRef,
}) {
    if (isScreenSharing) {
        return (
            <div className="meet-video-grid meet-video-grid--screen">
                <div className="meet-video-tile meet-video-tile--featured">
                    <video autoPlay muted playsInline ref={screenVideoRef} />
                    <div className="meet-video-label">
                        <strong>Màn hình của bạn</strong>
                    </div>
                </div>
                <div className="meet-video-grid meet-video-grid--thumbs">
                    <div className="meet-video-tile meet-video-tile--local">
                        <video autoPlay muted playsInline ref={localVideoRef} />
                        {!cameraOn && <span className="meet-video-placeholder">Cam tắt</span>}
                        <div className="meet-video-label">
                            <strong>{auth?.displayName || auth?.username || 'Bạn'}</strong>
                        </div>
                    </div>
                    {peerList.map((peer) => (
                        <RemoteVideoTile key={peer.connectionId} peer={peer} />
                    ))}
                </div>
            </div>
        )
    }

    const totalTiles = 1 + peerList.length

    return (
        <div
            className="meet-video-grid"
            data-participants={totalTiles}
            style={{ '--meet-tiles': totalTiles }}
        >
            <div className="meet-video-tile meet-video-tile--local">
                <video autoPlay muted playsInline ref={localVideoRef} />
                {!cameraOn && <span className="meet-video-placeholder">Camera đang tắt</span>}
                <div className="meet-video-label">
                    <strong>{auth?.displayName || auth?.username || 'Bạn'} (Bạn)</strong>
                </div>
            </div>
            {peerList.map((peer) => (
                <RemoteVideoTile key={peer.connectionId} peer={peer} />
            ))}
        </div>
    )
}
