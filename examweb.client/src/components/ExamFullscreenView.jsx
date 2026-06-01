import { APP_NAME } from '../config/appConfig'

export function ExamFullscreenView({
    answeredCount,
    auth,
    error,
    examShellRef,
    formatDuration,
    formatLongDuration,
    formatScore,
    fullscreenWarning,
    isExamLocked,
    isExamRunning,
    isFullscreen,
    monitoringMessage,
    monitoringStatus,
    onReenterFullscreen,
    onReset,
    onRestartScreenShare,
    onSelectAnswer,
    onSubmit,
    result,
    saving,
    selectedAnswers,
    studentTest,
    timeLeft,
}) {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const requireFullscreen = !isMobile;

    return (
        <div className="exam-fullscreen-shell" ref={examShellRef}>
            <header className="exam-fullscreen-topbar">
                <div>
                    <p className="eyebrow">{APP_NAME}</p>
                    <strong>{studentTest.testName}</strong>
                    <span>{auth.displayName}</span>
                </div>
                <div className="exam-fullscreen-meta">
                    <span className={`monitor-pill ${monitoringStatus}`}>{getMonitorStatusText(monitoringStatus)}</span>
                    <span className={`timer-pill ${timeLeft !== null && timeLeft <= 60 && !result ? 'danger' : ''}`}>
                        {result ? 'Đã nộp bài' : formatDuration(timeLeft)}
                    </span>
                    {isExamRunning && ((requireFullscreen && !isFullscreen) || monitoringStatus !== 'active') && (
                        <div className="exam-monitor-blocker" role="status">
                            <strong>Chưa đủ điều kiện làm bài</strong>
                            <span>
                                {!isFullscreen && requireFullscreen
                                    ? 'Bạn cần quay lại chế độ toàn màn hình để tiếp tục chọn đáp án.'
                                    : monitoringStatus === 'stopped'
                                        ? 'Bạn cần bật lại chia sẻ màn hình để tiếp tục chọn đáp án.'
                                        : 'Hệ thống đang kết nối giám sát màn hình.'}
                            </span>
                            {!isFullscreen && requireFullscreen ? (
                                <button className="primary-button" onClick={onReenterFullscreen} type="button">
                                    Vào lại toàn màn hình
                                </button>
                            ) : monitoringStatus === 'stopped' && !isMobile && (
                                <button className="primary-button" onClick={onRestartScreenShare} type="button">
                                    Bật lại chia sẻ màn hình
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </header>

            {fullscreenWarning && (
                <div className="fullscreen-warning" role="alert">
                    <strong>⚠ Cảnh báo</strong>
                    <span>{fullscreenWarning}</span>
                    {monitoringStatus === 'stopped' ? (
                        <button className="ghost-button" onClick={onRestartScreenShare} type="button">
                            Bật lại chia sẻ
                        </button>
                    ) : (
                        <button className="ghost-button" onClick={onReenterFullscreen} type="button">
                            Vào lại toàn màn hình
                        </button>
                    )}
                </div>
            )}

            {error && <div className="alert exam-alert">{error}</div>}

            {isExamRunning && (!isFullscreen || monitoringStatus !== 'active') && (
                <div className="exam-monitor-blocker" role="status">
                    <strong>Chưa đủ điều kiện làm bài</strong>
                    <span>
                        {!isFullscreen
                            ? 'Bạn cần quay lại chế độ toàn màn hình để tiếp tục chọn đáp án.'
                            : monitoringStatus === 'stopped'
                            ? 'Bạn cần bật lại chia sẻ màn hình để tiếp tục chọn đáp án.'
                            : 'Hệ thống đang kết nối giám sát màn hình.'}
                    </span>
                    {!isFullscreen ? (
                        <button className="primary-button" onClick={onReenterFullscreen} type="button">
                            Vào lại toàn màn hình
                        </button>
                    ) : monitoringStatus === 'stopped' && (
                        <button className="primary-button" onClick={onRestartScreenShare} type="button">
                            Bật lại chia sẻ màn hình
                        </button>
                    )}
                </div>
            )}

            <main className="exam-fullscreen-body">
                {studentTest.questions.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon" aria-hidden="true">!</div>
                        <h2>Đề chưa có câu hỏi</h2>
                        <p>Admin cần thêm câu hỏi trước khi học viên có thể làm bài.</p>
                    </div>
                ) : (
                    <div className="question-stack">
                        {studentTest.questions.map((question, index) => (
                            <article className="question-block" key={question.id}>
                                <div className="question-head">
                                    <h3>Câu {index + 1}</h3>
                                    <span className="score-badge">{formatScore(question.score)} điểm</span>
                                </div>
                                <p className="question-content">{question.content}</p>
                                <div className="answer-grid">
                                    {question.answers.map((answer) => (
                                        <label
                                            className={`answer-option ${selectedAnswers[question.id] === answer.id ? 'selected' : ''}`}
                                            key={answer.id}
                                        >
                                            <input
                                                checked={selectedAnswers[question.id] === answer.id}
                                                disabled={isExamLocked}
                                                name={question.id}
                                                onChange={() => onSelectAnswer(question.id, answer.id)}
                                                type="radio"
                                            />
                                            <span className="answer-text">{answer.content}</span>
                                        </label>
                                    ))}
                                </div>
                            </article>
                        ))}
                    </div>
                )}

                {result && (
                    <div className="result-panel">
                        <div className="result-score-info">
                            <p className="eyebrow">Kết quả</p>
                            <strong>
                                {formatScore(result.score)} / {formatScore(result.scoreTotal)} điểm
                            </strong>
                            <span>
                                Đúng {result.correctCount}/{result.questionCount} câu · {formatLongDuration(result.durationSeconds)}
                            </span>
                        </div>
                        <span className={result.isTimeExpired ? 'result-badge warning' : 'result-badge'}>
                            {result.isTimeExpired ? 'Tự nộp khi hết giờ' : 'Đã nộp bài'}
                        </span>
                    </div>
                )}
            </main>

            <footer className="exam-fullscreen-footer">
                <div className="progress-text">
                    Đã chọn <strong>{answeredCount}</strong> / {studentTest.questions.length} câu
                    {monitoringMessage && <span className="monitor-note"> · {monitoringMessage}</span>}
                </div>
                <div className="button-row">
                    {(result || isExamRunning) && (
                        <button className="ghost-button" onClick={onReset} type="button">
                            {result ? 'Về danh sách đề' : 'Thoát bài'}
                        </button>
                    )}
                    <button
                        className="primary-button"
                        disabled={saving || isExamLocked || studentTest.questions.length === 0}
                        onClick={onSubmit}
                        type="button"
                    >
                        Nộp bài
                    </button>
                </div>
            </footer>
        </div>
    )
}

function getMonitorStatusText(status) {
    const labels = {
        active: 'Đang theo dõi',
        idle: 'Chưa bật',
        starting: 'Đang kết nối',
        stopped: 'Đã dừng chia sẻ',
        submitted: 'Đã nộp bài',
    }
    return labels[status] || status
}
