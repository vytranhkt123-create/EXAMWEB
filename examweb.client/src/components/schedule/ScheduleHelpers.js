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
    const start = new Date(schedule.startTime).getTime()
    const end = new Date(schedule.endTime).getTime()

    if (Number.isNaN(start) || Number.isNaN(end)) return 'upcoming'
    if (now < start) return 'upcoming'
    if (now <= end) return 'live'
    return 'past'
}

export function toDateTimeLocalValue(value) {
    const date = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(date.getTime())) return ''

    const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000)
    return localDate.toISOString().slice(0, 16)
}

export function toApiDateTime(value) {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? '' : date.toISOString()
}

export function formatScheduleDate(value) {
    if (!value) return 'Chưa đặt lịch'

    return new Intl.DateTimeFormat('vi-VN', {
        weekday: 'long',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    }).format(new Date(value))
}

export function formatScheduleTimeRange(schedule) {
    const formatter = new Intl.DateTimeFormat('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
    })

    return `${formatter.format(new Date(schedule.startTime))} - ${formatter.format(new Date(schedule.endTime))}`
}

export function formatScheduleDateTime(value) {
    if (!value) return 'Chưa ghi nhận'

    return new Intl.DateTimeFormat('vi-VN', {
        dateStyle: 'short',
        timeStyle: 'short',
    }).format(new Date(value))
}

export function sortSchedules(schedules) {
    return [...schedules].sort((left, right) => new Date(left.startTime) - new Date(right.startTime))
}

export function getAttendanceReason(attendance) {
    return attendance?.reason?.trim() || 'Chưa nhập lý do'
}
