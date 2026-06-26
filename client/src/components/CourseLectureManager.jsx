import React, { useState, useEffect } from 'react';
import {
  Upload,
  Video,
  Play,
  Trash2,
  GripVertical,
  FileVideo,
  CheckCircle,
  AlertCircle,
  Loader,
  X,
  Plus,
  Download
} from 'lucide-react';
import {
  uploadCourseMaterial,
  getCourseMaterials,
  deleteCourseMaterial,
  reorderCourseMaterials,
  auth
} from '../firebase';

const CourseLectureManager = ({ courseId, isInstructor, onMaterialsChange }) => {
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [lectureTitle, setLectureTitle] = useState('');
  const [draggedItem, setDraggedItem] = useState(null);
  const [playingVideo, setPlayingVideo] = useState(null);

  useEffect(() => {
    loadMaterials();
  }, [courseId]);

  const loadMaterials = async () => {
    try {
      setLoading(true);
      const data = await getCourseMaterials(courseId);
      setMaterials(data);
      if (onMaterialsChange) onMaterialsChange(data);
    } catch (error) {
      console.error('Error loading materials:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Check file type (videos only)
      if (!file.type.startsWith('video/')) {
        alert('Please select a video file');
        return;
      }
      setSelectedFile(file);
      setLectureTitle(file.name.replace(/\.[^/.]+$/, '')); // Remove extension
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !lectureTitle.trim()) {
      alert('Please select a file and enter a title');
      return;
    }

    try {
      setUploading(true);
      setUploadProgress(0);

      const userId = auth.currentUser?.uid;
      await uploadCourseMaterial(
        courseId,
        selectedFile,
        lectureTitle,
        userId,
        (progress) => setUploadProgress(progress)
      );

      // Reset form
      setSelectedFile(null);
      setLectureTitle('');
      setShowUploadModal(false);
      setUploadProgress(0);

      // Reload materials
      await loadMaterials();
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload file. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (materialId) => {
    if (!confirm('Are you sure you want to delete this lecture?')) return;

    try {
      await deleteCourseMaterial(materialId);
      await loadMaterials();
    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to delete lecture');
    }
  };

  const handleDragStart = (e, index) => {
    setDraggedItem(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    if (draggedItem === null || draggedItem === index) return;

    const newMaterials = [...materials];
    const draggedMaterial = newMaterials[draggedItem];
    newMaterials.splice(draggedItem, 1);
    newMaterials.splice(index, 0, draggedMaterial);

    setMaterials(newMaterials);
    setDraggedItem(index);
  };

  const handleDragEnd = async () => {
    if (draggedItem !== null) {
      try {
        await reorderCourseMaterials(courseId, materials);
      } catch (error) {
        console.error('Reorder error:', error);
        await loadMaterials(); // Reload on error
      }
    }
    setDraggedItem(null);
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDuration = (url) => {
    // This would require loading the video metadata
    // For now, we'll return a placeholder
    return 'Video';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader className="w-8 h-8 text-purple-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-purple-500 to-pink-500 p-2 rounded-xl">
            <Video className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Course Lectures</h2>
            <p className="text-sm text-gray-600">{materials.length} lecture{materials.length !== 1 ? 's' : ''} available</p>
          </div>
        </div>
        {isInstructor && (
          <button
            onClick={() => setShowUploadModal(true)}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold flex items-center gap-2 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
          >
            <Upload className="w-5 h-5" />
            Upload Lecture
          </button>
        )}
      </div>

      {/* Lectures List */}
      {materials.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl shadow-lg border border-gray-100">
          <div className="bg-gradient-to-br from-purple-100 to-pink-100 rounded-full p-6 inline-block mb-4">
            <FileVideo className="w-16 h-16 text-purple-600" />
          </div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">No lectures yet</h3>
          <p className="text-gray-600 mb-6">
            {isInstructor
              ? 'Upload your first lecture to get started!'
              : 'Lectures will appear here once the instructor uploads them.'}
          </p>
          {isInstructor && (
            <button
              onClick={() => setShowUploadModal(true)}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 inline-flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Upload First Lecture
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {materials.map((material, index) => (
            <div
              key={material.id}
              draggable={isInstructor}
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              className={`group bg-white rounded-xl border-2 transition-all duration-300 ${
                playingVideo === material.id
                  ? 'border-purple-500 shadow-lg'
                  : 'border-gray-200 hover:border-purple-300 hover:shadow-md'
              } ${draggedItem === index ? 'opacity-50' : ''}`}
            >
              <div className="p-4 sm:p-5">
                <div className="flex items-center gap-4">
                  {/* Drag Handle */}
                  {isInstructor && (
                    <div className="cursor-move text-gray-400 hover:text-purple-600 transition-colors">
                      <GripVertical className="w-5 h-5" />
                    </div>
                  )}

                  {/* Lecture Number */}
                  <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center text-white font-bold text-lg">
                    {index + 1}
                  </div>

                  {/* Lecture Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-gray-800 truncate">{material.title}</h3>
                    <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-gray-600">
                      <span className="flex items-center gap-1">
                        <FileVideo className="w-4 h-4" />
                        {material.fileName || 'Video'}
                      </span>
                      {material.fileSize && (
                        <span className="text-gray-400">•</span>
                      )}
                      {material.fileSize && (
                        <span>{formatFileSize(material.fileSize)}</span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPlayingVideo(playingVideo === material.id ? null : material.id)}
                      className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-100 to-pink-100 hover:from-purple-200 hover:to-pink-200 text-purple-700 flex items-center gap-2 font-medium transition-all duration-300 hover:scale-105"
                    >
                      <Play className="w-4 h-4" />
                      <span className="hidden sm:inline">Play</span>
                    </button>

                    {isInstructor && (
                      <button
                        onClick={() => handleDelete(material.id)}
                        className="px-4 py-2 rounded-lg bg-red-100 hover:bg-red-200 text-red-700 flex items-center gap-2 font-medium transition-all duration-300"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span className="hidden sm:inline">Delete</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Video Player */}
                {playingVideo === material.id && (
                  <div className="mt-4 rounded-xl overflow-hidden bg-black">
                    <video
                      controls
                      className="w-full"
                      src={material.fileUrl}
                      autoPlay
                    >
                      Your browser does not support the video tag.
                    </video>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-slideUp">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-white/20 backdrop-blur-sm p-2 rounded-xl">
                    <Upload className="w-6 h-6 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-white">Upload Lecture</h2>
                </div>
                <button
                  onClick={() => !uploading && setShowUploadModal(false)}
                  className="text-white/80 hover:text-white transition-colors"
                  disabled={uploading}
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              {/* File Input */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Video File *
                </label>
                <div className="relative">
                  <input
                    type="file"
                    accept="video/*"
                    onChange={handleFileSelect}
                    disabled={uploading}
                    className="hidden"
                    id="video-upload"
                  />
                  <label
                    htmlFor="video-upload"
                    className={`block w-full px-4 py-8 border-2 border-dashed rounded-xl text-center cursor-pointer transition-all duration-300 ${
                      selectedFile
                        ? 'border-purple-500 bg-purple-50'
                        : 'border-gray-300 hover:border-purple-400 hover:bg-purple-50/50'
                    } ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {selectedFile ? (
                      <div className="space-y-2">
                        <FileVideo className="w-12 h-12 text-purple-600 mx-auto" />
                        <p className="font-medium text-gray-800">{selectedFile.name}</p>
                        <p className="text-sm text-gray-600">{formatFileSize(selectedFile.size)}</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Upload className="w-12 h-12 text-gray-400 mx-auto" />
                        <p className="font-medium text-gray-700">Click to select video</p>
                        <p className="text-sm text-gray-500">Supports MP4, MOV, AVI, and more</p>
                      </div>
                    )}
                  </label>
                </div>
              </div>

              {/* Title Input */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Lecture Title *
                </label>
                <input
                  type="text"
                  value={lectureTitle}
                  onChange={(e) => setLectureTitle(e.target.value)}
                  placeholder="Enter lecture title..."
                  disabled={uploading}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-purple-500 transition-colors duration-300"
                />
              </div>

              {/* Upload Progress */}
              {uploading && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm font-medium">
                    <span className="text-gray-700">Uploading...</span>
                    <span className="text-purple-600">{Math.round(uploadProgress)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-purple-600 to-pink-600 transition-all duration-300 rounded-full"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-6 flex justify-end gap-3 border-t">
              <button
                onClick={() => setShowUploadModal(false)}
                disabled={uploading}
                className="px-6 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 font-medium text-gray-700 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={!selectedFile || !lectureTitle.trim() || uploading}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {uploading ? (
                  <>
                    <Loader className="w-5 h-5 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-5 h-5" />
                    Upload
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CourseLectureManager;
