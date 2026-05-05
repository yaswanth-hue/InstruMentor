import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { onAuthStateChanged } from 'firebase/auth';
import {
  auth,
  createCourse,
  getCourses,
  getEnrolledCourses,
  enrollInCourse,
  unenrollFromCourse,
} from '../firebase';
import { BookOpen, PlusCircle, UserPlus, Users, GraduationCap, Award, TrendingUp, Sparkles } from 'lucide-react';

const CoursesPage = () => {
  const navigate = useNavigate();
  const [userId, setUserId] = useState(null);
  const [tab, setTab] = useState('explore'); // explore | my | enrolled
  const [courses, setCourses] = useState([]);
  const [myCourses, setMyCourses] = useState([]);
  const [enrolled, setEnrolled] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  // Listen to auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUserId(user?.uid || null);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const load = async () => {
      if (!userId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const [all, mine, myEnroll] = await Promise.all([
          getCourses(),
          getCourses(userId),
          getEnrolledCourses(userId),
        ]);
        setCourses(all);
        setMyCourses(mine);
        setEnrolled(myEnroll);
      } catch (error) {
        console.error('Error loading courses:', error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [userId]);

  const handleCreate = async () => {
    if (!title.trim()) return;
    const id = await createCourse({
      title,
      description,
      creatorId: userId,
    });
    setShowCreate(false);
    setTitle('');
    setDescription('');
    navigate(`/course/${id}`);
  };

  const handleEnroll = async (courseId) => {
    if (!userId) return;
    await enrollInCourse(courseId, userId);
    const updated = await getEnrolledCourses(userId);
    setEnrolled(updated);
  };

  const handleUnenroll = async (courseId) => {
    if (!userId) return;
    await unenrollFromCourse(courseId, userId);
    const updated = await getEnrolledCourses(userId);
    setEnrolled(updated);
  };

  const isEnrolled = (courseId) => enrolled.some((c) => c.id === courseId);

  // Filter out user's own courses from explore tab
  const list = tab === 'explore'
    ? courses.filter(course => course.creatorId !== userId)
    : tab === 'my'
    ? myCourses
    : enrolled;

  return (
    <>
      <Helmet>
        <title>Courses | InstruMentor - Learn & Teach Music</title>
        <meta name="description" content="Discover music courses on InstruMentor. Learn from talented musicians, enroll in courses, or create your own to teach others. Master your instrument today!" />
        <meta property="og:title" content="Courses | InstruMentor - Learn & Teach Music" />
        <meta property="og:description" content="Discover music courses on InstruMentor. Learn from talented musicians, enroll in courses, or create your own to teach others." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={typeof window !== 'undefined' ? window.location.href : ''} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Courses | InstruMentor - Learn & Teach Music" />
        <meta name="twitter:description" content="Discover music courses on InstruMentor. Learn from talented musicians or create your own courses to teach others." />
      </Helmet>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50" style={{width: '100%', maxWidth: 'none'}}>
      {/* Header with gradient background */}
      <div className="bg-gradient-to-r from-purple-600 via-pink-500 to-blue-500 shadow-lg">
        <div className="w-full px-4 sm:px-6 py-5 sm:py-6 flex items-center justify-between" style={{width: '100%', maxWidth: 'none'}}>
          <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-3">
            <div className="bg-white/20 backdrop-blur-sm p-2 rounded-xl">
              <GraduationCap className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
            </div>
            <span className="drop-shadow-md">Discover Courses</span>
          </h1>
          <div className="flex gap-2">
            <button
              onClick={() => setShowCreate(true)}
              className="bg-white text-purple-600 hover:bg-purple-50 px-4 py-2.5 sm:px-5 sm:py-3 rounded-xl flex items-center gap-2 text-sm sm:text-base font-semibold shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
            >
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">Create Course</span>
              <span className="sm:hidden">Create</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation with modern design */}
        <div className="w-full px-4 sm:px-6 pb-0 flex gap-2 sm:gap-4 overflow-x-auto" style={{width: '100%', maxWidth: 'none'}}>
          <button
            className={`pb-4 px-4 font-semibold transition-all duration-300 ${
              tab === 'explore'
                ? 'text-white border-b-4 border-white'
                : 'text-white/70 hover:text-white border-b-4 border-transparent'
            }`}
            onClick={() => setTab('explore')}
          >
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Explore
            </div>
          </button>
          <button
            className={`pb-4 px-4 font-semibold transition-all duration-300 ${
              tab === 'my'
                ? 'text-white border-b-4 border-white'
                : 'text-white/70 hover:text-white border-b-4 border-transparent'
            }`}
            onClick={() => setTab('my')}
          >
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4" />
              My Courses
            </div>
          </button>
          <button
            className={`pb-4 px-4 font-semibold transition-all duration-300 ${
              tab === 'enrolled'
                ? 'text-white border-b-4 border-white'
                : 'text-white/70 hover:text-white border-b-4 border-transparent'
            }`}
            onClick={() => setTab('enrolled')}
          >
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              Enrolled
            </div>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="w-full px-4 sm:px-6 py-6 sm:py-8" style={{width: '100%', maxWidth: 'none'}}>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-purple-600"></div>
            <p className="mt-4 text-gray-600 font-medium">Loading amazing courses...</p>
          </div>
        ) : list.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="bg-white rounded-full p-6 shadow-lg mb-4">
              <BookOpen className="w-16 h-16 text-gray-400" />
            </div>
            <p className="text-xl text-gray-600 font-medium">No courses found</p>
            <p className="text-gray-500 mt-2">
              {tab === 'explore' ? 'Start creating some courses!' : 'Nothing here yet'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
            {list.map((course, index) => (
              <div
                key={course.id}
                className="group bg-white rounded-2xl shadow-md hover:shadow-2xl transition-all duration-500 overflow-hidden border border-gray-100 hover:border-purple-200 hover:-translate-y-2"
                style={{
                  animation: `fadeInUp 0.5s ease-out ${index * 0.1}s backwards`
                }}
              >
                {/* Course Header with Gradient */}
                <div className="h-32 bg-gradient-to-br from-purple-400 via-pink-400 to-blue-400 relative overflow-hidden">
                  <div className="absolute inset-0 bg-black/10"></div>
                  <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full flex items-center gap-2 shadow-lg">
                    <Users className="w-4 h-4 text-purple-600" />
                    <span className="text-sm font-bold text-gray-800">
                      {course.enrolledUsers?.length || 0}
                    </span>
                  </div>
                  {/* Decorative elements */}
                  <div className="absolute bottom-0 left-0 w-full h-8 bg-white rounded-t-3xl"></div>
                </div>

                {/* Course Content */}
                <div className="p-5 pt-2">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="bg-gradient-to-br from-purple-500 to-pink-500 p-2.5 rounded-xl shadow-md group-hover:scale-110 transition-transform duration-300">
                      <BookOpen className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-bold text-gray-800 group-hover:text-purple-600 transition-colors duration-300 line-clamp-2">
                        {course.title}
                      </h3>
                    </div>
                  </div>

                  <p className="text-gray-600 text-sm leading-relaxed line-clamp-3 mb-4">
                    {course.description || 'Explore this amazing course and enhance your skills!'}
                  </p>

                  {/* Stats Bar */}
                  <div className="flex items-center gap-3 mb-4 p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl">
                    <div className="flex items-center gap-2 text-sm">
                      <div className="bg-purple-100 p-1.5 rounded-lg">
                        <Users className="w-4 h-4 text-purple-600" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Students</p>
                        <p className="font-bold text-purple-600">
                          {course.enrolledUsers?.length || 0}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => navigate(`/course/${course.id}`)}
                      className="flex-1 px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 font-medium text-gray-700 transition-all duration-300 hover:shadow-md"
                    >
                      View Details
                    </button>
                    {course.creatorId === userId ? (
                      <div className="bg-gradient-to-r from-amber-100 to-yellow-100 px-4 py-2.5 rounded-xl flex items-center gap-2">
                        <Award className="w-4 h-4 text-amber-600" />
                        <span className="text-xs font-semibold text-amber-700">Creator</span>
                      </div>
                    ) : isEnrolled(course.id) ? (
                      <button
                        onClick={() => handleUnenroll(course.id)}
                        className="px-4 py-2.5 rounded-xl bg-white border-2 border-gray-300 hover:border-red-300 hover:bg-red-50 font-medium text-gray-700 hover:text-red-600 transition-all duration-300"
                      >
                        Leave
                      </button>
                    ) : (
                      <button
                        onClick={() => handleEnroll(course.id)}
                        className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-medium flex items-center gap-2 transition-all duration-300 hover:shadow-lg hover:scale-105"
                      >
                        <UserPlus className="w-4 h-4" />
                        <span className="text-sm">Enroll</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-slideUp">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 backdrop-blur-sm p-2 rounded-xl">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-white">Create New Course</h2>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Course Title
                </label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter an engaging course title..."
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-purple-500 focus:outline-none transition-colors duration-300"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Course Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what students will learn..."
                  rows={4}
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-purple-500 focus:outline-none resize-none transition-colors duration-300"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => setShowCreate(false)}
                  className="px-6 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 font-medium text-gray-700 transition-all duration-300"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!title.trim()}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <PlusCircle className="w-5 h-5" />
                  Create Course
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
};

export default CoursesPage;



