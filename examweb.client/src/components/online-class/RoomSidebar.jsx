import { useRef, useState } from 'react'
import { formatDateTime } from '../../utils/datetime'
import { compressImageFile } from '../../utils/image'

function MemberAvatar({ name, speaking = false }) {
    const initials = String(name || 'User')
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join('') || 'U'

    return (
        <span className={`meet-member-avatar ${speaking ? 'speaking' : ''}`} aria-hidden="true">
            {initials}
        </span>
    )
}

export function RoomSidebar({
    auth,
    chatDisabled = false,
    chatError = '',
    messages = [],
    onClearChat,
    peerList = [],
    showManageActions = false,
    onSendMessage,
}) {
    const [messageText, setMessageText] = useState('')
    const [imageDataUrl, setImageDataUrl] = useState('')
    const [imageError, setImageError] = useState('')
    const [imageProcessing, setImageProcessing] = useState(false)
    const [activeTab, setActiveTab] = useState('participants')
    const fileInputRef = useRef(null)

    async function handleImageChange(event) {
        const file = event.target.files?.[0]
        if (!file) return

        setImageError('')
        setImageProcessing(true)
        try {
            const compressed = await compressImageFile(file)
            setImageDataUrl(compressed)
        } catch (err) {
            setImageDataUrl('')
            setImageError(err.message || 'Could not process image')
        } finally {
            setImageProcessing(false)
        }
    }

    function clearSelectedImage() {
        setImageDataUrl('')
        setImageError('')
        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
    }

    async function handleSubmit(event) {
        event.preventDefault()
        if ((!messageText.trim() && !imageDataUrl) || chatDisabled || imageProcessing) return
        await onSendMessage?.({ text: messageText, imageDataUrl })
        setMessageText('')
        clearSelectedImage()
    }

    return (
        <aside className="meet-sidebar" aria-label="Room sidebar">
            <div className="meet-sidebar-tabs" role="tablist">
                <button
                    aria-selected={activeTab === 'participants'}
                    className={activeTab === 'participants' ? 'active' : ''}
                    onClick={() => setActiveTab('participants')}
                    role="tab"
                    type="button"
                >
                    People ({peerList.length + 1})
                </button>
                <button
                    aria-selected={activeTab === 'chat'}
                    className={activeTab === 'chat' ? 'active' : ''}
                    onClick={() => setActiveTab('chat')}
                    role="tab"
                    type="button"
                >
                    Chat
                </button>
            </div>

            {activeTab === 'participants' ? (
                <div className="meet-sidebar-panel" role="tabpanel">
                    <ul className="meet-member-list">
                        <li className="meet-member-item meet-member-item--self">
                            <MemberAvatar name={auth?.displayName || auth?.username || 'You'} />
                            <span>{auth?.displayName || auth?.username || 'You'}</span>
                            <small>You</small>
                        </li>
                        {peerList.map((peer) => (
                            <li className={`meet-member-item ${peer.isSpeaking ? 'is-speaking' : ''}`} key={peer.connectionId}>
                                <MemberAvatar name={peer.displayName} speaking={peer.isSpeaking} />
                                <span>{peer.displayName}</span>
                                <small>{peer.isSpeaking ? 'Speaking' : peer.connectionState || 'online'}</small>
                            </li>
                        ))}
                    </ul>
                </div>
            ) : (
                <div className="meet-sidebar-panel meet-sidebar-panel--chat" role="tabpanel">
                    <div className="meet-chat-list" role="log">
                        {chatError && <p className="meet-chat-error" role="alert">{chatError}</p>}
                        {messages.length === 0 ? (
                            <p className="meet-chat-empty">No messages yet</p>
                        ) : (
                            messages.map((message) => (
                                <article className="meet-chat-message" key={message.id}>
                                    <header>
                                        <strong>{message.authorName}</strong>
                                        <time dateTime={message.createdAt}>
                                            {formatDateTime(message.createdAt)}
                                        </time>
                                    </header>
                                    {message.text && <p>{message.text}</p>}
                                    {message.imageDataUrl && (
                                        <img
                                            alt={`Image from ${message.authorName}`}
                                            className="meet-chat-image"
                                            src={message.imageDataUrl}
                                        />
                                    )}
                                </article>
                            ))
                        )}
                    </div>
                    <form className="meet-chat-form" onSubmit={handleSubmit}>
                        <textarea
                            disabled={chatDisabled}
                            onChange={(event) => setMessageText(event.target.value)}
                            placeholder={chatDisabled ? 'Chat is locked' : 'Message this room'}
                            rows={3}
                            value={messageText}
                        />
                        {imageDataUrl && (
                            <div className="meet-chat-preview">
                                <img alt="Selected upload" src={imageDataUrl} />
                                <button className="ghost-button" onClick={clearSelectedImage} type="button">
                                    Remove
                                </button>
                            </div>
                        )}
                        {imageError && <p className="meet-chat-error" role="alert">{imageError}</p>}
                        <div className="meet-chat-actions">
                            <label className={`meet-chat-upload ${chatDisabled || imageProcessing ? 'disabled' : ''}`}>
                                <input
                                    accept="image/*"
                                    disabled={chatDisabled || imageProcessing}
                                    onChange={handleImageChange}
                                    ref={fileInputRef}
                                    type="file"
                                />
                                {imageProcessing ? 'Compressing...' : 'Image'}
                            </label>
                            {showManageActions && (
                                <button
                                    className="ghost-button"
                                    disabled={messages.length === 0}
                                    onClick={onClearChat}
                                    type="button"
                                >
                                    Clear
                                </button>
                            )}
                            <button
                                className="primary-button"
                                disabled={chatDisabled || imageProcessing || (!messageText.trim() && !imageDataUrl)}
                                type="submit"
                            >
                                Send
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </aside>
    )
}
