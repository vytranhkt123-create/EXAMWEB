import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LanguageSwitcher } from '../LanguageSwitcher'
import { classVideosApi, materialFileApi } from '../../services/api'
import { getYouTubeEmbedUrl } from '../../utils/youtube'
import './ClassDetail.css'

const classTabs = [
    { id: 'members', labelKey: 'course_detail.tabs.members' },
    { id: 'exams', labelKey: 'course_detail.tabs.exams' },
    { id: 'materials', labelKey: 'course_detail.tabs.materials' },
    { id: 'videos', labelKey: 'course_detail.tabs.videos' },
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

function PdfMaterialPreview({ material }) {
    const [pdfUrl, setPdfUrl] = useState('')
    const [previewError, setPreviewError] = useState('')

    useEffect(() => {
        if (!material?.id) return undefined

        let active = true
        let objectUrl = ''

        materialFileApi(material.id)
            .then((blob) => {
                objectUrl = URL.createObjectURL(blob)
                if (active) {
                    setPdfUrl(objectUrl)
                    setPreviewError('')
                }
            })
            .catch((err) => {
                if (active) {
                    setPdfUrl('')
                    setPreviewError(err.message || 'Could not open this PDF')
                }
            })

        return () => {
            active = false
            if (objectUrl) URL.revokeObjectURL(objectUrl)
        }
    }, [material])

    if (!material) {
        return <div className="class-pdf-viewer-empty">Select a PDF to preview</div>
    }

    if (previewError) {
        return <div className="class-pdf-viewer-empty">{previewError}</div>
    }

    return pdfUrl ? (
        <iframe className="class-pdf-viewer-frame" src={pdfUrl} title={material.title} />
    ) : (
        <div className="class-pdf-viewer-empty">Loading PDF...</div>
    )
}

export function ClassDetail({
    canManageVideos = false,
    canManageTests = false,
    classRoomId,
    classTitle = 'Online Class',
    exams = [],
    materials = [],
    members = [],
    onBack,
    onOpenTest,
    onRequestCreateTest,
    onTakeTest,
}) {
    const { t } = useTranslation()
    const [activeTab, setActiveTab] = useState('videos')
    const [videos, setVideos] = useState([])
    const [selectedVideoId, setSelectedVideoId] = useState('')
    const [draft, setDraft] = useState(emptyVideoDraft)
    const [loadingVideos, setLoadingVideos] = useState(false)
    const [savingVideo, setSavingVideo] = useState(false)
    const [accessDenied, setAccessDenied] = useState(false)
    const [notice, setNotice] = useState('')
    const [error, setError] = useState('')

    const selectedVideo = useMemo(
        () => videos.find((video) => video.id === selectedVideoId) || videos[0] || null,
        [selectedVideoId, videos],
    )
    const [selectedMaterialId, setSelectedMaterialId] = useState('')
    const selectedMaterial = useMemo(
        () => materials.find((material) => material.id === selectedMaterialId) || materials[0] || null,
        [materials, selectedMaterialId],
    )

    useEffect(() => {
        if (!classRoomId) return undefined

        let active = true
        const timer = window.setTimeout(() => {
            setLoadingVideos(true)
            setAccessDenied(false)
            setError('')

            classVideosApi(classRoomId)
                .then((data) => {
                    if (!active) return

                    const nextVideos = Array.isArray(data) ? data : []
                    setVideos(nextVideos)
                    setSelectedVideoId((current) =>
                        nextVideos.some((video) => video.id === current)
                            ? current
                            : nextVideos[0]?.id || '',
                    )
                })
                .catch((err) => {
                    if (!active) return

                    if (err.status === 403) {
                        setAccessDenied(true)
                        setError('Access Denied / You are not enrolled in this course')
                        return
                    }

                    setError(err.message || 'Could not load video lectures')
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
            setSelectedVideoId(created.id)
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
                <div className="class-detail-actions">
                    {onBack && (
                        <button className="ghost-button" onClick={onBack} type="button">
                            {t('course_detail.course_list')}
                        </button>
                    )}
                    <LanguageSwitcher />
                    <span className="class-detail-count">{t('course_detail.video_count', { count: videos.length })}</span>
                </div>
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
                        {t(tab.labelKey)}
                    </button>
                ))}
            </div>

            {activeTab === 'members' && (
                <div className="class-detail-panel" role="tabpanel">
                    {members.length === 0 ? (
                        <div className="class-detail-placeholder">
                            <strong>Members</strong>
                            <span>No enrolled members yet.</span>
                        </div>
                    ) : (
                        <div className="class-member-list">
                            {members.map((member) => (
                                <div className="class-member-row" key={member.accountId || member}>
                                    <div className="class-member-avatar" aria-hidden="true">
                                        {member.avatarText || String(member.displayName || member).slice(0, 2).toUpperCase()}
                                    </div>
                                    <div>
                                        <strong>{member.displayName || `Account #${member}`}</strong>
                                        <span>{member.username || 'Enrolled account'}</span>
                                    </div>
                                    <span className="class-member-role">
                                        {member.role === 'Admin' ? 'Teacher' : 'Student'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'exams' && (
                <div className="class-detail-panel" role="tabpanel">
                    <div className="class-exam-head">
                        <div>
                            <strong>Course Exams</strong>
                            <span>{exams.length} tests</span>
                        </div>
                        {canManageTests && (
                            <button className="primary-button" onClick={onRequestCreateTest} type="button">
                                {t('create_test')}
                            </button>
                        )}
                    </div>

                    {exams.length === 0 ? (
                        <div className="class-detail-placeholder">No tests created for this course yet.</div>
                    ) : (
                        <div className="class-exam-list">
                            {exams.map((exam) => (
                                <article className="class-exam-card" key={exam.id}>
                                    <div>
                                        <h2>{exam.testName}</h2>
                                        <span>{exam.durationMinutes} minutes</span>
                                    </div>
                                    <div className="class-exam-actions">
                                        <strong>{exam.questionCount || 0} questions</strong>
                                        {canManageTests ? (
                                            <button className="ghost-button" onClick={() => onOpenTest?.(exam.id)} type="button">
                                                Open Editor
                                            </button>
                                        ) : (
                                            <button className="primary-button" onClick={() => onTakeTest?.(exam.id)} type="button">
                                                Start Test
                                            </button>
                                        )}
                                    </div>
                                </article>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'materials' && (
                <div className="class-detail-panel" role="tabpanel">
                    {materials.length === 0 ? (
                        <div className="class-detail-placeholder">No PDF materials available.</div>
                    ) : (
                        <div className="class-pdf-layout">
                            <aside className="class-pdf-sidebar" aria-label="PDF materials">
                                <div className="class-pdf-sidebar-head">
                                    <strong>PDF files</strong>
                                    <span>{materials.length}</span>
                                </div>
                                <div className="class-pdf-list">
                                    {materials.map((material) => (
                                        <button
                                            className={`class-pdf-list-item ${selectedMaterial?.id === material.id ? 'active' : ''}`}
                                            key={material.id}
                                            onClick={() => setSelectedMaterialId(material.id)}
                                            type="button"
                                        >
                                            <strong>{material.title}</strong>
                                            <span>{material.fileName}</span>
                                        </button>
                                    ))}
                                </div>
                            </aside>
                            <div className="class-pdf-viewer">
                                <PdfMaterialPreview material={selectedMaterial} />
                            </div>
                        </div>
                    )}
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

                    {accessDenied ? (
                        <div className="class-detail-placeholder access-denied">
                            <strong>Access Denied</strong>
                            <span>You are not enrolled in this course.</span>
                        </div>
                    ) : loadingVideos ? (
                        <div className="class-detail-placeholder">Loading video lectures...</div>
                    ) : videos.length === 0 ? (
                        <div className="class-detail-placeholder">No video lectures yet</div>
                    ) : (
                        <div className="class-video-learning-layout">
                            <div className="class-video-player-panel">
                                {selectedVideo && (
                                    <>
                                        <VideoPlayer title={selectedVideo.title} youtubeUrl={selectedVideo.youtubeUrl} />
                                        <div className="class-video-copy">
                                            <h2>{selectedVideo.title}</h2>
                                            {selectedVideo.description && <p>{selectedVideo.description}</p>}
                                        </div>
                                    </>
                                )}
                            </div>
                            <div className="class-video-list" aria-label="Video lectures">
                                {videos.map((video, index) => (
                                    <button
                                        className={`class-video-list-item ${selectedVideo?.id === video.id ? 'active' : ''}`}
                                        key={video.id}
                                        onClick={() => setSelectedVideoId(video.id)}
                                        type="button"
                                    >
                                        <span>Lesson {index + 1}</span>
                                        <strong>{video.title}</strong>
                                        {video.description && <small>{video.description}</small>}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </section>
    )
}
