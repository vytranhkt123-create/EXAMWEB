import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, classesApi, materialsApi } from '../../services/api'
import { ClassDetail } from './ClassDetail'
import { CreateClassForm } from './CreateClassForm'
import './ClassDetail.css'

export function CourseWorkspace({
    canManage = false,
    onCreateCourseTest,
    onOpenCourseTest,
    onTakeCourseTest,
    students = [],
}) {
    const [courses, setCourses] = useState([])
    const [selectedCourseId, setSelectedCourseId] = useState('')
    const [courseTests, setCourseTests] = useState([])
    const [materials, setMaterials] = useState([])
    const [pendingDeleteCourse, setPendingDeleteCourse] = useState(null)
    const [deletingCourse, setDeletingCourse] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const selectedCourse = useMemo(
        () => courses.find((course) => course.id === selectedCourseId) || null,
        [courses, selectedCourseId],
    )

    const loadCourses = useCallback(async (selectCourseId = '') => {
        setLoading(true)
        setError('')

        try {
            const data = await classesApi()
            const nextCourses = Array.isArray(data) ? data : []
            setCourses(nextCourses)
            if (selectCourseId) {
                setSelectedCourseId(selectCourseId)
            }
        } catch (err) {
            setError(err.message || 'Could not load courses')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        const timer = window.setTimeout(() => {
            loadCourses()
        }, 0)

        return () => window.clearTimeout(timer)
    }, [loadCourses])

    useEffect(() => {
        if (!selectedCourse?.id) {
            return undefined
        }

        let active = true
        const timer = window.setTimeout(() => {
            Promise.all([
                api(`?classRoomId=${encodeURIComponent(selectedCourse.id)}`),
                materialsApi(),
            ])
                .then(([tests, nextMaterials]) => {
                    if (!active) return
                    setCourseTests(Array.isArray(tests) ? tests : [])
                    setMaterials(Array.isArray(nextMaterials) ? nextMaterials : [])
                })
                .catch((err) => {
                    if (active) setError(err.message || 'Could not load course details')
                })
        }, 0)

        return () => {
            active = false
            window.clearTimeout(timer)
        }
    }, [selectedCourse?.id])

    function handleRequestCreateTest() {
        if (selectedCourse?.id) {
            onCreateCourseTest?.(selectedCourse.id)
        }
    }

    async function handleDeleteCourse() {
        if (!pendingDeleteCourse?.id) return

        setDeletingCourse(true)
        setError('')

        try {
            await classesApi(`/${encodeURIComponent(pendingDeleteCourse.id)}`, { method: 'DELETE' })
            setCourses((current) => current.filter((course) => course.id !== pendingDeleteCourse.id))
            if (selectedCourseId === pendingDeleteCourse.id) {
                setSelectedCourseId('')
            }
            setPendingDeleteCourse(null)
        } catch (err) {
            setError(err.message || 'Could not delete course')
        } finally {
            setDeletingCourse(false)
        }
    }

    if (selectedCourse) {
        return (
            <>
                <ClassDetail
                    canManageTests={canManage}
                    canManageVideos={canManage}
                    classRoomId={selectedCourse.id}
                    classTitle={selectedCourse.name}
                    exams={courseTests}
                    materials={materials}
                    members={selectedCourse.members || []}
                    onBack={() => setSelectedCourseId('')}
                    onOpenTest={canManage ? onOpenCourseTest : undefined}
                    onRequestDeleteClass={canManage ? () => setPendingDeleteCourse(selectedCourse) : undefined}
                    onRequestCreateTest={handleRequestCreateTest}
                    onTakeTest={!canManage ? onTakeCourseTest : undefined}
                />
                {pendingDeleteCourse && (
                    <div className="modal-overlay" role="presentation">
                        <div aria-modal="true" className="modal-card" role="dialog">
                            <span className="modal-badge danger">Delete class</span>
                            <h2>Delete {pendingDeleteCourse.name}?</h2>
                            <p className="modal-copy">
                                This will remove the class, members, and course videos. This action cannot be undone.
                            </p>
                            <div className="modal-actions">
                                <button className="ghost-button" disabled={deletingCourse} onClick={() => setPendingDeleteCourse(null)} type="button">
                                    Cancel
                                </button>
                                <button className="delete-button" disabled={deletingCourse} onClick={handleDeleteCourse} type="button">
                                    {deletingCourse ? 'Deleting...' : 'Delete Class'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </>
        )
    }

    return (
        <section className="course-workspace">
            <header className="course-workspace-head">
                <div>
                    <p className="class-detail-eyebrow">Course list</p>
                    <h1>{canManage ? 'Courses' : 'My Courses'}</h1>
                    <p>{canManage ? 'Create courses, assign students, and add YouTube lessons.' : 'Open a course to watch assigned video lectures.'}</p>
                </div>
                <button className="ghost-button" disabled={loading} onClick={() => loadCourses()} type="button">
                    Refresh
                </button>
            </header>

            {canManage && (
                <CreateClassForm
                    onCreated={(courseId) => loadCourses(courseId)}
                    students={students}
                />
            )}

            {error && <p className="class-detail-alert danger" role="alert">{error}</p>}

            <div className="course-list-panel">
                <div className="course-list-head">
                    <h2>{canManage ? 'All Courses' : 'Enrolled Courses'}</h2>
                    <span>{courses.length}</span>
                </div>

                {loading ? (
                    <div className="class-detail-placeholder">Loading courses...</div>
                ) : courses.length === 0 ? (
                    <div className="class-detail-placeholder">
                        {canManage ? 'No courses yet. Create the first one above.' : 'You are not enrolled in any courses yet.'}
                    </div>
                ) : (
                    <div className="course-list">
                        {courses.map((course) => (
                            <article className="course-list-card" key={course.id}>
                                <div>
                                    <h3>{course.name}</h3>
                                    <p>{course.description || 'No description'}</p>
                                    <span>{course.memberCount || 0} members</span>
                                </div>
                                <div className="course-list-actions">
                                    {canManage && (
                                        <button
                                            className="delete-button outline"
                                            onClick={() => setPendingDeleteCourse(course)}
                                            type="button"
                                        >
                                            Delete
                                        </button>
                                    )}
                                    <button
                                        className="primary-button"
                                        onClick={() => setSelectedCourseId(course.id)}
                                        type="button"
                                    >
                                        View Detail
                                    </button>
                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </div>
            {pendingDeleteCourse && (
                <div className="modal-overlay" role="presentation">
                    <div aria-modal="true" className="modal-card" role="dialog">
                        <span className="modal-badge danger">Delete class</span>
                        <h2>Delete {pendingDeleteCourse.name}?</h2>
                        <p className="modal-copy">
                            This will remove the class, members, and course videos. This action cannot be undone.
                        </p>
                        <div className="modal-actions">
                            <button className="ghost-button" disabled={deletingCourse} onClick={() => setPendingDeleteCourse(null)} type="button">
                                Cancel
                            </button>
                            <button className="delete-button" disabled={deletingCourse} onClick={handleDeleteCourse} type="button">
                                {deletingCourse ? 'Deleting...' : 'Delete Class'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    )
}
