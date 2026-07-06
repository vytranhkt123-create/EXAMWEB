import { MessageInput } from './MessageInput'
import { MessageList } from './MessageList'

export function ChatBox({
    connectionState,
    currentUser,
    hasMore,
    loading,
    messages,
    onClose,
    onDelete,
    onEdit,
    onLoadOlder,
    onReact,
    onSend,
    onTyping,
    onlineAccountIds,
    room,
    typingUsers,
}) {
    const participant = room.participants?.find((item) => item.accountId !== currentUser?.accountId)
    const directOnline = room.type === 'Direct' && participant
        ? onlineAccountIds.has(participant.accountId)
        : false

    return (
        <section className="chat-box" aria-label={room.title}>
            <header className="chat-box-header">
                <div>
                    <strong>{room.title}</strong>
                    <span>
                        {connectionState === 'connected'
                            ? directOnline
                                ? 'Đang online'
                                : room.type === 'Direct'
                                    ? 'Không online'
                                    : 'Đã kết nối'
                            : 'Đang kết nối'}
                    </span>
                </div>
                <button className="chat-close-button" onClick={() => onClose?.(room.id)} title="Đóng" type="button">
                    ×
                </button>
            </header>

            <MessageList
                currentUser={currentUser}
                hasMore={hasMore}
                loading={loading}
                messages={messages}
                onDelete={onDelete}
                onEdit={onEdit}
                onLoadOlder={onLoadOlder}
                onReact={onReact}
            />

            <div className="chat-typing-line">
                {typingUsers.length > 0 ? `${typingUsers.map((user) => user.displayName).join(', ')} đang nhập...` : '\u00a0'}
            </div>

            <MessageInput
                disabled={connectionState === 'connecting'}
                onSend={(text) => onSend?.(room.id, text)}
                onTyping={(isTyping) => onTyping?.(room.id, isTyping)}
            />
        </section>
    )
}
