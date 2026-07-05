import { useState } from 'react'
import { useArenaSocket } from '../../hooks/useArenaSocket'

export function StudentArena({ onClose }) {
    const [pin, setPin] = useState('')
    const [name, setName] = useState('')
    const [joined, setJoined] = useState(false)

    const {
        roomState,
        error,
        setError,
        joinRoom,
        submitAnswer,
    } = useArenaSocket()

    const handleJoin = (e) => {
        e.preventDefault()
        if (!pin.trim() || !name.trim()) {
            setError('Vui lòng nhập đầy đủ mã PIN và tên của bạn')
            return
        }
        setError(null)
        joinRoom(pin.trim(), name.trim(), 'player')
        setJoined(true)
    }

    const hasJoined = joined && !error

    // State 1: Join Screen
    if (!hasJoined || !roomState) {
        return (
            <div className="bg-gradient-to-br from-purple-800 to-indigo-900 text-white min-h-[500px] rounded-xl shadow-2xl p-6 flex flex-col justify-center items-center">
                <div className="w-full max-w-sm text-center">
                    <h1 className="text-4xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-amber-400 mb-2">
                        ĐẤU TRƯỜNG
                    </h1>
                    <p className="text-purple-200 text-sm mb-6">Nhập mã PIN từ giáo viên để tham gia thi đấu</p>

                    {error && (
                        <div className="bg-red-500 bg-opacity-20 border border-red-500 text-red-200 p-3 rounded-lg text-sm mb-4">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleJoin} className="space-y-4">
                        <div>
                            <input
                                type="text"
                                placeholder="MÃ PIN (Ví dụ: 123456)"
                                value={pin}
                                onChange={(e) => setPin(e.target.value)}
                                className="w-full bg-white text-gray-800 border-2 border-purple-400 rounded-xl px-4 py-3.5 text-center text-xl font-bold tracking-widest placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-purple-300 transition"
                            />
                        </div>
                        <div>
                            <input
                                type="text"
                                placeholder="BIỆT DANH / TÊN CỦA BẠN"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full bg-white text-gray-800 border-2 border-purple-400 rounded-xl px-4 py-3.5 text-center text-lg font-extrabold placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-purple-300 transition"
                            />
                        </div>

                        <button
                            type="submit"
                            className="w-full bg-yellow-400 hover:bg-yellow-300 text-purple-950 font-black text-lg uppercase py-4 rounded-xl shadow-lg transform active:scale-95 transition"
                        >
                            Tham gia ngay
                        </button>
                    </form>

                    <button
                        onClick={onClose}
                        className="mt-6 text-purple-300 hover:text-white text-sm transition"
                    >
                        Quay lại trang chủ
                    </button>
                </div>
            </div>
        )
    }

    const {
        currentQuestionIndex,
        totalQuestions,
        showAnswers,
        currentPlayer,
        currentQuestion,
        leaderboard,
        gameOver
    } = roomState

    // State 2: Game Over Screen
    if (gameOver) {
        // Find player position in leaderboard
        const myRankInfo = leaderboard?.find((p) => p.name === currentPlayer?.name)
        return (
            <div className="bg-gradient-to-br from-indigo-950 to-purple-900 text-white p-8 rounded-xl shadow-2xl min-h-[500px] flex flex-col justify-between items-center text-center">
                <div>
                    <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-amber-500 mb-4">👑 KẾT THÚC TRÒ CHƠI 👑</h1>
                    <p className="text-lg text-gray-300 mb-8">Bạn đã hoàn thành chặng đua đấu trường!</p>
                </div>

                <div className="bg-white bg-opacity-10 border border-white/20 p-6 rounded-2xl w-full max-w-sm mb-6">
                    <p className="text-sm uppercase tracking-widest text-purple-300 font-bold mb-1">Kết quả của bạn</p>
                    <h2 className="text-3xl font-black text-yellow-300 mb-3">{currentPlayer?.score || 0} Điểm</h2>
                    {myRankInfo && (
                        <div className="text-xl">
                            Hạng <span className="text-2xl font-black text-green-400">#{myRankInfo.rank}</span> chung cuộc
                        </div>
                    )}
                </div>

                <button
                    onClick={onClose}
                    className="px-8 py-3 bg-red-600 hover:bg-red-500 rounded-xl text-lg font-bold transition shadow-lg"
                >
                    Rời phòng thi đấu
                </button>
            </div>
        )
    }

    // State 3: Waiting for Host to start first question
    if (currentQuestionIndex === -1) {
        return (
            <div className="bg-gradient-to-br from-purple-900 to-indigo-800 text-white p-8 rounded-xl shadow-2xl min-h-[500px] flex flex-col justify-center items-center text-center">
                <div className="animate-bounce text-6xl mb-4">🎮</div>
                <h2 className="text-2xl font-black mb-2">Đã kết nối thành công!</h2>
                <p className="text-purple-200 text-sm mb-6">Bạn đang ở trong phòng chờ với biệt danh <span className="font-bold text-yellow-300">{currentPlayer?.name}</span></p>

                <div className="bg-black bg-opacity-20 border border-purple-700 rounded-xl p-4 py-6 max-w-xs w-full mb-8">
                    <p className="text-xs text-purple-300 uppercase tracking-widest font-bold">Mã phòng</p>
                    <h1 className="text-4xl font-black text-white">{pin}</h1>
                </div>

                <div className="flex items-center space-x-2 text-yellow-400 text-sm font-bold animate-pulse">
                    <span className="h-2 w-2 rounded-full bg-yellow-400"></span>
                    <span>Đang đợi giáo viên bắt đầu trò chơi...</span>
                </div>
            </div>
        )
    }

    // Answer options colors/shapes/styles
    const optionThemes = [
        { bg: 'bg-red-500 hover:bg-red-600 active:bg-red-700', text: 'text-white', symbol: '▲' },
        { bg: 'bg-blue-500 hover:bg-blue-600 active:bg-blue-700', text: 'text-white', symbol: '■' },
        { bg: 'bg-yellow-500 hover:bg-yellow-600 active:bg-yellow-700', text: 'text-white', symbol: '●' },
        { bg: 'bg-green-500 hover:bg-green-600 active:bg-green-700', text: 'text-white', symbol: '✦' }
    ]

    // State 4: Playing - Question Active
    if (!showAnswers) {
        const hasAnswered = currentPlayer?.hasAnswered

        return (
            <div className="bg-slate-900 text-white p-6 rounded-xl shadow-2xl min-h-[520px] flex flex-col justify-between">
                {/* Score & Progress Bar */}
                <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-800">
                    <div>
                        <span className="text-xs text-indigo-400 uppercase font-black">Câu hỏi {currentQuestionIndex + 1} / {totalQuestions}</span>
                        <h3 className="text-sm font-semibold text-gray-400">{currentPlayer?.name}</h3>
                    </div>
                    <div className="text-right">
                        <span className="text-xs text-gray-500 block">ĐIỂM SỐ</span>
                        <span className="text-xl font-black text-yellow-400">{currentPlayer?.score || 0}đ</span>
                    </div>
                </div>

                {/* Content Box */}
                <div className="flex-1 flex flex-col justify-center my-4 text-center">
                    {!hasAnswered ? (
                        <>
                            <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700 mb-6">
                                <h2 className="text-xl sm:text-2xl font-bold leading-relaxed">{currentQuestion?.content}</h2>
                            </div>

                            {/* 4 Large Box Colors for answer input */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {currentQuestion?.answers.map((answer, index) => {
                                    const theme = optionThemes[index % 4]
                                    return (
                                        <button
                                            key={answer.id}
                                            onClick={() => submitAnswer(answer.id)}
                                            className={`${theme.bg} ${theme.text} p-6 rounded-2xl flex items-center justify-center space-x-3 shadow-lg hover:scale-102 transform active:scale-98 transition font-bold text-lg min-h-[80px] border-b-4 border-black/20`}
                                        >
                                            <span className="bg-white bg-opacity-20 rounded-lg h-8 w-8 flex items-center justify-center text-lg font-black">
                                                {theme.symbol}
                                            </span>
                                            <span>{answer.content}</span>
                                        </button>
                                    )
                                })}
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center space-y-4 py-12">
                            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-yellow-400 mb-2"></div>
                            <h2 className="text-2xl font-black text-yellow-300">ĐÃ GỬI ĐÁP ÁN!</h2>
                            <p className="text-slate-400">Đang chờ các bạn khác trả lời hoặc giáo viên khóa câu hỏi...</p>
                        </div>
                    )}
                </div>

                {/* Status bar */}
                <div className="mt-4 pt-2 text-center text-xs text-slate-500">
                    Cố gắng trả lời thật nhanh để nhận điểm thưởng tối đa!
                </div>
            </div>
        )
    }

    // State 5: Result Screen (After Host closes the question)
    const isCorrect = currentPlayer?.lastAnswerCorrect
    const selectedAnswerObj = currentQuestion?.answers.find((a) => a.id === currentPlayer?.selectedAnswerId)

    return (
        <div className={`p-6 rounded-xl shadow-2xl min-h-[520px] flex flex-col justify-between text-white ${
            isCorrect ? 'bg-gradient-to-br from-green-800 to-emerald-900' : 'bg-gradient-to-br from-red-800 to-rose-950'
        }`}>
            {/* Top Bar */}
            <div className="flex justify-between items-center pb-3 border-b border-white/10">
                <span className="text-xs uppercase font-black tracking-widest text-white/70">KẾT QUẢ CÂU {currentQuestionIndex + 1}</span>
                <span className="text-lg font-black text-yellow-300">{currentPlayer?.score || 0}đ</span>
            </div>

            {/* Results Announcement */}
            <div className="flex-1 flex flex-col justify-center items-center text-center my-6 space-y-4">
                <div className="text-6xl">{isCorrect ? '🎉' : '❌'}</div>
                <h1 className="text-4xl font-black tracking-wide">
                    {isCorrect ? 'CHÍNH XÁC!' : 'SAI MẤT RỒI!'}
                </h1>
                
                {isCorrect ? (
                    <div className="bg-white/15 px-6 py-3 rounded-full text-lg font-extrabold animate-bounce-slow text-yellow-300">
                        +{currentPlayer?.scoreDelta} Điểm thưởng! ⚡
                    </div>
                ) : (
                    <div className="bg-white/10 px-6 py-3 rounded-full text-sm text-gray-200">
                        +0 Điểm. Hãy cố gắng ở câu tiếp theo!
                    </div>
                )}

                <div className="max-w-xs bg-black/20 p-4 rounded-xl text-left text-sm space-y-2 mt-4 w-full">
                    <p className="text-white/60 font-semibold text-xs uppercase">Lựa chọn của bạn:</p>
                    <p className="font-bold text-white">
                        {selectedAnswerObj ? selectedAnswerObj.content : 'Không đưa ra câu trả lời'}
                    </p>
                </div>
            </div>

            {/* Footer status */}
            <div className="text-center text-xs text-white/50 animate-pulse">
                Hãy chú ý màn hình của giáo viên để xem câu hỏi tiếp theo!
            </div>
        </div>
    )
}
