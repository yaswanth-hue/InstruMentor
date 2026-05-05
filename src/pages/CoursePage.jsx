import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  auth, 
  db,
  getUserProfile, 
  createMeeting, 
  getMeetings,
  enrollInCourse 
} from '../firebase';
import { 
  doc, 
  getDoc, 
  updateDoc, 
  arrayUnion,
  arrayRemove 
} from 'firebase/firestore';
import {
  BookOpen,
  Users,
  Calendar,
  Video,
  Plus,
  Clock,
  User,
  ArrowLeft,
  Edit,
  FileText,
  ExternalLink,
  BarChart3,
  PlayCircle,
  GraduationCap,
  Award,
  Sparkles,
  TrendingUp,
  UserPlus,
  Download,
  Link as LinkIcon
} from 'lucide-react';
import CourseProgressDashboard from '../components/CourseProgressDashboard';
import CourseContentHub from '../components/CourseContentHub';

const CoursePage = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const [meetings, setMeetings] = useState([]);
  const [creatorProfile, setCreatorProfile] = useState(null);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [isCreator, setIsCreator] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  
  const currentUserId = auth.currentUser?.uid;

  useEffect(() => {
    loadCourseData();
  }, [courseId, currentUserId]);

  const loadCourseData = async () => {
    if (!courseId) return;

    try {
      setLoading(true);
      
      // Load course details
      const courseDoc = await getDoc(doc(db, 'courses', courseId));
      if (!courseDoc.exists()) {
        navigate('/courses');
        return;
      }

      const courseData = { id: courseDoc.id, ...courseDoc.data() };
      setCourse(courseData);

      // Load creator profile
      const creator = await getUserProfile(courseData.creatorId);
      setCreatorProfile(creator);

      // Check if user is enrolled or creator
      const enrolled = courseData.enrolledUsers?.includes(currentUserId) || false;
      const creator_check = courseData.creatorId === currentUserId;
      setIsEnrolled(enrolled);
      setIsCreator(creator_check);

      // Load meetings if enrolled or creator
      if (enrolled || creator_check) {
        const courseMeetings = await getMeetings(courseId);
        setMeetings(courseMeetings);
      }

    } catch (error) {
      console.error('Error loading course:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEnroll = async () => {
    try {
      const courseRef = doc(db, 'courses', courseId);
      await updateDoc(courseRef, {
        enrolledUsers: arrayUnion(currentUserId)
      });
      setIsEnrolled(true);
      loadCourseData(); // Reload to get meetings
    } catch (error) {
      console.error('Error enrolling:', error);
      alert('Failed to enroll in course');
    }
  };


  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center" style={{width: '100%', maxWidth: 'none'}}>
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-purple-600"></div>
          <p className="mt-4 text-gray-600 font-medium">Loading course...</p>
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center" style={{width: '100%', maxWidth: 'none'}}>
        <div className="text-center">
          <div className="bg-white rounded-full p-6 shadow-lg mb-4 inline-block">
            <BookOpen className="w-16 h-16 text-gray-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-700 mb-2">Course not found</h2>
          <button
            onClick={() => navigate('/courses')}
            className="mt-4 px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold hover:shadow-lg transition-all duration-300"
          >
            Back to Courses
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50" style={{width: '100%', maxWidth: 'none'}}>
      {/* Hero Header with Gradient */}
      <div className="bg-gradient-to-r from-purple-600 via-pink-500 to-blue-500 shadow-lg relative overflow-hidden">
        {/* Decorative background elements */}
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-white/10 rounded-full blur-3xl"></div>

        <div className="relative w-full px-4 sm:px-6 py-6 sm:py-8" style={{width: '100%', maxWidth: 'none'}}>
          {/* Back Button */}
          <button
            onClick={() => navigate('/courses')}
            className="mb-4 flex items-center gap-2 text-white/90 hover:text-white transition-colors duration-300 group"
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform duration-300" />
            <span className="font-medium">Back to Courses</span>
          </button>

          {/* Course Header */}
          <div className="flex items-start gap-4 mb-6">
            <div className="bg-white/20 backdrop-blur-sm p-3 sm:p-4 rounded-2xl shadow-lg flex-shrink-0">
              <GraduationCap className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white drop-shadow-lg mb-2 animate-fadeIn">
                {course.title}
              </h1>
              <p className="text-base sm:text-lg text-white/90 leading-relaxed animate-slideDown">
                {course.description}
              </p>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 sm:p-4 border border-white/20 hover:bg-white/20 transition-all duration-300">
              <div className="flex items-center gap-2 mb-1">
                <User className="w-4 h-4 text-white/80" />
                <span className="text-xs text-white/80">Instructor</span>
              </div>
              <p className="font-bold text-white text-sm sm:text-base truncate">
                {creatorProfile?.displayName || 'Unknown'}
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 sm:p-4 border border-white/20 hover:bg-white/20 transition-all duration-300">
              <div className="flex items-center gap-2 mb-1">
                <Users className="w-4 h-4 text-white/80" />
                <span className="text-xs text-white/80">Students</span>
              </div>
              <p className="font-bold text-white text-lg sm:text-2xl">
                {course.enrolledUsers?.length || 0}
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 sm:p-4 border border-white/20 hover:bg-white/20 transition-all duration-300">
              <div className="flex items-center gap-2 mb-1">
                <Video className="w-4 h-4 text-white/80" />
                <span className="text-xs text-white/80">Meetings</span>
              </div>
              <p className="font-bold text-white text-lg sm:text-2xl">
                {meetings.length}
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 sm:p-4 border border-white/20 hover:bg-white/20 transition-all duration-300">
              <div className="flex items-center gap-2 mb-1">
                <FileText className="w-4 h-4 text-white/80" />
                <span className="text-xs text-white/80">Materials</span>
              </div>
              <p className="font-bold text-white text-lg sm:text-2xl">
                {course.materials?.length || 0}
              </p>
            </div>
          </div>

          {/* Role Badge & Enroll Button */}
          <div className="flex flex-wrap items-center gap-3">
            {isCreator && (
              <div className="bg-gradient-to-r from-amber-400/20 to-yellow-400/20 backdrop-blur-md px-4 py-2 rounded-xl border border-amber-300/30 flex items-center gap-2">
                <Award className="w-5 h-5 text-white" />
                <span className="font-semibold text-white">Course Instructor</span>
              </div>
            )}
            {!isEnrolled && !isCreator && (
              <button
                onClick={handleEnroll}
                className="px-6 py-3 rounded-xl bg-white text-purple-600 hover:bg-purple-50 font-semibold flex items-center gap-2 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
              >
                <UserPlus className="w-5 h-5" />
                Enroll in Course
              </button>
            )}
            {isEnrolled && !isCreator && (
              <div className="bg-green-400/20 backdrop-blur-md px-4 py-2 rounded-xl border border-green-300/30 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-white" />
                <span className="font-semibold text-white">Enrolled</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="w-full px-4 sm:px-6 py-6 sm:py-8" style={{width: '100%', maxWidth: 'none'}}>
        {!isEnrolled && !isCreator ? (
          <div className="bg-white rounded-2xl shadow-lg p-8 sm:p-12 text-center border border-purple-100 animate-fadeIn">
            <div className="bg-gradient-to-br from-purple-100 to-pink-100 rounded-full p-6 inline-block mb-6">
              <BookOpen className="w-16 h-16 text-purple-600" />
            </div>
            <h3 className="text-2xl font-bold text-gray-800 mb-3">Enroll to Access Course Content</h3>
            <p className="text-gray-600 mb-8 max-w-md mx-auto">
              Join this course to view materials, attend meetings, and interact with other students.
            </p>
            <button
              onClick={handleEnroll}
              className="px-8 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold flex items-center gap-2 mx-auto shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
            >
              <UserPlus className="w-5 h-5" />
              Enroll Now
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Tab Navigation with Modern Design */}
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100">
              <div className="border-b border-gray-200 overflow-x-auto">
                <nav className="flex space-x-1 px-2 sm:px-4 min-w-max" aria-label="Tabs">
                  <button
                    onClick={() => setActiveTab('overview')}
                    className={`py-4 px-4 sm:px-6 font-semibold text-sm transition-all duration-300 border-b-4 ${
                      activeTab === 'overview'
                        ? 'border-purple-600 text-purple-600 bg-purple-50/50'
                        : 'border-transparent text-gray-600 hover:text-purple-600 hover:bg-purple-50/30'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <BookOpen className="w-4 h-4" />
                      <span>Overview</span>
                    </div>
                  </button>

                  <button
                    onClick={() => setActiveTab('content')}
                    className={`py-4 px-4 sm:px-6 font-semibold text-sm transition-all duration-300 border-b-4 ${
                      activeTab === 'content'
                        ? 'border-purple-600 text-purple-600 bg-purple-50/50'
                        : 'border-transparent text-gray-600 hover:text-purple-600 hover:bg-purple-50/30'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <Video className="w-4 h-4" />
                      <span>Content</span>
                    </div>
                  </button>

                  {(isEnrolled || isCreator) && (
                    <button
                      onClick={() => setActiveTab('progress')}
                      className={`py-4 px-4 sm:px-6 font-semibold text-sm transition-all duration-300 border-b-4 ${
                        activeTab === 'progress'
                          ? 'border-purple-600 text-purple-600 bg-purple-50/50'
                          : 'border-transparent text-gray-600 hover:text-purple-600 hover:bg-purple-50/30'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <BarChart3 className="w-4 h-4" />
                        <span>Progress</span>
                      </div>
                    </button>
                  )}
                </nav>
              </div>
            </div>
            
            {/* Tab Content */}
            {activeTab === 'overview' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
                {/* Course Description */}
                <div className="lg:col-span-2 space-y-6">
                  <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8 border border-gray-100">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="bg-gradient-to-br from-purple-500 to-pink-500 p-2 rounded-xl">
                        <BookOpen className="w-5 h-5 text-white" />
                      </div>
                      <h2 className="text-2xl font-bold text-gray-800">About This Course</h2>
                    </div>
                    <p className="text-gray-600 leading-relaxed mb-6">{course.description}</p>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                      <div className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-2 mb-1">
                          <Users className="w-4 h-4 text-purple-600" />
                        </div>
                        <div className="text-2xl sm:text-3xl font-bold text-purple-600">{course.enrolledUsers?.length || 0}</div>
                        <div className="text-xs sm:text-sm text-gray-600 font-medium">Students</div>
                      </div>
                      <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-2 mb-1">
                          <Video className="w-4 h-4 text-blue-600" />
                        </div>
                        <div className="text-2xl sm:text-3xl font-bold text-blue-600">{meetings.length}</div>
                        <div className="text-xs sm:text-sm text-gray-600 font-medium">Meetings</div>
                      </div>
                      <div className="p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-xl hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-2 mb-1">
                          <FileText className="w-4 h-4 text-green-600" />
                        </div>
                        <div className="text-2xl sm:text-3xl font-bold text-green-600">{course.materials?.length || 0}</div>
                        <div className="text-xs sm:text-sm text-gray-600 font-medium">Materials</div>
                      </div>
                      <div className="p-4 bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-2 mb-1">
                          <Calendar className="w-4 h-4 text-amber-600" />
                        </div>
                        <div className="text-xl sm:text-2xl font-bold text-amber-600">
                          {new Date(course.createdAt?.toDate?.() || Date.now()).toLocaleDateString('en', {month: 'short'})}
                        </div>
                        <div className="text-xs sm:text-sm text-gray-600 font-medium">Created</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                  {/* Course Info */}
                  <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="bg-gradient-to-br from-purple-500 to-pink-500 p-2 rounded-xl">
                        <GraduationCap className="w-5 h-5 text-white" />
                      </div>
                      <h3 className="text-lg font-bold text-gray-800">Course Info</h3>
                    </div>
                    <div className="space-y-4">
                      <div className="p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl">
                        <span className="text-xs text-gray-600 font-medium block mb-1">Instructor</span>
                        <p className="font-bold text-gray-800">{creatorProfile?.displayName || 'Unknown'}</p>
                      </div>
                      <div className="p-3 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl">
                        <span className="text-xs text-gray-600 font-medium block mb-1">Enrolled Students</span>
                        <p className="font-bold text-gray-800">{course.enrolledUsers?.length || 0} students</p>
                      </div>
                      <div className="p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl">
                        <span className="text-xs text-gray-600 font-medium block mb-1">Course Materials</span>
                        <p className="font-bold text-gray-800">{course.materials?.length || 0} resources</p>
                      </div>
                      <div className="p-3 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl">
                        <span className="text-xs text-gray-600 font-medium block mb-1">Scheduled Meetings</span>
                        <p className="font-bold text-gray-800">{meetings.length} meetings</p>
                      </div>
                    </div>
                  </div>

                  {/* Quick Actions */}
                  {isCreator && (
                    <div className="bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl shadow-lg p-6 text-white">
                      <div className="flex items-center gap-3 mb-4">
                        <Sparkles className="w-5 h-5" />
                        <h3 className="text-lg font-bold">Quick Actions</h3>
                      </div>
                      <div className="space-y-2">
                        <button
                          onClick={() => setActiveTab('content')}
                          className="w-full text-left px-4 py-3 rounded-xl bg-white/20 backdrop-blur-sm hover:bg-white/30 flex items-center gap-3 transition-all duration-300 hover:scale-105"
                        >
                          <Video className="w-5 h-5" />
                          <span className="font-medium">Manage Content</span>
                        </button>
                        <button
                          onClick={() => setActiveTab('progress')}
                          className="w-full text-left px-4 py-3 rounded-xl bg-white/20 backdrop-blur-sm hover:bg-white/30 flex items-center gap-3 transition-all duration-300 hover:scale-105"
                        >
                          <BarChart3 className="w-5 h-5" />
                          <span className="font-medium">View Progress</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {activeTab === 'content' && (
              <div className="animate-fadeIn">
                <CourseContentHub
                  courseId={courseId}
                  courseTitle={course.title}
                  isInstructor={isCreator}
                  enrolledEmails={course.enrolledUsers || []}
                  isHost={isCreator}
                />
              </div>
            )}

            {activeTab === 'progress' && (isEnrolled || isCreator) && (
              <CourseProgressDashboard
                courseId={courseId}
                courseTitle={course.title}
              />
            )}
          </div>
        )}
      </div>

    </div>
  );
};

export default CoursePage;
