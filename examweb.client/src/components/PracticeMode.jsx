import { useEffect, useMemo, useState } from 'react'
import { APP_NAME } from '../config/appConfig'

export function PracticeMode({ auth, formatScore, onReset, studentTest }) {
    const questions = studentTest?.questions || []
    const totalQuestions = questions.length
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
    const [selectedAnswers, setSelectedAnswers] = useState({})
    const [isFinished, setIsFinished] = useState(false)

    useEffect(() => {
        setCurrentQuestionIndex(0)
        setSelectedAnswers({})
        setIsFinished(false)
    }, [studentTest?.id])

    const currentQuestion = questions[currentQuestionIndex]
    const selectedAnswerId = currentQuestion ? selectedAnswers[currentQuestion.id] : null
    const selectedAnswer = currentQuestion?.answers.find((answer) => answer.id === selectedAnswerId)
    const isCurrentQuestionLocked = Boolean(selectedAnswerId)

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

        setSelectedAnswers((current) => ({
            ...current,
            [currentQuestion.id]: answerId,
        }))
    }

    function goNext() {
        if (!isCurrentQuestionLocked) return

        if (currentQuestionIndex >= totalQuestions - 1) {
            setIsFinished(true)
            return
        }

        setCurrentQuestionIndex((current) => current + 1)
    }

    function restartPractice() {
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
            <PracticeHeader auth={auth} studentTest={studentTest} />

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
                        <span className="score-badge">{formatScore(currentQuestion.score)} điểm</span>
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

function PracticeHeader({ auth, studentTest }) {
    return (
        <header className="practice-topbar">
            <div>
                <p className="eyebrow">{APP_NAME}</p>
                <strong>{studentTest.testName}</strong>
                <span>{auth.displayName}</span>
            </div>
            <span className="practice-mode-pill">Luyện tập</span>
        </header>
    )
}

function PracticeResultView({
    auth,
    formatScore,
    onReset,
    onRestart,
    questions,
    selectedAnswers,
    studentTest,
    summary,
}) {
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

                    <div className="question-stack">
                        {questions.map((question, index) => {
                            const selectedAnswerId = selectedAnswers[question.id]
                            const selectedAnswer = question.answers.find((answer) => answer.id === selectedAnswerId)

                            return (
                                <article
                                    className={`question-block review-question ${selectedAnswer?.isCorrect ? 'correct' : 'incorrect'}`}
                                    key={question.id}
                                >
                                    <div className="question-head review-question-head">
                                        <div>
                                            <h3>Câu {index + 1}</h3>
                                            <p className="question-content">{question.content}</p>
                                        </div>
                                        <div className="review-score">
                                            <span>Điểm đạt</span>
                                            <strong>{formatScore(selectedAnswer?.isCorrect ? question.score : 0)}</strong>
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
