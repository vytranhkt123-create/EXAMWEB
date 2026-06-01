import { useCallback, useEffect, useMemo, useState } from 'react'
import { scheduleApi } from '../../services/api'
import {
    AttendanceStatusChip,
    ScheduleTimingChip,
} from './ScheduleShared'
import {
    formatScheduleDate,
    formatScheduleDateTime,
    formatScheduleTimeRange,
    getAttendanceReason,
    getScheduleTiming,
    sortSchedules,
} from './ScheduleHelpers'

const STUDENT_FILTERS = [
    { label: 'Sắp tới', value: 'upcoming' },
    { label: 'Đã báo', value: 'reported' },
    { label: 'Tất cả', value: 'all' },
]

export function StudentSchedulePanel({ auth }) {
    const [schedules, setSchedules] = useState([])
    const [selectedScheduleId, setSelectedScheduleId] = useState('')
    const [activeFilter, setActiveFilter] = useState('upcoming')
    const [attendanceForm, setAttendanceForm] = useState({ status: 'Absent', reason: '' })
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [notice, setNotice] = useState('')

    const sortedSchedules = useMemo(() => sortSchedules(schedules), [schedules])
    const visibleSchedules = useMemo(() => {
        if (activeFilter === 'reported') {
            return sortedSchedules.filter((schedule) => schedule.myAttendance)
        }

        if (activeFilter === 'upcoming') {
            return sortedSchedules.filter((schedule) => getScheduleTiming(schedule) !== 'past')
        }

        return sortedSchedules
    }, [activeFilter, sortedSchedules])

    const selectedSchedule = sortedSchedules.find((schedule) => schedule.id === selectedScheduleId) || visibleSchedules[0]

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

    useEffect(() => {
        const timer = window.setTimeout(() => {
            loadSchedules()
        }, 0)

        return () => window.clearTimeout(timer)
    }, [loadSchedules])

    useEffect(() => {
        if (!selectedSchedule) return
        const timer = window.setTimeout(() => {
            setAttendanceForm(createAttendanceForm(selectedSchedule))
        }, 0)

        return () => window.clearTimeout(timer)
    }, [selectedSchedule])

    function selectSchedule(schedule) {
        setSelectedScheduleId(schedule.id)
        setNotice('')
        setAttendanceForm(createAttendanceForm(schedule))
    }

    function updateAttendanceForm(field, value) {
        setAttendanceForm((current) => ({ ...current, [field]: value }))
    }

    async function handleAttendanceSubmit(event) {
        event.preventDefault()
        if (!selectedSchedule) return

        setSaving(true)
        setError('')
        setNotice('')

        try {
            await scheduleApi(`/${selectedSchedule.id}/attendance`, {
                method: selectedSchedule.myAttendance ? 'PUT' : 'POST',
                body: JSON.stringify({
                    status: attendanceForm.status,
                    reason: attendanceForm.reason.trim(),
                }),
            })
            setNotice('Đã gửi thông tin điểm danh cho buổi học')
            await loadSchedules(selectedSchedule.id)
        } catch (err) {
            setError(err.message)
        } finally {
            setSaving(false)
        }
    }

    return (
        <section className="schedule-user">
            <div className="schedule-hero admin-panel">
                <div>
                    <p className="eyebrow">Thời khóa biểu</p>
                    <h2>Lịch học của bạn</h2>
                    <p>{auth?.displayName ? `${auth.displayName}, theo dõi lịch học và báo vắng/muộn tại đây.` : 'Theo dõi lịch học và báo vắng/muộn tại đây.'}</p>
                </div>
                <div className="schedule-stat-strip compact">
                    <ScheduleUserStat label="Tổng lịch" value={schedules.length} />
                    <ScheduleUserStat label="Đã báo" value={schedules.filter((schedule) => schedule.myAttendance).length} />
                </div>
            </div>

            {error && <div className="alert schedule-alert">{error}</div>}
            {notice && <div className="online-notice schedule-notice">{notice}</div>}

            <div className="schedule-user-layout">
                <section className="admin-panel schedule-list-panel">
                    <div className="panel-title">
                        <h2>Danh sách buổi học</h2>
                        <span className="badge-count">{visibleSchedules.length}</span>
                    </div>

                    <div className="schedule-filter-row">
                        {STUDENT_FILTERS.map((filter) => (
                            <button
                                className={activeFilter === filter.value ? 'active' : ''}
                                key={filter.value}
                                onClick={() => setActiveFilter(filter.value)}
                                type="button"
                            >
                                {filter.label}
                            </button>
                        ))}
                    </div>

                    <div className="schedule-list">
                        {loading && schedules.length === 0 ? (
                            <div className="empty-list">Đang tải thời khóa biểu...</div>
                        ) : visibleSchedules.length === 0 ? (
                            <div className="empty-list">Không có lịch học trong bộ lọc này</div>
                        ) : (
                            visibleSchedules.map((schedule) => (
                                <button
                                    className={`student-schedule-row ${selectedSchedule?.id === schedule.id ? 'selected' : ''}`}
                                    key={schedule.id}
                                    onClick={() => selectSchedule(schedule)}
                                    type="button"
                                >
                                    <div>
                                        <strong>{schedule.title}</strong>
                                        <span>{formatScheduleDate(schedule.startTime)}</span>
                                        <small>{formatScheduleTimeRange(schedule)}</small>
                                    </div>
                                    <div className="student-schedule-statuses">
                                        <ScheduleTimingChip schedule={schedule} />
                                        <AttendanceStatusChip status={schedule.myAttendance?.status} />
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </section>

                <section className="admin-panel schedule-student-detail">
                    {selectedSchedule ? (
                        <>
                            <div className="panel-title">
                                <h2>{selectedSchedule.title}</h2>
                                <ScheduleTimingChip schedule={selectedSchedule} />
                            </div>

                            <div className="schedule-detail">
                                <p>{selectedSchedule.description || 'Admin chưa thêm mô tả cho buổi học này.'}</p>
                                <div className="schedule-detail-grid">
                                    <InfoTile label="Ngày học" value={formatScheduleDate(selectedSchedule.startTime)} />
                                    <InfoTile label="Thời gian" value={formatScheduleTimeRange(selectedSchedule)} />
                                </div>
                            </div>

                            {selectedSchedule.myAttendance && (
                                <div className="student-attendance-current">
                                    <div>
                                        <span>Thông tin đã gửi</span>
                                        <strong>{getAttendanceReason(selectedSchedule.myAttendance)}</strong>
                                        <small>Cập nhật {formatScheduleDateTime(selectedSchedule.myAttendance.updatedAt)}</small>
                                    </div>
                                    <AttendanceStatusChip status={selectedSchedule.myAttendance.status} />
                                </div>
                            )}

                            <form className="student-attendance-form" onSubmit={handleAttendanceSubmit}>
                                <div className="panel-title">
                                    <h3>Báo vắng hoặc đi muộn</h3>
                                </div>

                                <div className="schedule-choice-row">
                                    <label className={attendanceForm.status === 'Absent' ? 'selected' : ''}>
                                        <input
                                            checked={attendanceForm.status === 'Absent'}
                                            onChange={() => updateAttendanceForm('status', 'Absent')}
                                            type="radio"
                                        />
                                        Xin vắng
                                    </label>
                                    <label className={attendanceForm.status === 'Late' ? 'selected' : ''}>
                                        <input
                                            checked={attendanceForm.status === 'Late'}
                                            onChange={() => updateAttendanceForm('status', 'Late')}
                                            type="radio"
                                        />
                                        Đi muộn
                                    </label>
                                </div>

                                <div className="form-row">
                                    <label htmlFor="attendance-reason">Lý do</label>
                                    <textarea
                                        id="attendance-reason"
                                        onChange={(event) => updateAttendanceForm('reason', event.target.value)}
                                        placeholder="Nhập lý do để admin nắm được tình hình"
                                        required
                                        rows="4"
                                        value={attendanceForm.reason}
                                    />
                                </div>

                                <button className="primary-button full-width" disabled={saving} type="submit">
                                    {selectedSchedule.myAttendance ? 'Cập nhật thông tin' : 'Gửi thông tin'}
                                </button>
                            </form>
                        </>
                    ) : (
                        <div className="empty-state">
                            <div className="empty-icon" aria-hidden="true">L</div>
                            <h2>Chưa có lịch học</h2>
                            <p>Admin chưa tạo thời khóa biểu cho lớp.</p>
                        </div>
                    )}
                </section>
            </div>
        </section>
    )
}

function createAttendanceForm(schedule) {
    const currentStatus = schedule.myAttendance?.status === 'Late' ? 'Late' : 'Absent'

    return {
        status: currentStatus,
        reason: schedule.myAttendance?.reason || '',
    }
}

function ScheduleUserStat({ label, value }) {
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
