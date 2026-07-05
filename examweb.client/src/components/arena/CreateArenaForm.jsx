import { useCallback, useEffect, useState } from 'react'
import { api, arenaApi } from '../../services/api'

export default function CreateArenaForm({ onSuccess, onCancel }) {
  const [tests, setTests] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    testId: '',
    scheduledStartTime: '',
    durationMinutes: 30
  })

  const fetchTests = useCallback(async () => {
    try {
      const response = await api('')
      setTests(response || [])
    } catch {
      setError('Không thể tải danh sách đề thi')
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    Promise.resolve().then(() => {
      if (!cancelled) {
        fetchTests()
      }
    })

    return () => {
      cancelled = true
    }
  }, [fetchTests])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    setError('')
    setSuccess('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!formData.name.trim()) {
      setError('Tên đấu trường không được để trống')
      return
    }

    if (!formData.testId) {
      setError('Vui lòng chọn đề thi')
      return
    }

    if (formData.durationMinutes < 1 || formData.durationMinutes > 240) {
      setError('Thời lượng phải từ 1 đến 240 phút')
      return
    }

    setLoading(true)

    try {
      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        testId: formData.testId,
        scheduledStartTime: formData.scheduledStartTime || null,
        durationMinutes: parseInt(formData.durationMinutes, 10)
      }

      const response = await arenaApi('', {
        method: 'POST',
        body: JSON.stringify(payload)
      })

      setSuccess('Tạo đấu trường thành công!')
      
      // Reset form
      setFormData({
        name: '',
        description: '',
        testId: '',
        scheduledStartTime: '',
        durationMinutes: 30
      })

      // Call onSuccess callback with the created arena
      if (onSuccess) {
        onSuccess(response)
      }
    } catch (err) {
      setError(err.message || 'Không thể tạo đấu trường')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Tạo Đấu Trường Mới</h2>

      {error && (
        <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
            Tên Đấu Trường <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Nhập tên đấu trường"
            disabled={loading}
          />
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
            Mô Tả
          </label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            rows="3"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Nhập mô tả (tùy chọn)"
            disabled={loading}
          />
        </div>

        <div>
          <label htmlFor="testId" className="block text-sm font-medium text-gray-700 mb-1">
            Chọn Đề Thi <span className="text-red-500">*</span>
          </label>
          <select
            id="testId"
            name="testId"
            value={formData.testId}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading}
            required
          >
            <option value="">-- Chọn đề thi --</option>
            {tests.map(test => (
              <option key={test.id} value={test.id}>
                {test.testName} ({test.questionCount} câu hỏi)
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="scheduledStartTime" className="block text-sm font-medium text-gray-700 mb-1">
            Thời Gian Bắt Đầu (Tùy chọn)
          </label>
          <input
            type="datetime-local"
            id="scheduledStartTime"
            name="scheduledStartTime"
            value={formData.scheduledStartTime}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading}
          />
          <p className="text-xs text-gray-500 mt-1">Để trống nếu muốn bắt đầu ngay</p>
        </div>

        <div>
          <label htmlFor="durationMinutes" className="block text-sm font-medium text-gray-700 mb-1">
            Thời Lượng (Phút) <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            id="durationMinutes"
            name="durationMinutes"
            value={formData.durationMinutes}
            onChange={handleChange}
            min="1"
            max="240"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading}
            required
          />
        </div>

        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {loading ? 'Đang tạo...' : 'Tạo Đấu Trường'}
          </button>
          
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              Hủy
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
