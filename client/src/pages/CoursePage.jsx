import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { auth, db, getUserProfile, getMeetings, enrollInCourse } from '../firebase';
import { doc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import {
  BookOpen, Users, Calendar, Video, ArrowLeft, BarChart3,
  GraduationCap, Sparkles, UserPlus, Check, AlertCircle,
  Clock, Hash
} from 'lucide-react';
import CourseProgressDashboard  from '../components/CourseProgressDashboard';
import CourseContentHub         from '../components/CourseContentHub';
import CourseMeetingScheduler   from '../components/CourseMeetingScheduler';
import LoadingSpinner           from '../components/LoadingSpinner';

/* ─── helpers ──────────────────────────────────────────────────────────────── */
const fmtMonth = raw => {
  const d = raw?.toDate ? raw.toDate() : new Date(raw);
  return isNaN(d) ? '—' : d.toLocaleDateString([], { month: 'short', year: 'numeric' });
};

/* ─── Stat card ──────────────────────────────────────────────────────────── */
const Stat = ({ icon: Icon, value, label, accent }) => {
  const cls = {
    sky:     'bg-sky-500/10 border-sky-500/20 text-sky-400',
    violet:  'bg-violet-500/10 border-violet-500/20 text-violet-400',
    emerald: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
    amber:   'bg-amber-500/10 border-amber-500/20 text-amber-400',
  }[accent] || 'bg-slate-700 border-slate-600 text-slate-400';
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-700/60 bg-slate-900/50 px-3 py-3 sm:px-4 transition-all duration-200 hover:border-slate-600/60">
      <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${cls}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <p className="text-base sm:text-lg font-bold text-slate-100 leading-none truncate">{value}</p>
        <p className="text-xs text-slate-500 mt-0.5">{label}</p>
      </div>
    </div>
  );
};

/* ─── Tab button ─────────────────────────────────────────────────────────── */
const Tab = ({ id, label, icon: Icon, active, onClick }) => (
  <button
    onClick={() => onClick(id)}
    className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-3.5 text-xs sm:text-sm font-semibold border-b-2 whitespace-nowrap transition-all duration-200 ${
      active
        ? 'border-sky-400 text-sky-300'
        : 'border-transparent text-slate-500 hover:text-slate-300 hover:border-slate-600'
    }`}
  >
    <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
    <span>{label}</span>
  </button>
);

/* ─── Page ───────────────────────────────────────────────────────────────── */
const CoursePage = () => {
  const { courseId } = useParams();
  const navigate     = useNavigate();

  const [course,         setCourse]         = useState(null);
  const [meetings,       setMeetings]       = useState([]);
  const [creatorProfile, setCreatorProfile] = useState(null);
  const [isEnrolled,     setIsEnrolled]     = useState(false);
  const [isCreator,      setIsCreator]      = useState(false);
  const [loading,        setLoading]        = useState(true);
  const [enrolling,      setEnrolling]      = useState(false);
  const [enrollError,    setEnrollError]    = useState('');
  const [activeTab,      setActiveTab]      = useState('overview');

  const currentUserId = auth.currentUser?.uid;

  useEffect(() => { if (courseId) load(); }, [courseId, currentUserId]);

  const load = async () => {
    try {
      setLoading(true);
      const snap = await getDoc(doc(db, 'courses', courseId));
      if (!snap.exists()) { navigate('/courses'); return; }
      const data = { id: snap.id, ...snap.data() };
      setCourse(data);
      setCreatorProfile(await getUserProfile(data.creatorId));
      const enrolled = data.enrolledUsers?.includes(currentUserId) || false;
      const creator  = data.creatorId === currentUserId;
      setIsEnrolled(enrolled);
      setIsCreator(creator);
      if (enrolled || creator) setMeetings(await getMeetings(courseId));
    } catch (e) {
      console.error(e);
    } finally { setLoading(false); }
  };

  const handleEnroll = async () => {
    setEnrolling(true); setEnrollError('');
    try {
      await updateDoc(doc(db, 'courses', courseId), { enrolledUsers: arrayUnion(currentUserId) });
      setIsEnrolled(true);
      await load();
    } catch { setEnrollError('Failed to enroll. Please try again.'); }
    finally { setEnrolling(false); }
  };

  /* ── Loading ── */
  if (loading) return <LoadingSpinner message="Loading course…" />;

  /* ── Not found ── */
  if (!course) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-900 flex items-center justify-center p-4" style={{ width: '100%', maxWidth: 'none' }}>
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto mb-4">
          <BookOpen className="w-8 h-8 text-slate-500" />
        </div>
        <h2 className="text-xl font-bold text-slate-200 mb-4">Course not found</h2>
        <button onClick={() => navigate('/courses')}
          className="px-6 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold transition-colors duration-200">
          Back to Courses
        </button>
      </div>
    </div>
  );

  const tabs = [
    { id: 'overview',  label: 'Overview',  icon: BookOpen   },
    { id: 'content',   label: 'Lectures',  icon: Video      },
    ...(isEnrolled || isCreator ? [
      { id: 'meetings', label: 'Meetings', icon: Calendar   },
      { id: 'progress', label: 'Progress', icon: BarChart3  },
    ] : []),
  ];

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-900 text-slate-100"
      style={{ width: '100%', maxWidth: 'none' }}
    >
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
          <div className="flex items-start gap-4 mb-5">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-sky-600/25 to-violet-600/25 border border-sky-500/20 flex items-center justify-center shrink-0">
              <GraduationCap className="w-6 h-6 sm:w-7 sm:h-7 text-sky-300" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-50 leading-tight mb-2">
                {course.title}
              </h1>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <GraduationCap className="w-3.5 h-3.5 text-slate-500" />
                  <span>{creatorProfile?.displayName || 'Unknown Instructor'}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <Users className="w-3.5 h-3.5 text-slate-500" />
                  <span>{course.enrolledUsers?.length || 0} students</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  <span>Since {fmtMonth(course.createdAt)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* status pills */}
          <div className="flex flex-wrap items-center gap-2">
            {!isEnrolled && !isCreator && (
              <button
                onClick={handleEnroll}
                disabled={enrolling}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-600 hover:from-sky-500 hover:to-cyan-500 disabled:opacity-50 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-sky-900/25 transition-all duration-200"
              >
                {enrolling
                  ? <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  : <UserPlus className="w-4 h-4" />}
                {enrolling ? 'Enrolling…' : 'Enroll Now'}
              </button>
            )}
            {isEnrolled && !isCreator && (
              <div className="flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
                <Check className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-semibold text-emerald-300">Enrolled</span>
              </div>
            )}
            {isCreator && (
              <div className="flex items-center gap-1.5 rounded-xl border border-violet-500/30 bg-violet-500/10 px-3 py-2">
                <Sparkles className="w-4 h-4 text-violet-400" />
                <span className="text-sm font-semibold text-violet-300">Your Course</span>
              </div>
            )}
            {enrollError && (
              <span className="text-xs text-red-400 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" /> {enrollError}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="w-full px-4 sm:px-6 py-5 sm:py-6" style={{ width: '100%', maxWidth: 'none' }}>

        {/* not enrolled gate */}
        {!isEnrolled && !isCreator ? (
          <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-8 sm:p-12 text-center max-w-lg mx-auto">
            <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto mb-4">
              <BookOpen className="w-7 h-7 text-slate-500" />
            </div>
            <h3 className="text-lg font-bold text-slate-100 mb-2">Enroll to access this course</h3>
            <p className="text-slate-400 text-sm mb-6 leading-relaxed">
              Join to view materials, attend live meetings, and track your progress.
            </p>
            {enrollError && (
              <p className="text-xs text-red-400 flex items-center justify-center gap-1 mb-4">
                <AlertCircle className="w-3.5 h-3.5" /> {enrollError}
              </p>
            )}
            <button
              onClick={handleEnroll}
              disabled={enrolling}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-600 hover:from-sky-500 hover:to-cyan-500 disabled:opacity-50 px-7 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-900/25 transition-all duration-200"
            >
              {enrolling ? <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> : <UserPlus className="w-4 h-4" />}
              {enrolling ? 'Enrolling…' : 'Enroll Now'}
            </button>
          </div>

        ) : (
          <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 overflow-hidden">

            {/* tabs */}
            <div className="border-b border-slate-700/60 overflow-x-auto scrollbar-hide">
              <nav className="flex px-2 min-w-max">
                {tabs.map(t => <Tab key={t.id} {...t} active={activeTab === t.id} onClick={setActiveTab} />)}
              </nav>
            </div>

            {/* tab panels — fade transition */}
            <div className="p-4 sm:p-5 lg:p-6">

              {/* ── Overview ── */}
              {activeTab === 'overview' && (
                <div
                  className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5"
                  style={{ animation: 'fadeInUp 0.25s ease-out' }}
                >
                  {/* left col */}
                  <div className="lg:col-span-2 space-y-4">
                    <div className="rounded-2xl border border-slate-700/60 bg-slate-950/40 p-4 sm:p-5">
                      <h2 className="font-semibold text-slate-100 text-sm mb-3 flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-sky-400" /> About This Course
                      </h2>
                      <p className="text-slate-400 text-sm leading-relaxed">
                        {course.description || 'No description provided.'}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { label: 'Students Enrolled', value: course.enrolledUsers?.length || 0, color: 'text-sky-400' },
                        { label: 'Meetings',           value: meetings.length,                   color: 'text-violet-400' },
                        { label: 'Course Materials',   value: course.materials?.length || 0,    color: 'text-emerald-400' },
                        { label: 'Date Created',       value: fmtMonth(course.createdAt),        color: 'text-amber-400' },
                      ].map(s => (
                        <div
                          key={s.label}
                          className="rounded-2xl border border-slate-700/60 bg-slate-950/40 p-4 text-center transition-all duration-200 hover:border-slate-600/60"
                        >
                          <p className={`text-2xl sm:text-3xl font-bold mb-1 ${s.color}`}>{s.value}</p>
                          <p className="text-xs text-slate-500">{s.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* right col */}
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-slate-700/60 bg-slate-950/40 p-4 sm:p-5">
                      <h3 className="font-semibold text-slate-300 text-sm mb-4 flex items-center gap-2">
                        <GraduationCap className="w-4 h-4 text-sky-400" /> Instructor
                      </h3>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-500 to-violet-500 flex items-center justify-center text-white font-bold shrink-0 text-sm">
                          {(creatorProfile?.displayName || 'I')[0].toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-100 text-sm truncate">{creatorProfile?.displayName || 'Unknown'}</p>
                          <p className="text-xs text-slate-500 truncate">{creatorProfile?.email || ''}</p>
                        </div>
                      </div>
                    </div>

                    {isCreator && (
                      <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-4 sm:p-5">
                        <h3 className="font-semibold text-violet-300 text-sm mb-3 flex items-center gap-2">
                          <Sparkles className="w-4 h-4" /> Quick Actions
                        </h3>
                        <div className="space-y-2">
                          {[
                            { tab: 'content',  icon: Video,     label: 'Manage Lectures'  },
                            { tab: 'meetings', icon: Calendar,  label: 'Schedule Meeting' },
                            { tab: 'progress', icon: BarChart3, label: 'View Progress'    },
                          ].map(({ tab, icon: Icon, label }) => (
                            <button
                              key={tab}
                              onClick={() => setActiveTab(tab)}
                              className="w-full flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-900 hover:border-violet-500/40 hover:bg-violet-500/5 px-3 py-2.5 text-sm text-slate-300 hover:text-violet-300 transition-all duration-200"
                            >
                              <Icon className="w-4 h-4 shrink-0" /> {label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── Content (Lectures) ── */}
              {activeTab === 'content' && (
                <div style={{ animation: 'fadeInUp 0.25s ease-out' }}>
                  <CourseContentHub
                    courseId={courseId}
                    courseTitle={course.title}
                    isInstructor={isCreator}
                    enrolledEmails={course.enrolledUsers || []}
                    isHost={isCreator}
                  />
                </div>
              )}

              {/* ── Meetings ── */}
              {activeTab === 'meetings' && (
                <div style={{ animation: 'fadeInUp 0.25s ease-out' }}>
                  <CourseMeetingScheduler
                    courseId={courseId}
                    courseTitle={course.title}
                    enrolledEmails={course.enrolledUsers || []}
                    isHost={isCreator}
                    onMeetingScheduled={m => setMeetings(p => [...p, m])}
                  />
                </div>
              )}

              {/* ── Progress ── */}
              {activeTab === 'progress' && (isEnrolled || isCreator) && (
                <div style={{ animation: 'fadeInUp 0.25s ease-out' }}>
                  <CourseProgressDashboard courseId={courseId} courseTitle={course.title} />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CoursePage;