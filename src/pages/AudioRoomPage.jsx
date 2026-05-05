import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../firebase';
import AudioRoomComponent from '../components/AudioRoomComponent';
import { LogIn } from 'lucide-react';

const AudioRoomPage = () => {
  const { roomId } = useParams();
  const [user, loading] = useAuthState(auth);
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-100 flex items-center justify-center" style={{width: '100%', maxWidth: 'none'}}>
        <div className="text-center">
          <div className="relative">
            <div className="w-20 h-20 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <svg className="w-8 h-8 text-purple-600 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" />
              </svg>
            </div>
          </div>
          <p className="mt-6 text-gray-600 font-medium">Authenticating...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-100 flex items-center justify-center p-4" style={{width: '100%', maxWidth: 'none'}}>
        <div className="max-w-md w-full">
          <div className="bg-white rounded-2xl shadow-2xl p-8 text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-red-500 to-pink-500 rounded-full mx-auto flex items-center justify-center mb-6">
              <LogIn className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-3">Authentication Required</h2>
            <p className="text-gray-600 mb-6">
              Please log in to join the audio room and collaborate with other musicians.
            </p>
            <button
              onClick={() => navigate('/login', { state: { from: `/audio-room/${roomId}` } })}
              className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center space-x-2"
            >
              <LogIn className="w-5 h-5" />
              <span>Log In to Continue</span>
            </button>
            <button
              onClick={() => navigate('/audio-rooms')}
              className="w-full mt-3 px-6 py-3 border-2 border-gray-300 hover:border-purple-400 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-all duration-200"
            >
              Back to Rooms
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AudioRoomComponent
      roomId={roomId}
      userId={user.uid}
      userName={user.displayName || user.email}
      userEmail={user.email}
      isHost={false}
    />
  );
};

export default AudioRoomPage;
