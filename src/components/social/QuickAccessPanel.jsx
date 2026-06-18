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
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
                onClick={onClose}
            ></div>

            {/* Panel */}
            <div className="fixed top-0 left-0 h-full bg-slate-900/95 border-r border-slate-700 backdrop-blur-xl shadow-2xl z-50 animate-slide-in-left">
                <div className="p-6 h-full overflow-y-auto">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-bold text-slate-100 flex items-center gap-3">
                            <div className="w-10 h-10 bg-slate-800 border border-sky-400/30 rounded-2xl flex items-center justify-center">
                                <Music className="w-6 h-6 text-white" />
                            </div>
                            Quick Access
                        </h2>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-slate-800 rounded-xl transition-colors"
                        >
                            <X className="w-5 h-5 text-slate-300" />
                        </button>
                    </div>
                    <div className="space-y-3 min-w-[280px]">
                        <button
                            onClick={() => navigateTo('/users')}
                            className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white px-5 py-4 rounded-2xl flex items-center gap-3 transition-all font-semibold"
                        >
                            <Users className="w-5 h-5 text-sky-300" />
                            Discover Musicians
                        </button>
                        <button
                            onClick={() => navigateTo('/courses')}
                            className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white px-5 py-4 rounded-2xl flex items-center gap-3 transition-all font-semibold"
                        >
                            <BookOpen className="w-5 h-5 text-sky-300" />
                            Browse Courses
                        </button>
                        <button
                            onClick={() => navigateTo('/audio-rooms')}
                            className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white px-5 py-4 rounded-2xl flex items-center gap-3 transition-all font-semibold"
                        >
                            <Mic className="w-5 h-5 text-sky-300" />
                            Join Audio Rooms
                        </button>
                        <button
                            onClick={() => navigateTo('/original-home')}
                            className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white px-5 py-4 rounded-2xl flex items-center gap-3 transition-all font-semibold"
                        >
                            <Play className="w-5 h-5 text-sky-300" />
                            Virtual Instruments
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};

export default QuickAccessPanel;
