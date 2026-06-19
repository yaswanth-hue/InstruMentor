import React, { useState, useEffect } from 'react';
import {
  Upload, Video, Play, Trash2, GripVertical, FileVideo,
  Calendar, Clock, Users, Loader, X, Plus, ChevronDown,
  ChevronUp, Film, Sparkles, Paperclip, FileText,
  Phone, CheckCircle2, AlertCircle, ChevronLeft, ChevronRight
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

/* ─── helpers ──────────────────────────────────────────────────────────────── */
const formatFileSize = (bytes) => {
  if (!bytes) return '';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};

const formatDate = (timestamp) => {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
};

const formatRelative = (timestamp) => {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const now = new Date();
  const diff = date - now;
  const days = Math.ceil(diff / 86400000);
  if (diff < 0) return 'Completed';
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days < 7) return `In ${days} days`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

/* ─── Empty state ──────────────────────────────────────────────────────────── */
const EmptyState = ({ icon: Icon, title, subtitle }) => (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    <div className="w-16 h-16 rounded-2xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center mb-4">
      <Icon className="w-7 h-7 text-slate-500" />
    </div>
    <p className="font-semibold text-slate-200 text-base mb-1">{title}</p>
    <p className="text-slate-500 text-sm max-w-xs leading-relaxed">{subtitle}</p>
  </div>
);

/* ─── Inline DateTimePicker ─────────────────────────────────────────────────── */
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS   = ['Su','Mo','Tu','We','Th','Fr','Sa'];
const HOURS  = Array.from({ length: 12 }, (_, i) => String(i === 0 ? 12 : i).padStart(2, '0'));
const MINS   = ['00','15','30','45'];

/* Convert 12h+ampm → 24h integer */
const to24 = (h, ap) => {
  let hrs = parseInt(h, 10);
  if (ap === 'PM' && hrs !== 12) hrs += 12;
  if (ap === 'AM' && hrs === 12) hrs = 0;
  return hrs;
};

const DateTimePicker = ({ value, onChange }) => {
  const now     = new Date();
  const initDate = value ? new Date(value) : null;

  const [viewYear,  setViewYear]  = useState(initDate?.getFullYear()  ?? now.getFullYear());
  const [viewMonth, setViewMonth] = useState(initDate?.getMonth()     ?? now.getMonth());
  const [selDate,   setSelDate]   = useState(initDate ?? null);
  const [hour,      setHour]      = useState(initDate ? String(initDate.getHours() % 12 || 12).padStart(2,'0') : '09');
  const [minute,    setMinute]    = useState(initDate ? (['00','15','30','45'].find(m => parseInt(m) >= initDate.getMinutes()) ?? '00') : '00');
  const [ampm,      setAmpm]      = useState(initDate ? (initDate.getHours() >= 12 ? 'PM' : 'AM') : 'AM');

  /* Is the selected date today? */
  const isSelectedToday = selDate &&
    selDate.getFullYear() === now.getFullYear() &&
    selDate.getMonth()    === now.getMonth()    &&
    selDate.getDate()     === now.getDate();

  /* Is a given 12h hour+ampm combo in the past (only matters when today is selected) */
  const isHourPast = (h, ap) => {
    if (!isSelectedToday) return false;
    return to24(h, ap) < now.getHours();
  };

  /* Is a given minute in the past for the currently selected hour (today only) */
  const isMinutePast = (m) => {
    if (!isSelectedToday) return false;
    const h24 = to24(hour, ampm);
    if (h24 > now.getHours()) return false;
    if (h24 < now.getHours()) return true;
    return parseInt(m, 10) <= now.getMinutes();
  };

  /* Is an AM/PM option entirely in the past (today only) */
  const isAmpmPast = (ap) => {
    if (!isSelectedToday) return false;
    // PM is past only if current time is past 11:59 PM — never
    // AM is past if it's already PM
    if (ap === 'AM' && now.getHours() >= 12) return true;
    return false;
  };

  /* Auto-advance time to nearest valid slot when date changes to today */
  const autoAdvanceTime = (date) => {
    const isToday =
      date.getFullYear() === now.getFullYear() &&
      date.getMonth()    === now.getMonth()    &&
      date.getDate()     === now.getDate();
    if (!isToday) return { h: hour, m: minute, ap: ampm };

    // find next valid 15-min slot
    const nowMins = now.getHours() * 60 + now.getMinutes() + 1; // +1 = strictly future
    const nextSlot = Math.ceil(nowMins / 15) * 15;
    const nextH24  = Math.floor(nextSlot / 60) % 24;
    const nextMin  = nextSlot % 60;
    const nextAp   = nextH24 >= 12 ? 'PM' : 'AM';
    const nextH12  = String(nextH24 % 12 || 12).padStart(2, '0');
    const nextM    = String(nextMin).padStart(2, '0');
    // snap minute to grid
    const snappedM = MINS.find(m => parseInt(m) >= parseInt(nextM)) ?? '00';
    return { h: nextH12, m: snappedM, ap: nextAp };
  };

  const commit = (date, h, m, ap) => {
    if (!date) return;
    const d = new Date(date);
    d.setHours(to24(h, ap), parseInt(m, 10), 0, 0);
    onChange(d.toISOString().slice(0, 16));
  };

  const pickDate = (day) => {
    const d = new Date(viewYear, viewMonth, day);
    const { h, m, ap } = autoAdvanceTime(d);
    setSelDate(d); setHour(h); setMinute(m); setAmpm(ap);
    commit(d, h, m, ap);
  };

  const changeHour = (h) => {
    // if hour is past on today, skip
    if (isHourPast(h, ampm)) return;
    setHour(h);
    // if chosen minute is now past, snap forward
    let m = minute;
    if (isMinutePastFor(h, ampm, minute)) {
      m = MINS.find(mn => !isMinutePastFor(h, ampm, mn)) ?? '00';
      setMinute(m);
    }
    if (selDate) commit(selDate, h, m, ampm);
  };

  const changeMin = (m) => {
    if (isMinutePast(m)) return;
    setMinute(m);
    if (selDate) commit(selDate, hour, m, ampm);
  };

  const changeAmpm = (ap) => {
    if (isAmpmPast(ap)) return;
    // if switching to AM on today and all AM hours are past, block
    setAmpm(ap);
    // re-validate hour
    let h = hour;
    if (isHourPast(h, ap)) {
      h = HOURS.find(hr => !isHourPast(hr, ap)) ?? '12';
      setHour(h);
    }
    let m = minute;
    if (isMinutePastFor(h, ap, m)) {
      m = MINS.find(mn => !isMinutePastFor(h, ap, mn)) ?? '00';
      setMinute(m);
    }
    if (selDate) commit(selDate, h, m, ap);
  };

  /* Helper: check minute past for arbitrary h+ap (not just current state) */
  const isMinutePastFor = (h, ap, m) => {
    if (!isSelectedToday) return false;
    const h24 = to24(h, ap);
    if (h24 > now.getHours()) return false;
    if (h24 < now.getHours()) return true;
    return parseInt(m, 10) <= now.getMinutes();
  };

  const prevMonth = () => viewMonth === 0  ? (setViewMonth(11), setViewYear(y => y-1)) : setViewMonth(m => m-1);
  const nextMonth = () => viewMonth === 11 ? (setViewMonth(0),  setViewYear(y => y+1)) : setViewMonth(m => m+1);

  const daysInMonth  = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstWeekDay = new Date(viewYear, viewMonth, 1).getDay();

  const isCalToday    = d => now.getFullYear()===viewYear && now.getMonth()===viewMonth && now.getDate()===d;
  const isCalSelected = d => selDate && selDate.getFullYear()===viewYear && selDate.getMonth()===viewMonth && selDate.getDate()===d;
  const isCalPast     = d => new Date(viewYear, viewMonth, d) < new Date(now.getFullYear(), now.getMonth(), now.getDate());

  return (
    <div className="rounded-xl border border-slate-700/80 bg-slate-950/60 overflow-hidden">
      {/* ── Calendar ── */}
      <div className="p-4">
        {/* month nav */}
        <div className="flex items-center justify-between mb-3">
          <button type="button" onClick={prevMonth}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold text-slate-100">{MONTHS[viewMonth]} {viewYear}</span>
          <button type="button" onClick={nextMonth}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* day headers */}
        <div className="grid grid-cols-7 mb-1">
          {DAYS.map(d => (
            <div key={d} className="text-center text-xs font-semibold text-slate-600 py-1">{d}</div>
          ))}
        </div>

        {/* day grid */}
        <div className="grid grid-cols-7 gap-y-0.5">
          {Array.from({ length: firstWeekDay }).map((_, i) => <div key={`e${i}`} />)}
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => (
            <button
              key={day}
              type="button"
              disabled={isCalPast(day)}
              onClick={() => pickDate(day)}
              className={`h-8 w-full rounded-lg text-xs font-medium transition-all duration-100 ${
                isCalSelected(day)
                  ? 'bg-violet-600 text-white font-bold shadow-sm'
                  : isCalToday(day)
                  ? 'border border-violet-500/50 text-violet-300'
                  : isCalPast(day)
                  ? 'text-slate-700 cursor-not-allowed'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              {day}
            </button>
          ))}
        </div>
      </div>

      {/* ── Time row ── */}
      <div className="border-t border-slate-700/60 px-4 py-3">
        <div className="flex items-center gap-2 mb-2">
          <Clock className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Time</span>
          {isSelectedToday && (
            <span className="text-xs text-amber-400/80 ml-auto">Past times are disabled</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* hour */}
          <div className="flex-1 grid grid-cols-4 gap-1">
            {HOURS.map(h => {
              const past = isHourPast(h, ampm);
              return (
                <button key={h} type="button" disabled={past} onClick={() => changeHour(h)}
                  className={`py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    hour === h && !past
                      ? 'bg-violet-600 text-white'
                      : past
                      ? 'text-slate-700 cursor-not-allowed bg-slate-900/30'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                  }`}>
                  {h}
                </button>
              );
            })}
          </div>

          <div className="flex flex-col gap-1 shrink-0">
            {/* AM/PM */}
            {['AM','PM'].map(ap => {
              const past = isAmpmPast(ap);
              return (
                <button key={ap} type="button" disabled={past} onClick={() => changeAmpm(ap)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    ampm === ap && !past
                      ? 'bg-violet-600 text-white'
                      : past
                      ? 'text-slate-700 cursor-not-allowed bg-slate-900/30'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}>
                  {ap}
                </button>
              );
            })}
          </div>
        </div>

        {/* minutes */}
        <div className="flex gap-2 mt-2">
          {MINS.map(m => {
            const past = isMinutePast(m);
            return (
              <button key={m} type="button" disabled={past} onClick={() => changeMin(m)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  minute === m && !past
                    ? 'bg-violet-600 text-white'
                    : past
                    ? 'text-slate-700 cursor-not-allowed bg-slate-900/30'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}>
                :{m}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Summary strip ── */}
      {selDate && (
        <div className="border-t border-slate-700/60 px-4 py-2.5 flex items-center justify-between">
          <span className="text-xs text-violet-300 font-medium">
            {MONTHS[selDate.getMonth()].slice(0,3)} {selDate.getDate()}, {selDate.getFullYear()} · {hour}:{minute} {ampm}
          </span>
          <button type="button" onClick={() => { setSelDate(null); onChange(''); }}
            className="text-xs text-slate-600 hover:text-red-400 transition-colors">
            Clear
          </button>
        </div>
      )}
    </div>
  );
};

/* ─── Component ────────────────────────────────────────────────────────────── */
const CourseContentHub = ({ courseId, courseTitle, isInstructor, enrolledEmails, isHost }) => {
  const [activeTab,        setActiveTab]        = useState('lectures');
  const [lectures,         setLectures]         = useState([]);
  const [meetings,         setMeetings]         = useState([]);
  const [loading,          setLoading]          = useState(true);
  const [uploading,        setUploading]        = useState(false);
  const [uploadProgress,   setUploadProgress]   = useState(0);
  const [showUploadModal,  setShowUploadModal]  = useState(false);
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [selectedFile,     setSelectedFile]     = useState(null);
  const [lectureTitle,     setLectureTitle]     = useState('');
  const [attachments,      setAttachments]      = useState([]);
  const [draggedItem,      setDraggedItem]      = useState(null);
  const [playingVideo,     setPlayingVideo]     = useState(null);
  const [expandedMeeting,  setExpandedMeeting]  = useState(null);
  const [newMeeting, setNewMeeting] = useState({ title: '', description: '', scheduledTime: '' });

  useEffect(() => { loadContent(); }, [courseId]);

  const loadContent = async () => {
    try {
      setLoading(true);
      const [lecturesData, meetingsData] = await Promise.all([
        getCourseMaterials(courseId),
        getMeetings(courseId)
      ]);
      setLectures(lecturesData);
      setMeetings(meetingsData);
    } catch (e) {
      console.error('Error loading content:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('video/')) { alert('Please select a video file'); return; }
    setSelectedFile(file);
    setLectureTitle(file.name.replace(/\.[^/.]+$/, ''));
  };

  const handleAttachmentSelect = (e) => {
    const files = Array.from(e.target.files);
    const next = files.map(file => ({
      file, name: file.name, size: file.size, type: file.type,
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null
    }));
    setAttachments(prev => [...prev, ...next]);
  };

  const removeAttachment = (index) => {
    setAttachments(prev => {
      const updated = [...prev];
      if (updated[index].preview) URL.revokeObjectURL(updated[index].preview);
      updated.splice(index, 1);
      return updated;
    });
  };

  const handleUpload = async () => {
    if (!selectedFile || !lectureTitle.trim()) return;
    try {
      setUploading(true);
      setUploadProgress(0);
      await uploadCourseMaterial(
        courseId, selectedFile, lectureTitle,
        auth.currentUser?.uid,
        (p) => setUploadProgress(p)
      );
      setSelectedFile(null); setLectureTitle(''); setAttachments([]);
      setShowUploadModal(false); setUploadProgress(0);
      await loadContent();
    } catch (e) {
      console.error('Upload error:', e);
      alert('Failed to upload. Please try again.');
    } finally { setUploading(false); }
  };

  const handleCreateMeeting = async () => {
    if (!newMeeting.title.trim() || !newMeeting.scheduledTime) return;
    try {
      const currentUserId = auth.currentUser?.uid;
      await createMeeting({
        courseId, title: newMeeting.title, description: newMeeting.description,
        scheduledTime: new Date(newMeeting.scheduledTime),
        participants: [currentUserId, ...(enrolledEmails || [])],
        status: 'scheduled'
      });
      setShowMeetingModal(false);
      setNewMeeting({ title: '', description: '', scheduledTime: '' });
      await loadContent();
    } catch (e) {
      console.error('Error creating meeting:', e);
    }
  };

  const handleDelete = async (lectureId) => {
    if (!confirm('Delete this lecture?')) return;
    try {
      await deleteCourseMaterial(lectureId);
      await loadContent();
    } catch (e) { console.error('Delete error:', e); }
  };

  const handleDragStart = (e, index) => {
    setDraggedItem(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (draggedItem === null || draggedItem === index) return;
    const updated = [...lectures];
    const [moved] = updated.splice(draggedItem, 1);
    updated.splice(index, 0, moved);
    setLectures(updated);
    setDraggedItem(index);
  };

  const handleDragEnd = async () => {
    if (draggedItem !== null) {
      try { await reorderCourseMaterials(courseId, lectures); }
      catch { await loadContent(); }
    }
    setDraggedItem(null);
  };

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-sky-500/30 border-t-sky-500 animate-spin" />
        <p className="text-slate-400 text-sm">Loading content…</p>
      </div>
    </div>
  );

  /* ─── Render ── */
  return (
    <div className="space-y-4">

      {/* ── Tab switcher ── */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex rounded-xl border border-slate-700/60 bg-slate-950/60 p-1 gap-1">
          {[
            { id: 'lectures', icon: Video,    label: 'Lectures', count: lectures.length },
            { id: 'meetings', icon: Calendar, label: 'Meetings', count: meetings.length },
          ].map(({ id, icon: Icon, label, count }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                  active
                    ? 'bg-sky-500/15 border border-sky-500/25 text-sky-300 shadow-sm'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                  active ? 'bg-sky-500/20 text-sky-300' : 'bg-slate-800 text-slate-500'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* action button */}
        {isInstructor && activeTab === 'lectures' && (
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-600 hover:from-sky-500 hover:to-cyan-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-sky-900/20 transition-all duration-200"
          >
            <Upload className="w-4 h-4" />
            <span className="hidden sm:inline">Upload Lecture</span>
            <span className="sm:hidden">Upload</span>
          </button>
        )}
        {isInstructor && activeTab === 'meetings' && (
          <button
            onClick={() => setShowMeetingModal(true)}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-violet-900/20 transition-all duration-200"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Schedule Meeting</span>
            <span className="sm:hidden">Schedule</span>
          </button>
        )}
      </div>

      {/* ── Lectures tab ── */}
      {activeTab === 'lectures' && (
        <div style={{ animation: 'fadeInUp 0.2s ease-out' }}>
          {lectures.length === 0 ? (
            <EmptyState
              icon={FileVideo}
              title="No lectures yet"
              subtitle={isInstructor
                ? 'Upload your first lecture to get started.'
                : 'Lectures will appear here once the instructor uploads them.'}
            />
          ) : (
            <div className="space-y-2">
              {lectures.map((lecture, index) => (
                <div
                  key={lecture.id}
                  draggable={isInstructor}
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  className={`group rounded-xl border transition-all duration-200 overflow-hidden ${
                    playingVideo === lecture.id
                      ? 'border-sky-500/60 bg-slate-900'
                      : 'border-slate-700/60 bg-slate-950/40 hover:border-slate-600/60 hover:bg-slate-900/60'
                  } ${draggedItem === index ? 'opacity-40 scale-[0.98]' : ''}`}
                >
                  <div className="flex items-center gap-3 px-4 py-3.5">
                    {isInstructor && (
                      <GripVertical className="w-4 h-4 text-slate-600 hover:text-slate-400 cursor-move shrink-0 transition-colors" />
                    )}

                    {/* index badge */}
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-600/30 to-cyan-600/30 border border-sky-500/20 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-sky-300">{index + 1}</span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-slate-100 truncate">{lecture.title}</h3>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
                        <FileVideo className="w-3 h-3" />
                        <span className="truncate">{lecture.fileName || 'Video file'}</span>
                        {lecture.fileSize && (
                          <span className="shrink-0">· {formatFileSize(lecture.fileSize)}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => setPlayingVideo(playingVideo === lecture.id ? null : lecture.id)}
                        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-200 ${
                          playingVideo === lecture.id
                            ? 'bg-sky-500/20 border border-sky-500/30 text-sky-300'
                            : 'bg-slate-800 hover:bg-sky-500/10 border border-slate-700 hover:border-sky-500/30 text-slate-300 hover:text-sky-300'
                        }`}
                      >
                        <Play className="w-3.5 h-3.5" />
                        {playingVideo === lecture.id ? 'Close' : 'Play'}
                      </button>

                      {isInstructor && (
                        <button
                          onClick={() => handleDelete(lecture.id)}
                          className="p-1.5 rounded-lg border border-transparent hover:border-red-500/30 hover:bg-red-500/10 text-slate-600 hover:text-red-400 transition-all duration-200"
                          title="Delete lecture"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* video player */}
                  {playingVideo === lecture.id && (
                    <div
                      className="border-t border-slate-700/60 bg-black"
                      style={{ animation: 'fadeInUp 0.15s ease-out' }}
                    >
                      <video controls autoPlay className="w-full max-h-96" src={lecture.fileUrl}>
                        Your browser does not support the video tag.
                      </video>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Meetings tab ── */}
      {activeTab === 'meetings' && (
        <div style={{ animation: 'fadeInUp 0.2s ease-out' }}>
          {meetings.length === 0 ? (
            <EmptyState
              icon={Calendar}
              title="No meetings scheduled"
              subtitle={isInstructor
                ? 'Schedule a live session for your students.'
                : 'Meetings will appear here once the instructor schedules them.'}
            />
          ) : (
            <div className="space-y-2">
              {meetings.map((meeting) => {
                const meetingDate = meeting.scheduledTime?.toDate
                  ? meeting.scheduledTime.toDate()
                  : new Date(meeting.scheduledTime);
                const isPast      = meetingDate < new Date();
                const isExpanded  = expandedMeeting === meeting.id;
                const relative    = formatRelative(meeting.scheduledTime);

                return (
                  <div
                    key={meeting.id}
                    className={`rounded-xl border transition-all duration-200 overflow-hidden ${
                      isPast
                        ? 'border-slate-700/40 bg-slate-950/30'
                        : 'border-slate-700/60 bg-slate-950/40 hover:border-slate-600/60 hover:bg-slate-900/60'
                    }`}
                  >
                    <button
                      onClick={() => setExpandedMeeting(isExpanded ? null : meeting.id)}
                      className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
                    >
                      {/* status dot */}
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        isPast
                          ? 'bg-slate-800 border border-slate-700'
                          : 'bg-gradient-to-br from-violet-600/30 to-blue-600/30 border border-violet-500/20'
                      }`}>
                        <Calendar className={`w-4 h-4 ${isPast ? 'text-slate-500' : 'text-violet-300'}`} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className={`text-sm font-semibold truncate ${isPast ? 'text-slate-400' : 'text-slate-100'}`}>
                            {meeting.title}
                          </h3>
                          {isPast ? (
                            <span className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-500 font-medium">
                              Done
                            </span>
                          ) : (
                            <span className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300 font-medium">
                              {relative}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDate(meeting.scheduledTime)}
                          </span>
                          {meeting.participants && (
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              {meeting.participants.length}
                            </span>
                          )}
                        </div>
                      </div>

                      <ChevronDown
                        className={`w-4 h-4 text-slate-500 shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                      />
                    </button>

                    {/* expanded */}
                    {isExpanded && (
                      <div
                        className="border-t border-slate-700/50 px-4 py-3 space-y-3"
                        style={{ animation: 'fadeInUp 0.15s ease-out' }}
                      >
                        {meeting.description && (
                          <p className="text-sm text-slate-400 leading-relaxed">{meeting.description}</p>
                        )}
                        {!isPast && (
                          <button
                            onClick={() => window.open(`/meeting/${meeting.id}`, '_blank')}
                            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all duration-200 ${
                              isInstructor
                                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-900/20'
                                : 'bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 shadow-violet-900/20'
                            }`}
                          >
                            <Phone className="w-4 h-4" />
                            {isInstructor ? 'Start Meeting' : 'Join Meeting'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Upload Lecture Modal ── */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          style={{ animation: 'fadeIn 0.15s ease-out' }}>
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl shadow-black/60 overflow-hidden"
            style={{ animation: 'slideUp 0.2s ease-out' }}>

            {/* header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-700/60">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
                  <Upload className="w-4 h-4 text-sky-400" />
                </div>
                <h2 className="font-bold text-slate-100">Upload Lecture</h2>
              </div>
              <button
                onClick={() => !uploading && setShowUploadModal(false)}
                disabled={uploading}
                className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition-colors disabled:opacity-40"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* video drop zone */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                  Video File *
                </label>
                <label
                  htmlFor="video-upload"
                  className={`flex flex-col items-center justify-center gap-2 w-full rounded-xl border-2 border-dashed py-8 cursor-pointer transition-all duration-200 ${
                    selectedFile
                      ? 'border-sky-500/40 bg-sky-500/5'
                      : 'border-slate-700 hover:border-sky-500/40 hover:bg-sky-500/5'
                  } ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {selectedFile ? (
                    <>
                      <CheckCircle2 className="w-6 h-6 text-sky-400" />
                      <span className="text-sm font-medium text-sky-300">{selectedFile.name}</span>
                      <span className="text-xs text-slate-500">{formatFileSize(selectedFile.size)}</span>
                    </>
                  ) : (
                    <>
                      <Video className="w-6 h-6 text-slate-500" />
                      <span className="text-sm text-slate-400">Click to select a video file</span>
                      <span className="text-xs text-slate-600">MP4, MOV, WebM…</span>
                    </>
                  )}
                </label>
                <input
                  id="video-upload" type="file" accept="video/*"
                  onChange={handleFileSelect} disabled={uploading}
                  className="hidden"
                />
              </div>

              {/* title */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                  Lecture Title *
                </label>
                <input
                  type="text" value={lectureTitle}
                  onChange={e => setLectureTitle(e.target.value)}
                  placeholder="e.g. Introduction to Music Theory"
                  disabled={uploading}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500/60 focus:outline-none focus:ring-2 focus:ring-sky-500/20 transition disabled:opacity-50"
                />
              </div>

              {/* attachments */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                  Attachments <span className="text-slate-600 normal-case font-normal">(optional)</span>
                </label>
                <label
                  htmlFor="attachment-upload"
                  className={`flex items-center justify-center gap-2 w-full rounded-xl border border-dashed border-slate-700 py-3 cursor-pointer transition-all duration-200 hover:border-slate-500 hover:bg-slate-800/40 ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <Paperclip className="w-4 h-4 text-slate-500" />
                  <span className="text-sm text-slate-400">Add files (PDFs, images…)</span>
                </label>
                <input
                  id="attachment-upload" type="file" multiple
                  accept="image/*,.pdf,.doc,.docx,.ppt,.pptx,.txt"
                  onChange={handleAttachmentSelect} disabled={uploading}
                  className="hidden"
                />
                {attachments.length > 0 && (
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {attachments.map((a, i) => (
                      <div key={i} className="relative group flex items-center gap-2 border border-slate-700 rounded-lg p-2 hover:border-slate-600 bg-slate-950/60 transition-colors">
                        <FileText className="w-5 h-5 text-slate-500 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-slate-300 truncate">{a.name}</p>
                          <p className="text-xs text-slate-500">{formatFileSize(a.size)}</p>
                        </div>
                        <button
                          onClick={() => removeAttachment(i)}
                          disabled={uploading}
                          className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 hover:bg-red-400 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-2.5 h-2.5 text-white" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* progress */}
              {uploading && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-slate-400">Uploading…</span>
                    <span className="text-sky-400">{Math.round(uploadProgress)}%</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-sky-600 to-cyan-600 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 px-6 py-4 border-t border-slate-700/60">
              <button
                onClick={() => setShowUploadModal(false)} disabled={uploading}
                className="flex-1 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 py-2.5 text-sm font-semibold text-slate-300 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={!selectedFile || !lectureTitle.trim() || uploading}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-600 hover:from-sky-500 hover:to-cyan-500 disabled:opacity-50 py-2.5 text-sm font-semibold text-white shadow-md shadow-sky-900/20 transition-all duration-200"
              >
                {uploading ? <Loader className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {uploading ? 'Uploading…' : 'Upload'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Schedule Meeting Modal ── */}
      {showMeetingModal && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-10 bg-black/60 backdrop-blur-sm overflow-y-auto"
          style={{ animation: 'fadeIn 0.15s ease-out' }}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl shadow-black/60 mb-10"
            style={{ animation: 'slideUp 0.2s ease-out' }}
          >
            {/* header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-700/60">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                  <Calendar className="w-4 h-4 text-violet-400" />
                </div>
                <h2 className="font-bold text-slate-100">Schedule Meeting</h2>
              </div>
              <button
                onClick={() => setShowMeetingModal(false)}
                className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                  Meeting Title *
                </label>
                <input
                  type="text" value={newMeeting.title}
                  onChange={e => setNewMeeting(p => ({ ...p, title: e.target.value }))}
                  placeholder="e.g. Week 3 Q&A Session"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-violet-500/60 focus:outline-none focus:ring-2 focus:ring-violet-500/20 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                  Description <span className="text-slate-600 normal-case font-normal">(optional)</span>
                </label>
                <textarea
                  value={newMeeting.description}
                  onChange={e => setNewMeeting(p => ({ ...p, description: e.target.value }))}
                  placeholder="What will this meeting cover?"
                  rows={2}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-violet-500/60 focus:outline-none focus:ring-2 focus:ring-violet-500/20 transition resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                  Date & Time *
                </label>
                <DateTimePicker
                  value={newMeeting.scheduledTime}
                  onChange={v => setNewMeeting(p => ({ ...p, scheduledTime: v }))}
                />
              </div>

              <div className="flex items-center gap-3 rounded-xl border border-slate-700/60 bg-slate-950/40 px-4 py-3">
                <Users className="w-4 h-4 text-slate-500 shrink-0" />
                <p className="text-xs text-slate-400">All enrolled students will be invited automatically.</p>
              </div>
            </div>

            <div className="flex gap-3 px-6 py-4 border-t border-slate-700/60">
              <button
                onClick={() => setShowMeetingModal(false)}
                className="flex-1 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 py-2.5 text-sm font-semibold text-slate-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateMeeting}
                disabled={!newMeeting.title.trim() || !newMeeting.scheduledTime}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 disabled:opacity-50 py-2.5 text-sm font-semibold text-white shadow-md shadow-violet-900/20 transition-all duration-200"
              >
                <Calendar className="w-4 h-4" />
                Schedule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CourseContentHub;