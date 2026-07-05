import { useMemo, useState } from 'react'
import { classesApi } from '../../services/api'

const emptyCourseDraft = {
    name: '',
    description: '',
}

function formatStudent(student) {
    return [
        student.displayName || student.username,
        student.grade ? `Grade ${student.grade}` : '',
        student.className ? `Class ${student.className}` : '',
    ].filter(Boolean).join(' - ')
}

export function CreateClassForm({ onCreated, students = [] }) {
    const [draft, setDraft] = useState(emptyCourseDraft)
    const [selectedStudentIds, setSelectedStudentIds] = useState([])
    const [saving, setSaving] = useState(false)
    const [notice, setNotice] = useState('')
    const [error, setError] = useState('')

    const selectedCount = selectedStudentIds.length
    const canSubmit = useMemo(() => draft.name.trim().length > 0 && !saving, [draft.name, saving])

    function updateDraft(field, value) {
        setDraft((current) => ({ ...current, [field]: value }))
    }

    function toggleStudent(studentId) {
        setSelectedStudentIds((current) =>
            current.includes(studentId)
                ? current.filter((id) => id !== studentId)
                : [...current, studentId],
        )
    }

    async function handleSubmit(event) {
        event.preventDefault()
        if (!canSubmit) return

        setSaving(true)
        setNotice('')
        setError('')

        try {
            const createdClass = await classesApi('', {
                method: 'POST',
                body: JSON.stringify({
                    name: draft.name.trim(),
                    description: draft.description.trim(),
                }),
            })

            if (selectedStudentIds.length > 0) {
                await classesApi(`/${encodeURIComponent(createdClass.id)}/members`, {
                    method: 'POST',
                    body: JSON.stringify({ accountIds: selectedStudentIds }),
                })
            }

            setDraft(emptyCourseDraft)
            setSelectedStudentIds([])
            setNotice('Course created')
            await onCreated?.(createdClass.id)
        } catch (err) {
            setError(err.message || 'Could not create course')
        } finally {
            setSaving(false)
        }
    }

    return (
        <form className="create-class-form" onSubmit={handleSubmit}>
            <div className="create-class-head">
                <div>
                    <p className="class-detail-eyebrow">New course</p>
                    <h2>Create Course</h2>
                </div>
                <span>{selectedCount} selected</span>
            </div>

            <label htmlFor="course-name">
                <span>Course Name</span>
                <input
                    id="course-name"
                    onChange={(event) => updateDraft('name', event.target.value)}
                    placeholder="Math review - Group A"
                    value={draft.name}
                />
            </label>

            <label htmlFor="course-description">
                <span>Description</span>
                <textarea
                    id="course-description"
                    onChange={(event) => updateDraft('description', event.target.value)}
                    placeholder="What students will learn in this course"
                    rows={3}
                    value={draft.description}
                />
            </label>

            <div className="course-student-picker">
                <div className="course-picker-head">
                    <strong>Assign Students</strong>
                    <span>{students.length} available</span>
                </div>

                {students.length === 0 ? (
                    <p className="course-empty-copy">No student accounts available.</p>
                ) : (
                    <div className="course-checkbox-list">
                        {students.map((student) => (
                            <label className="course-checkbox-option" key={student.id}>
                                <input
                                    checked={selectedStudentIds.includes(student.id)}
                                    onChange={() => toggleStudent(student.id)}
                                    type="checkbox"
                                />
                                <span>{formatStudent(student)}</span>
                            </label>
                        ))}
                    </div>
                )}
            </div>

            {(notice || error) && (
                <p className={error ? 'class-detail-alert danger' : 'class-detail-alert'} role="status">
                    {error || notice}
                </p>
            )}

            <button className="class-video-submit" disabled={!canSubmit} type="submit">
                {saving ? 'Creating...' : 'Create Course'}
            </button>
        </form>
    )
}
