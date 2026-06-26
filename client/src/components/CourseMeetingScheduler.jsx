import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, createMeeting, getMeetings, startMeeting } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import {
  Calendar, Clock, Video, Plus, Trash2, Play, Radio,
  AlertCircle, X, ChevronDown, ChevronUp, Upload,
  Check, Loader, Users, FileText
} from 'lucide-react';

/* ─── helpers ──────────────────────────────────────────────────────────── */
const pad = n => String(n).padStart(2, '0');

const fmtDate = raw => {
  const d = raw?.toDate ? raw.toDate() : new Date(raw);
  if (isNaN(d)) return '—';
  return d.toLocaleString([], {
    weekday: 'short', month: 'short', day: 'numeric',
    year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

const getStatus = (meeting, now = new Date()) => {
  const t = meeting.scheduledTime?.toDate
    ? meeting.scheduledTime.toDate()
    : new Date(meeting.scheduledTime);
  const diff = t - now;

  // ended trumps everything — only an explicit "End meeting" sets this
  if (meeting.endedAt)
    return { key: 'ended',     label: 'Ended',         cls: 'bg-slate-700/60 text-slate-400 border-slate-600/40' };
  // isActive is only ever set by startMeeting() — never inferred from the clock
  if (meeting.isActive)
    return { key: 'live',      label: '● Live Now',    cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 animate-pulse' };
  if (diff > 0 && diff <= 15 * 60_000)
    return { key: 'soon',      label: 'Starting Soon', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30' };
  if (diff > 0)
    return { key: 'scheduled', label: 'Scheduled',     cls: 'bg-sky-500/15 text-sky-300 border-sky-500/30' };
  // scheduled time has passed — allow up to 10 minutes to start,
  // after that the window is closed and the meeting is considered missed.
  const minutesPast = (now - t) / 60_000;
  if (minutesPast <= 10)
    return { key: 'overdue',  label: 'Ready to Start', cls: 'bg-violet-500/15 text-violet-300 border-violet-500/30' };
  return   { key: 'missed',   label: 'Missed',         cls: 'bg-red-500/15 text-red-400 border-red-500/30' };
};

/* ─── Toast ────────────────────────────────────────────────────────────── */
let _tid;
const useToast = () => {
  const [t, set] = useState(null);
  const show = useCallback((msg, type = 'info') => {
    clearTimeout(_tid);
    set({ msg, type });
    _tid = setTimeout(() => set(null), 3400);
  }, []);
  return [t, show];
};
const TC = {
  success: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  error:   'border-red-500/40 bg-red-500/10 text-red-300',
  info:    'border-sky-500/40 bg-sky-500/10 text-sky-300',
};
const Toast = ({ t }) => !t ? null : (
  <div className="fixed top-4 right-4 z-50 pointer-events-none">
    <div className={`flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium shadow-2xl backdrop-blur-xl transition-all duration-300 ${TC[t.type]}`}>
      {t.type === 'success' ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
      {t.msg}
    </div>
  </div>
);

/* ─── Confirm modal ─────────────────────────────────────────────────────── */
const Confirm = ({ onOk, onCancel }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
    <div className="w-full max-w-xs rounded-3xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
      <p className="text-slate-200 font-medium mb-5">Delete this meeting?</p>
      <div className="flex gap-3">
        <button onClick={onCancel} className="flex-1 rounded-2xl border border-slate-700 bg-slate-800 hover:bg-slate-700 py-2.5 text-sm font-semibold text-slate-300 transition-colors">Cancel</button>
        <button onClick={onOk}     className="flex-1 rounded-2xl bg-red-600 hover:bg-red-500 py-2.5 text-sm font-semibold text-white   transition-colors">Delete</button>
      </div>
    </div>
  </div>
);

/* ─── Meeting card ──────────────────────────────────────────────────────── */
const MeetingCard = ({ meeting, isHost, userId, onStart, onJoin, onDelete, now }) => {
  const [open, setOpen]         = useState(false);
  const [confirm, setConfirm]   = useState(false);
  const [upload, setUpload]     = useState({ file: null, title: '', busy: false });
  const [toast, notify]         = useToast();
  const status = getStatus(meeting, now);

  const isFinished = status.key === 'ended' || status.key === 'missed';

  const doUpload = async () => {
    if (!upload.file) return;
    if (upload.file.size > 500_000) { notify('File too large (max 500 KB)', 'error'); return; }
    setUpload(u => ({ ...u, busy: true }));
    try {
      const { addDoc, collection, serverTimestamp } = await import('firebase/firestore');
      const { db } = await import('../firebase');
      const b64 = await new Promise((res, rej) => {
        const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(upload.file);
      });
      await addDoc(collection(db, 'meetingMaterials'), {
        meetingId: meeting.id,
        title: upload.title || upload.file.name,
        fileName: upload.file.name,
        fileUrl: b64,
        uploaderId: userId,
        createdAt: serverTimestamp(),
      });
      setUpload({ file: null, title: '', busy: false });
      notify('Material uploaded', 'success');
    } catch { notify('Upload failed', 'error'); setUpload(u => ({ ...u, busy: false })); }
  };

  return (
    <>
      <Toast t={toast} />
      {confirm && <Confirm onOk={() => { setConfirm(false); onDelete(meeting.id); }} onCancel={() => setConfirm(false)} />}

      <div className="rounded-2xl border border-slate-700/50 bg-slate-900/50 hover:border-slate-600/70 transition-all duration-200 overflow-hidden">
        <div className="p-4">
          <div className="flex items-start gap-3">
            {/* icon */}
            <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 mt-0.5 ${
              isFinished ? 'bg-slate-800 border-slate-700' : 'bg-sky-500/10 border-sky-500/20'
            }`}>
              <Video className={`w-4 h-4 ${isFinished ? 'text-slate-500' : 'text-sky-400'}`} />
            </div>

            {/* info */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h3 className="font-semibold text-slate-100 text-sm leading-snug">{meeting.title}</h3>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${status.cls}`}>{status.label}</span>
              </div>
              {meeting.description && (
                <p className="text-slate-400 text-xs mb-2 leading-relaxed">{meeting.description}</p>
              )}
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{fmtDate(meeting.scheduledTime)}</span>
                <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{meeting.allowedEmails?.length || 0} invited</span>
              </div>
            </div>

            {/* actions */}
            <div className="flex items-center gap-1.5 shrink-0 ml-1">
              {/* host: Start — only when NOT finished */}
              {isHost && !isFinished && (
                <button onClick={() => onStart(meeting.id)}
                  className="flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors shadow-lg shadow-emerald-900/20">
                  <Play className="w-3.5 h-3.5" />
                  {status.key === 'live' ? 'Rejoin' : status.key === 'scheduled' ? 'Start Early' : 'Start'}
                </button>
              )}
              {/* student: Join — only live, soon, or overdue-waiting */}
              {!isHost && (status.key === 'live' || status.key === 'soon' || status.key === 'overdue') && !isFinished && (
                <button onClick={() => onJoin(meeting.id)}
                  className="flex items-center gap-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors shadow-lg shadow-sky-900/20">
                  <Radio className="w-3.5 h-3.5" /> Join
                </button>
              )}
              {/* host: delete */}
              {isHost && (
                <button onClick={() => setConfirm(true)}
                  className="p-1.5 rounded-xl border border-slate-700 hover:border-red-500/50 hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-all">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
              {/* host: expand materials */}
              {isHost && (
                <button onClick={() => setOpen(o => !o)}
                  className="p-1.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition-all">
                  {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Materials upload (host only) */}
        {isHost && open && (
          <div className="border-t border-slate-700/50 bg-slate-950/40 p-4 space-y-3">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
              <Upload className="w-3.5 h-3.5" /> Upload Material
            </p>
            <input type="text" value={upload.title} onChange={e => setUpload(u => ({ ...u, title: e.target.value }))}
              placeholder="Title (optional)"
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500/50 focus:outline-none focus:ring-2 focus:ring-sky-500/20 transition" />
            <input type="file" onChange={e => setUpload(u => ({ ...u, file: e.target.files?.[0] || null }))}
              className="w-full text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-sky-600 file:text-white hover:file:bg-sky-500 cursor-pointer" />
            {upload.file && (
              <div className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2">
                <FileText className="w-4 h-4 text-sky-400 shrink-0" />
                <span className="text-xs text-slate-300 truncate flex-1">{upload.file.name}</span>
                <span className="text-xs text-slate-500">{(upload.file.size / 1024).toFixed(0)} KB</span>
              </div>
            )}
            <button onClick={doUpload} disabled={!upload.file || upload.busy}
              className="w-full rounded-xl bg-sky-600 hover:bg-sky-500 disabled:bg-slate-700 disabled:text-slate-500 py-2.5 text-sm font-semibold text-white transition-colors flex items-center justify-center gap-2">
              {upload.busy ? <><Loader className="w-4 h-4 animate-spin" /> Uploading…</> : <><Upload className="w-4 h-4" /> Upload</>}
            </button>
          </div>
        )}
      </div>
    </>
  );
};

/* ─── Schedule form ─────────────────────────────────────────────────────── */
const ScheduleForm = ({ enrolledCount, onSubmit, onClose, isCreating, error }) => {
  const now     = new Date();
  const minDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const minTime = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const [form, setForm] = useState({ title: '', description: '', date: '', time: '' });
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  return (
    <div className="border-b border-slate-700/50 bg-slate-950/30 p-4 sm:p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-100 text-sm flex items-center gap-2">
          <Calendar className="w-4 h-4 text-sky-400" /> Schedule Meeting
        </h3>
        <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-xs text-red-300">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
        </div>
      )}

      <form onSubmit={e => { e.preventDefault(); onSubmit(form); }} className="space-y-3">
        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Title *</label>
          <input type="text" value={form.title} onChange={set('title')} placeholder="e.g. Week 3 — Live Q&A" required
            className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500/60 focus:outline-none focus:ring-2 focus:ring-sky-500/20 transition" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-3 h-3" /> Date *
            </label>
            <input type="date" value={form.date} onChange={set('date')} min={minDate} required
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 focus:border-sky-500/60 focus:outline-none focus:ring-2 focus:ring-sky-500/20 transition [color-scheme:dark]" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
              <Clock className="w-3 h-3" /> Time *
            </label>
            <input type="time" value={form.time} onChange={set('time')} min={form.date === minDate ? minTime : undefined} step="60" required
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 focus:border-sky-500/60 focus:outline-none focus:ring-2 focus:ring-sky-500/20 transition [color-scheme:dark]" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Description</label>
          <textarea value={form.description} onChange={set('description')} rows={2} placeholder="Agenda or notes for students…"
            className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500/60 focus:outline-none focus:ring-2 focus:ring-sky-500/20 transition resize-none" />
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-1">
          <span className="text-xs text-slate-500 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" /> {enrolledCount} student{enrolledCount !== 1 ? 's' : ''} enrolled
          </span>
          <div className="flex gap-2 w-full sm:w-auto">
            <button type="button" onClick={onClose}
              className="flex-1 sm:flex-none rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-300 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={isCreating}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-600 hover:from-sky-500 hover:to-cyan-500 disabled:opacity-50 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-sky-900/20 transition-all duration-200">
              {isCreating ? <><Loader className="w-4 h-4 animate-spin" /> Creating…</> : <><Check className="w-4 h-4" /> Schedule</>}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

/* ─── Main ──────────────────────────────────────────────────────────────── */
const CourseMeetingScheduler = ({ courseId, enrolledEmails = [], isHost = false, onMeetingScheduled }) => {
  const [meetings,     setMeetings]     = useState([]);
  const [showForm,     setShowForm]     = useState(false);
  const [loading,      setLoading]      = useState(true);
  const [isCreating,   setIsCreating]   = useState(false);
  const [formError,    setFormError]    = useState('');
  const [currentUser,  setCurrentUser]  = useState(auth.currentUser);
  const [toast, notify] = useToast();
  const [now, setNow] = useState(new Date());
  const navigate = useNavigate();

  // Tick every 15s so "Scheduled" → "Starting Soon" → "Ready to Start"
  // badges update live, instead of only on page reload.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => setCurrentUser(u));
    return unsub;
  }, []);

  useEffect(() => { if (courseId) load(); }, [courseId]);

  const load = async () => {
    try {
      setLoading(true);
      setMeetings(await getMeetings(courseId));
    } catch (e) {
      console.error('getMeetings:', e);
      notify('Failed to load meetings', 'error');
    } finally { setLoading(false); }
  };

  const handleSubmit = async ({ title, description, date, time }) => {
    setFormError('');
    if (!title.trim())  { setFormError('Please enter a title.'); return; }
    if (!date || !time) { setFormError('Please pick a date and time.'); return; }
    const dt = new Date(`${date}T${time}`);
    if (isNaN(dt.getTime())) { setFormError('Invalid date or time.'); return; }
    if (dt <= new Date())    { setFormError('Please choose a future date and time.'); return; }

    const user = auth.currentUser;
    if (!user) { setFormError('You must be signed in.'); return; }

    try {
      setIsCreating(true);
      const data = {
        courseId, title: title.trim(), description: description.trim(),
        scheduledTime: dt,
        hostId: user.uid, hostName: user.displayName || user.email, hostEmail: user.email,
        allowedEmails: enrolledEmails, isActive: false, participants: [],
      };
      const id = await createMeeting(data);
      const nm = { id, ...data };
      setMeetings(p => [...p, nm]);
      setShowForm(false);
      setFormError('');
      notify('Meeting scheduled!', 'success');
      onMeetingScheduled?.(nm);
    } catch (e) {
      console.error('createMeeting:', e);
      setFormError(`Failed: ${e?.message || 'Unknown error'}`);
    } finally { setIsCreating(false); }
  };

  const handleDelete = async id => {
    try {
      const { deleteDoc, doc } = await import('firebase/firestore');
      const { db }             = await import('../firebase');
      await deleteDoc(doc(db, 'meetings', id));
      setMeetings(p => p.filter(m => m.id !== id));
      notify('Meeting deleted', 'info');
    } catch (e) {
      console.error(e);
      notify('Failed to delete meeting', 'error');
    }
  };

  // Host explicitly starting a meeting — this is the ONLY thing that
  // should ever flip a meeting to "Live". It writes isActive to
  // Firestore first so the status badge is correct the instant the
  // host (or anyone re-loading the page) looks at it, then navigates
  // into the room. Without this, meetings used to just sit there and
  // flip to "Completed" once their scheduled time passed, with no way
  // to actually start them.
  const handleStart = async id => {
    // Guard: refuse to start meetings whose window has closed (>10 min past schedule)
    const mtg = meetings.find(m => m.id === id);
    if (mtg && getStatus(mtg).key === 'missed') {
      notify('This meeting can no longer be started — the 10-minute window has passed.', 'error');
      return;
    }
    try {
      await startMeeting(id);
      setMeetings(p => p.map(m => m.id === id ? { ...m, isActive: true, endedAt: null } : m));
    } catch (e) {
      console.error('startMeeting:', e);
      notify('Failed to start meeting', 'error');
    } finally {
      navigate(`/meeting/${id}`);
    }
  };

  const sorted = [...meetings].sort((a, b) => {
    const ta = a.scheduledTime?.toDate ? a.scheduledTime.toDate() : new Date(a.scheduledTime);
    const tb = b.scheduledTime?.toDate ? b.scheduledTime.toDate() : new Date(b.scheduledTime);
    return ta - tb;
  });

  return (
    <>
      <Toast t={toast} />
      <div className="rounded-2xl border border-slate-700/50 bg-slate-900/60 backdrop-blur-xl shadow-xl overflow-hidden">

        {/* header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-4 border-b border-slate-700/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
              <Video className="w-4 h-4 text-sky-400" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-100 text-sm">Meetings</h2>
              <p className="text-xs text-slate-500">{meetings.length} scheduled</p>
            </div>
          </div>
          {isHost && !showForm && (
            <button onClick={() => { setShowForm(true); setFormError(''); }}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-600 hover:from-sky-500 hover:to-cyan-500 px-3 py-2 text-xs font-semibold text-white shadow-lg shadow-sky-900/20 transition-all duration-200">
              <Plus className="w-3.5 h-3.5" /> Schedule
            </button>
          )}
        </div>

        {/* form */}
        {showForm && (
          <ScheduleForm
            enrolledCount={enrolledEmails.length}
            onSubmit={handleSubmit}
            onClose={() => { setShowForm(false); setFormError(''); }}
            isCreating={isCreating}
            error={formError}
          />
        )}

        {/* list */}
        <div className="p-4 sm:p-5">
          {loading ? (
            <div className="space-y-3">
              {[1, 2].map(i => (
                <div key={i} className="rounded-2xl border border-slate-700/40 bg-slate-900/40 p-4 animate-pulse">
                  <div className="flex gap-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-800" />
                    <div className="flex-1 space-y-2 pt-0.5">
                      <div className="h-3.5 bg-slate-800 rounded w-2/5" />
                      <div className="h-3 bg-slate-800 rounded w-3/5" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : sorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center mb-3">
                <Video className="w-6 h-6 text-slate-500" />
              </div>
              <p className="font-medium text-slate-300 text-sm mb-1">No meetings yet</p>
              <p className="text-xs text-slate-500">
                {isHost ? 'Click "Schedule" to create your first session.' : 'No meetings scheduled yet.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {sorted.map(m => (
                <MeetingCard key={m.id} meeting={m} isHost={isHost} userId={currentUser?.uid} now={now}
                  onStart={handleStart}
                  onJoin={id  => navigate(`/meeting/${id}`)}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default CourseMeetingScheduler;