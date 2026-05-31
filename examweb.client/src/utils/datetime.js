export function formatDateTime(value) {
    if (!value) return 'Chưa ghi nhận'
    return new Intl.DateTimeFormat('vi-VN', {
        dateStyle: 'short',
        timeStyle: 'short',
    }).format(new Date(value))
}
