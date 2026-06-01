function ControlIcon({ type }) {
    const icons = {
        mic: 'M',
        muted: 'M',
        camera: 'C',
        cameraOff: 'C',
        screen: 'S',
        leave: 'L',
    }

    return <span className="meet-control-icon" aria-hidden="true">{icons[type]}</span>
}

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
        <footer className="meet-room-controls" aria-label="Room controls">
            <button
                aria-label={micOn ? 'Mute microphone' : 'Unmute microphone'}
                aria-pressed={micOn}
                className={micOn ? 'meet-control-btn meet-control-btn--active' : 'meet-control-btn'}
                onClick={onToggleMicrophone}
                type="button"
            >
                <ControlIcon type={micOn ? 'mic' : 'muted'} />
                <span>{micOn ? 'Mic on' : 'Muted'}</span>
            </button>
            <button
                aria-label={cameraOn ? 'Turn camera off' : 'Turn camera on'}
                aria-pressed={cameraOn}
                className={cameraOn ? 'meet-control-btn meet-control-btn--active' : 'meet-control-btn'}
                onClick={onToggleCamera}
                type="button"
            >
                <ControlIcon type={cameraOn ? 'camera' : 'cameraOff'} />
                <span>{cameraOn ? 'Camera on' : 'Camera off'}</span>
            </button>
            <button
                aria-label={isScreenSharing ? 'Stop presenting' : 'Present screen'}
                aria-pressed={isScreenSharing}
                className={isScreenSharing ? 'meet-control-btn meet-control-btn--share-active' : 'meet-control-btn'}
                onClick={onToggleScreenShare}
                type="button"
            >
                <ControlIcon type="screen" />
                <span>{isScreenSharing ? 'Stop presenting' : 'Present'}</span>
            </button>
            <button
                aria-label="Leave room"
                className="meet-control-btn meet-control-btn--leave"
                onClick={onLeave}
                type="button"
            >
                <ControlIcon type="leave" />
                <span>Leave</span>
            </button>
        </footer>
    )
}
