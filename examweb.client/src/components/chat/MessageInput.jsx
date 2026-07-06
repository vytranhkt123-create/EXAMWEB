import { useEffect, useRef, useState } from 'react'
import EmojiPicker from 'emoji-picker-react'

export function MessageInput({ disabled = false, onSend, onTyping }) {
    const [text, setText] = useState('')
    const [emojiOpen, setEmojiOpen] = useState(false)
    const textareaRef = useRef(null)
    const typingTimerRef = useRef(null)

    useEffect(() => {
        return () => {
            if (typingTimerRef.current) {
                window.clearTimeout(typingTimerRef.current)
            }
        }
    }, [])

    function notifyTyping() {
        onTyping?.(true)
        if (typingTimerRef.current) {
            window.clearTimeout(typingTimerRef.current)
        }
        typingTimerRef.current = window.setTimeout(() => {
            onTyping?.(false)
        }, 1200)
    }

    function handleChange(event) {
        setText(event.target.value)
        notifyTyping()
    }

    function handleEmojiSelect(emoji) {
        const nativeEmoji = emoji?.emoji || ''
        if (!nativeEmoji) return
        setText((current) => `${current}${nativeEmoji}`)
        setEmojiOpen(false)
        textareaRef.current?.focus()
        notifyTyping()
    }

    async function handleSubmit(event) {
        event.preventDefault()
        const cleanText = text.trim()
        if (!cleanText || disabled) return

        await onSend?.(cleanText)
        setText('')
        onTyping?.(false)
    }

    return (
        <form className="chat-input" onSubmit={handleSubmit}>
            <div className="chat-input-row">
                <button
                    aria-expanded={emojiOpen}
                    className="chat-icon-button"
                    disabled={disabled}
                    onClick={() => setEmojiOpen((open) => !open)}
                    title="Emoji"
                    type="button"
                >
                    ☺
                </button>
                <textarea
                    disabled={disabled}
                    onChange={handleChange}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.shiftKey) {
                            handleSubmit(event)
                        }
                    }}
                    placeholder="Nhập tin nhắn..."
                    ref={textareaRef}
                    rows={1}
                    value={text}
                />
                <button className="chat-send-button" disabled={disabled || !text.trim()} title="Gửi" type="submit">
                    ➤
                </button>
            </div>

            {emojiOpen && (
                <div className="chat-emoji-popover">
                    <EmojiPicker
                        height={360}
                        lazyLoadEmojis
                        onEmojiClick={handleEmojiSelect}
                        previewConfig={{ showPreview: false }}
                        searchPlaceHolder="Tìm emoji"
                        width={300}
                    />
                </div>
            )}
        </form>
    )
}
