import { useCallback, useEffect, useMemo, useState } from 'react'
import { classesApi } from '../../services/api'
import { ClassDetail } from './ClassDetail'
import { CreateClassForm } from './CreateClassForm'
import './ClassDetail.css'

export function CourseWorkspace({ canManage = false, students = [] }) {
    const [courses, setCourses] = useState([])
    const [selectedCourseId, setSelectedCourseId] = useState('')
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

    if (selectedCourse) {
        return (
            <ClassDetail
                canManageVideos={canManage}
                classRoomId={selectedCourse.id}
                classTitle={selectedCourse.name}
                members={selectedCourse.memberAccountIds || []}
                onBack={() => setSelectedCourseId('')}
            />
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
