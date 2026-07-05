import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, classesApi, materialsApi } from '../../services/api'
import { ClassDetail } from './ClassDetail'
import { CreateClassForm } from './CreateClassForm'
import './ClassDetail.css'

const emptyTestDraft = {
    testName: '',
    durationMinutes: 30,
    allowPracticeMode: true,
}

export function CourseWorkspace({ canManage = false, students = [] }) {
    const [courses, setCourses] = useState([])
    const [selectedCourseId, setSelectedCourseId] = useState('')
    const [courseTests, setCourseTests] = useState([])
    const [materials, setMaterials] = useState([])
    const [showCreateTest, setShowCreateTest] = useState(false)
    const [testDraft, setTestDraft] = useState(emptyTestDraft)
    const [testSaving, setTestSaving] = useState(false)
    const [testError, setTestError] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const selectedCourse = useMemo(
        () => courses.find((course) => course.id === selectedCourseId) || null,
        [courses, selectedCourseId],
    )
    const selectedCourseStudentIds = useMemo(() => {
        if (!selectedCourse) return []
        if (Array.isArray(selectedCourse.memberAccountIds) && selectedCourse.memberAccountIds.length > 0) {
            return selectedCourse.memberAccountIds
        }

        return (selectedCourse.members || [])
            .filter((member) => member.role === 'User')
            .map((member) => member.accountId)
    }, [selectedCourse])

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

    function updateTestDraft(field, value) {
        setTestDraft((current) => ({ ...current, [field]: value }))
    }

    async function handleCreateTest(event) {
        event.preventDefault()
        if (!selectedCourse?.id || !testDraft.testName.trim()) return

        setTestSaving(true)
        setTestError('')

        try {
            const createdTest = await api('', {
                method: 'POST',
                body: JSON.stringify({
                    testName: testDraft.testName.trim(),
                    classRoomId: selectedCourse.id,
                    durationMinutes: Number(testDraft.durationMinutes) || 30,
                    allowPracticeMode: Boolean(testDraft.allowPracticeMode),
                    assignedStudentIds: selectedCourseStudentIds,
                }),
            })
            setCourseTests((current) => [createdTest, ...current])
            setTestDraft(emptyTestDraft)
            setShowCreateTest(false)
        } catch (err) {
            setTestError(err.message || 'Could not create test')
        } finally {
            setTestSaving(false)
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
                    onRequestCreateTest={() => setShowCreateTest(true)}
                />
                {showCreateTest && (
                    <div className="modal-overlay" role="presentation">
                        <div aria-labelledby="create-course-test-title" aria-modal="true" className="modal-card course-test-modal" role="dialog">
                            <h2 id="create-course-test-title">Create New Test</h2>
                            <form className="course-test-form" onSubmit={handleCreateTest}>
                                <label htmlFor="course-test-name">
                                    <span>Test name</span>
                                    <input
                                        autoFocus
                                        id="course-test-name"
                                        onChange={(event) => updateTestDraft('testName', event.target.value)}
                                        placeholder="Mid-course quiz"
                                        value={testDraft.testName}
                                    />
                                </label>
                                <label htmlFor="course-test-duration">
                                    <span>Duration minutes</span>
                                    <input
                                        id="course-test-duration"
                                        max="240"
                                        min="1"
                                        onChange={(event) => updateTestDraft('durationMinutes', event.target.value)}
                                        type="number"
                                        value={testDraft.durationMinutes}
                                    />
                                </label>
                                <label className="course-test-checkbox">
                                    <input
                                        checked={testDraft.allowPracticeMode}
                                        onChange={(event) => updateTestDraft('allowPracticeMode', event.target.checked)}
                                        type="checkbox"
                                    />
                                    <span>Allow practice mode</span>
                                </label>
                                {testError && <p className="class-detail-alert danger" role="alert">{testError}</p>}
                                <div className="modal-actions">
                                    <button className="ghost-button" disabled={testSaving} onClick={() => setShowCreateTest(false)} type="button">
                                        Cancel
                                    </button>
                                    <button className="primary-button" disabled={testSaving || !testDraft.testName.trim()} type="submit">
                                        {testSaving ? 'Creating...' : 'Create Test'}
                                    </button>
                                </div>
                            </form>
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
                                <button
                                    className="primary-button"
                                    onClick={() => setSelectedCourseId(course.id)}
                                    type="button"
                                >
                                    View Detail
                                </button>
                            </article>
                        ))}
                    </div>
                )}
            </div>
        </section>
    )
}
