import React from 'react';
import { TrendingUp, X, Hash } from 'lucide-react';

const TrendingPanel = ({ show, onClose, trendingHashtags }) => {
    if (!show) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
                onClick={onClose}
            ></div>

            {/* Panel */}
            <div className="fixed top-0 right-0 h-full bg-white/95 backdrop-blur-xl shadow-2xl z-50 animate-slide-in-right">
                <div className="p-6 h-full overflow-y-auto">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-pink-500 rounded-2xl flex items-center justify-center">
                                <TrendingUp className="w-6 h-6 text-white" />
                            </div>
                            Trending Now
                        </h2>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-indigo-50 rounded-xl transition-colors"
                        >
                            <X className="w-5 h-5 text-gray-600" />
                        </button>
                    </div>
                    <div className="space-y-4 min-w-[280px] max-w-[350px]">
                        {trendingHashtags.length > 0 ? (
                            trendingHashtags.map((item, index) => {
                                const gradients = [
                                    'from-indigo-500 to-purple-500',
                                    'from-purple-500 to-pink-500',
                                    'from-pink-500 to-orange-500'
                                ];
                                const bgGradients = [
                                    'from-indigo-50 to-purple-50',
                                    'from-purple-50 to-pink-50',
                                    'from-pink-50 to-orange-50'
                                ];
                                return (
                                    <div key={item.tag} className={`p-5 bg-gradient-to-r ${bgGradients[index]} rounded-2xl border border-indigo-100 hover:shadow-lg transition-all cursor-pointer group`}>
                                        <div className="flex items-center gap-3 mb-2">
                                            <Hash className={`w-5 h-5 bg-gradient-to-r ${gradients[index]} bg-clip-text text-transparent font-bold`} />
                                            <p className={`text-base font-bold bg-gradient-to-r ${gradients[index]} bg-clip-text text-transparent`}>
                                                {item.tag.substring(1)}
                                            </p>
                                        </div>
                                        <p className="text-sm text-indigo-600 font-semibold">
                                            {item.count} {item.count === 1 ? 'post' : 'posts'}
                                        </p>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="p-6 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl text-center">
                                <Hash className="w-8 h-8 text-indigo-300 mx-auto mb-3" />
                                <p className="text-sm text-indigo-400 font-medium">No trending hashtags yet</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};

export default TrendingPanel;
