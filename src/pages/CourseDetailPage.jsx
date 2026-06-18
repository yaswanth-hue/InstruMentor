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
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-900 flex items-center justify-center" style={{width: '100%', maxWidth: 'none'}}>
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-sky-500"></div>
          <p className="mt-4 text-slate-300 font-medium">Loading course details...</p>
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-900 flex items-center justify-center" style={{width: '100%', maxWidth: 'none'}}>
        <div className="text-center">
          <div className="bg-slate-800 rounded-full p-6 shadow-lg mb-4 inline-block border border-slate-700">
            <BookOpen className="w-16 h-16 text-slate-400" />
          </div>
          <p className="text-xl text-slate-200 font-medium">Course not found</p>
          <button
            onClick={() => navigate('/courses')}
            className="mt-4 px-6 py-3 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-600 text-white font-semibold hover:shadow-lg transition-all duration-300"
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
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-900 text-slate-100" style={{width: '100%', maxWidth: 'none'}}>
      {/* Hero Section with Gradient Background */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 shadow-lg relative overflow-hidden border-b border-sky-300/20">
        {/* Decorative background elements */}
        <div className="absolute inset-0 bg-black/30"></div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-sky-500/20 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl"></div>

        <div className="relative w-full px-4 sm:px-6 py-8 sm:py-12" style={{width: '100%', maxWidth: 'none'}}>
          {/* Back Button */}
          <button
            onClick={() => navigate('/courses')}
            className="mb-6 inline-flex items-center gap-1.5 rounded-lg border border-sky-300/30 bg-slate-900/80 px-2.5 py-1.5 text-xs font-medium text-slate-200 transition-all duration-300 hover:border-sky-300/60 hover:bg-slate-800 group"
          >
            <ArrowLeft className="h-3.5 w-3.5 group-hover:-translate-x-1 transition-transform duration-300" />
            <span>Back</span>
          </button>

          {/* Course Header */}
          <div className="flex items-start gap-4 mb-6">
            <div className="bg-slate-800/80 backdrop-blur-sm p-4 rounded-2xl shadow-lg border border-sky-300/20">
              <GraduationCap className="w-10 h-10 sm:w-12 sm:h-12 text-white" />
            </div>
            <div className="flex-1">
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-slate-100 drop-shadow-lg mb-3 animate-fadeIn">
                {course.title}
              </h1>
              <p className="text-lg text-slate-300 leading-relaxed max-w-3xl animate-slideDown">
                {course.description || 'Explore this amazing course and enhance your skills!'}
              </p>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
            {/* Enrolled Students */}
            <div className="bg-slate-900/70 backdrop-blur-md rounded-2xl p-5 border border-sky-300/20 hover:bg-slate-800/80 transition-all duration-300 hover:scale-105">
              <div className="flex items-center gap-3">
                <div className="bg-slate-800 p-3 rounded-xl border border-sky-300/20">
                  <Users className="w-6 h-6 text-sky-300" />
                </div>
                <div>
                  <p className="text-slate-400 text-sm font-medium">Enrolled Students</p>
                  <p className="text-3xl font-bold text-slate-100">{course.enrolledUsers?.length || 0}</p>
                </div>
              </div>
            </div>

            {/* Instructor Badge */}
            {isCreator && (
              <div className="bg-slate-900/70 backdrop-blur-md rounded-2xl p-5 border border-amber-300/30 hover:scale-105 transition-all duration-300">
                <div className="flex items-center gap-3">
                  <div className="bg-amber-500/20 p-3 rounded-xl border border-amber-300/30">
                    <Award className="w-6 h-6 text-amber-200" />
                  </div>
                  <div>
                    <p className="text-slate-300 text-sm font-medium">Your Role</p>
                    <p className="text-2xl font-bold text-slate-100">Instructor</p>
                  </div>
                </div>
              </div>
            )}

            {/* Status Badge */}
            {!isCreator && (
              <div className={`backdrop-blur-md rounded-2xl p-5 border transition-all duration-300 hover:scale-105 ${
                isEnrolled
                  ? 'bg-emerald-500/15 border-emerald-300/30'
                  : 'bg-slate-900/70 border-sky-300/20'
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-xl border ${isEnrolled ? 'bg-emerald-500/20 border-emerald-300/30' : 'bg-slate-800 border-sky-300/20'}`}>
                    {isEnrolled ? (
                      <TrendingUp className="w-6 h-6 text-emerald-200" />
                    ) : (
                      <Sparkles className="w-6 h-6 text-sky-300" />
                    )}
                  </div>
                  <div>
                    <p className="text-slate-300 text-sm font-medium">Status</p>
                    <p className="text-2xl font-bold text-slate-100">
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
                  className="px-6 py-3 rounded-xl bg-slate-900/80 backdrop-blur-sm border-2 border-slate-600 hover:bg-red-900/20 hover:border-red-400/60 text-slate-100 font-semibold flex items-center gap-2 transition-all duration-300 hover:scale-105 hover:shadow-lg"
                >
                  <UserMinus className="w-5 h-5" />
                  Leave Course
                </button>
              ) : (
                <button
                  onClick={handleEnroll}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-600 hover:from-sky-700 hover:to-cyan-700 text-white font-semibold flex items-center gap-2 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
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
          <div className="bg-slate-900/80 rounded-2xl shadow-2xl shadow-black/40 p-8 text-center border border-sky-300/20">
            <div className="bg-gradient-to-br from-sky-900/60 to-cyan-900/60 rounded-full p-6 inline-block mb-4">
              <BookOpen className="w-12 h-12 text-sky-300" />
            </div>
            <h3 className="text-2xl font-bold text-slate-100 mb-2">Enroll to Access Course Materials</h3>
            <p className="text-slate-300 mb-6">
              Join this course to access lectures, meetings, and connect with other students!
            </p>
            <button
              onClick={handleEnroll}
              className="px-8 py-3 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-600 hover:from-sky-700 hover:to-cyan-700 text-white font-semibold flex items-center gap-2 mx-auto shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
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



