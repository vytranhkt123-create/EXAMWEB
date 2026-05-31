export function RoomControls({
    cameraOn,
    isScreenSharing,
    micOn,
    onLeave,
    onToggleCamera,
    onToggleMicrophone,
    onToggleScreenShare,
}) {
    return (
        <footer className="meet-room-controls" aria-label="Điều khiển phòng học">
            <button
                aria-label={micOn ? 'Tắt micro' : 'Bật micro'}
                aria-pressed={micOn}
                className={micOn ? 'meet-control-btn meet-control-btn--active' : 'meet-control-btn'}
                onClick={onToggleMicrophone}
                type="button"
            >
                <span className="meet-control-icon" aria-hidden="true">{micOn ? '🎤' : '🔇'}</span>
                <span>{micOn ? 'Micro' : 'Tắt micro'}</span>
            </button>
            <button
                aria-label={cameraOn ? 'Tắt camera' : 'Bật camera'}
                aria-pressed={cameraOn}
                className={cameraOn ? 'meet-control-btn meet-control-btn--active' : 'meet-control-btn'}
                onClick={onToggleCamera}
                type="button"
            >
                <span className="meet-control-icon" aria-hidden="true">{cameraOn ? '📷' : '📵'}</span>
                <span>{cameraOn ? 'Camera' : 'Bật cam'}</span>
            </button>
            <button
                aria-label={isScreenSharing ? 'Dừng chia sẻ màn hình' : 'Chia sẻ màn hình'}
                aria-pressed={isScreenSharing}
                className={isScreenSharing ? 'meet-control-btn meet-control-btn--share-active' : 'meet-control-btn'}
                onClick={onToggleScreenShare}
                type="button"
            >
                <span className="meet-control-icon" aria-hidden="true">🖥️</span>
                <span>{isScreenSharing ? 'Dừng chia sẻ' : 'Chia sẻ màn hình'}</span>
            </button>
            <button
                aria-label="Rời khỏi phòng"
                className="meet-control-btn meet-control-btn--leave"
                onClick={onLeave}
                type="button"
            >
                <span className="meet-control-icon" aria-hidden="true">📞</span>
                <span>Rời phòng</span>
            </button>
        </footer>
    )
}
