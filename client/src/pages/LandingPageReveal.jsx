import React, { useRef, useLayoutEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Users, BookOpen, Mic2, MessageCircle, ArrowRight } from "lucide-react";

import logoImg from "../assets/logo.png";

gsap.registerPlugin(ScrollTrigger);

/**
 * Shared check for reduced-motion preference. Read once per component
 * instance rather than per-effect-run, since it can't change mid-session
 * without a page reload in practice, and matchMedia calls aren't free.
 */
const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * A line of text whose words individually resolve into focus as the line
 * crosses a wide reading band, scrubbed to scroll position. Reserved for
 * the big multi-word statements, which have enough scroll distance either
 * side to complete the animation cleanly.
 *
 * Elements render fully visible by default (no inline opacity in JSX), so
 * if JS never runs — blocked, slow, or erroring — the copy simply reads
 * as static text instead of vanishing. The animation is a progressive
 * enhancement layered on top via useLayoutEffect, and is skipped entirely
 * for users who've asked for reduced motion.
 */
const RevealLine = ({ text, className = "", as: Tag = "p" }) => {
  const wrapRef = useRef(null);
  const wordRefs = useRef([]);
  wordRefs.current = [];

  useLayoutEffect(() => {
    if (prefersReducedMotion()) return;

    const ctx = gsap.context(() => {
      gsap.set(wordRefs.current, { opacity: 0.15, y: "0.3em" });
      gsap.to(wordRefs.current, {
        opacity: 1,
        y: "0em",
        stagger: 0.06,
        ease: "none",
        scrollTrigger: {
          trigger: wrapRef.current,
          start: "top 85%",
          end: "top 25%",
          scrub: true,
        },
      });
    }, wrapRef);
    return () => ctx.revert();
  }, []);

  const words = text.split(" ");

  return (
    <Tag ref={wrapRef} className={className}>
      {words.map((w, i) => (
        <span
          key={i}
          ref={(el) => (wordRefs.current[i] = el)}
          className="inline-block will-change-transform"
          style={{ marginRight: "0.28em" }}
        >
          {w}
        </span>
      ))}
    </Tag>
  );
};

/**
 * A simpler, one-shot reveal for shorter UI text (labels, titles). Plays
 * once when it enters view and stays fully visible — no scrub math tied to
 * a precise scroll window, so it can't get caught "stuck" mid-transition
 * the way the word-by-word version can on short list items.
 *
 * Same no-JS-safe default and reduced-motion opt-out as RevealLine above.
 */
const RevealUp = ({ text, className = "", as: Tag = "p" }) => {
  const ref = useRef(null);

  useLayoutEffect(() => {
    if (prefersReducedMotion()) return;

    const ctx = gsap.context(() => {
      gsap.set(ref.current, { opacity: 0, y: 14 });
      gsap.to(ref.current, {
        opacity: 1,
        y: 0,
        duration: 0.6,
        ease: "power2.out",
        scrollTrigger: {
          trigger: ref.current,
          start: "top 92%",
          toggleActions: "play none none none",
        },
      });
    }, ref);
    return () => ctx.revert();
  }, []);

  return (
    <Tag ref={ref} className={className}>
      {text}
    </Tag>
  );
};

const FEATURES = [
  {
    icon: BookOpen,
    title: "Courses, hosted by musicians",
    desc: "Anyone can put one together — lectures, a live meeting schedule, and progress tracking for everyone who enrolls.",
    tone: "text-amber-300 bg-amber-400/10 border-amber-400/20 group-hover:bg-amber-400/20",
  },
  {
    icon: Users,
    title: "A feed for what you're working on",
    desc: "Post progress, follow other musicians, and see what people ahead of you — and people just starting out — are doing.",
    tone: "text-sky-300 bg-sky-400/10 border-sky-400/20 group-hover:bg-sky-400/20",
  },
  {
    icon: Mic2,
    title: "Live audio rooms",
    desc: "Open a room to jam, rehearse, or get a second opinion on your latest take — keep it public, or lock it with a password.",
    tone: "text-cyan-300 bg-cyan-400/10 border-cyan-400/20 group-hover:bg-cyan-400/20",
  },
  {
    icon: MessageCircle,
    title: "Messaging, by request",
    desc: "Send a request, they accept it, then you talk. No one lands in a stranger's inbox uninvited.",
    tone: "text-emerald-300 bg-emerald-400/10 border-emerald-400/20 group-hover:bg-emerald-400/20",
  },
];

const LandingPageReveal = () => {
  const navigate = useNavigate();
  const heroRef = useRef(null);

  useLayoutEffect(() => {
    // Reduced motion: skip the fade/slide entirely, hero is just visible.
    if (prefersReducedMotion()) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        heroRef.current,
        { opacity: 0, y: 16 },
        { opacity: 1, y: 0, duration: 1, ease: "power2.out", delay: 0.15 }
      );
    });

    // "Instrument Serif" loads async and reflows the page once it swaps in,
    // which can throw off scroll-trigger math computed against the fallback
    // font. Refresh after fonts settle (and once more after full load, to
    // catch any late image-driven layout shifts) so trigger positions match
    // final layout.
    let refreshed = false;
    const refresh = () => {
      if (refreshed) return;
      refreshed = true;
      ScrollTrigger.refresh();
    };
    if (document.fonts?.ready) {
      document.fonts.ready.then(refresh);
    }
    window.addEventListener("load", refresh);
    const fallbackTimer = setTimeout(refresh, 800);

    return () => {
      ctx.revert();
      window.removeEventListener("load", refresh);
      clearTimeout(fallbackTimer);
    };
  }, []);

  return (
    <>
      <Helmet>
        <title>InstruMentor — Courses, Audio Rooms, and a Feed Built by Musicians</title>
        <meta
          name="description"
          content="InstruMentor is a social network for musicians: host or enroll in courses with live meetings and progress tracking, open audio rooms to jam, and follow what other musicians are working on."
        />
      </Helmet>

      <div
        className="min-h-screen bg-gradient-to-b from-zinc-950 via-neutral-950 to-zinc-950 text-white relative overflow-hidden"
        style={{ width: "100%", maxWidth: "none" }}
      >
        <div className="absolute inset-0">
          <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[520px] w-[95vw] max-w-[980px] rounded-full bg-gradient-to-r from-sky-600/15 via-cyan-500/10 to-amber-500/10 blur-3xl" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-zinc-950/10 to-zinc-950" />
        </div>

        {/* NAV */}
        <header className="relative z-20 sticky top-0 bg-zinc-950/70 backdrop-blur-2xl border-b border-white/5">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between py-3 sm:py-4">
              <button
                type="button"
                onClick={() => navigate("/")}
                className="flex items-center gap-3 rounded-xl px-2 py-1 hover:bg-white/5 transition-colors"
              >
                <span className="relative h-10 w-10 rounded-2xl overflow-hidden border border-white/10 bg-zinc-900/80">
                  <img src={logoImg} alt="InstruMentor logo" className="h-full w-full object-cover" />
                </span>
                <span className="text-lg font-semibold tracking-tight">InstruMentor</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => navigate("/login")}
                  className="inline-flex rounded-xl px-3 sm:px-4 py-2 text-sm font-semibold text-zinc-200 hover:text-white hover:bg-white/5 border border-white/10 transition-colors"
                >
                  Log in
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/signup")}
                  className="inline-flex items-center gap-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white px-3 sm:px-4 py-2 text-sm font-semibold shadow-lg shadow-sky-900/30 transition-colors"
                >
                  Get started
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="relative z-10">
          {/* HERO — states what the product is up front, then the pitch's
              opening line, fading in on load */}
          <section className="min-h-[80vh] flex items-center justify-center text-center px-4 sm:px-6">
            <div ref={heroRef} className="max-w-4xl">
              <h1 className="font-display italic text-4xl sm:text-6xl md:text-7xl leading-[1.1]">
                No one here is teaching a curriculum written for everyone at once.
              </h1>
              <p className="mt-6 text-lg sm:text-xl text-zinc-400 max-w-2xl mx-auto">
                A social network for musicians — courses, live audio rooms, and a
                feed for what you're working on.
              </p>
            </div>
          </section>

          {/* REVEAL SEQUENCE — the pitch continues, one line at a time */}
          <section className="mx-auto max-w-4xl px-4 sm:px-6 py-24 sm:py-36 space-y-14 sm:space-y-20">
            <RevealLine
              as="h2"
              text="Every course, every room, every post — made by someone actually playing."
              className="font-display italic text-3xl sm:text-5xl leading-tight"
            />
            <RevealLine
              as="h2"
              text="InstruMentor is musicians building this together."
              className="font-display italic text-3xl sm:text-5xl leading-tight bg-gradient-to-r from-sky-300 via-cyan-300 to-amber-200 bg-clip-text text-transparent"
            />
            <RevealLine
              as="p"
              text="Host a course with lectures and live meetings, open an audio room to jam or rehearse, or just post what you're working on today."
              className="text-lg sm:text-2xl leading-relaxed text-zinc-300 max-w-3xl"
            />
          </section>

          {/* FEATURES — editorial rows, hairline dividers instead of boxed cards */}
          <section id="features" className="mx-auto max-w-5xl px-4 sm:px-6 pb-24 sm:pb-36">
            <RevealUp
              as="p"
              text="What you get."
              className="font-display italic text-2xl sm:text-3xl text-amber-200/90 mb-4"
            />
            <div className="border-t border-white/10 divide-y divide-white/10">
              {FEATURES.map((f) => (
                <div key={f.title} className="grid sm:grid-cols-12 gap-4 sm:gap-8 py-10 group">
                  <div className="sm:col-span-5 flex items-start gap-4">
                    <div className={`h-12 w-12 shrink-0 rounded-2xl border inline-flex items-center justify-center transition-colors ${f.tone}`}>
                      <f.icon className="h-5 w-5" />
                    </div>
                    <RevealUp as="p" text={f.title} className="font-semibold text-xl sm:text-2xl leading-snug pt-1.5" />
                  </div>
                  <p className="sm:col-span-7 text-base sm:text-lg text-zinc-400 leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* CLOSING STATEMENT */}
          <section className="mx-auto max-w-4xl px-4 sm:px-6 pt-24 sm:pt-36 pb-32 sm:pb-48 text-center">
            <RevealLine
              as="h2"
              text="Your instrument is waiting."
              className="font-display italic text-4xl sm:text-6xl leading-tight"
            />
            <RevealLine
              as="h2"
              text="So is everyone building this with you."
              className="font-display italic text-4xl sm:text-6xl leading-tight bg-gradient-to-r from-sky-300 via-cyan-300 to-amber-200 bg-clip-text text-transparent mt-2"
            />
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => navigate("/signup")}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white px-6 py-3 text-sm font-semibold shadow-lg shadow-sky-900/30 transition-colors"
              >
                Create your account
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => navigate("/login")}
                className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl px-6 py-3 text-sm font-semibold text-zinc-200 hover:text-white border border-white/10 hover:bg-white/5 transition-colors"
              >
                Log in
              </button>
            </div>
          </section>
        </main>
      </div>
    </>
  );
};

export default LandingPageReveal;