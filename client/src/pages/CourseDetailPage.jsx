import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  auth,
  getCourseById,
  enrollInCourse,
  unenrollFromCourse,
} from '../firebase';
import {
  Users, GraduationCap, Award, BookOpen, ArrowLeft,
  UserPlus, UserMinus, Sparkles, Check, Clock
} from 'lucide-react';
import CourseContentHub from '../components/CourseContentHub';

const fmtMonth = raw => {
  const d = raw?.toDate ? raw.toDate() : new Date(raw);
  return isNaN(d) ? '—' : d.toLocaleDateString([], { month: 'short', year: 'numeric' });
};

const CourseDetailPage = () => {
  const { courseId } = useParams();
  const navigate     = useNavigate();
  const userId       = auth.currentUser?.uid;

  const [course,    setCourse]    = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [enrolling, setEnrolling] = useState(false);

  const isCreator  = useMemo(() => course && course.creatorId === userId, [course, userId]);
  const isEnrolled = useMemo(() => !!course && (course.enrolledUsers || []).includes(userId), [course, userId]);

  const load = async () => {
    setLoading(true);
    try { setCourse(await getCourseById(courseId)); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [courseId]);

  const handleEnroll = async () => {
    setEnrolling(true);
    try { await enrollInCourse(courseId, userId); await load(); }
    finally { setEnrolling(false); }
  };

  const handleUnenroll = async () => {
    setEnrolling(true);
    try { await unenrollFromCourse(courseId, userId); await load(); }
    finally { setEnrolling(false); }
  };

  const getEnrolledEmails = () =>
    (course?.enrolledUsers || []).map(uid => `user-${uid}@email.com`);

  /* ── Loading ── */
  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-900 flex items-center justify-center" style={{ width: '100%', maxWidth: 'none' }}>
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-sky-500/30 border-t-sky-500 animate-spin" />
        <p className="text-slate-400 text-sm">Loading course…</p>
      </div>
    </div>
  );

  /* ── Not found ── */
  if (!course) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-900 flex items-center justify-center p-4" style={{ width: '100%', maxWidth: 'none' }}>
      <div className="text-center">
        <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto mb-4">
          <BookOpen className="w-7 h-7 text-slate-500" />
        </div>
        <h2 className="text-xl font-bold text-slate-200 mb-4">Course not found</h2>
        <button onClick={() => navigate('/courses')}
          className="px-6 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold transition-colors duration-200">
          Back to Courses
        </button>
      </div>
    </div>
  );

  const canAccess = isCreator || isEnrolled;

  return (
    <>
      <Helmet>
        <title>{course.title} | InstruMentor</title>
        <meta name="description" content={course.description || `Learn with ${course.title} on InstruMentor.`} />
      </Helmet>

      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-900 text-slate-100" style={{ width: '100%', maxWidth: 'none' }}>

        {/* ── Hero ── */}
        <div className="relative overflow-hidden border-b border-slate-800/80">
          <div className="pointer-events-none absolute -top-24 -right-24 w-80 h-80 rounded-full bg-sky-600/8 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 -left-16 w-64 h-64 rounded-full bg-violet-600/6 blur-3xl" />

          <div className="relative w-full px-4 sm:px-6 py-5 sm:py-7">

            {/* back */}
            <button
              onClick={() => navigate('/courses')}
              className="mb-5 inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-slate-600 hover:text-slate-100 transition-all duration-200 group"
            >
              <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform duration-200" />
              Back to Courses
            </button>

            {/* title row */}
            <div className="flex items-start gap-4 mb-4">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-sky-600/25 to-violet-600/25 border border-sky-500/20 flex items-center justify-center shrink-0">
                <GraduationCap className="w-5 h-5 text-sky-300" />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-50 leading-tight">
                  {course.title}
                </h1>
                {course.description && (
                  <p className="text-slate-400 text-sm mt-1 leading-relaxed line-clamp-2">
                    {course.description}
                  </p>
                )}
              </div>
            </div>

            {/* meta row */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-5 pl-[60px]">
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Users className="w-3.5 h-3.5" />
                <span>{course.enrolledUsers?.length || 0} students</span>
              </div>
              {course.createdAt && (
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Since {fmtMonth(course.createdAt)}</span>
                </div>
              )}
            </div>

            {/* status / action pills */}
            <div className="flex flex-wrap items-center gap-2 pl-[60px]">
              {/* creator badge */}
              {isCreator && (
                <div className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-1.5">
                  <Award className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-xs font-semibold text-amber-300">Instructor</span>
                </div>
              )}

              {/* enrolled badge */}
              {isEnrolled && !isCreator && (
                <div className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-xs font-semibold text-emerald-300">Enrolled</span>
                </div>
              )}

              {/* enroll / leave */}
              {!isCreator && (
                isEnrolled ? (
                  <button
                    onClick={handleUnenroll}
                    disabled={enrolling}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-600 hover:border-red-400/50 hover:bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-red-300 transition-all duration-200 disabled:opacity-50"
                  >
                    <UserMinus className="w-3.5 h-3.5" />
                    {enrolling ? 'Leaving…' : 'Leave Course'}
                  </button>
                ) : (
                  <button
                    onClick={handleEnroll}
                    disabled={enrolling}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-600 hover:from-sky-500 hover:to-cyan-500 disabled:opacity-50 px-4 py-1.5 text-xs font-semibold text-white shadow-md shadow-sky-900/20 transition-all duration-200"
                  >
                    {enrolling
                      ? <div className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      : <UserPlus className="w-3.5 h-3.5" />}
                    {enrolling ? 'Enrolling…' : 'Enroll Now'}
                  </button>
                )
              )}
            </div>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="w-full px-4 sm:px-6 py-5 sm:py-6" style={{ width: '100%', maxWidth: 'none' }}>
          {canAccess ? (
            <div style={{ animation: 'fadeInUp 0.25s ease-out' }}>
              <CourseContentHub
                courseId={courseId}
                courseTitle={course.title}
                isInstructor={isCreator}
                enrolledEmails={getEnrolledEmails()}
                isHost={isCreator}
              />
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-8 sm:p-12 text-center max-w-lg mx-auto">
              <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto mb-4">
                <BookOpen className="w-7 h-7 text-slate-500" />
              </div>
              <h3 className="text-lg font-bold text-slate-100 mb-2">Enroll to access this course</h3>
              <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                Join to view lectures, attend live meetings, and track your progress.
              </p>
              <button
                onClick={handleEnroll}
                disabled={enrolling}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-600 hover:from-sky-500 hover:to-cyan-500 disabled:opacity-50 px-7 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-900/25 transition-all duration-200"
              >
                {enrolling ? <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> : <UserPlus className="w-4 h-4" />}
                {enrolling ? 'Enrolling…' : 'Enroll Now'}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default CourseDetailPage;