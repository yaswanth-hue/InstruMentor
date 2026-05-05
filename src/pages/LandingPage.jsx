import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from 'react-helmet-async';
import { Music, Users, MessageCircle, BookOpen, Mic2, Sparkles, ArrowRight, Check, Menu, X } from "lucide-react";


const LandingPage = () => {
  const navigate = useNavigate();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <>
      <Helmet>
        <title>InstruMentor - Connect, Learn & Collaborate with Musicians</title>
        <meta name="description" content="Join InstruMentor - the ultimate social network for musicians. Connect with fellow artists, share your music, learn from courses, and collaborate in real-time. Start your musical journey today!" />
        <meta property="og:title" content="InstruMentor - Connect, Learn & Collaborate with Musicians" />
        <meta property="og:description" content="Join the ultimate social network for musicians. Connect, share, learn, and collaborate with artists worldwide." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={typeof window !== 'undefined' ? window.location.href : ''} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="InstruMentor - Connect, Learn & Collaborate with Musicians" />
        <meta name="twitter:description" content="Join the ultimate social network for musicians. Connect, share, learn, and collaborate." />
      </Helmet>

      <div
        className="min-h-screen bg-gradient-to-b from-zinc-950 via-neutral-950 to-zinc-950 text-white relative overflow-hidden"
        style={{ width: "100%", maxWidth: "none" }}
      >
        {/* background */}
        <div className="absolute inset-0">
          <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[520px] w-[95vw] max-w-[980px] rounded-full bg-gradient-to-r from-indigo-600/25 via-fuchsia-600/20 to-amber-500/15 blur-3xl" />
          <div
            className="absolute inset-0 opacity-[0.045]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.12) 1px, transparent 1px)",
              backgroundSize: "54px 54px",
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-zinc-950/10 to-zinc-950" />
        </div>

        {/* top nav */}
        <header className="relative z-10">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between py-4 sm:py-6">
              <button
                type="button"
                onClick={() => navigate("/")}
                className="flex items-center gap-3 rounded-xl px-2 py-1 hover:bg-white/5 transition-colors"
              >
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 shadow-lg shadow-indigo-500/20">
                  <Music className="h-5 w-5 text-white" />
                </span>
                <span className="text-lg font-semibold tracking-tight">InstruMentor</span>
              </button>

              <nav className="hidden md:flex items-center gap-2 text-sm">
                <a href="#features" className="rounded-lg px-3 py-2 text-zinc-300 hover:text-white hover:bg-white/5 transition-colors">
                  Features
                </a>
                <a href="#how" className="rounded-lg px-3 py-2 text-zinc-300 hover:text-white hover:bg-white/5 transition-colors">
                  How it works
                </a>
                <a href="#faq" className="rounded-lg px-3 py-2 text-zinc-300 hover:text-white hover:bg-white/5 transition-colors">
                  FAQ
                </a>
              </nav>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => navigate("/login")}
                  className="hidden sm:inline-flex rounded-xl px-4 py-2 text-sm font-semibold text-zinc-200 hover:text-white hover:bg-white/5 border border-white/10 transition-colors"
                >
                  Log in
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/signup")}
                  className="inline-flex items-center gap-2 rounded-xl bg-white text-zinc-950 px-4 py-2 text-sm font-semibold shadow-lg shadow-white/10 hover:bg-zinc-100 transition-colors"
                >
                  Get started
                  <ArrowRight className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  onClick={() => setMobileNavOpen((v) => !v)}
                  className="md:hidden inline-flex items-center justify-center rounded-xl p-2 border border-white/10 hover:bg-white/5 transition-colors"
                  aria-label={mobileNavOpen ? "Close menu" : "Open menu"}
                  aria-expanded={mobileNavOpen}
                >
                  {mobileNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* mobile nav */}
            {mobileNavOpen && (
              <div className="md:hidden pb-4">
                <div className="rounded-2xl border border-white/10 bg-zinc-950/40 backdrop-blur-xl p-2">
                  {[
                    { label: "Features", href: "#features" },
                    { label: "How it works", href: "#how" },
                    { label: "FAQ", href: "#faq" },
                  ].map((l) => (
                    <a
                      key={l.href}
                      href={l.href}
                      onClick={() => setMobileNavOpen(false)}
                      className="block rounded-xl px-4 py-3 text-sm font-semibold text-zinc-200 hover:text-white hover:bg-white/5 transition-colors"
                    >
                      {l.label}
                    </a>
                  ))}
                  <div className="grid grid-cols-2 gap-2 p-2 pt-0">
                    <button
                      type="button"
                      onClick={() => {
                        setMobileNavOpen(false);
                        navigate("/login");
                      }}
                      className="rounded-xl px-4 py-2 text-sm font-semibold text-zinc-200 hover:text-white border border-white/10 hover:bg-white/5 transition-colors"
                    >
                      Log in
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMobileNavOpen(false);
                        navigate("/signup");
                      }}
                      className="rounded-xl bg-white text-zinc-950 px-4 py-2 text-sm font-semibold hover:bg-zinc-100 transition-colors"
                    >
                      Get started
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </header>

        {/* hero */}
        <main className="relative z-10">
          <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-10 sm:pt-16 pb-16 sm:pb-20">
            <div className="grid lg:grid-cols-12 gap-10 items-center">
              <div className="lg:col-span-6">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-200">
                  <Sparkles className="h-4 w-4 text-amber-300" />
                  A social network built for musicians
                </div>

                <h1 className="mt-6 text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight leading-[1.05]">
                  Learn faster.{" "}
                  <span className="bg-gradient-to-r from-amber-300 via-pink-300 to-indigo-300 bg-clip-text text-transparent">
                    Play better.
                  </span>{" "}
                  Find your people.
                </h1>

                <p className="mt-5 text-lg text-zinc-300 leading-relaxed max-w-xl">
                  InstruMentor brings together a music feed, structured courses, and real‑time collaboration—so you can
                  practice with purpose and grow with a community.
                </p>

                <div className="mt-8 flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={() => navigate("/signup")}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-amber-400 text-zinc-950 px-6 py-3 font-semibold shadow-lg shadow-amber-400/20 hover:bg-amber-300 transition-colors"
                  >
                    Create your account
                    <ArrowRight className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate("/login")}
                    className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl px-6 py-3 font-semibold text-zinc-200 hover:text-white border border-white/10 hover:bg-white/5 transition-colors"
                  >
                    I already have an account
                  </button>
                </div>

                <div className="mt-8 grid sm:grid-cols-2 gap-3 text-sm text-zinc-300">
                  {[
                    "Personalized learning paths and resources",
                    "Connect with mentors and fellow learners",
                    "Share posts, progress, and clips",
                    "Join audio rooms to jam in real time",
                  ].map((t) => (
                    <div key={t} className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                      <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300">
                        <Check className="h-3.5 w-3.5" />
                      </span>
                      <span className="leading-snug">{t}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* preview card */}
              <div className="lg:col-span-6">
                <div className="relative">
                  <div className="absolute -inset-4 rounded-3xl bg-gradient-to-r from-indigo-500/20 via-purple-500/15 to-amber-500/10 blur-2xl" />
                  <div className="relative rounded-3xl border border-white/10 bg-zinc-950/40 backdrop-blur-xl shadow-2xl shadow-black/40 overflow-hidden">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
                        <span className="h-2.5 w-2.5 rounded-full bg-amber-300/80" />
                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
                      </div>
                      <span className="text-xs text-zinc-400">Preview</span>
                    </div>

                    <div className="p-6">
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                          <div className="flex items-center gap-3">
                            <span className="h-10 w-10 rounded-2xl bg-indigo-500/15 text-indigo-200 inline-flex items-center justify-center">
                              <Users className="h-5 w-5" />
                            </span>
                            <div>
                              <p className="text-sm font-semibold">Social feed</p>
                              <p className="text-xs text-zinc-400">Share & discover</p>
                            </div>
                          </div>
                          <div className="mt-4 space-y-3">
                            <div className="flex items-center gap-2">
                              <div className="h-7 w-7 rounded-full bg-gradient-to-br from-indigo-400 to-purple-400" />
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-zinc-200 truncate">Aarav</p>
                                <p className="text-[11px] text-zinc-400 truncate">Just nailed clean chord changes today.</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="h-7 w-7 rounded-full bg-gradient-to-br from-amber-300 to-pink-300" />
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-zinc-200 truncate">Mina</p>
                                <p className="text-[11px] text-zinc-400 truncate">Metronome at 90bpm — feeling solid.</p>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {["practice", "guitar", "timing"].map((t) => (
                                <span
                                  key={t}
                                  className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-semibold text-zinc-300"
                                >
                                  #{t}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                          <div className="flex items-center gap-3">
                            <span className="h-10 w-10 rounded-2xl bg-amber-400/15 text-amber-200 inline-flex items-center justify-center">
                              <BookOpen className="h-5 w-5" />
                            </span>
                            <div>
                              <p className="text-sm font-semibold">Courses</p>
                              <p className="text-xs text-zinc-400">Structured learning</p>
                            </div>
                          </div>
                          <div className="mt-4 space-y-2">
                            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-zinc-950/20 px-3 py-2">
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-zinc-200 truncate">Fingerstyle Basics</p>
                                <p className="text-[11px] text-zinc-400">Lesson 3 · Right‑hand pattern</p>
                              </div>
                              <span className="ml-3 text-[10px] font-semibold text-amber-200/90">36%</span>
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                              <div className="h-full w-[36%] rounded-full bg-gradient-to-r from-amber-300 via-amber-200 to-amber-100" />
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-zinc-400">
                              <span className="inline-flex h-1.5 w-1.5 rounded-full bg-amber-300/80" />
                              Next up: chord transitions
                            </div>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                          <div className="flex items-center gap-3">
                            <span className="h-10 w-10 rounded-2xl bg-fuchsia-500/15 text-fuchsia-200 inline-flex items-center justify-center">
                              <Mic2 className="h-5 w-5" />
                            </span>
                            <div>
                              <p className="text-sm font-semibold">Audio rooms</p>
                              <p className="text-xs text-zinc-400">Jam in real time</p>
                            </div>
                          </div>
                          <div className="mt-4 space-y-2">
                            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-zinc-950/20 px-3 py-2">
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-zinc-200 truncate">Lo‑fi Jam Room</p>
                                <p className="text-[11px] text-zinc-400">4 listening · 2 playing</p>
                              </div>
                              <span className="inline-flex items-center gap-2 text-[11px] text-zinc-400">
                                <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                                Live
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-zinc-400">
                              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">No mic? Listen in</span>
                              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">Low latency</span>
                            </div>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                          <div className="flex items-center gap-3">
                            <span className="h-10 w-10 rounded-2xl bg-emerald-500/15 text-emerald-200 inline-flex items-center justify-center">
                              <MessageCircle className="h-5 w-5" />
                            </span>
                            <div>
                              <p className="text-sm font-semibold">Messages</p>
                              <p className="text-xs text-zinc-400">Plan practice together</p>
                            </div>
                          </div>
                          <div className="mt-4 space-y-2">
                            <div className="flex items-center gap-2">
                              <div className="h-7 w-7 rounded-full bg-gradient-to-br from-emerald-400 to-teal-400" />
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-semibold text-zinc-200 truncate">Practice Buddy</p>
                                <p className="text-[11px] text-zinc-400 truncate">Want to run scales at 7pm?</p>
                              </div>
                              <span className="text-[10px] font-semibold text-emerald-200/90">New</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="h-7 w-7 rounded-full bg-gradient-to-br from-zinc-500 to-zinc-700" />
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-semibold text-zinc-200 truncate">Mentor</p>
                                <p className="text-[11px] text-zinc-400 truncate">Great progress — keep tempo steady.</p>
                              </div>
                              <span className="text-[10px] text-zinc-500">2m</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* features */}
          <section id="features" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-16">
            <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 sm:p-10">
              <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
                <div>
                  <p className="text-sm font-semibold text-amber-200/90">Everything in one place</p>
                  <h2 className="mt-2 text-2xl sm:text-3xl font-semibold tracking-tight">Practice, progress, and community—together</h2>
                  <p className="mt-3 text-zinc-300 max-w-2xl">
                    Stop juggling tabs and apps. InstruMentor keeps your learning and connections under one roof.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={() => navigate("/signup")}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-white text-zinc-950 px-5 py-2.5 text-sm font-semibold hover:bg-zinc-100 transition-colors"
                  >
                    Start free
                    <ArrowRight className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate("/login")}
                    className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl px-5 py-2.5 text-sm font-semibold text-zinc-200 hover:text-white border border-white/10 hover:bg-white/5 transition-colors"
                  >
                    Log in
                  </button>
                </div>
              </div>

              <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  {
                    icon: Users,
                    title: "Social learning",
                    desc: "Follow musicians, post updates, and learn by doing—together.",
                    tone: "from-indigo-500/20 to-indigo-500/5",
                  },
                  {
                    icon: BookOpen,
                    title: "Courses that stick",
                    desc: "Clear structure, progress tracking, and a path you can commit to.",
                    tone: "from-amber-400/20 to-amber-400/5",
                  },
                  {
                    icon: Mic2,
                    title: "Audio rooms",
                    desc: "Create or join rooms to collaborate, rehearse, and get feedback.",
                    tone: "from-fuchsia-500/20 to-fuchsia-500/5",
                  },
                  {
                    icon: MessageCircle,
                    title: "Direct messages",
                    desc: "Coordinate sessions, share resources, and stay accountable.",
                    tone: "from-emerald-500/20 to-emerald-500/5",
                  },
                ].map((f) => (
                  <div key={f.title} className="rounded-2xl border border-white/10 bg-zinc-950/30 p-5">
                    <div className={`h-11 w-11 rounded-2xl bg-gradient-to-br ${f.tone} border border-white/10 inline-flex items-center justify-center`}>
                      <f.icon className="h-5 w-5 text-white" />
                    </div>
                    <p className="mt-4 font-semibold">{f.title}</p>
                    <p className="mt-2 text-sm text-zinc-300 leading-relaxed">{f.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* how it works */}
          <section id="how" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-16">
            <div className="grid lg:grid-cols-12 gap-6">
              <div className="lg:col-span-5">
                <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">How it works</h2>
                <p className="mt-3 text-zinc-300 leading-relaxed">
                  Create a profile, pick what you’re learning, then start posting progress. Join rooms to collaborate, and use courses to stay on track.
                </p>
              </div>
              <div className="lg:col-span-7 grid sm:grid-cols-3 gap-4">
                {[
                  { n: "01", title: "Set up", desc: "Create an account and personalize your profile." },
                  { n: "02", title: "Learn", desc: "Use courses and resources built for musicians." },
                  { n: "03", title: "Collaborate", desc: "Message, join audio rooms, and grow faster." },
                ].map((s) => (
                  <div key={s.n} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                    <p className="text-sm font-semibold text-amber-200/90">{s.n}</p>
                    <p className="mt-2 font-semibold">{s.title}</p>
                    <p className="mt-2 text-sm text-zinc-300 leading-relaxed">{s.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* FAQ */}
          <section id="faq" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-20">
            <div className="rounded-3xl border border-white/10 bg-zinc-950/30 backdrop-blur-xl p-6 sm:p-10">
              <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">FAQ</h2>
              <div className="mt-8 grid lg:grid-cols-2 gap-4">
                {[
                  {
                    q: "Is InstruMentor only for beginners?",
                    a: "No—beginners, intermediate, and advanced players can all use it to practice, share progress, and collaborate.",
                  },
                  {
                    q: "Do I need an instrument to join?",
                    a: "You can join to explore and connect, but you’ll get the most out of it when you’re actively learning or creating.",
                  },
                  {
                    q: "What can I do after signing up?",
                    a: "You’ll have access to the social home, courses, messaging, and audio rooms (depending on the route).",
                  },
                  {
                    q: "Is it free?",
                    a: "You can create an account and start using the core experience right away.",
                  },
                ].map((item) => (
                  <div key={item.q} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                    <p className="font-semibold">{item.q}</p>
                    <p className="mt-2 text-sm text-zinc-300 leading-relaxed">{item.a}</p>
                  </div>
                ))}
              </div>

              <div className="mt-10 flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 p-5">
                <div>
                  <p className="font-semibold">Ready to start?</p>
                  <p className="text-sm text-zinc-300">Create an account in under a minute.</p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate("/signup")}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-amber-400 text-zinc-950 px-6 py-3 font-semibold hover:bg-amber-300 transition-colors"
                >
                  Get started
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </section>
        </main>

        {/* footer */}
        <footer className="relative z-10 border-t border-white/10">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="text-sm text-zinc-400">
              <span className="text-zinc-200 font-semibold">InstruMentor</span> — Connect, learn, and collaborate with musicians.
            </div>
            <div className="w-full sm:w-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <button
                type="button"
                onClick={() => navigate("/login")}
                className="w-full sm:w-auto rounded-xl px-4 py-2 text-sm font-semibold text-zinc-200 hover:text-white border border-white/10 hover:bg-white/5 transition-colors"
              >
                Log in
              </button>
              <button
                type="button"
                onClick={() => navigate("/signup")}
                className="w-full sm:w-auto rounded-xl bg-white text-zinc-950 px-4 py-2 text-sm font-semibold hover:bg-zinc-100 transition-colors"
              >
                Get started
              </button>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
};

export default LandingPage;
