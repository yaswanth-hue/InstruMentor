import React from 'react';
import { Camera, PlusCircle, User } from 'lucide-react';

const StoriesBar = ({ stories, onOpenStory, onCreateStory }) => {
    return (
        <div className="bg-zinc-950/60 backdrop-blur-2xl border-b border-white/5">
            <div className="w-full px-3 sm:px-4 lg:px-6 py-4 sm:py-5" style={{ width: '100%', maxWidth: 'none' }}>
                <div className="flex items-center gap-4 overflow-x-auto pb-2 px-1 [scrollbar-width:thin]">
                    {/* Create Update Button */}
                    <div className="flex-shrink-0">
                        <button
                            onClick={onCreateStory}
                            className="group relative flex flex-col items-center"
                        >
                            <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-zinc-900 border border-sky-400/30 flex items-center justify-center transition-transform duration-300 shadow-lg shadow-black/40 group-hover:-translate-y-0.5 group-hover:border-sky-300/50">
                                <Camera className="w-8 h-8 sm:w-10 sm:h-10 text-sky-300" />
                                <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-zinc-950 rounded-full flex items-center justify-center ring-2 ring-sky-400/30 shadow-lg">
                                    <PlusCircle className="w-5 h-5 text-sky-300" />
                                </div>
                            </div>
                            <p className="text-xs sm:text-sm font-semibold text-zinc-200 mt-2.5">Your Update</p>
                        </button>
                    </div>

                    {/* Stories from other users */}
                    {Object.entries(stories).map(([userId, storyData]) => (
                        <div key={userId} className="flex-shrink-0">
                            <button
                                onClick={() => onOpenStory(userId)}
                                className="group relative flex flex-col items-center"
                            >
                                <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-3xl p-[2px] bg-gradient-to-tr from-sky-500 to-cyan-500 transition-transform duration-300 shadow-lg shadow-black/40 group-hover:-translate-y-0.5">
                                    <div className="w-full h-full rounded-[22px] overflow-hidden bg-zinc-900 flex items-center justify-center border border-sky-400/20">
                                        {storyData.userInfo?.profilePic ? (
                                            <img
                                                src={storyData.userInfo.profilePic}
                                                alt={storyData.userInfo.displayName}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-full h-full bg-gradient-to-br from-zinc-800 to-zinc-900 flex items-center justify-center">
                                                <User className="w-7 h-7 sm:w-8 sm:h-8 text-zinc-300" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <p className="text-xs sm:text-sm font-medium text-zinc-300 mt-2.5 truncate max-w-[90px]">
                                    {storyData.userInfo?.displayName || 'User'}
                                </p>
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default StoriesBar;
