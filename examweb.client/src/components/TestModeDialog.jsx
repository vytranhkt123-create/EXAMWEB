export function TestModeDialog({
    loading,
    onCancel,
    onSelectExam,
    onSelectPractice,
    testName,
}) {
    return (
        <div className="modal-overlay" role="presentation">
            <div aria-labelledby="mode-dialog-title" aria-modal="true" className="modal-card mode-dialog" role="dialog">
                <span className="modal-badge">Chọn chế độ</span>
                <h2 id="mode-dialog-title">{testName || 'Bắt đầu làm bài'}</h2>
                <p className="mode-dialog-lead">Bạn muốn làm đề theo chế độ nào?</p>

                <div className="mode-choice-grid">
                    <button className="mode-choice exam" disabled={loading} onClick={onSelectExam} type="button">
                        <span className="mode-choice-icon">T</span>
                        <strong>Thi Thật</strong>
                        <small>Làm toàn bộ câu hỏi và xem kết quả sau khi nộp bài.</small>
                    </button>

                    <button className="mode-choice practice" disabled={loading} onClick={onSelectPractice} type="button">
                        <span className="mode-choice-icon">L</span>
                        <strong>Luyện Tập</strong>
                        <small>Làm từng câu, khóa đáp án và xem đúng sai ngay.</small>
                    </button>
                </div>

                <div className="modal-actions">
                    <button className="ghost-button" disabled={loading} onClick={onCancel} type="button">
                        Hủy
                    </button>
                </div>
            </div>
        </div>
    )
}
