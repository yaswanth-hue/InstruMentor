import React from 'react';
import { TrendingUp, X, Hash } from 'lucide-react';

const TrendingPanel = ({ show, onClose, trendingHashtags }) => {
    if (!show) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
                onClick={onClose}
            ></div>

            {/* Panel */}
            <div className="fixed top-0 right-0 h-full bg-slate-900/95 border-l border-slate-700 backdrop-blur-xl shadow-2xl z-50 animate-slide-in-right">
                <div className="p-6 h-full overflow-y-auto">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-bold text-slate-100 flex items-center gap-3">
                            <div className="w-10 h-10 bg-slate-800 border border-sky-400/30 rounded-2xl flex items-center justify-center">
                                <TrendingUp className="w-6 h-6 text-white" />
                            </div>
                            Trending Now
                        </h2>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-slate-800 rounded-xl transition-colors"
                        >
                            <X className="w-5 h-5 text-slate-300" />
                        </button>
                    </div>
                    <div className="space-y-4 min-w-[280px] max-w-[350px]">
                        {trendingHashtags.length > 0 ? (
                            trendingHashtags.map((item, index) => {
                                return (
                                    <div key={item.tag} className="p-5 bg-slate-800/70 rounded-2xl border border-slate-700 hover:bg-slate-800 transition-all cursor-pointer group">
                                        <div className="flex items-center gap-3 mb-2">
                                            <Hash className="w-5 h-5 text-sky-300 font-bold" />
                                            <p className="text-base font-bold text-sky-300">
                                                {item.tag.substring(1)}
                                            </p>
                                        </div>
                                        <p className="text-sm text-slate-300 font-semibold">
                                            {item.count} {item.count === 1 ? 'post' : 'posts'}
                                        </p>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="p-6 bg-slate-800/70 border border-slate-700 rounded-2xl text-center">
                                <Hash className="w-8 h-8 text-slate-500 mx-auto mb-3" />
                                <p className="text-sm text-slate-400 font-medium">No trending hashtags yet</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};

export default TrendingPanel;
