import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { onAuthStateChanged } from 'firebase/auth';
import {
  auth, getCourses, getEnrolledCourses,
  enrollInCourse, unenrollFromCourse,
} from '../firebase';
import {
  BookOpen, UserPlus, UserMinus, Users, GraduationCap,
  Award, Compass, Search, ArrowRight, ArrowLeft, Library,
  ChevronRight, Clock,
} from 'lucide-react';

const TAB_KEYS = ['explore', 'my', 'enrolled'];
const TAB_CONFIG = {
  explore:  { label: 'Explore',    Icon: Compass,  headline: 'Discover courses',     sub: 'Browse and enroll in community courses.' },
  my:       { label: 'My Courses', Icon: Award,    headline: 'Your teaching studio', sub: 'Courses you host — manage content and students.' },
  enrolled: { label: 'Enrolled',   Icon: Library,  headline: 'Continue learning',    sub: 'Every course you have joined.' },
};

const ACCENTS = [
  { from: 'from-sky-600',    to: 'to-cyan-600',    dot: 'bg-sky-400'    },
  { from: 'from-violet-600', to: 'to-blue-600',    dot: 'bg-violet-400' },
  { from: 'from-teal-600',   to: 'to-emerald-600', dot: 'bg-teal-400'   },
  { from: 'from-blue-600',   to: 'to-indigo-600',  dot: 'bg-blue-400'   },
];

/* ── Skeleton card ─────────────────────────────────────────────────────────── */
const SkeletonCard = () => (
  <div className="rounded-2xl border border-slate-700/50 bg-slate-900/60 overflow-hidden animate-pulse">
    <div className="h-1.5 bg-slate-700" />
    <div className="p-5 space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-slate-800" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-slate-800 rounded w-3/5" />
          <div className="h-3 bg-slate-800 rounded w-2/5" />
        </div>
      </div>
      <div className="space-y-1.5">
        <div className="h-3 bg-slate-800 rounded" />
        <div className="h-3 bg-slate-800 rounded w-4/5" />
      </div>
      <div className="h-9 bg-slate-800 rounded-xl" />
    </div>
  </div>
);

/* ── Course card ───────────────────────────────────────────────────────────── */
const CourseCard = ({ course, index, userId, isEnrolledFn, onEnroll, onUnenroll }) => {
  const navigate   = useNavigate();
  const [busy, setBusy] = useState(false);
  const isMine     = course.creatorId === userId;
  const enrolled   = isEnrolledFn(course.id);
  const accent     = ACCENTS[index % ACCENTS.length];
  const nStudents  = course.enrolledUsers?.length || 0;

  const openCourse = () => navigate(`/course/${course.id}`);

  const enroll = async (e) => {
    e.stopPropagation();
    setBusy(true);
    await onEnroll(course.id);
    setBusy(false);
  };

  const unenroll = async (e) => {
    e.stopPropagation();
    setBusy(true);
    await onUnenroll(course.id);
    setBusy(false);
  };

  return (
    <article
      onClick={openCourse}
      className="group relative rounded-2xl border border-slate-700/50 bg-slate-900/70 hover:border-slate-600 hover:bg-slate-900 transition-all duration-300 overflow-hidden cursor-pointer hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/40"
      style={{ animation: `fadeInUp 0.4s ease-out ${index * 0.06}s backwards` }}
    >
      {/* top accent bar */}
      <div className={`h-1 bg-gradient-to-r ${accent.from} ${accent.to}`} />

      <div className="p-5">
        {/* header */}
        <div className="flex items-start gap-3 mb-3">
          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${accent.from} ${accent.to} flex items-center justify-center shrink-0 shadow-lg group-hover:scale-105 transition-transform duration-300`}>
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-slate-100 text-sm sm:text-base leading-snug line-clamp-2 group-hover:text-sky-300 transition-colors duration-200">
              {course.title}
            </h2>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              {isMine && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-400/20 px-2 py-0.5 text-xs font-semibold text-amber-300">
                  <Award className="w-3 h-3" /> Creator
                </span>
              )}
              {enrolled && !isMine && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-400/20 px-2 py-0.5 text-xs font-semibold text-emerald-300">
                  Enrolled
                </span>
              )}
            </div>
          </div>
        </div>

        {/* description */}
        <p className="text-slate-400 text-xs sm:text-sm leading-relaxed line-clamp-2 mb-4">
          {course.description || 'Explore this course and enhance your skills!'}
        </p>

        {/* footer */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Users className="w-3.5 h-3.5" />
            <span>{nStudents} student{nStudents !== 1 ? 's' : ''}</span>
          </div>

          <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
            {enrolled && !isMine && (
              <button
                onClick={unenroll}
                disabled={busy}
                className="flex items-center gap-1.5 rounded-xl border border-slate-600 hover:border-red-400/50 hover:bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-red-300 transition-all duration-200 disabled:opacity-50"
              >
                <UserMinus className="w-3.5 h-3.5" />
                Leave
              </button>
            )}

            {!enrolled && !isMine && (
              <button
                onClick={enroll}
                disabled={busy}
                className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-600 hover:from-sky-500 hover:to-cyan-500 px-3 py-1.5 text-xs font-semibold text-white shadow-md shadow-sky-900/20 transition-all duration-200 disabled:opacity-50"
              >
                {busy
                  ? <div className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  : <UserPlus className="w-3.5 h-3.5" />}
                Enroll
              </button>
            )}

            <button
              onClick={openCourse}
              className="flex items-center gap-1 rounded-xl border border-slate-700 hover:border-sky-500/50 hover:bg-sky-500/5 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-sky-300 transition-all duration-200"
            >
              {isMine ? 'Manage' : 'Open'}
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
};

/* ── Page ──────────────────────────────────────────────────────────────────── */
const CoursesPage = () => {
  const navigate = useNavigate();
  const [userId,    setUserId]    = useState(null);
  const [tab,       setTab]       = useState('explore');
  const [courses,   setCourses]   = useState([]);
  const [myCourses, setMyCourses] = useState([]);
  const [enrolled,  setEnrolled]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState('');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => setUserId(u?.uid || null));
    return unsub;
  }, []);

  useEffect(() => {
    const load = async () => {
      if (!userId) { setLoading(false); return; }
      setLoading(true);
      try {
        const [all, mine, myEnroll] = await Promise.all([
          getCourses(), getCourses(userId), getEnrolledCourses(userId),
        ]);
        setCourses(all); setMyCourses(mine); setEnrolled(myEnroll);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, [userId]);

  const handleEnroll = async courseId => {
    if (!userId) return;
    await enrollInCourse(courseId, userId);
    setEnrolled(await getEnrolledCourses(userId));
  };

  const handleUnenroll = async courseId => {
    if (!userId) return;
    await unenrollFromCourse(courseId, userId);
    setEnrolled(await getEnrolledCourses(userId));
  };

  const isEnrolledFn = id => enrolled.some(c => c.id === id);

  const list = useMemo(() => {
    if (tab === 'explore') return courses.filter(c => c.creatorId !== userId);
    if (tab === 'my')      return myCourses;
    return enrolled;
  }, [tab, courses, myCourses, enrolled, userId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(c =>
      (c.title || '').toLowerCase().includes(q) ||
      (c.description || '').toLowerCase().includes(q)
    );
  }, [list, search]);

  const goTab = useCallback(id => { if (TAB_KEYS.includes(id)) setTab(id); }, []);
  const cfg    = TAB_CONFIG[tab];
  const TabIcon = cfg.Icon;

  const empty = useMemo(() => {
    if (search.trim()) return { title: 'No matches', hint: 'Try a different keyword.', action: () => setSearch(''), actionLabel: 'Clear search' };
    if (tab === 'enrolled') return { title: 'Not enrolled anywhere', hint: 'Browse the catalog and join a course.', action: () => goTab('explore'), actionLabel: 'Browse courses' };
    return { title: 'Nothing here yet', hint: 'No courses available right now.', action: () => goTab('explore'), actionLabel: 'Browse all courses' };
  }, [tab, search]);

  return (
    <>
      <Helmet>
        <title>Courses | InstruMentor</title>
      </Helmet>

      <div
        className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-900 text-slate-100"
        style={{ width: '100%', maxWidth: 'none' }}
      >
        {/* ── Header ── */}
        <div className="relative overflow-hidden border-b border-slate-800/80">
          <div className="pointer-events-none absolute -top-24 -right-24 w-80 h-80 rounded-full bg-sky-600/8 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 -left-16 w-64 h-64 rounded-full bg-violet-600/6 blur-3xl" />

          <div className="relative w-full px-4 sm:px-6 py-5 sm:py-7" style={{ width: '100%', maxWidth: 'none' }}>
            <button
              onClick={() => navigate('/')}
              className="mb-4 inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-slate-600 hover:text-slate-100 transition-all duration-200 group"
            >
              <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform duration-200" />
              Back
            </button>

            {/* Title row — no create button */}
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-600/30 to-cyan-600/30 border border-sky-500/20 flex items-center justify-center shrink-0">
                <TabIcon className="w-6 h-6 text-sky-300" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Courses</span>
                  <span className="text-xs text-slate-600">·</span>
                  <span className="text-xs text-slate-500">{loading ? '…' : `${list.length}`}</span>
                </div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-50">{cfg.headline}</h1>
                <p className="text-slate-400 text-sm mt-0.5 hidden sm:block">{cfg.sub}</p>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 overflow-x-auto scrollbar-hide">
              {TAB_KEYS.map(key => {
                const { label, Icon: TIcon } = TAB_CONFIG[key];
                const active = tab === key;
                return (
                  <button
                    key={key}
                    onClick={() => goTab(key)}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all duration-200 ${
                      active
                        ? 'bg-sky-500/15 border border-sky-500/30 text-sky-300'
                        : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'
                    }`}
                  >
                    <TIcon className="w-3.5 h-3.5" />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="w-full px-4 sm:px-6 py-5 sm:py-6" style={{ width: '100%', maxWidth: 'none' }}>
          {/* Search */}
          <div className="relative mb-5">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search courses…"
              className="w-full rounded-xl border border-slate-700 bg-slate-900/80 py-2.5 pl-10 pr-4 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500/60 focus:outline-none focus:ring-2 focus:ring-sky-500/20 transition"
            />
          </div>

          {/* Grid */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1,2,3,4,5,6].map(i => <SkeletonCard key={i} />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-700/60 bg-slate-900/60 p-10 sm:p-16 text-center">
              <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center mb-4">
                <BookOpen className="w-7 h-7 text-slate-500" />
              </div>
              <p className="font-bold text-slate-200 text-lg mb-1">{empty.title}</p>
              <p className="text-slate-400 text-sm mb-6 max-w-xs">{empty.hint}</p>
              <button
                onClick={empty.action}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-600 hover:from-sky-500 hover:to-cyan-500 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky-900/20 transition-all duration-200"
              >
                {empty.actionLabel} <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((course, i) => (
                <CourseCard
                  key={course.id}
                  course={course}
                  index={i}
                  userId={userId}
                  isEnrolledFn={isEnrolledFn}
                  onEnroll={handleEnroll}
                  onUnenroll={handleUnenroll}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default CoursesPage;