function extractYouTubeVideoId(youtubeUrl) {
    const cleanUrl = youtubeUrl.trim()
    if (!cleanUrl) return ''

    try {
        const url = new URL(cleanUrl)
        const hostname = url.hostname.replace(/^www\./, '')

        if (hostname === 'youtu.be') {
            return url.pathname.split('/').filter(Boolean)[0] || ''
        }

        if (hostname === 'youtube.com' || hostname.endsWith('.youtube.com')) {
            const watchId = url.searchParams.get('v')
            if (watchId) return watchId

            const pathMatch = url.pathname.match(/^\/(?:embed|shorts|live)\/([^/?#]+)/)
            if (pathMatch) return pathMatch[1]
        }
    } catch {
        // Fall through to the regex below for pasted strings that are not strict URLs.
    }

    // Captures the id after common YouTube markers: watch?v=, embed/, shorts/, live/, or youtu.be/.
    const fallbackMatch = cleanUrl.match(
        /(?:youtube\.com\/(?:watch\?[^#]*v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/i,
    )
    return fallbackMatch?.[1] || ''
}

export function getYouTubeEmbedUrl(youtubeUrl) {
    const videoId = extractYouTubeVideoId(youtubeUrl || '')
    return videoId ? `https://www.youtube.com/embed/${encodeURIComponent(videoId)}` : ''
}
