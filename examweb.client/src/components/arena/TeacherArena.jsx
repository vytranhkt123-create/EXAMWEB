import { useEffect, useState } from 'react'
import { useArenaSocket } from '../../hooks/useArenaSocket'
import { arenaApi } from '../../services/api'

export function TeacherArena({ testId, onClose }) {
    const [roomId, setRoomId] = useState(null)
    const [creatingRoom, setCreatingRoom] = useState(false)
    const [apiError, setApiError] = useState(null)
    
    const {
        isConnected,
        roomState,
        error: socketError,
        joinRoom,
        nextQuestion,
        showResults,
    } = useArenaSocket()

    const error = apiError || socketError

    // Step 1: Create the room via REST API
    useEffect(() => {
        if (!testId) return

        let cancelled = false

        Promise.resolve()
            .then(() => {
                if (cancelled) return null

                setCreatingRoom(true)
                setApiError(null)
                return arenaApi(`/create/${encodeURIComponent(testId)}`, { method: 'POST' })
            })
            .then((data) => {
                if (!data || cancelled) return
                setRoomId(data.roomId)
            })
            .catch((err) => {
                if (cancelled) return
                console.error('Error creating arena room:', err)
                setApiError(err.message || 'Không thể tạo phòng đấu trường')
            })
            .finally(() => {
                if (cancelled) return
                setCreatingRoom(false)
            })

        return () => {
            cancelled = true
        }
    }, [testId])

    // Step 2: Join room as host once WebSocket is connected and roomId is acquired
    useEffect(() => {
        if (isConnected && roomId) {
            joinRoom(roomId, 'Giáo viên', 'host')
        }
    }, [isConnected, roomId, joinRoom])

    if (creatingRoom) {
        return (
            <div className="arena-container flex flex-col items-center justify-center p-8 min-h-[500px]">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500 mb-4"></div>
                <h3 className="text-xl font-semibold text-gray-700">Đang khởi tạo phòng thi đấu...</h3>
            </div>
        )
    }

    if (error) {
        return (
            <div className="arena-container p-8 max-w-md mx-auto text-center">
                <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4 rounded shadow-sm">
                    <p className="text-red-700 font-medium">Lỗi xảy ra:</p>
                    <p className="text-red-600 text-sm">{error}</p>
                </div>
                <button
                    onClick={onClose}
                    className="px-6 py-2 bg-indigo-600 text-white rounded font-medium hover:bg-indigo-700 transition"
                >
                    Quay lại
                </button>
            </div>
        )
    }

    if (!roomState) {
        return (
            <div className="arena-container flex flex-col items-center justify-center p-8 min-h-[500px]">
                <div className="animate-pulse flex space-x-4">
                    <div className="flex-1 space-y-4 py-1">
                        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                        <div className="space-y-2">
                            <div className="h-4 bg-gray-200 rounded"></div>
                            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                        </div>
                    </div>
                </div>
                <h3 className="text-xl font-semibold text-gray-500 mt-4">Đang kết nối tới đấu trường...</h3>
            </div>
        )
    }

    const {
        currentQuestionIndex,
        totalQuestions,
        showAnswers,
        players = [],
        currentQuestion,
        answeredCount,
        totalPlayers,
        leaderboard = [],
        gameOver,
    } = roomState

    // Render 1: Lobby (Waiting for players)
    if (currentQuestionIndex === -1) {
        return (
            <div className="bg-gradient-to-br from-indigo-900 to-purple-800 text-white p-8 rounded-xl shadow-2xl min-h-[550px] flex flex-col justify-between">
                <div className="text-center">
                    <div className="flex justify-between items-center mb-6">
                        <span className="bg-purple-700 text-purple-200 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider">Lobby</span>
                        <button onClick={onClose} className="text-gray-400 hover:text-white text-sm">Thoát</button>
                    </div>
                    <h2 className="text-2xl font-bold mb-2">Đấu trường Real-time: {roomState.testName}</h2>
                    <p className="text-gray-300 text-sm mb-6">Yêu cầu học sinh truy cập mục "Đấu trường" và nhập mã PIN dưới đây</p>

                    <div className="bg-white text-indigo-900 p-6 rounded-2xl inline-block shadow-lg border-4 border-purple-400 mb-8 transform hover:scale-105 transition duration-300">
                        <p className="text-xs uppercase tracking-widest text-gray-500 font-bold mb-1">MÃ PIN PHÒNG THI</p>
                        <h1 className="text-6xl font-black tracking-widest">{roomId}</h1>
                    </div>
                </div>

                <div className="flex-1 my-6 max-h-[220px] overflow-y-auto bg-black bg-opacity-20 rounded-xl p-4 border border-purple-700">
                    <h4 className="text-sm font-semibold text-purple-300 mb-3 flex justify-between">
                        <span>Danh sách học sinh đang chờ ({players.length})</span>
                        {players.length === 0 && <span className="animate-pulse text-yellow-400 text-xs">Đang chờ người tham gia...</span>}
                    </h4>
                    {players.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-32 text-gray-400">
                            <span className="text-4xl mb-2">👥</span>
                            <p className="text-sm">Chưa có ai tham gia phòng đấu trường</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                            {players.map((p) => (
                                <div key={p.connectionId} className="bg-purple-800 bg-opacity-60 border border-purple-600 rounded-lg py-2 px-3 flex items-center space-x-2 shadow-sm animate-bounce-slow">
                                    <span className="h-2 w-2 rounded-full bg-green-400"></span>
                                    <span className="font-medium text-sm truncate">{p.name}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="flex justify-center">
                    <button
                        onClick={nextQuestion}
                        disabled={players.length === 0}
                        className={`px-12 py-4 rounded-xl text-lg font-black shadow-lg uppercase tracking-wide transform active:scale-95 transition-all ${
                            players.length === 0
                                ? 'bg-gray-600 cursor-not-allowed text-gray-400'
                                : 'bg-green-500 hover:bg-green-400 text-white hover:shadow-green-500/50'
                        }`}
                    >
                        Bắt đầu trò chơi
                    </button>
                </div>
            </div>
        )
    }

    // Render 2: Game Over Screen
    if (gameOver) {
        return (
            <div className="bg-gradient-to-br from-indigo-950 via-purple-900 to-indigo-900 text-white p-8 rounded-xl shadow-2xl min-h-[550px] flex flex-col justify-between">
                <div className="text-center">
                    <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-amber-500 mb-2 animate-pulse">👑 TRẬN ĐẤU KẾT THÚC 👑</h1>
                    <p className="text-gray-300 mb-6">Xin chúc mừng các bạn học sinh xuất sắc nhất!</p>
                </div>

                <div className="flex-1 max-w-lg mx-auto w-full my-6 bg-black bg-opacity-30 rounded-2xl p-6 border border-purple-500/30">
                    <h3 className="text-xl font-bold text-yellow-400 mb-4 text-center">BẢNG VÀNG DANH DỰ</h3>
                    <div className="space-y-3">
                        {leaderboard.slice(0, 5).map((player) => (
                            <div
                                key={player.name}
                                className={`flex justify-between items-center p-3 rounded-xl border ${
                                    player.rank === 1
                                        ? 'bg-yellow-500 bg-opacity-20 border-yellow-500'
                                        : player.rank === 2
                                        ? 'bg-gray-300 bg-opacity-20 border-gray-400'
                                        : player.rank === 3
                                        ? 'bg-amber-700 bg-opacity-20 border-amber-800'
                                        : 'bg-purple-800 bg-opacity-20 border-purple-700'
                                }`}
                            >
                                <div className="flex items-center space-x-4">
                                    <span className="text-2xl font-black w-8 text-center">
                                        {player.rank === 1 ? '🥇' : player.rank === 2 ? '🥈' : player.rank === 3 ? '🥉' : `${player.rank}`}
                                    </span>
                                    <span className="font-bold text-lg">{player.name}</span>
                                </div>
                                <div className="text-right">
                                    <p className="font-extrabold text-xl text-yellow-300">{player.score}đ</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex justify-center space-x-4">
                    <button
                        onClick={onClose}
                        className="px-8 py-3 bg-red-600 hover:bg-red-500 rounded-xl text-lg font-bold shadow-lg transition"
                    >
                        Đóng đấu trường
                    </button>
                </div>
            </div>
        )
    }

    // Answer options colors/shapes (A: Red, B: Blue, C: Yellow, D: Green)
    const optionThemes = [
        { bg: 'bg-red-500 hover:bg-red-600', border: 'border-red-600', symbol: '▲', color: 'red' },
        { bg: 'bg-blue-500 hover:bg-blue-600', border: 'border-blue-600', symbol: '■', color: 'blue' },
        { bg: 'bg-yellow-500 hover:bg-yellow-600', border: 'border-yellow-600', symbol: '●', color: 'yellow' },
        { bg: 'bg-green-500 hover:bg-green-600', border: 'border-green-600', symbol: '✦', color: 'green' }
    ]

    // Render 3 & 4: Playing and Results view
    return (
        <div className="bg-slate-900 text-white p-6 rounded-xl shadow-2xl min-h-[580px] flex flex-col justify-between">
            {/* Top Bar */}
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-800">
                <div>
                    <span className="text-xs text-indigo-400 uppercase font-black tracking-widest">Câu hỏi {currentQuestionIndex + 1} / {totalQuestions}</span>
                    <h3 className="text-sm font-semibold text-gray-400">{roomState.testName} (PIN: {roomId})</h3>
                </div>
                <div className="flex items-center space-x-4">
                    <div className="text-center px-4 py-1.5 bg-slate-800 rounded-lg border border-slate-700">
                        <p className="text-xs text-gray-400 uppercase">Đã nộp bài</p>
                        <h4 className="text-lg font-black text-green-400">{answeredCount} / {totalPlayers}</h4>
                    </div>
                </div>
            </div>

            {/* Question Box */}
            <div className="flex-1 flex flex-col justify-center my-4">
                <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-inner mb-6 text-center">
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-wide leading-snug">
                        {currentQuestion?.content}
                    </h1>
                </div>

                {/* Choices or Results screen */}
                {!showAnswers ? (
                    // Playing: Show 4 answers
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {currentQuestion?.answers.map((answer, index) => {
                            const theme = optionThemes[index % 4]
                            return (
                                <div
                                    key={answer.id}
                                    className={`${theme.bg} p-4 rounded-xl flex items-center space-x-4 shadow-md border-b-4 ${theme.border} transform transition`}
                                >
                                    <span className="bg-white bg-opacity-20 text-white rounded-lg h-10 w-10 flex items-center justify-center text-xl font-black">
                                        {theme.symbol}
                                    </span>
                                    <span className="text-lg font-bold truncate">{answer.content}</span>
                                </div>
                            )
                        })}
                    </div>
                ) : (
                    // Question Ended: Review & Leaderboard
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        {/* Correct answer display */}
                        <div className="lg:col-span-7 space-y-3">
                            <h3 className="text-lg font-bold text-yellow-400 flex items-center">
                                <span className="mr-2">💡</span> Kết quả câu hỏi:
                            </h3>
                            {currentQuestion?.answers.map((answer, index) => {
                                const theme = optionThemes[index % 4]
                                return (
                                    <div
                                        key={answer.id}
                                        className={`p-3 rounded-xl flex items-center justify-between border ${
                                            answer.isCorrect
                                                ? 'bg-green-600 bg-opacity-20 border-green-500 text-green-200 font-extrabold'
                                                : 'bg-slate-800 bg-opacity-50 border-slate-700 text-slate-400 line-through'
                                        }`}
                                    >
                                        <div className="flex items-center space-x-3">
                                            <span className={`h-8 w-8 rounded-lg flex items-center justify-center font-bold text-sm ${answer.isCorrect ? 'bg-green-500 text-white' : 'bg-slate-700 text-slate-300'}`}>
                                                {theme.symbol}
                                            </span>
                                            <span>{answer.content}</span>
                                        </div>
                                        {answer.isCorrect && <span className="text-sm bg-green-500 text-white px-2 py-0.5 rounded font-black">ĐÚNG</span>}
                                    </div>
                                )
                            })}
                        </div>

                        {/* Current Question Leaderboard Top 5 */}
                        <div className="lg:col-span-5 bg-slate-800 bg-opacity-60 rounded-xl p-4 border border-slate-700">
                            <h3 className="text-md font-bold text-purple-400 mb-3 flex items-center justify-between">
                                <span>Bảng xếp hạng hiện tại</span>
                                <span className="text-xs bg-purple-900 text-purple-200 px-2 py-0.5 rounded">Top 5</span>
                            </h3>
                            <div className="space-y-2">
                                {leaderboard.slice(0, 5).map((player) => (
                                    <div key={player.name} className="flex justify-between items-center text-sm p-2 rounded bg-slate-900 bg-opacity-40 border border-slate-800">
                                        <div className="flex items-center space-x-2 truncate">
                                            <span className="font-extrabold text-indigo-400 w-4">{player.rank}.</span>
                                            <span className="font-semibold truncate">{player.name}</span>
                                            {player.scoreDelta > 0 && <span className="text-xs text-green-400 font-black">+{player.scoreDelta}</span>}
                                        </div>
                                        <span className="font-extrabold text-yellow-400">{player.score}đ</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Teacher Control Bar */}
            <div className="mt-4 pt-3 border-t border-slate-800 flex justify-between items-center">
                <button
                    onClick={onClose}
                    className="px-5 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 text-sm font-bold transition"
                >
                    Kết thúc đấu trường
                </button>

                {!showAnswers ? (
                    <button
                        onClick={showResults}
                        className="px-8 py-3 bg-red-600 hover:bg-red-500 text-white rounded-lg font-black tracking-wide shadow-lg transform active:scale-95 transition"
                    >
                        Chốt đáp án & Hiện kết quả
                    </button>
                ) : (
                    <button
                        onClick={nextQuestion}
                        className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-black tracking-wide shadow-lg transform active:scale-95 transition"
                    >
                        {currentQuestionIndex + 1 === totalQuestions ? 'Xem kết quả chung cuộc' : 'Câu tiếp theo ➜'}
                    </button>
                )}
            </div>
        </div>
    )
}
