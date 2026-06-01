import { ATTENDANCE_LABELS, TIMING_LABELS, getScheduleTiming } from './ScheduleHelpers'

export function AttendanceStatusChip({ status }) {
    if (!status) {
        return <span className="schedule-status-chip muted">Chưa báo</span>
    }

    return (
        <span className={`schedule-status-chip ${status.toLowerCase()}`}>
            {ATTENDANCE_LABELS[status] || status}
        </span>
    )
}

export function ScheduleTimingChip({ schedule }) {
    const timing = getScheduleTiming(schedule)
    return (
        <span className={`schedule-status-chip ${timing}`}>
            {TIMING_LABELS[timing] || timing}
        </span>
    )
}
