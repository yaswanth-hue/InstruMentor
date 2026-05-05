import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  auth,
  getCourseById,
  enrollInCourse,
  unenrollFromCourse,
} from '../firebase';
import { Users, GraduationCap, Award, BookOpen, Calendar, ArrowLeft, UserPlus, UserMinus, Sparkles, TrendingUp } from 'lucide-react';
import CourseContentHub from '../components/CourseContentHub';

const CourseDetailPage = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const userId = auth.currentUser?.uid;
  const userEmail = auth.currentUser?.email;
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const isCreator = useMemo(() => course && course.creatorId === userId, [course, userId]);
  const isEnrolled = useMemo(
    () => !!course && (course.enrolledUsers || []).includes(userId),
    [course, userId]
  );

  const load = async () => {
    setLoading(true);
    try {
      const c = await getCourseById(courseId);
      setCourse(c);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  const handleEnroll = async () => {
    await enrollInCourse(courseId, userId);
    await load();
  };

  const handleUnenroll = async () => {
    await unenrollFromCourse(courseId, userId);
    await load();
  };

  const canAccessMaterials = isCreator || isEnrolled;

  // Get enrolled emails for the meeting scheduler
  const getEnrolledEmails = () => {
    if (!course || !course.enrolledUsers) return [];
    // This is a simplified version - in production, you'd fetch actual emails from user profiles
    return course.enrolledUsers.map(uid => `user-${uid}@email.com`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center" style={{width: '100%', maxWidth: 'none'}}>
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-purple-600"></div>
          <p className="mt-4 text-gray-600 font-medium">Loading course details...</p>
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
          <p className="text-xl text-gray-600 font-medium">Course not found</p>
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
    <>
      <Helmet>
        <title>{course?.title || 'Course'} | InstruMentor</title>
        <meta name="description" content={course?.description || `Learn music with ${course?.title || 'this course'} on InstruMentor. Enroll now and master your instrument!`} />
        <meta property="og:title" content={`${course?.title || 'Course'} | InstruMentor`} />
        <meta property="og:description" content={course?.description || 'Learn music on InstruMentor'} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={typeof window !== 'undefined' ? window.location.href : ''} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={`${course?.title || 'Course'} | InstruMentor`} />
        <meta name="twitter:description" content={course?.description || 'Learn music on InstruMentor'} />
      </Helmet>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50" style={{width: '100%', maxWidth: 'none'}}>
      {/* Hero Section with Gradient Background */}
      <div className="bg-gradient-to-r from-purple-600 via-pink-500 to-blue-500 shadow-lg relative overflow-hidden">
        {/* Decorative background elements */}
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-white/10 rounded-full blur-3xl"></div>

        <div className="relative w-full px-4 sm:px-6 py-8 sm:py-12" style={{width: '100%', maxWidth: 'none'}}>
          {/* Back Button */}
          <button
            onClick={() => navigate('/courses')}
            className="mb-6 flex items-center gap-2 text-white/90 hover:text-white transition-colors duration-300 group"
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform duration-300" />
            <span className="font-medium">Back to Courses</span>
          </button>

          {/* Course Header */}
          <div className="flex items-start gap-4 mb-6">
            <div className="bg-white/20 backdrop-blur-sm p-4 rounded-2xl shadow-lg">
              <GraduationCap className="w-10 h-10 sm:w-12 sm:h-12 text-white" />
            </div>
            <div className="flex-1">
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white drop-shadow-lg mb-3 animate-fadeIn">
                {course.title}
              </h1>
              <p className="text-lg text-white/90 leading-relaxed max-w-3xl animate-slideDown">
                {course.description || 'Explore this amazing course and enhance your skills!'}
              </p>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
            {/* Enrolled Students */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-5 border border-white/20 hover:bg-white/20 transition-all duration-300 hover:scale-105">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 p-3 rounded-xl">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-white/80 text-sm font-medium">Enrolled Students</p>
                  <p className="text-3xl font-bold text-white">{course.enrolledUsers?.length || 0}</p>
                </div>
              </div>
            </div>

            {/* Instructor Badge */}
            {isCreator && (
              <div className="bg-gradient-to-br from-amber-400/20 to-yellow-400/20 backdrop-blur-md rounded-2xl p-5 border border-amber-300/30 hover:scale-105 transition-all duration-300">
                <div className="flex items-center gap-3">
                  <div className="bg-amber-400/30 p-3 rounded-xl">
                    <Award className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-white/90 text-sm font-medium">Your Role</p>
                    <p className="text-2xl font-bold text-white">Instructor</p>
                  </div>
                </div>
              </div>
            )}

            {/* Status Badge */}
            {!isCreator && (
              <div className={`backdrop-blur-md rounded-2xl p-5 border transition-all duration-300 hover:scale-105 ${
                isEnrolled
                  ? 'bg-green-400/20 border-green-300/30'
                  : 'bg-white/10 border-white/20'
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-xl ${isEnrolled ? 'bg-green-400/30' : 'bg-white/20'}`}>
                    {isEnrolled ? (
                      <TrendingUp className="w-6 h-6 text-white" />
                    ) : (
                      <Sparkles className="w-6 h-6 text-white" />
                    )}
                  </div>
                  <div>
                    <p className="text-white/90 text-sm font-medium">Status</p>
                    <p className="text-2xl font-bold text-white">
                      {isEnrolled ? 'Enrolled' : 'Available'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="mt-8 flex flex-wrap gap-3">
            {!isCreator && (
              isEnrolled ? (
                <button
                  onClick={handleUnenroll}
                  className="px-6 py-3 rounded-xl bg-white/10 backdrop-blur-sm border-2 border-white/30 hover:bg-white/20 text-white font-semibold flex items-center gap-2 transition-all duration-300 hover:scale-105 hover:shadow-lg"
                >
                  <UserMinus className="w-5 h-5" />
                  Leave Course
                </button>
              ) : (
                <button
                  onClick={handleEnroll}
                  className="px-6 py-3 rounded-xl bg-white text-purple-600 hover:bg-purple-50 font-semibold flex items-center gap-2 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
                >
                  <UserPlus className="w-5 h-5" />
                  Enroll Now
                </button>
              )
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="w-full px-4 sm:px-6 py-8" style={{width: '100%', maxWidth: 'none'}}>
        {canAccessMaterials ? (
          <div className="animate-fadeInUp">
            <CourseContentHub
              courseId={courseId}
              courseTitle={course.title}
              isInstructor={isCreator}
              enrolledEmails={getEnrolledEmails()}
              isHost={isCreator}
            />
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center border border-purple-100">
            <div className="bg-gradient-to-br from-purple-100 to-pink-100 rounded-full p-6 inline-block mb-4">
              <BookOpen className="w-12 h-12 text-purple-600" />
            </div>
            <h3 className="text-2xl font-bold text-gray-800 mb-2">Enroll to Access Course Materials</h3>
            <p className="text-gray-600 mb-6">
              Join this course to access lectures, meetings, and connect with other students!
            </p>
            <button
              onClick={handleEnroll}
              className="px-8 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold flex items-center gap-2 mx-auto shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
            >
              <UserPlus className="w-5 h-5" />
              Enroll Now
            </button>
          </div>
        )}
      </div>
    </div>
    </>
  );
};

export default CourseDetailPage;



