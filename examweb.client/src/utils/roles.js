export function formatRoleLabel(role) {
    if (role === 'Admin') return 'Thầy giáo'
    if (role === 'User') return 'Học sinh'
    return role || 'Học sinh'
}
