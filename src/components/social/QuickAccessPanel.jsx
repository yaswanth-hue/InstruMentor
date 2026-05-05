import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Music, X, Users, BookOpen, Mic, Play } from 'lucide-react';

const QuickAccessPanel = ({ show, onClose }) => {
    const navigate = useNavigate();

    if (!show) return null;

    const navigateTo = (path) => {
        navigate(path);
        onClose();
    };

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
                onClick={onClose}
            ></div>

            {/* Panel */}
            <div className="fixed top-0 left-0 h-full bg-white/95 backdrop-blur-xl shadow-2xl z-50 animate-slide-in-left">
                <div className="p-6 h-full overflow-y-auto">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-2xl flex items-center justify-center">
                                <Music className="w-6 h-6 text-white" />
                            </div>
                            Quick Access
                        </h2>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-indigo-50 rounded-xl transition-colors"
                        >
                            <X className="w-5 h-5 text-gray-600" />
                        </button>
                    </div>
                    <div className="space-y-3 min-w-[280px]">
                        <button
                            onClick={() => navigateTo('/users')}
                            className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-5 py-4 rounded-2xl flex items-center gap-3 transition-all shadow-lg hover:shadow-xl hover:scale-105 font-semibold"
                        >
                            <Users className="w-5 h-5" />
                            Discover Musicians
                        </button>
                        <button
                            onClick={() => navigateTo('/courses')}
                            className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white px-5 py-4 rounded-2xl flex items-center gap-3 transition-all shadow-lg hover:shadow-xl hover:scale-105 font-semibold"
                        >
                            <BookOpen className="w-5 h-5" />
                            Browse Courses
                        </button>
                        <button
                            onClick={() => navigateTo('/audio-rooms')}
                            className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white px-5 py-4 rounded-2xl flex items-center gap-3 transition-all shadow-lg hover:shadow-xl hover:scale-105 font-semibold"
                        >
                            <Mic className="w-5 h-5" />
                            Join Audio Rooms
                        </button>
                        <button
                            onClick={() => navigateTo('/original-home')}
                            className="w-full bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white px-5 py-4 rounded-2xl flex items-center gap-3 transition-all shadow-lg hover:shadow-xl hover:scale-105 font-semibold"
                        >
                            <Play className="w-5 h-5" />
                            Virtual Instruments
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};

export default QuickAccessPanel;
