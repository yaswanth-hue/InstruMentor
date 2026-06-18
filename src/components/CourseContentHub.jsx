import React, { useState, useEffect } from 'react';
import {
  Upload,
  Video,
  Play,
  Trash2,
  GripVertical,
  FileVideo,
  Calendar,
  Clock,
  Users,
  Loader,
  X,
  Plus,
  ChevronDown,
  ChevronUp,
  Film,
  BookOpen,
  Sparkles,
  ExternalLink,
  Paperclip,
  Image as ImageIcon,
  FileText,
  Download,
  Link as LinkIcon,
  Phone,
  PhoneOff
} from 'lucide-react';
import {
  uploadCourseMaterial,
  getCourseMaterials,
  deleteCourseMaterial,
  reorderCourseMaterials,
  getMeetings,
  createMeeting,
  auth
} from '../firebase';

const CourseContentHub = ({ courseId, courseTitle, isInstructor, enrolledEmails, isHost }) => {
  const [activeTab, setActiveTab] = useState('lectures');
  const [lectures, setLectures] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [lectureTitle, setLectureTitle] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [draggedItem, setDraggedItem] = useState(null);
  const [playingVideo, setPlayingVideo] = useState(null);
  const [expandedMeeting, setExpandedMeeting] = useState(null);
  const [newMeeting, setNewMeeting] = useState({
    title: '',
    description: '',
    scheduledTime: ''
  });

  useEffect(() => {
    loadContent();
  }, [courseId]);

  const loadContent = async () => {
    try {
      setLoading(true);
      const [lecturesData, meetingsData] = await Promise.all([
        getCourseMaterials(courseId),
        getMeetings(courseId)
      ]);
      setLectures(lecturesData);
      setMeetings(meetingsData);
    } catch (error) {
      console.error('Error loading content:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith('video/')) {
        alert('Please select a video file');
        return;
      }
      setSelectedFile(file);
      setLectureTitle(file.name.replace(/\.[^/.]+$/, ''));
    }
  };

  const handleAttachmentSelect = (e) => {
    const files = Array.from(e.target.files);
    const newAttachments = files.map(file => ({
      file,
      name: file.name,
      size: file.size,
      type: file.type,
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null
    }));
    setAttachments([...attachments, ...newAttachments]);
  };

  const removeAttachment = (index) => {
    const newAttachments = [...attachments];
    if (newAttachments[index].preview) {
      URL.revokeObjectURL(newAttachments[index].preview);
    }
    newAttachments.splice(index, 1);
    setAttachments(newAttachments);
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

      // Upload main video
      const result = await uploadCourseMaterial(
        courseId,
        selectedFile,
        lectureTitle,
        userId,
        (progress) => setUploadProgress(progress)
      );

      // TODO: Upload attachments to Firebase Storage and store URLs
      // For now, we'll store attachment info in the lecture metadata
      // This would require updating the uploadCourseMaterial function

      setSelectedFile(null);
      setLectureTitle('');
      setAttachments([]);
      setShowUploadModal(false);
      setUploadProgress(0);
      await loadContent();
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload file. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleCreateMeeting = async () => {
    if (!newMeeting.title.trim() || !newMeeting.scheduledTime) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      const enrolledUsers = enrolledEmails || [];
      const currentUserId = auth.currentUser?.uid;
      const participants = [currentUserId, ...enrolledUsers];

      await createMeeting({
        courseId: courseId,
        title: newMeeting.title,
        description: newMeeting.description,
        scheduledTime: new Date(newMeeting.scheduledTime),
        participants: participants,
        status: 'scheduled'
      });

      setShowMeetingModal(false);
      setNewMeeting({ title: '', description: '', scheduledTime: '' });
      await loadContent();
    } catch (error) {
      console.error('Error creating meeting:', error);
      alert('Failed to create meeting');
    }
  };

  const startMeeting = (meetingId) => {
    window.open(`/meeting/${meetingId}`, '_blank');
  };

  const handleDelete = async (lectureId) => {
    if (!confirm('Are you sure you want to delete this lecture?')) return;

    try {
      await deleteCourseMaterial(lectureId);
      await loadContent();
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

    const newLectures = [...lectures];
    const draggedLecture = newLectures[draggedItem];
    newLectures.splice(draggedItem, 1);
    newLectures.splice(index, 0, draggedLecture);

    setLectures(newLectures);
    setDraggedItem(index);
  };

  const handleDragEnd = async () => {
    if (draggedItem !== null) {
      try {
        await reorderCourseMaterials(courseId, lectures);
      } catch (error) {
        console.error('Reorder error:', error);
        await loadContent();
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

  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const joinMeeting = (meetingId) => {
    window.open(`/meeting/${meetingId}`, '_blank');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <Loader className="w-12 h-12 text-sky-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-300 font-medium">Loading content...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Gradient */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-2xl shadow-lg p-6 sm:p-8 relative overflow-hidden border border-sky-300/20">
        <div className="absolute inset-0 bg-black/30"></div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-sky-500/20 rounded-full blur-3xl"></div>

        <div className="relative">
          <div className="flex items-center gap-4">
            <div className="bg-slate-800/80 backdrop-blur-sm p-3 rounded-xl border border-sky-300/20">
              <Film className="w-8 h-8 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-2xl sm:text-3xl font-bold text-white drop-shadow-md">Course Content</h2>
              <p className="text-slate-300 mt-1">
                {lectures.length} lecture{lectures.length !== 1 ? 's' : ''} • {meetings.length} meeting{meetings.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          {/* Modern Tab Navigation */}
          <div className="mt-6 flex gap-2 sm:gap-3">
            <button
              onClick={() => setActiveTab('lectures')}
              className={`flex-1 px-4 sm:px-6 py-3 rounded-xl font-semibold transition-all duration-300 flex items-center justify-center gap-2 ${
                activeTab === 'lectures'
                  ? 'bg-slate-100 text-slate-900 shadow-lg'
                  : 'bg-slate-800/70 backdrop-blur-sm text-slate-200 hover:bg-slate-700/80'
              }`}
            >
              <Video className="w-5 h-5" />
              <span>Lectures</span>
              <span className="px-2 py-0.5 rounded-full bg-sky-600 text-white text-xs font-bold">
                {lectures.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('meetings')}
              className={`flex-1 px-4 sm:px-6 py-3 rounded-xl font-semibold transition-all duration-300 flex items-center justify-center gap-2 ${
                activeTab === 'meetings'
                  ? 'bg-slate-100 text-slate-900 shadow-lg'
                  : 'bg-slate-800/70 backdrop-blur-sm text-slate-200 hover:bg-slate-700/80'
              }`}
            >
              <Calendar className="w-5 h-5" />
              <span>Meetings</span>
              <span className="px-2 py-0.5 rounded-full bg-sky-600 text-white text-xs font-bold">
                {meetings.length}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="bg-slate-900/85 rounded-2xl shadow-2xl shadow-black/30 border border-sky-300/20 overflow-hidden">
        {/* Lectures Tab */}
        {activeTab === 'lectures' && (
          <div className="p-6 sm:p-8">
            {/* Upload Button for Lectures */}
            {isInstructor && (
              <div className="mb-6">
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="px-5 py-3 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-600 hover:from-sky-700 hover:to-cyan-700 text-white font-semibold flex items-center gap-2 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
                >
                  <Upload className="w-5 h-5" />
                  Upload New Lecture
                </button>
              </div>
            )}

            {lectures.length === 0 ? (
              <div className="text-center py-16">
                <div className="bg-gradient-to-br from-sky-900/60 to-cyan-900/60 rounded-full p-6 inline-block mb-4">
                  <FileVideo className="w-16 h-16 text-sky-300" />
                </div>
                <h3 className="text-xl font-bold text-slate-100 mb-2">No lectures yet</h3>
                <p className="text-slate-300">
                  {isInstructor
                    ? 'Click the button above to upload your first lecture!'
                    : 'Lectures will appear here once the instructor uploads them.'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {lectures.map((lecture, index) => (
                  <div
                    key={lecture.id}
                    draggable={isInstructor}
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                    className={`group rounded-xl border-2 transition-all duration-300 ${
                      playingVideo === lecture.id
                        ? 'border-sky-500 bg-slate-800/90 shadow-lg'
                        : 'border-slate-700 hover:border-sky-400/60 hover:shadow-md bg-slate-900/70'
                    } ${draggedItem === index ? 'opacity-50 scale-95' : ''}`}
                  >
                    <div className="p-4 sm:p-5">
                      <div className="flex items-center gap-4">
                        {isInstructor && (
                          <div className="cursor-move text-slate-500 hover:text-sky-300 transition-colors">
                            <GripVertical className="w-5 h-5" />
                          </div>
                        )}

                        <div className="flex-shrink-0 w-14 h-14 bg-gradient-to-br from-sky-500 to-cyan-500 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-md">
                          {index + 1}
                        </div>

                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg font-bold text-slate-100 truncate">{lecture.title}</h3>
                          <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-slate-300">
                            <span className="flex items-center gap-1">
                              <FileVideo className="w-4 h-4" />
                              {lecture.fileName || 'Video'}
                            </span>
                            {lecture.fileSize && (
                              <>
                                <span className="text-slate-500">•</span>
                                <span>{formatFileSize(lecture.fileSize)}</span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setPlayingVideo(playingVideo === lecture.id ? null : lecture.id)}
                            className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-600 hover:to-cyan-600 text-white flex items-center gap-2 font-semibold transition-all duration-300 hover:scale-105 shadow-md"
                          >
                            <Play className="w-4 h-4" />
                            <span className="hidden sm:inline">Play</span>
                          </button>

                          {isInstructor && (
                            <button
                              onClick={() => handleDelete(lecture.id)}
                            className="px-4 py-2 rounded-xl bg-red-900/20 hover:bg-red-900/35 border border-red-400/30 text-red-300 flex items-center gap-2 font-medium transition-all duration-300"
                            >
                              <Trash2 className="w-4 h-4" />
                              <span className="hidden sm:inline">Delete</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {playingVideo === lecture.id && (
                        <div className="mt-4 rounded-xl overflow-hidden bg-black shadow-2xl">
                          <video
                            controls
                            className="w-full"
                            src={lecture.fileUrl}
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
          </div>
        )}

        {/* Meetings Tab */}
        {activeTab === 'meetings' && (
          <div className="p-6 sm:p-8">
            {/* Create Meeting Button */}
            {isInstructor && (
              <div className="mb-6">
                <button
                  onClick={() => setShowMeetingModal(true)}
                  className="px-5 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-semibold flex items-center gap-2 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
                >
                  <Plus className="w-5 h-5" />
                  Schedule New Meeting
                </button>
              </div>
            )}

            {meetings.length === 0 ? (
              <div className="text-center py-16">
                <div className="bg-gradient-to-br from-sky-900/60 to-cyan-900/60 rounded-full p-6 inline-block mb-4">
                  <Calendar className="w-16 h-16 text-sky-300" />
                </div>
                <h3 className="text-xl font-bold text-slate-100 mb-2">No meetings scheduled</h3>
                <p className="text-slate-300">
                  {isInstructor
                    ? 'Click the button above to schedule your first meeting!'
                    : 'Meetings will appear here once scheduled.'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {meetings.map((meeting, index) => {
                  const meetingDate = meeting.scheduledTime?.toDate ? meeting.scheduledTime.toDate() : new Date(meeting.scheduledTime);
                  const isPast = meetingDate < new Date();
                  const isExpanded = expandedMeeting === meeting.id;

                  return (
                    <div
                      key={meeting.id}
                      className="group bg-slate-900/70 rounded-xl border-2 border-slate-700 hover:border-sky-400/60 hover:shadow-md transition-all duration-300"
                    >
                      <div className="p-4 sm:p-5">
                        <div className="flex items-start gap-4">
                          <div className={`flex-shrink-0 w-14 h-14 rounded-xl flex items-center justify-center text-white font-bold shadow-md ${
                            isPast ? 'bg-gradient-to-br from-slate-500 to-slate-600' : 'bg-gradient-to-br from-sky-500 to-cyan-500'
                          }`}>
                            <Calendar className="w-7 h-7" />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1">
                                <h3 className="text-lg font-bold text-slate-100">{meeting.title}</h3>
                                <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-slate-300">
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-4 h-4" />
                                    {formatDate(meeting.scheduledTime)}
                                  </span>
                                  {meeting.participants && (
                                    <>
                                      <span className="text-slate-500">•</span>
                                      <span className="flex items-center gap-1">
                                        <Users className="w-4 h-4" />
                                        {meeting.participants.length} participant{meeting.participants.length !== 1 ? 's' : ''}
                                      </span>
                                    </>
                                  )}
                                  {isPast && (
                                    <>
                                      <span className="text-slate-500">•</span>
                                      <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-xs font-semibold border border-slate-600">
                                        Completed
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>

                              <button
                                onClick={() => setExpandedMeeting(isExpanded ? null : meeting.id)}
                                className="text-slate-500 hover:text-sky-300 transition-colors"
                              >
                                {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                              </button>
                            </div>

                            {isExpanded && (
                              <div className="mt-4 pt-4 border-t border-slate-700 space-y-3">
                                {meeting.description && (
                                  <p className="text-slate-300 leading-relaxed">{meeting.description}</p>
                                )}
                                {!isPast && (
                                  <div className="flex flex-wrap gap-2">
                                    <button
                                      onClick={() => startMeeting(meeting.id)}
                                      className={`px-5 py-2.5 rounded-xl bg-gradient-to-r ${isInstructor ? 'from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600' : 'from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600'} text-white font-semibold flex items-center gap-2 shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105`}
                                    >
                                      <Phone className="w-4 h-4" />
                                      {isInstructor ? 'Start Meeting' : 'Join Meeting'}
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-slate-900 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-slideUp border border-sky-300/20">
            <div className="bg-gradient-to-r from-sky-600 to-cyan-600 p-6">
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

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-200 mb-2">
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
                        ? 'border-sky-500 bg-sky-900/20'
                        : 'border-slate-600 hover:border-sky-400 hover:bg-sky-900/20'
                    } ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {selectedFile ? (
                      <div className="space-y-2">
                        <FileVideo className="w-12 h-12 text-sky-300 mx-auto" />
                        <p className="font-medium text-slate-100">{selectedFile.name}</p>
                        <p className="text-sm text-slate-300">{formatFileSize(selectedFile.size)}</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Upload className="w-12 h-12 text-slate-500 mx-auto" />
                        <p className="font-medium text-slate-200">Click to select video</p>
                        <p className="text-sm text-slate-400">No size limit • All video formats supported</p>
                      </div>
                    )}
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-200 mb-2">
                  Lecture Title *
                </label>
                <input
                  type="text"
                  value={lectureTitle}
                  onChange={(e) => setLectureTitle(e.target.value)}
                  placeholder="Enter lecture title..."
                  disabled={uploading}
                  className="w-full px-4 py-3 border-2 border-slate-700 bg-slate-800 text-slate-100 rounded-xl focus:outline-none focus:border-sky-500 transition-colors duration-300"
                />
              </div>

              {/* Attachments Section */}
              <div>
                <label className="block text-sm font-semibold text-slate-200 mb-2">
                  Attachments (Optional)
                </label>
                <div className="space-y-2">
                  <input
                    type="file"
                    multiple
                    accept="image/*,.pdf,.doc,.docx,.ppt,.pptx,.txt"
                    onChange={handleAttachmentSelect}
                    disabled={uploading}
                    className="hidden"
                    id="attachment-upload"
                  />
                  <label
                    htmlFor="attachment-upload"
                    className={`block w-full px-4 py-3 border-2 border-dashed rounded-xl text-center cursor-pointer transition-all duration-300 ${
                      uploading ? 'opacity-50 cursor-not-allowed' : 'border-slate-600 hover:border-sky-400 hover:bg-sky-900/20'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-2 text-slate-300">
                      <Paperclip className="w-5 h-5" />
                      <span className="text-sm font-medium">Add files (images, PDFs, documents)</span>
                    </div>
                  </label>

                  {/* Attachment Preview */}
                  {attachments.length > 0 && (
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {attachments.map((attachment, index) => (
                        <div key={index} className="relative group border-2 border-slate-700 rounded-lg p-2 hover:border-sky-400 transition-colors">
                          {attachment.preview ? (
                            <img src={attachment.preview} alt={attachment.name} className="w-full h-20 object-cover rounded" />
                          ) : (
                            <div className="flex items-center gap-2">
                              <FileText className="w-8 h-8 text-slate-500" />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-slate-200 truncate">{attachment.name}</p>
                                <p className="text-xs text-slate-400">{formatFileSize(attachment.size)}</p>
                              </div>
                            </div>
                          )}
                          <button
                            onClick={() => removeAttachment(index)}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            disabled={uploading}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {uploading && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm font-medium">
                    <span className="text-slate-300">Uploading...</span>
                    <span className="text-sky-300">{Math.round(uploadProgress)}%</span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-3 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-sky-600 to-cyan-600 transition-all duration-300 rounded-full"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 flex justify-end gap-3 border-t border-slate-700">
              <button
                onClick={() => setShowUploadModal(false)}
                disabled={uploading}
                className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 font-medium text-slate-100 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={!selectedFile || !lectureTitle.trim() || uploading}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-600 hover:from-sky-700 hover:to-cyan-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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

      {/* Create Meeting Modal */}
      {showMeetingModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-slate-900 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-slideUp border border-sky-300/20">
            <div className="bg-gradient-to-r from-blue-600 to-cyan-600 p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-white/20 backdrop-blur-sm p-2 rounded-xl">
                    <Calendar className="w-6 h-6 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-white">Schedule Meeting</h2>
                </div>
                <button
                  onClick={() => setShowMeetingModal(false)}
                  className="text-white/80 hover:text-white transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-200 mb-2">
                  Meeting Title *
                </label>
                <input
                  type="text"
                  value={newMeeting.title}
                  onChange={(e) => setNewMeeting(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Enter meeting title..."
                  className="w-full px-4 py-3 border-2 border-slate-700 bg-slate-800 text-slate-100 rounded-xl focus:outline-none focus:border-sky-500 transition-colors duration-300"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-200 mb-2">
                  Description (Optional)
                </label>
                <textarea
                  value={newMeeting.description}
                  onChange={(e) => setNewMeeting(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="What will this meeting be about?"
                  rows="3"
                  className="w-full px-4 py-3 border-2 border-slate-700 bg-slate-800 text-slate-100 rounded-xl resize-none focus:outline-none focus:border-sky-500 transition-colors duration-300"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-200 mb-2">
                  Scheduled Time *
                </label>
                <input
                  type="datetime-local"
                  value={newMeeting.scheduledTime}
                  onChange={(e) => setNewMeeting(prev => ({ ...prev, scheduledTime: e.target.value }))}
                  className="w-full px-4 py-3 border-2 border-slate-700 bg-slate-800 text-slate-100 rounded-xl focus:outline-none focus:border-sky-500 transition-colors duration-300"
                />
              </div>

              <div className="bg-sky-900/20 border-2 border-sky-400/30 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <Users className="w-5 h-5 text-sky-300 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-slate-100">Participants</p>
                    <p className="text-xs text-slate-300 mt-1">
                      All enrolled students will be invited to this meeting
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 flex justify-end gap-3 border-t border-slate-700">
              <button
                onClick={() => setShowMeetingModal(false)}
                className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 font-medium text-slate-100 transition-all duration-300"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateMeeting}
                disabled={!newMeeting.title.trim() || !newMeeting.scheduledTime}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Calendar className="w-5 h-5" />
                Schedule Meeting
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CourseContentHub;