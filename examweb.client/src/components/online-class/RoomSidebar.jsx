import { useState } from 'react'
import { formatDateTime } from '../../utils/datetime'

export function RoomSidebar({
    auth,
    chatDisabled = false,
    messages = [],
    onClearChat,
    peerList = [],
    showManageActions = false,
    onSendMessage,
}) {
    const [messageText, setMessageText] = useState('')
    const [activeTab, setActiveTab] = useState('participants')

    function handleSubmit(event) {
        event.preventDefault()
        if (!messageText.trim() || chatDisabled) return
        onSendMessage(messageText)
        setMessageText('')
    }

    return (
        <aside className="meet-sidebar" aria-label="Thanh bên phòng học">
            <div className="meet-sidebar-tabs" role="tablist">
                <button
                    aria-selected={activeTab === 'participants'}
                    className={activeTab === 'participants' ? 'active' : ''}
                    onClick={() => setActiveTab('participants')}
                    role="tab"
                    type="button"
                >
                    Thành viên ({peerList.length + 1})
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
                            <span>{auth?.displayName || auth?.username || 'Bạn'}</span>
                            <small>Bạn · Host</small>
                        </li>
                        {peerList.map((peer) => (
                            <li className="meet-member-item" key={peer.connectionId}>
                                <span>{peer.displayName}</span>
                                <small>{peer.connectionState || 'online'}</small>
                            </li>
                        ))}
                    </ul>
                </div>
            ) : (
                <div className="meet-sidebar-panel meet-sidebar-panel--chat" role="tabpanel">
                    <div className="meet-chat-list" role="log">
                        {messages.length === 0 ? (
                            <p className="meet-chat-empty">Chưa có tin nhắn</p>
                        ) : (
                            messages.map((message) => (
                                <article className="meet-chat-message" key={message.id}>
                                    <header>
                                        <strong>{message.authorName}</strong>
                                        <time dateTime={message.createdAt}>
                                            {formatDateTime(message.createdAt)}
                                        </time>
                                    </header>
                                    <p>{message.text}</p>
                                </article>
                            ))
                        )}
                    </div>
                    <form className="meet-chat-form" onSubmit={handleSubmit}>
                        <textarea
                            disabled={chatDisabled}
                            onChange={(event) => setMessageText(event.target.value)}
                            placeholder={chatDisabled ? 'Chat tạm khóa' : 'Nhập tin nhắn…'}
                            rows={3}
                            value={messageText}
                        />
                        <div className="meet-chat-actions">
                            {showManageActions && (
                                <button
                                    className="ghost-button"
                                    disabled={messages.length === 0}
                                    onClick={onClearChat}
                                    type="button"
                                >
                                    Xóa chat
                                </button>
                            )}
                            <button
                                className="primary-button"
                                disabled={chatDisabled || !messageText.trim()}
                                type="submit"
                            >
                                Gửi
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </aside>
    )
}
