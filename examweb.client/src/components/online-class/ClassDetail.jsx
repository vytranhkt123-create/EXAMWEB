import { useEffect, useMemo, useState } from 'react'
import { classVideosApi } from '../../services/api'
import { getYouTubeEmbedUrl } from '../../utils/youtube'
import './ClassDetail.css'

const classTabs = [
    { id: 'members', label: 'Members' },
    { id: 'exams', label: 'Exams' },
    { id: 'videos', label: 'Video Lectures' },
]

const emptyVideoDraft = {
    title: '',
    description: '',
    youtubeUrl: '',
}

function VideoPlayer({ title, youtubeUrl }) {
    const embedUrl = useMemo(() => getYouTubeEmbedUrl(youtubeUrl), [youtubeUrl])

    if (!embedUrl) {
        return (
            <a className="class-video-link" href={youtubeUrl} rel="noreferrer" target="_blank">
                Open YouTube video
            </a>
        )
    }

    return (
        <div className="class-video-frame">
            <iframe
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                loading="lazy"
                referrerPolicy="strict-origin-when-cross-origin"
                src={embedUrl}
                title={title}
            />
        </div>
    )
}

export function ClassDetail({
    canManageVideos = false,
    classRoomId,
    classTitle = 'Online Class',
    exams = [],
    members = [],
}) {
    const [activeTab, setActiveTab] = useState('videos')
    const [videos, setVideos] = useState([])
    const [draft, setDraft] = useState(emptyVideoDraft)
    const [loadingVideos, setLoadingVideos] = useState(false)
    const [savingVideo, setSavingVideo] = useState(false)
    const [notice, setNotice] = useState('')
    const [error, setError] = useState('')

    useEffect(() => {
        if (!classRoomId) return undefined

        let active = true
        const timer = window.setTimeout(() => {
            setLoadingVideos(true)
            setError('')

            classVideosApi(classRoomId)
                .then((data) => {
                    if (active) setVideos(Array.isArray(data) ? data : [])
                })
                .catch((err) => {
                    if (active) setError(err.message || 'Could not load video lectures')
                })
                .finally(() => {
                    if (active) setLoadingVideos(false)
                })
        }, 0)

        return () => {
            active = false
            window.clearTimeout(timer)
        }
    }, [classRoomId])

    function updateDraft(field, value) {
        setDraft((current) => ({ ...current, [field]: value }))
    }

    async function handleCreateVideo(event) {
        event.preventDefault()
        if (!classRoomId || !draft.title.trim() || !draft.youtubeUrl.trim()) return

        setSavingVideo(true)
        setError('')
        setNotice('')

        try {
            const created = await classVideosApi(classRoomId, '', {
                method: 'POST',
                body: JSON.stringify({
                    title: draft.title.trim(),
                    description: draft.description.trim(),
                    youtubeUrl: draft.youtubeUrl.trim(),
                }),
            })
            setVideos((current) => [created, ...current])
            setDraft(emptyVideoDraft)
            setNotice('Video lecture added')
        } catch (err) {
            setError(err.message || 'Could not add video lecture')
        } finally {
            setSavingVideo(false)
        }
    }

    return (
        <section className="class-detail-page">
            <header className="class-detail-head">
                <div>
                    <p className="class-detail-eyebrow">Class detail</p>
                    <h1>{classTitle}</h1>
                </div>
                <span className="class-detail-count">{videos.length} videos</span>
            </header>

            <div aria-label="Class detail tabs" className="class-detail-tabs" role="tablist">
                {classTabs.map((tab) => (
                    <button
                        aria-selected={activeTab === tab.id}
                        className={activeTab === tab.id ? 'active' : ''}
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        role="tab"
                        type="button"
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {activeTab === 'members' && (
                <div className="class-detail-panel" role="tabpanel">
                    <div className="class-detail-placeholder">
                        <strong>Members</strong>
                        <span>{members.length ? `${members.length} people assigned` : 'Student and teacher list placeholder'}</span>
                    </div>
                </div>
            )}

            {activeTab === 'exams' && (
                <div className="class-detail-panel" role="tabpanel">
                    <div className="class-detail-placeholder">
                        <strong>Exams</strong>
                        <span>{exams.length ? `${exams.length} assigned tests` : 'Assigned tests placeholder'}</span>
                    </div>
                </div>
            )}

            {activeTab === 'videos' && (
                <div className="class-detail-panel" role="tabpanel">
                    {canManageVideos && (
                        <form className="class-video-form" onSubmit={handleCreateVideo}>
                            <label htmlFor="class-video-title">
                                <span>Title</span>
                                <input
                                    id="class-video-title"
                                    onChange={(event) => updateDraft('title', event.target.value)}
                                    placeholder="Lesson 1: Algebra review"
                                    value={draft.title}
                                />
                            </label>
                            <label htmlFor="class-video-url">
                                <span>YouTube URL</span>
                                <input
                                    id="class-video-url"
                                    onChange={(event) => updateDraft('youtubeUrl', event.target.value)}
                                    placeholder="https://www.youtube.com/watch?v=XYZ"
                                    value={draft.youtubeUrl}
                                />
                            </label>
                            <label className="class-video-description" htmlFor="class-video-description">
                                <span>Description</span>
                                <textarea
                                    id="class-video-description"
                                    onChange={(event) => updateDraft('description', event.target.value)}
                                    placeholder="Optional notes for this lecture"
                                    rows={3}
                                    value={draft.description}
                                />
                            </label>
                            <button
                                className="class-video-submit"
                                disabled={savingVideo || !draft.title.trim() || !draft.youtubeUrl.trim()}
                                type="submit"
                            >
                                {savingVideo ? 'Saving...' : 'Add video'}
                            </button>
                        </form>
                    )}

                    {(notice || error) && (
                        <p className={error ? 'class-detail-alert danger' : 'class-detail-alert'} role="status">
                            {error || notice}
                        </p>
                    )}

                    {loadingVideos ? (
                        <div className="class-detail-placeholder">Loading video lectures...</div>
                    ) : videos.length === 0 ? (
                        <div className="class-detail-placeholder">No video lectures yet</div>
                    ) : (
                        <div className="class-video-list">
                            {videos.map((video) => (
                                <article className="class-video-card" key={video.id}>
                                    <VideoPlayer title={video.title} youtubeUrl={video.youtubeUrl} />
                                    <div className="class-video-copy">
                                        <h2>{video.title}</h2>
                                        {video.description && <p>{video.description}</p>}
                                    </div>
                                </article>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </section>
    )
}
