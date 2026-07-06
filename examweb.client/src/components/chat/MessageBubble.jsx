import { useState } from 'react'

const QUICK_REACTIONS = ['👍', '❤️', '😂', '🎉', '😮']

function formatMessageTime(value) {
    if (!value) return ''
    return new Intl.DateTimeFormat('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
    }).format(new Date(value))
}

export function MessageBubble({
    currentUser,
    message,
    onDelete,
    onEdit,
    onReact,
}) {
    const [editing, setEditing] = useState(false)
    const [draft, setDraft] = useState(message.text || '')
    const isMine = message.authorAccountId === currentUser?.accountId
    const canManage = isMine || currentUser?.role === 'Admin'
    const seenCount = (message.readReceipts || [])
        .filter((receipt) => receipt.accountId !== currentUser?.accountId)
        .length

    async function handleSave(event) {
        event.preventDefault()
        const cleanText = draft.trim()
        if (!cleanText || cleanText === message.text) {
            setEditing(false)
            setDraft(message.text || '')
            return
        }

        await onEdit?.(message.id, cleanText)
        setEditing(false)
    }

    return (
        <article className={`chat-message ${isMine ? 'mine' : 'theirs'} ${message.isDeleted ? 'deleted' : ''}`}>
            {!isMine && <span className="chat-message-author">{message.authorDisplayName}</span>}

            <div className="chat-message-body">
                {message.isDeleted ? (
                    <p className="chat-message-deleted">Tin nhắn đã được xóa</p>
                ) : editing ? (
                    <form className="chat-edit-form" onSubmit={handleSave}>
                        <textarea
                            autoFocus
                            onChange={(event) => setDraft(event.target.value)}
                            rows={2}
                            value={draft}
                        />
                        <div>
                            <button className="chat-text-button" onClick={() => setEditing(false)} type="button">
                                Hủy
                            </button>
                            <button className="chat-text-button strong" type="submit">
                                Lưu
                            </button>
                        </div>
                    </form>
                ) : (
                    <p>{message.text}</p>
                )}
            </div>

            {!message.isDeleted && (
                <div className="chat-reaction-row" aria-label="Reactions">
                    {QUICK_REACTIONS.map((emoji) => (
                        <button
                            className="chat-reaction-button"
                            key={emoji}
                            onClick={() => onReact?.(message.id, emoji)}
                            title={`React ${emoji}`}
                            type="button"
                        >
                            {emoji}
                        </button>
                    ))}
                </div>
            )}

            {!message.isDeleted && message.reactions?.length > 0 && (
                <div className="chat-reaction-summary">
                    {message.reactions.map((reaction) => (
                        <button
                            className={reaction.isMine ? 'active' : ''}
                            key={reaction.emoji}
                            onClick={() => onReact?.(message.id, reaction.emoji)}
                            type="button"
                        >
                            <span>{reaction.emoji}</span>
                            <strong>{reaction.count}</strong>
                        </button>
                    ))}
                </div>
            )}

            <footer className="chat-message-meta">
                <time>{formatMessageTime(message.createdAt)}</time>
                {message.editedAt && !message.isDeleted && <span>Đã sửa</span>}
                {isMine && seenCount > 0 && <span>Đã xem</span>}
                {canManage && !message.isDeleted && !editing && (
                    <span className="chat-message-actions">
                        {isMine && (
                            <button onClick={() => setEditing(true)} type="button">
                                Sửa
                            </button>
                        )}
                        <button onClick={() => onDelete?.(message.id)} type="button">
                            Xóa
                        </button>
                    </span>
                )}
            </footer>
        </article>
    )
}
