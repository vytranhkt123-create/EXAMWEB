import { useMemo, useState } from 'react'
import { APP_NAME } from '../config/appConfig'

export function ExamFullscreenView({
    answeredCount,
    auth,
    error,
    examShellRef,
    formatDuration,
    formatScore,
    fullscreenWarning,
    isExamLocked,
    isExamRunning,
    isFullscreen,
    markedQuestionIds = [],
    monitoringMessage,
    monitoringStatus,
    onReenterFullscreen,
    onReset,
    onSelectAnswer,
    onSubmit,
    onToggleQuestionMark,
    submitResult,
    saving,
    selectedAnswers,
    studentTest,
    timeLeft,
}) {
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
                    <span className={`timer-pill ${timeLeft !== null && timeLeft <= 60 && !submitResult ? 'danger' : ''}`}>
                        {submitResult ? 'Đã nộp bài' : formatDuration(timeLeft)}
                    </span>
                    {!isFullscreen && isExamRunning && (
                        <button className="ghost-button" onClick={onReenterFullscreen} type="button">
                            Vào lại toàn màn hình
                        </button>
                    )}
                </div>
            </header>

            {fullscreenWarning && (
                <div className="fullscreen-warning" role="alert">
                    <strong>⚠ Cảnh báo</strong>
                    <span>{fullscreenWarning}</span>
                    {!isFullscreen && isExamRunning && (
                        <button className="ghost-button" onClick={onReenterFullscreen} type="button">
                            Vào lại toàn màn hình
                        </button>
                    )}
                </div>
            )}

            {error && <div className="alert exam-alert">{error}</div>}

            {isExamRunning && !isFullscreen && (
                <div className="exam-monitor-blocker" role="status">
                    <strong>Vui lòng quay lại toàn màn hình</strong>
                    <span>Bạn cần ở chế độ toàn màn hình để tiếp tục chọn đáp án.</span>
                    <button className="primary-button" onClick={onReenterFullscreen} type="button">
                        Vào lại toàn màn hình
                    </button>
                </div>
            )}

            <main className="exam-fullscreen-body">
                {/* Bước 3: có submitResult thì ẩn giao diện làm bài và chỉ hiển thị kết quả. */}
                {submitResult ? (
                    <TestResultView
                        formatDuration={formatDuration}
                        formatScore={formatScore}
                        markedQuestionIds={markedQuestionIds}
                        result={submitResult}
                        studentTest={studentTest}
                    />
                ) : studentTest.questions.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon" aria-hidden="true">!</div>
                        <h2>Đề chưa có câu hỏi</h2>
                        <p>Thầy giáo cần thêm câu hỏi trước khi học sinh có thể làm bài.</p>
                    </div>
                ) : (
                    <div className="question-stack">
                        {studentTest.questions.map((question, index) => (
                            <article className="question-block" key={question.id}>
                                <div className="question-head">
                                    <h3>Câu {index + 1}</h3>
                                    <div className="question-actions">
                                        <button
                                            aria-pressed={markedQuestionIds.includes(question.id)}
                                            className={`mark-question-button ${markedQuestionIds.includes(question.id) ? 'active' : ''}`}
                                            onClick={() => onToggleQuestionMark?.(question.id)}
                                            title={markedQuestionIds.includes(question.id) ? 'Bỏ đánh dấu' : 'Đánh dấu câu hỏi'}
                                            type="button"
                                        >
                                            ⚑
                                        </button>
                                        <span className="score-badge">{formatScore(question.score)} điểm</span>
                                    </div>
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
            </main>

            <footer className="exam-fullscreen-footer">
                <div className="progress-text">
                    {submitResult ? (
                        <>
                            Đã nộp <strong>{submitResult.correctCount}</strong> / {submitResult.questionCount} câu đúng
                        </>
                    ) : (
                        <>
                            Đã chọn <strong>{answeredCount}</strong> / {studentTest.questions.length} câu
                        </>
                    )}
                    {monitoringMessage && <span className="monitor-note"> · {monitoringMessage}</span>}
                </div>
                <div className="button-row">
                    {(submitResult || isExamRunning) && (
                        <button className="ghost-button" onClick={onReset} type="button">
                            {submitResult ? 'Về danh sách đề' : 'Thoát bài'}
                        </button>
                    )}
                    {!submitResult && (
                        <button
                            className="primary-button"
                            disabled={saving || isExamLocked || studentTest.questions.length === 0}
                            onClick={onSubmit}
                            type="button"
                        >
                            Nộp bài
                        </button>
                    )}
                </div>
            </footer>
        </div>
    )
}

function TestResultView({ formatDuration, formatScore, markedQuestionIds = [], result, studentTest }) {
    const [activeFilter, setActiveFilter] = useState('all')
    const markedQuestionSet = useMemo(() => new Set(markedQuestionIds), [markedQuestionIds])
    const questionsById = useMemo(
        () => new Map((studentTest.questions || []).map((question) => [question.id, question])),
        [studentTest.questions],
    )
    const detailedResults = useMemo(() => result.results || [], [result.results])
    const resultIndexByQuestionId = useMemo(
        () => new Map(detailedResults.map((item, index) => [item.questionId, index])),
        [detailedResults],
    )
    const filterOptions = useMemo(() => [
        { label: 'Tất cả', value: 'all', count: detailedResults.length },
        { label: 'Câu đúng', value: 'correct', count: detailedResults.filter((item) => item.isCorrect).length },
        { label: 'Câu sai', value: 'incorrect', count: detailedResults.filter((item) => !item.isCorrect).length },
        {
            label: 'Câu đánh dấu',
            value: 'marked',
            count: detailedResults.filter((item) => markedQuestionSet.has(item.questionId)).length,
        },
    ], [detailedResults, markedQuestionSet])
    const filteredResults = useMemo(() => {
        return detailedResults.filter((item) => {
            if (activeFilter === 'correct') return item.isCorrect
            if (activeFilter === 'incorrect') return !item.isCorrect
            if (activeFilter === 'marked') return markedQuestionSet.has(item.questionId)
            return true
        })
    }, [activeFilter, detailedResults, markedQuestionSet])

    return (
        <section className="test-result-view">
            <div className="result-panel result-panel-full">
                <div className="result-score-info">
                    <p className="eyebrow">Kết quả thi</p>
                    <h2>Nộp bài thành công</h2>
                    <strong>
                        {formatScore(result.score)} / {formatScore(result.scoreTotal)} điểm
                    </strong>
                    <span>{result.studentName || studentTest.studentName}</span>
                </div>
                <div className="result-summary-grid">
                    <div className="result-summary-item">
                        <span>Số câu đúng</span>
                        <strong>{result.correctCount}/{result.questionCount}</strong>
                    </div>
                    <div className="result-summary-item">
                        <span>Thời gian</span>
                        <strong>{formatDuration(result.durationSeconds)}</strong>
                    </div>
                    <div className="result-summary-item">
                        <span>Trạng thái</span>
                        <strong>{result.isTimeExpired ? 'Tự nộp khi hết giờ' : 'Đã nộp bài'}</strong>
                    </div>
                </div>
            </div>

            <div className="result-review-head">
                <div>
                    <p className="eyebrow">Review chi tiết</p>
                    <h3>Đáp án từng câu</h3>
                </div>
                <span className={result.isTimeExpired ? 'result-badge warning' : 'result-badge'}>
                    {result.isTimeExpired ? 'Hết giờ' : 'Hoàn tất'}
                </span>
            </div>

            <div className="result-filter-row" aria-label="Lọc kết quả thi">
                {filterOptions.map((filter) => (
                    <button
                        className={activeFilter === filter.value ? 'active' : ''}
                        key={filter.value}
                        onClick={() => setActiveFilter(filter.value)}
                        type="button"
                    >
                        <span>{filter.label}</span>
                        <strong>{filter.count}</strong>
                    </button>
                ))}
            </div>

            <div className="question-stack">
                {filteredResults.length === 0 && (
                    <div className="empty-list">Không có câu hỏi phù hợp với bộ lọc này.</div>
                )}
                {filteredResults.map((item) => {
                    // Bước 4: ghép kết quả backend với câu hỏi gốc để lấy lại danh sách đáp án.
                    const question = questionsById.get(item.questionId)
                    const answers = question?.answers || []
                    const isMarked = markedQuestionSet.has(item.questionId)
                    const originalIndex = resultIndexByQuestionId.get(item.questionId) ?? 0

                    return (
                        <article
                            className={`question-block review-question ${item.isCorrect ? 'correct' : 'incorrect'} ${isMarked ? 'marked' : ''}`}
                            key={item.questionId}
                        >
                            <div className="question-head review-question-head">
                                <div>
                                    <h3>Câu {originalIndex + 1}</h3>
                                    <p className="question-content">{item.questionContent || question?.content}</p>
                                </div>
                                <div className="review-meta">
                                    {isMarked && <span className="marked-badge">Đã đánh dấu</span>}
                                    <div className="review-score">
                                        <span>Điểm đạt</span>
                                        <strong>{formatScore(item.scoreEarned)}</strong>
                                    </div>
                                </div>
                            </div>

                            {answers.length === 0 ? (
                                <div className="empty-list">Không tìm thấy danh sách đáp án của câu hỏi này.</div>
                            ) : (
                                <div className="answer-grid review-answer-grid">
                                    {answers.map((answer, answerIndex) => {
                                        const answerState = getReviewAnswerState(answer.id, item)
                                        return (
                                            <div className={`answer-option review-answer ${answerState}`} key={answer.id}>
                                                <span className="answer-marker">{getAnswerLabel(answerIndex)}</span>
                                                <span className="answer-text">{answer.content}</span>
                                                {answer.id === item.selectedAnswerId && (
                                                    <span className="answer-status">Bạn chọn</span>
                                                )}
                                                {answer.id === item.correctAnswerId && (
                                                    <span className="answer-status correct-label">Đáp án đúng</span>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            )}

                            {!item.selectedAnswerId && (
                                <p className="unanswered-note">Bạn chưa chọn đáp án cho câu này.</p>
                            )}
                        </article>
                    )
                })}
            </div>
        </section>
    )
}

function getReviewAnswerState(answerId, resultItem) {
    if (answerId === resultItem.correctAnswerId) return 'correct-answer'
    if (answerId === resultItem.selectedAnswerId && !resultItem.isCorrect) return 'wrong-answer'
    if (answerId === resultItem.selectedAnswerId) return 'selected-answer'
    return ''
}

function getAnswerLabel(index) {
    return String.fromCharCode(65 + index)
}

function getMonitorStatusText(status) {
    const labels = {
        active: 'Đang giám sát',
        idle: 'Chưa bắt đầu',
        starting: 'Đang chuẩn bị',
        stopped: 'Đã tạm dừng',
        submitted: 'Đã nộp bài',
    }
    return labels[status] || status
}
