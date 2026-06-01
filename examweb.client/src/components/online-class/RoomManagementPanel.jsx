import { useEffect, useMemo, useState } from 'react'
import { onlineClassApi, studentsApi } from '../../services/api'

const emptyRoomDraft = {
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

export function RoomManagementPanel({
    onRoomsChanged,
    rooms = [],
    selectedRoomId,
    onSelectRoom,
}) {
    const [students, setStudents] = useState([])
    const [draft, setDraft] = useState(emptyRoomDraft)
    const [assignedIds, setAssignedIds] = useState([])
    const [busy, setBusy] = useState(false)
    const [notice, setNotice] = useState('')
    const [error, setError] = useState('')

    const selectedRoom = useMemo(
        () => rooms.find((room) => room.id === selectedRoomId) || rooms[0] || null,
        [rooms, selectedRoomId],
    )

    useEffect(() => {
        let active = true
        studentsApi()
            .then((data) => {
                if (active) setStudents(Array.isArray(data) ? data : [])
            })
            .catch((err) => {
                if (active) setError(err.message || 'Could not load students')
            })

        return () => {
            active = false
        }
    }, [])

    useEffect(() => {
        const timer = window.setTimeout(() => {
            if (!selectedRoom) {
                setDraft(emptyRoomDraft)
                setAssignedIds([])
                return
            }

            setDraft({
                name: selectedRoom.name || '',
                description: selectedRoom.description || '',
            })
            setAssignedIds(selectedRoom.memberAccountIds || [])
        }, 0)

        return () => window.clearTimeout(timer)
    }, [selectedRoom])

    function updateDraft(field, value) {
        setDraft((current) => ({ ...current, [field]: value }))
    }

    function toggleStudent(studentId) {
        setAssignedIds((current) =>
            current.includes(studentId)
                ? current.filter((id) => id !== studentId)
                : [...current, studentId],
        )
    }

    async function handleCreateRoom(event) {
        event.preventDefault()
        if (!draft.name.trim()) return

        setBusy(true)
        setError('')
        setNotice('')
        try {
            const room = await onlineClassApi('/rooms', {
                method: 'POST',
                body: JSON.stringify({
                    name: draft.name.trim(),
                    description: draft.description.trim(),
                }),
            })
            setNotice('Room created')
            onSelectRoom?.(room.id)
            await onRoomsChanged?.(room.id)
        } catch (err) {
            setError(err.message || 'Could not create room')
        } finally {
            setBusy(false)
        }
    }

    async function handleSaveRoom() {
        if (!selectedRoom || !draft.name.trim()) return

        setBusy(true)
        setError('')
        setNotice('')
        try {
            await onlineClassApi(`/rooms/${encodeURIComponent(selectedRoom.id)}`, {
                method: 'PUT',
                body: JSON.stringify({
                    name: draft.name.trim(),
                    description: draft.description.trim(),
                }),
            })
            setNotice('Room details saved')
            await onRoomsChanged?.(selectedRoom.id)
        } catch (err) {
            setError(err.message || 'Could not save room')
        } finally {
            setBusy(false)
        }
    }

    async function handleToggleLive() {
        if (!selectedRoom) return

        setBusy(true)
        setError('')
        setNotice('')
        try {
            await onlineClassApi(`/rooms/${encodeURIComponent(selectedRoom.id)}/live`, {
                method: 'POST',
                body: JSON.stringify({ isLive: !selectedRoom.isLive }),
            })
            setNotice(!selectedRoom.isLive ? 'Room opened' : 'Room closed')
            await onRoomsChanged?.(selectedRoom.id)
        } catch (err) {
            setError(err.message || 'Could not change room state')
        } finally {
            setBusy(false)
        }
    }

    async function handleSaveMembers() {
        if (!selectedRoom) return

        setBusy(true)
        setError('')
        setNotice('')
        try {
            await onlineClassApi(`/rooms/${encodeURIComponent(selectedRoom.id)}/members`, {
                method: 'PUT',
                body: JSON.stringify({ accountIds: assignedIds }),
            })
            setNotice('Room students updated')
            await onRoomsChanged?.(selectedRoom.id)
        } catch (err) {
            setError(err.message || 'Could not update students')
        } finally {
            setBusy(false)
        }
    }

    async function handleDeleteRoom() {
        if (!selectedRoom || !window.confirm(`Delete ${selectedRoom.name}?`)) return

        setBusy(true)
        setError('')
        setNotice('')
        try {
            await onlineClassApi(`/rooms/${encodeURIComponent(selectedRoom.id)}`, { method: 'DELETE' })
            setNotice('Room deleted')
            await onRoomsChanged?.()
        } catch (err) {
            setError(err.message || 'Could not delete room')
        } finally {
            setBusy(false)
        }
    }

    return (
        <section className="room-management-panel" aria-label="Room management">
            <div className="room-management-head">
                <div>
                    <p className="meet-room-eyebrow">Admin rooms</p>
                    <h3>Manage rooms and students</h3>
                </div>
                <span className="badge">{rooms.length} rooms</span>
            </div>

            {(notice || error) && (
                <p className={error ? 'room-management-alert danger' : 'room-management-alert'} role="status">
                    {error || notice}
                </p>
            )}

            <form className="room-management-form" onSubmit={handleCreateRoom}>
                <label className="form-row" htmlFor="room-management-name">
                    <span>Room name</span>
                    <input
                        id="room-management-name"
                        onChange={(event) => updateDraft('name', event.target.value)}
                        placeholder="Math review - Group A"
                        value={draft.name}
                    />
                </label>
                <label className="form-row" htmlFor="room-management-description">
                    <span>Description</span>
                    <textarea
                        id="room-management-description"
                        onChange={(event) => updateDraft('description', event.target.value)}
                        placeholder="Optional room agenda"
                        rows={3}
                        value={draft.description}
                    />
                </label>
                <div className="room-management-actions">
                    <button className="primary-button" disabled={busy || !draft.name.trim()} type="submit">
                        Create room
                    </button>
                    <button className="ghost-button" disabled={busy || !selectedRoom || !draft.name.trim()} onClick={handleSaveRoom} type="button">
                        Save details
                    </button>
                    <button className="ghost-button" disabled={busy || !selectedRoom} onClick={handleToggleLive} type="button">
                        {selectedRoom?.isLive ? 'Close room' : 'Open room'}
                    </button>
                    <button className="delete-button outline" disabled={busy || !selectedRoom} onClick={handleDeleteRoom} type="button">
                        Delete
                    </button>
                </div>
            </form>

            <div className="room-management-body">
                <div className="room-management-list" aria-label="Existing rooms">
                    {rooms.length === 0 ? (
                        <p className="room-management-empty">No rooms yet</p>
                    ) : (
                        rooms.map((room) => (
                            <button
                                className={room.id === selectedRoom?.id ? 'active' : ''}
                                key={room.id}
                                onClick={() => onSelectRoom?.(room.id)}
                                type="button"
                            >
                                <strong>{room.name}</strong>
                                <span>{room.isLive ? 'Live' : 'Closed'} - {room.memberAccountIds?.length || 0} students</span>
                            </button>
                        ))
                    )}
                </div>

                <div className="room-assignment-panel">
                    <div className="room-assignment-head">
                        <strong>Assign students</strong>
                        <span>{assignedIds.length} selected</span>
                    </div>
                    <div className="room-student-list">
                        {students.length === 0 ? (
                            <p className="room-management-empty">No students available</p>
                        ) : (
                            students.map((student) => (
                                <label className="room-student-option" key={student.id}>
                                    <input
                                        checked={assignedIds.includes(student.id)}
                                        onChange={() => toggleStudent(student.id)}
                                        type="checkbox"
                                    />
                                    <span>{formatStudent(student)}</span>
                                </label>
                            ))
                        )}
                    </div>
                    <button className="primary-button full-width" disabled={busy || !selectedRoom} onClick={handleSaveMembers} type="button">
                        Save assigned students
                    </button>
                </div>
            </div>
        </section>
    )
}
