import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { APP_NAME } from '../config/appConfig'
import { explainQuestionWithAI } from '../services/api'

const AUTO_ADVANCE_OPTIONS = [
    { label: 'Không', value: 0 },
    { label: '1 giây', value: 1 },
    { label: '2 giây', value: 2 },
    { label: '3 giây', value: 3 },
]

export function PracticeMode({
    auth,
    formatScore,
    markedQuestionIds = [],
    onReset,
    onToggleQuestionMark,
    studentTest,
}) {
    const questions = useMemo(() => studentTest?.questions || [], [studentTest?.questions])
    const totalQuestions = questions.length
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
    const [selectedAnswers, setSelectedAnswers] = useState({})
    const [autoAdvanceDelaySeconds, setAutoAdvanceDelaySeconds] = useState(0)
    const [isFinished, setIsFinished] = useState(false)
    const [aiExplanation, setAiExplanation] = useState(null)
    const [isExplaining, setIsExplaining] = useState(false)
    const [explainError, setExplainError] = useState('')
    const autoAdvanceTimeoutRef = useRef(null)

    const clearAutoAdvanceTimeout = useCallback(() => {
        if (autoAdvanceTimeoutRef.current) {
            window.clearTimeout(autoAdvanceTimeoutRef.current)
            autoAdvanceTimeoutRef.current = null
        }
    }, [])

    useEffect(() => {
        return () => clearAutoAdvanceTimeout()
    }, [clearAutoAdvanceTimeout, studentTest?.id])

    // Bước UX: chuyển câu thì xóa giải thích AI của câu trước.
    useEffect(() => {
        setAiExplanation(null)
        setIsExplaining(false)
        setExplainError('')
    }, [currentQuestionIndex])

    const currentQuestion = questions[currentQuestionIndex]
    const selectedAnswerId = currentQuestion ? selectedAnswers[currentQuestion.id] : null
    const selectedAnswer = currentQuestion?.answers.find((answer) => answer.id === selectedAnswerId)
    const isCurrentQuestionLocked = Boolean(selectedAnswerId)
    const isCurrentQuestionMarked = currentQuestion ? markedQuestionIds.includes(currentQuestion.id) : false

    const summary = useMemo(() => {
        return questions.reduce(
            (result, question) => {
                const chosenAnswerId = selectedAnswers[question.id]
                const chosenAnswer = question.answers.find((answer) => answer.id === chosenAnswerId)
                if (chosenAnswer?.isCorrect) {
                    result.correctCount += 1
                    result.score += Number(question.score || 0)
                }
                return result
            },
            { correctCount: 0, score: 0 },
        )
    }, [questions, selectedAnswers])

    function selectAnswer(answerId) {
        if (!currentQuestion || isCurrentQuestionLocked || isFinished) return

        clearAutoAdvanceTimeout()
        const selectedQuestionIndex = currentQuestionIndex

        setSelectedAnswers((current) => ({
            ...current,
            [currentQuestion.id]: answerId,
        }))

        if (autoAdvanceDelaySeconds > 0) {
            autoAdvanceTimeoutRef.current = window.setTimeout(() => {
                autoAdvanceTimeoutRef.current = null
                if (selectedQuestionIndex >= totalQuestions - 1) {
                    setIsFinished(true)
                    return
                }

                setCurrentQuestionIndex((current) => {
                    if (current !== selectedQuestionIndex) return current
                    return current + 1
                })
            }, autoAdvanceDelaySeconds * 1000)
        }
    }

    function goNext() {
        clearAutoAdvanceTimeout()
        if (!isCurrentQuestionLocked) return

        if (currentQuestionIndex >= totalQuestions - 1) {
            setIsFinished(true)
            return
        }

        setCurrentQuestionIndex((current) => current + 1)
    }

    async function handleExplainWithAI() {
        if (!currentQuestion || !selectedAnswerId || selectedAnswer?.isCorrect || isExplaining) return

        setIsExplaining(true)
        setExplainError('')
        setAiExplanation(null)

        try {
            const response = await explainQuestionWithAI(
                studentTest.id,
                currentQuestion.id,
                selectedAnswerId,
            )
            setAiExplanation(response?.explanation || '')
        } catch (err) {
            setExplainError(err.message || 'Không thể lấy giải thích từ AI')
        } finally {
            setIsExplaining(false)
        }
    }

    function restartPractice() {
        clearAutoAdvanceTimeout()
        setCurrentQuestionIndex(0)
        setSelectedAnswers({})
        setIsFinished(false)
    }

    if (totalQuestions === 0) {
        return (
            <section className="practice-shell">
                <PracticeHeader auth={auth} studentTest={studentTest} />
                <main className="practice-body">
                    <div className="empty-state">
                        <div className="empty-icon" aria-hidden="true">!</div>
                        <h2>Đề chưa có câu hỏi</h2>
                        <p>Thầy giáo cần thêm câu hỏi trước khi bạn có thể luyện tập.</p>
                        <button className="primary-button" onClick={onReset} type="button">
                            Về danh sách đề
                        </button>
                    </div>
                </main>
            </section>
        )
    }

    if (isFinished) {
        return (
            <PracticeResultView
                auth={auth}
                formatScore={formatScore}
                markedQuestionIds={markedQuestionIds}
                onReset={onReset}
                onRestart={restartPractice}
                questions={questions}
                selectedAnswers={selectedAnswers}
                studentTest={studentTest}
                summary={summary}
            />
        )
    }

    const progressPercent = Math.round(((currentQuestionIndex + 1) / totalQuestions) * 100)

    return (
        <section className="practice-shell">
            <PracticeHeader
                auth={auth}
                autoAdvanceDelaySeconds={autoAdvanceDelaySeconds}
                onChangeAutoAdvanceDelay={(value) => {
                    clearAutoAdvanceTimeout()
                    setAutoAdvanceDelaySeconds(value)
                }}
                studentTest={studentTest}
            />

            <main className="practice-body">
                <div className="practice-progress">
                    <div>
                        <span>Câu {currentQuestionIndex + 1}/{totalQuestions}</span>
                        <strong>{progressPercent}%</strong>
                    </div>
                    <progress max="100" value={progressPercent} />
                </div>

                <article className="question-block practice-question-card">
                    <div className="question-head">
                        <h3>Câu {currentQuestionIndex + 1}</h3>
                        <div className="question-actions">
                            <button
                                aria-pressed={isCurrentQuestionMarked}
                                className={`mark-question-button ${isCurrentQuestionMarked ? 'active' : ''}`}
                                onClick={() => onToggleQuestionMark?.(currentQuestion.id)}
                                title={isCurrentQuestionMarked ? 'Bỏ đánh dấu' : 'Đánh dấu câu hỏi'}
                                type="button"
                            >
                                ⚑
                            </button>
                            <span className="score-badge">{formatScore(currentQuestion.score)} điểm</span>
                        </div>
                    </div>
                    <p className="question-content">{currentQuestion.content}</p>

                    <div className="answer-grid practice-answer-grid">
                        {currentQuestion.answers.map((answer, index) => {
                            const answerState = getPracticeAnswerState(answer, selectedAnswerId)
                            return (
                                <button
                                    className={`answer-option practice-answer-button ${answerState}`}
                                    disabled={isCurrentQuestionLocked}
                                    key={answer.id}
                                    onClick={() => selectAnswer(answer.id)}
                                    type="button"
                                >
                                    <span className="answer-marker">{getAnswerLabel(index)}</span>
                                    <span className="answer-text">{answer.content}</span>
                                    {isCurrentQuestionLocked && answer.id === selectedAnswerId && (
                                        <span className={`answer-status ${answer.isCorrect ? 'correct-label' : ''}`}>
                                            Bạn chọn
                                        </span>
                                    )}
                                    {isCurrentQuestionLocked && answer.isCorrect && answer.id !== selectedAnswerId && (
                                        <span className="answer-status correct-label">Đáp án đúng</span>
                                    )}
                                </button>
                            )
                        })}
                    </div>

                    {isCurrentQuestionLocked && (
                        <div className={`practice-feedback ${selectedAnswer?.isCorrect ? 'correct' : 'wrong'}`}>
                            <strong>{selectedAnswer?.isCorrect ? 'Chính xác' : 'Chưa đúng'}</strong>
                            <span>
                                {selectedAnswer?.isCorrect
                                    ? 'Bạn đã chọn đúng đáp án.'
                                    : 'Đáp án đúng đã được hiển thị màu xanh.'}
                            </span>
                        </div>
                    )}

                    {isCurrentQuestionLocked && !selectedAnswer?.isCorrect && (
                        <div className="ai-explain-section">
                            <button
                                className="ai-explain-button"
                                disabled={isExplaining}
                                onClick={handleExplainWithAI}
                                type="button"
                            >
                                <span aria-hidden="true">✨</span>
                                {isExplaining ? 'AI đang suy nghĩ...' : 'Giải thích bằng AI'}
                            </button>

                            {isExplaining && (
                                <div className="ai-explain-loading" role="status">
                                    <span className="ai-explain-spinner" aria-hidden="true" />
                                    <span>Trợ giảng AI đang phân tích câu hỏi...</span>
                                </div>
                            )}

                            {explainError && (
                                <div className="ai-explain-error" role="alert">
                                    {explainError}
                                </div>
                            )}

                            {aiExplanation && (
                                <div className="ai-explanation-box">
                                    <strong>Giải thích từ AI</strong>
                                    <p>{aiExplanation}</p>
                                </div>
                            )}
                        </div>
                    )}
                </article>
            </main>

            <footer className="practice-footer">
                <div className="progress-text">
                    Đã làm <strong>{Object.keys(selectedAnswers).length}</strong> / {totalQuestions} câu
                </div>
                <div className="button-row">
                    <button className="ghost-button" onClick={onReset} type="button">
                        Thoát luyện tập
                    </button>
                    <button className="primary-button" disabled={!isCurrentQuestionLocked} onClick={goNext} type="button">
                        {currentQuestionIndex >= totalQuestions - 1 ? 'Xem kết quả' : 'Câu tiếp theo'}
                    </button>
                </div>
            </footer>
        </section>
    )
}

function PracticeHeader({
    auth,
    autoAdvanceDelaySeconds = 0,
    onChangeAutoAdvanceDelay,
    studentTest,
}) {
    return (
        <header className="practice-topbar">
            <div>
                <p className="eyebrow">{APP_NAME}</p>
                <strong>{studentTest.testName}</strong>
                <span>{auth.displayName}</span>
            </div>
            <div className="practice-topbar-actions">
                {onChangeAutoAdvanceDelay && (
                    <label className="auto-advance-control">
                        <span>Tự chuyển câu</span>
                        <select
                            onChange={(event) => onChangeAutoAdvanceDelay(Number(event.target.value))}
                            value={autoAdvanceDelaySeconds}
                        >
                            {AUTO_ADVANCE_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </label>
                )}
                <span className="practice-mode-pill">Luyện tập</span>
            </div>
        </header>
    )
}

function PracticeResultView({
    auth,
    formatScore,
    markedQuestionIds = [],
    onReset,
    onRestart,
    questions,
    selectedAnswers,
    studentTest,
    summary,
}) {
    const [activeFilter, setActiveFilter] = useState('all')
    const markedQuestionSet = useMemo(() => new Set(markedQuestionIds), [markedQuestionIds])
    const filterOptions = useMemo(() => [
        { label: 'Tất cả', value: 'all', count: questions.length },
        {
            label: 'Câu đúng',
            value: 'correct',
            count: questions.filter((question) => {
                const selectedAnswerId = selectedAnswers[question.id]
                return question.answers.some((answer) => answer.id === selectedAnswerId && answer.isCorrect)
            }).length,
        },
        {
            label: 'Câu sai',
            value: 'incorrect',
            count: questions.filter((question) => {
                const selectedAnswerId = selectedAnswers[question.id]
                return !question.answers.some((answer) => answer.id === selectedAnswerId && answer.isCorrect)
            }).length,
        },
        {
            label: 'Câu đánh dấu',
            value: 'marked',
            count: questions.filter((question) => markedQuestionSet.has(question.id)).length,
        },
    ], [markedQuestionSet, questions, selectedAnswers])
    const filteredQuestions = useMemo(() => {
        return questions.filter((question) => {
            const selectedAnswerId = selectedAnswers[question.id]
            const isCorrect = question.answers.some((answer) => answer.id === selectedAnswerId && answer.isCorrect)

            if (activeFilter === 'correct') return isCorrect
            if (activeFilter === 'incorrect') return !isCorrect
            if (activeFilter === 'marked') return markedQuestionSet.has(question.id)
            return true
        })
    }, [activeFilter, markedQuestionSet, questions, selectedAnswers])

    return (
        <section className="practice-shell">
            <PracticeHeader auth={auth} studentTest={studentTest} />

            <main className="practice-body">
                <section className="test-result-view practice-result-view">
                    <div className="result-panel result-panel-full">
                        <div className="result-score-info">
                            <p className="eyebrow">Kết quả luyện tập</p>
                            <h2>Hoàn thành bài luyện tập</h2>
                            <strong>
                                {formatScore(summary.score)} / {formatScore(studentTest.scoreTotal)} điểm
                            </strong>
                        </div>
                        <div className="result-summary-grid">
                            <div className="result-summary-item">
                                <span>Số câu đúng</span>
                                <strong>{summary.correctCount}/{questions.length}</strong>
                            </div>
                            <div className="result-summary-item">
                                <span>Tổng câu hỏi</span>
                                <strong>{questions.length}</strong>
                            </div>
                            <div className="result-summary-item">
                                <span>Chế độ</span>
                                <strong>Luyện tập</strong>
                            </div>
                        </div>
                    </div>

                    <div className="result-review-head">
                        <div>
                            <p className="eyebrow">Review chi tiết</p>
                            <h3>Đáp án từng câu</h3>
                        </div>
                    </div>

                    <div className="result-filter-row" aria-label="Lọc kết quả luyện tập">
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
                        {filteredQuestions.length === 0 && (
                            <div className="empty-list">Không có câu hỏi phù hợp với bộ lọc này.</div>
                        )}
                        {filteredQuestions.map((question) => {
                            const originalIndex = questions.findIndex((item) => item.id === question.id)
                            const selectedAnswerId = selectedAnswers[question.id]
                            const selectedAnswer = question.answers.find((answer) => answer.id === selectedAnswerId)
                            const isMarked = markedQuestionSet.has(question.id)

                            return (
                                <article
                                    className={`question-block review-question ${selectedAnswer?.isCorrect ? 'correct' : 'incorrect'} ${isMarked ? 'marked' : ''}`}
                                    key={question.id}
                                >
                                    <div className="question-head review-question-head">
                                        <div>
                                            <h3>Câu {originalIndex + 1}</h3>
                                            <p className="question-content">{question.content}</p>
                                        </div>
                                        <div className="review-meta">
                                            {isMarked && <span className="marked-badge">Đã đánh dấu</span>}
                                            <div className="review-score">
                                                <span>Điểm đạt</span>
                                                <strong>{formatScore(selectedAnswer?.isCorrect ? question.score : 0)}</strong>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="answer-grid review-answer-grid">
                                        {question.answers.map((answer, answerIndex) => (
                                            <div
                                                className={`answer-option review-answer ${getPracticeAnswerState(answer, selectedAnswerId)}`}
                                                key={answer.id}
                                            >
                                                <span className="answer-marker">{getAnswerLabel(answerIndex)}</span>
                                                <span className="answer-text">{answer.content}</span>
                                                {answer.id === selectedAnswerId && (
                                                    <span className="answer-status">Bạn chọn</span>
                                                )}
                                                {answer.isCorrect && answer.id !== selectedAnswerId && (
                                                    <span className="answer-status correct-label">Đáp án đúng</span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </article>
                            )
                        })}
                    </div>
                </section>
            </main>

            <footer className="practice-footer">
                <div className="progress-text">
                    Đúng <strong>{summary.correctCount}</strong> / {questions.length} câu
                </div>
                <div className="button-row">
                    <button className="ghost-button" onClick={onReset} type="button">
                        Về danh sách đề
                    </button>
                    <button className="primary-button" onClick={onRestart} type="button">
                        Luyện lại
                    </button>
                </div>
            </footer>
        </section>
    )
}

function getPracticeAnswerState(answer, selectedAnswerId) {
    if (!selectedAnswerId) return ''
    if (answer.isCorrect) return 'correct-answer'
    if (answer.id === selectedAnswerId) return 'wrong-answer'
    return ''
}

function getAnswerLabel(index) {
    return String.fromCharCode(65 + index)
}
