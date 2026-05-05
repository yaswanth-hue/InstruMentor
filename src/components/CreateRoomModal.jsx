import React, { useState } from 'react';
import { X, Lock, Users, MessageSquare, Image } from 'lucide-react';
import bcrypt from 'bcryptjs';

const CreateRoomModal = ({ isOpen, onClose, onCreateRoom, user }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    maxParticipants: 10,
    allowChat: true,
    allowMedia: false,
    isPrivate: false,
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!formData.title.trim()) {
      setError('Room title is required');
      return;
    }

    if (formData.isPrivate) {
      if (!formData.password) {
        setError('Password is required for private rooms');
        return;
      }
      if (formData.password.length < 6) {
        setError('Password must be at least 6 characters');
        return;
      }
      if (formData.password !== formData.confirmPassword) {
        setError('Passwords do not match');
        return;
      }
    }

    setIsCreating(true);

    try {
      let passwordHash = null;
      if (formData.isPrivate && formData.password) {
        const salt = await bcrypt.genSalt(10);
        passwordHash = await bcrypt.hash(formData.password, salt);
      }

      const response = await fetch('http://localhost:3001/api/audio-rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: formData.title.trim(),
          description: formData.description.trim(),
          host_id: user.uid,
          host_name: user.displayName || user.email,
          max_participants: parseInt(formData.maxParticipants),
          allow_chat: formData.allowChat,
          allow_media: formData.allowMedia,
          is_private: formData.isPrivate,
          password_hash: passwordHash
        })
      });

      if (response.ok) {
        const newRoom = await response.json();
        onCreateRoom(newRoom);
        onClose();
        // Reset form
        setFormData({
          title: '',
          description: '',
          maxParticipants: 10,
          allowChat: true,
          allowMedia: false,
          isPrivate: false,
          password: '',
          confirmPassword: ''
        });
      } else {
        throw new Error('Failed to create room');
      }
    } catch (err) {
      setError('Error creating room: ' + err.message);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-slideUp">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-purple-600 to-blue-600 text-white p-6 rounded-t-2xl flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Create Audio Room</h2>
            <p className="text-purple-100 text-sm mt-1">Set up your collaborative space</p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-all duration-200"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg animate-shake">
              <p className="text-red-700 text-sm font-medium">{error}</p>
            </div>
          )}

          {/* Room Title */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Room Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="e.g., Jazz Session, Guitar Practice"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 transition-colors duration-200"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Description (Optional)
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Tell others what this room is about..."
              rows="3"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 transition-colors duration-200 resize-none"
            />
          </div>

          {/* Max Participants */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              <Users className="w-4 h-4 inline mr-1" />
              Maximum Participants
            </label>
            <select
              name="maxParticipants"
              value={formData.maxParticipants}
              onChange={handleChange}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 transition-colors duration-200"
            >
              <option value="5">5 participants</option>
              <option value="10">10 participants</option>
              <option value="20">20 participants</option>
              <option value="50">50 participants</option>
              <option value="100">100 participants</option>
            </select>
          </div>

          {/* Room Features */}
          <div className="space-y-3">
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Room Features
            </label>

            {/* Allow Chat */}
            <label className="flex items-center p-4 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-purple-300 hover:bg-purple-50 transition-all duration-200">
              <input
                type="checkbox"
                name="allowChat"
                checked={formData.allowChat}
                onChange={handleChange}
                className="w-5 h-5 text-purple-600 rounded focus:ring-2 focus:ring-purple-500"
              />
              <MessageSquare className="w-5 h-5 ml-3 mr-2 text-purple-600" />
              <div className="flex-1">
                <span className="font-medium text-gray-800">Enable Chat</span>
                <p className="text-xs text-gray-500 mt-1">Allow participants to send text messages</p>
              </div>
            </label>

            {/* Allow Media */}
            <label className="flex items-center p-4 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-blue-300 hover:bg-blue-50 transition-all duration-200">
              <input
                type="checkbox"
                name="allowMedia"
                checked={formData.allowMedia}
                onChange={handleChange}
                className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
              <Image className="w-5 h-5 ml-3 mr-2 text-blue-600" />
              <div className="flex-1">
                <span className="font-medium text-gray-800">Enable Media Sharing</span>
                <p className="text-xs text-gray-500 mt-1">Allow participants to share images, videos, and files</p>
              </div>
            </label>

            {/* Private Room */}
            <label className="flex items-center p-4 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-yellow-300 hover:bg-yellow-50 transition-all duration-200">
              <input
                type="checkbox"
                name="isPrivate"
                checked={formData.isPrivate}
                onChange={handleChange}
                className="w-5 h-5 text-yellow-600 rounded focus:ring-2 focus:ring-yellow-500"
              />
              <Lock className="w-5 h-5 ml-3 mr-2 text-yellow-600" />
              <div className="flex-1">
                <span className="font-medium text-gray-800">Private Room</span>
                <p className="text-xs text-gray-500 mt-1">Require password to join</p>
              </div>
            </label>
          </div>

          {/* Password Fields (shown only if private) */}
          {formData.isPrivate && (
            <div className="space-y-4 p-4 bg-yellow-50 border-2 border-yellow-200 rounded-lg animate-slideDown">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <Lock className="w-4 h-4 inline mr-1" />
                  Room Password <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Enter password (min 6 characters)"
                  className="w-full px-4 py-3 border-2 border-yellow-300 rounded-lg focus:outline-none focus:border-yellow-500 transition-colors duration-200"
                  minLength="6"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Confirm Password <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="Confirm your password"
                  className="w-full px-4 py-3 border-2 border-yellow-300 rounded-lg focus:outline-none focus:border-yellow-500 transition-colors duration-200"
                  minLength="6"
                />
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-all duration-200"
              disabled={isCreating}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isCreating}
            >
              {isCreating ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Creating...
                </span>
              ) : (
                'Create Room'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateRoomModal;
