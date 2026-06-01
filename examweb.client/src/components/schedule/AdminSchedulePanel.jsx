import { useCallback, useEffect, useMemo, useState } from 'react'
import { scheduleApi } from '../../services/api'
import {
    AttendanceStatusChip,
    ScheduleTimingChip,
} from './ScheduleShared'
import {
    createDefaultScheduleForm,
    formatScheduleDate,
    formatScheduleDateTime,
    formatScheduleTimeRange,
    getAttendanceReason,
    sortSchedules,
    toApiDateTime,
    toDateTimeLocalValue,
    getScheduleTiming,
} from './ScheduleHelpers'

const ATTENDANCE_FILTERS = [
    { label: 'Vắng/muộn', value: '' },
    { label: 'Xin vắng', value: 'Absent' },
    { label: 'Đi muộn', value: 'Late' },
]

export function AdminSchedulePanel() {
    const [schedules, setSchedules] = useState([])
    const [attendanceRequests, setAttendanceRequests] = useState([])
    const [form, setForm] = useState(() => createDefaultScheduleForm())
    const [editingScheduleId, setEditingScheduleId] = useState('')
    const [selectedScheduleId, setSelectedScheduleId] = useState('')
    const [attendanceFilter, setAttendanceFilter] = useState('')
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [notice, setNotice] = useState('')

    const sortedSchedules = useMemo(() => sortSchedules(schedules), [schedules])
    const selectedSchedule = sortedSchedules.find((schedule) => schedule.id === selectedScheduleId) || sortedSchedules[0]

    const scheduleStats = useMemo(() => {
        return {
            total: schedules.length,
            upcoming: schedules.filter((schedule) => getScheduleTiming(schedule) !== 'past').length,
            absent: attendanceRequests.filter((item) => item.status === 'Absent').length,
            late: attendanceRequests.filter((item) => item.status === 'Late').length,
        }
    }, [attendanceRequests, schedules])

    const loadSchedules = useCallback(async (preferredScheduleId = '') => {
        setLoading(true)
        setError('')
        try {
            const data = await scheduleApi()
            setSchedules(data)
            const nextSelectedId = preferredScheduleId || selectedScheduleId
            if (nextSelectedId && data.some((schedule) => schedule.id === nextSelectedId)) {
                setSelectedScheduleId(nextSelectedId)
            } else if (data.length > 0) {
                setSelectedScheduleId(data[0].id)
            } else {
                setSelectedScheduleId('')
            }
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }, [selectedScheduleId])

    const loadAttendanceRequests = useCallback(async () => {
        const query = attendanceFilter ? `?status=${encodeURIComponent(attendanceFilter)}` : ''
        try {
            const data = await scheduleApi(`/attendance-requests${query}`)
            setAttendanceRequests(data)
        } catch (err) {
            setError(err.message)
        }
    }, [attendanceFilter])

    useEffect(() => {
        const timer = window.setTimeout(() => {
            loadSchedules()
        }, 0)

        return () => window.clearTimeout(timer)
    }, [loadSchedules])

    useEffect(() => {
        const timer = window.setTimeout(() => {
            loadAttendanceRequests()
        }, 0)

        return () => window.clearTimeout(timer)
    }, [loadAttendanceRequests])

    function updateForm(field, value) {
        setForm((current) => ({ ...current, [field]: value }))
    }

    function resetForm() {
        setEditingScheduleId('')
        setForm(createDefaultScheduleForm())
    }

    function startEdit(schedule) {
        setEditingScheduleId(schedule.id)
        setSelectedScheduleId(schedule.id)
        setNotice('')
        setForm({
            title: schedule.title || '',
            description: schedule.description || '',
            startTime: toDateTimeLocalValue(schedule.startTime),
            endTime: toDateTimeLocalValue(schedule.endTime),
        })
    }

    async function handleSubmit(event) {
        event.preventDefault()
        setSaving(true)
        setError('')
        setNotice('')

        const payload = {
            title: form.title.trim(),
            description: form.description.trim() || null,
            startTime: toApiDateTime(form.startTime),
            endTime: toApiDateTime(form.endTime),
        }

        try {
            const schedule = editingScheduleId
                ? await scheduleApi(`/${editingScheduleId}`, {
                    method: 'PUT',
                    body: JSON.stringify(payload),
                })
                : await scheduleApi('', {
                    method: 'POST',
                    body: JSON.stringify(payload),
                })

            setSelectedScheduleId(schedule.id)
            setNotice(editingScheduleId ? 'Đã cập nhật lịch học' : 'Đã tạo lịch học mới')
            resetForm()
            await loadSchedules(schedule.id)
            await loadAttendanceRequests()
        } catch (err) {
            setError(err.message)
        } finally {
            setSaving(false)
        }
    }

    async function handleDelete(schedule) {
        if (!window.confirm(`Xóa lịch "${schedule.title}"?`)) return

        setSaving(true)
        setError('')
        setNotice('')
        try {
            await scheduleApi(`/${schedule.id}`, { method: 'DELETE' })
            if (selectedScheduleId === schedule.id) {
                setSelectedScheduleId('')
            }
            if (editingScheduleId === schedule.id) {
                resetForm()
            }
            setNotice('Đã xóa lịch học')
            await loadSchedules()
            await loadAttendanceRequests()
        } catch (err) {
            setError(err.message)
        } finally {
            setSaving(false)
        }
    }

    return (
        <section className="schedule-admin">
            <div className="schedule-hero admin-panel">
                <div>
                    <p className="eyebrow">Thời khóa biểu</p>
                    <h2>Quản lý lịch học và báo vắng/muộn</h2>
                    <p>Tạo buổi học, cập nhật thời gian và theo dõi các lý do học sinh gửi trước buổi học.</p>
                </div>
                <div className="schedule-stat-strip">
                    <ScheduleStat label="Tổng lịch" value={scheduleStats.total} />
                    <ScheduleStat label="Sắp tới" value={scheduleStats.upcoming} />
                    <ScheduleStat label="Xin vắng" value={scheduleStats.absent} />
                    <ScheduleStat label="Đi muộn" value={scheduleStats.late} />
                </div>
            </div>

            {error && <div className="alert admin-alert schedule-alert">{error}</div>}
            {notice && <div className="online-notice schedule-notice">{notice}</div>}

            <div className="schedule-admin-layout">
                <form className="admin-panel schedule-form-panel" onSubmit={handleSubmit}>
                    <div className="panel-title">
                        <h2>{editingScheduleId ? 'Cập nhật lịch học' : 'Tạo lịch học'}</h2>
                        {editingScheduleId && (
                            <button className="ghost-button" onClick={resetForm} type="button">
                                Hủy sửa
                            </button>
                        )}
                    </div>

                    <div className="form-row">
                        <label htmlFor="schedule-title">Tiêu đề</label>
                        <input
                            id="schedule-title"
                            onChange={(event) => updateForm('title', event.target.value)}
                            placeholder="Ví dụ: Lớp Toán chuyên đề hàm số"
                            required
                            value={form.title}
                        />
                    </div>

                    <div className="form-row">
                        <label htmlFor="schedule-description">Mô tả</label>
                        <textarea
                            id="schedule-description"
                            onChange={(event) => updateForm('description', event.target.value)}
                            placeholder="Nội dung buổi học, tài liệu cần chuẩn bị..."
                            rows="4"
                            value={form.description}
                        />
                    </div>

                    <div className="schedule-form-grid">
                        <div className="form-row">
                            <label htmlFor="schedule-start">Bắt đầu</label>
                            <input
                                id="schedule-start"
                                onChange={(event) => updateForm('startTime', event.target.value)}
                                required
                                type="datetime-local"
                                value={form.startTime}
                            />
                        </div>
                        <div className="form-row">
                            <label htmlFor="schedule-end">Kết thúc</label>
                            <input
                                id="schedule-end"
                                onChange={(event) => updateForm('endTime', event.target.value)}
                                required
                                type="datetime-local"
                                value={form.endTime}
                            />
                        </div>
                    </div>

                    <button className="primary-button full-width" disabled={saving} type="submit">
                        {editingScheduleId ? 'Lưu lịch học' : 'Tạo lịch học'}
                    </button>
                </form>

                <section className="admin-panel schedule-list-panel">
                    <div className="panel-title">
                        <h2>Danh sách lịch học</h2>
                        <span className="badge-count">{schedules.length}</span>
                    </div>

                    <div className="schedule-list">
                        {loading && schedules.length === 0 ? (
                            <div className="empty-list">Đang tải thời khóa biểu...</div>
                        ) : sortedSchedules.length === 0 ? (
                            <div className="empty-list">Chưa có lịch học</div>
                        ) : (
                            sortedSchedules.map((schedule) => (
                                <article
                                    className={`schedule-card ${selectedSchedule?.id === schedule.id ? 'selected' : ''}`}
                                    key={schedule.id}
                                >
                                    <button
                                        className="schedule-card-main"
                                        onClick={() => setSelectedScheduleId(schedule.id)}
                                        type="button"
                                    >
                                        <div>
                                            <strong>{schedule.title}</strong>
                                            <span>{formatScheduleDate(schedule.startTime)}</span>
                                            <small>{formatScheduleTimeRange(schedule)}</small>
                                        </div>
                                        <ScheduleTimingChip schedule={schedule} />
                                    </button>
                                    <div className="schedule-card-footer">
                                        <span>{schedule.attendanceSummary?.absentCount || 0} vắng</span>
                                        <span>{schedule.attendanceSummary?.lateCount || 0} muộn</span>
                                        <div className="row-actions">
                                            <button className="ghost-button" onClick={() => startEdit(schedule)} type="button">
                                                Sửa
                                            </button>
                                            <button className="delete-button outline" onClick={() => handleDelete(schedule)} type="button">
                                                Xóa
                                            </button>
                                        </div>
                                    </div>
                                </article>
                            ))
                        )}
                    </div>
                </section>
            </div>

            <div className="schedule-admin-layout lower">
                <section className="admin-panel schedule-detail-panel">
                    <div className="panel-title">
                        <h2>Chi tiết lịch</h2>
                        {selectedSchedule && <ScheduleTimingChip schedule={selectedSchedule} />}
                    </div>
                    {selectedSchedule ? (
                        <div className="schedule-detail">
                            <h3>{selectedSchedule.title}</h3>
                            <p>{selectedSchedule.description || 'Chưa có mô tả cho buổi học này.'}</p>
                            <div className="schedule-detail-grid">
                                <InfoTile label="Ngày học" value={formatScheduleDate(selectedSchedule.startTime)} />
                                <InfoTile label="Thời gian" value={formatScheduleTimeRange(selectedSchedule)} />
                                <InfoTile label="Xin vắng" value={selectedSchedule.attendanceSummary?.absentCount || 0} />
                                <InfoTile label="Đi muộn" value={selectedSchedule.attendanceSummary?.lateCount || 0} />
                            </div>
                        </div>
                    ) : (
                        <div className="empty-list">Chọn một lịch học để xem chi tiết</div>
                    )}
                </section>

                <section className="admin-panel attendance-requests-panel">
                    <div className="panel-title">
                        <h2>Danh sách xin vắng/muộn</h2>
                        <span className="badge-count">{attendanceRequests.length}</span>
                    </div>

                    <div className="schedule-filter-row">
                        {ATTENDANCE_FILTERS.map((filter) => (
                            <button
                                className={attendanceFilter === filter.value ? 'active' : ''}
                                key={filter.label}
                                onClick={() => setAttendanceFilter(filter.value)}
                                type="button"
                            >
                                {filter.label}
                            </button>
                        ))}
                    </div>

                    <div className="attendance-request-list">
                        {attendanceRequests.length === 0 ? (
                            <div className="empty-list">Chưa có học sinh báo vắng hoặc đi muộn</div>
                        ) : (
                            attendanceRequests.map((attendance) => (
                                <article className="attendance-request-row" key={attendance.id}>
                                    <div>
                                        <strong>{attendance.studentName || `Học sinh #${attendance.accountId}`}</strong>
                                        <span>{attendance.scheduleTitle}</span>
                                        <small>
                                            {formatScheduleDateTime(attendance.startTime)} · Cập nhật {formatScheduleDateTime(attendance.updatedAt)}
                                        </small>
                                    </div>
                                    <AttendanceStatusChip status={attendance.status} />
                                    <p>{getAttendanceReason(attendance)}</p>
                                </article>
                            ))
                        )}
                    </div>
                </section>
            </div>
        </section>
    )
}

function ScheduleStat({ label, value }) {
    return (
        <div className="schedule-stat">
            <span>{label}</span>
            <strong>{value}</strong>
        </div>
    )
}

function InfoTile({ label, value }) {
    return (
        <div className="schedule-info-tile">
            <span>{label}</span>
            <strong>{value}</strong>
        </div>
    )
}
