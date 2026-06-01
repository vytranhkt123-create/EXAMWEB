import {
    formatDateTime,
    formatLocalDate,
    formatTime,
    parseBackendDate,
    toDateTimeLocalInputValue,
    toUtcIsoString,
} from '../../utils/datetime'

export const ATTENDANCE_LABELS = {
    Present: 'Có mặt',
    Absent: 'Xin vắng',
    Late: 'Đi muộn',
}

export const TIMING_LABELS = {
    upcoming: 'Sắp học',
    live: 'Đang diễn ra',
    past: 'Đã kết thúc',
}

export function createDefaultScheduleForm() {
    const start = new Date()
    start.setSeconds(0, 0)
    start.setMinutes(start.getMinutes() < 30 ? 30 : 60)

    const end = new Date(start.getTime() + 90 * 60 * 1000)

    return {
        title: '',
        description: '',
        startTime: toDateTimeLocalValue(start),
        endTime: toDateTimeLocalValue(end),
    }
}

export function getScheduleTiming(schedule) {
    const now = Date.now()
    const start = parseBackendDate(schedule.startTime)?.getTime()
    const end = parseBackendDate(schedule.endTime)?.getTime()

    if (!Number.isFinite(start) || !Number.isFinite(end)) return 'upcoming'
    if (now < start) return 'upcoming'
    if (now <= end) return 'live'
    return 'past'
}

export function toDateTimeLocalValue(value) {
    return toDateTimeLocalInputValue(value)
}

export function toApiDateTime(value) {
    return toUtcIsoString(value)
}

export function formatScheduleDate(value) {
    return formatLocalDate(
        value,
        {
            weekday: 'long',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
        },
        'Chưa đặt lịch',
    )
}

export function formatScheduleTimeRange(schedule) {
    return `${formatTime(schedule.startTime)} - ${formatTime(schedule.endTime)}`
}

export function formatScheduleDateTime(value) {
    return formatDateTime(value)
}

export function sortSchedules(schedules) {
    return [...schedules].sort((left, right) => {
        const leftTime = parseBackendDate(left.startTime)?.getTime() ?? 0
        const rightTime = parseBackendDate(right.startTime)?.getTime() ?? 0
        return leftTime - rightTime
    })
}

export function getAttendanceReason(attendance) {
    return attendance?.reason?.trim() || 'Chưa nhập lý do'
}
