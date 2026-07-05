import { BlockMath, InlineMath } from 'react-katex'
import 'katex/dist/katex.min.css'

const mathPattern = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|\$[^$\n]+?\$)/g

function parseMathSegment(segment) {
    if (segment.startsWith('$$') && segment.endsWith('$$')) {
        return { display: true, value: segment.slice(2, -2).trim() }
    }

    if (segment.startsWith('\\[') && segment.endsWith('\\]')) {
        return { display: true, value: segment.slice(2, -2).trim() }
    }

    if (segment.startsWith('\\(') && segment.endsWith('\\)')) {
        return { display: false, value: segment.slice(2, -2).trim() }
    }

    if (segment.startsWith('$') && segment.endsWith('$')) {
        return { display: false, value: segment.slice(1, -1).trim() }
    }

    return null
}

export function MathText({ text = '' }) {
    if (!text) return null

    const parts = String(text).split(mathPattern).filter(Boolean)

    return (
        <>
            {parts.map((part, index) => {
                const math = parseMathSegment(part)
                if (!math) {
                    return <span key={`${part}-${index}`}>{part}</span>
                }

                return math.display ? (
                    <BlockMath key={`${part}-${index}`} math={math.value} renderError={() => <span>{part}</span>} />
                ) : (
                    <InlineMath key={`${part}-${index}`} math={math.value} renderError={() => <span>{part}</span>} />
                )
            })}
        </>
    )
}
