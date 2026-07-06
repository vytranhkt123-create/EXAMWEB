import { useEffect, useRef } from 'react'
import { MessageBubble } from './MessageBubble'

export function MessageList({
    currentUser,
    hasMore,
    loading,
    messages,
    onDelete,
    onEdit,
    onLoadOlder,
    onReact,
}) {
    const bottomRef = useRef(null)

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ block: 'end' })
    }, [messages.length])

    return (
        <div className="chat-message-list">
            {hasMore && (
                <button className="chat-load-older" disabled={loading} onClick={onLoadOlder} type="button">
                    {loading ? 'Đang tải...' : 'Tin cũ hơn'}
                </button>
            )}

            {messages.length === 0 && !loading ? (
                <div className="chat-empty">Chưa có tin nhắn</div>
            ) : (
                messages.map((message) => (
                    <MessageBubble
                        currentUser={currentUser}
                        key={message.id}
                        message={message}
                        onDelete={onDelete}
                        onEdit={onEdit}
                        onReact={onReact}
                    />
                ))
            )}
            <div ref={bottomRef} />
        </div>
    )
}
