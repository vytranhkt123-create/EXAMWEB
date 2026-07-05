import { MathText } from './MathText'

export function QuestionContent({ className = 'question-content', imageUrl, text }) {
    return (
        <div className={className}>
            <MathText text={text} />
            {imageUrl && (
                <img
                    alt=""
                    className="question-image"
                    loading="lazy"
                    src={imageUrl}
                />
            )}
        </div>
    )
}
