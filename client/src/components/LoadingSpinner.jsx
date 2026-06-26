import React from "react";
import logoImg from "../assets/logo.png";

/**
 * LoadingSpinner — single loading UI for the entire app.
 *
 * fullScreen (default true)  → full-viewport, used at route / auth level
 * fullScreen={false}         → inline, used inside cards / tabs / panels
 */

const LoadingSpinner = ({
  message = "Loading…",
  fullScreen = true,
  size = "md",
}) => {
  /* ── Inline mode ── */
  if (!fullScreen) {
    const ring = size === "sm" ? "h-5 w-5 border-[1.5px]" : "h-8 w-8 border-2";
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-10 animate-fadeIn">
        <div className={`${ring} rounded-full border-white/10 border-t-sky-400 animate-spin`} />
        {message && (
          <p className="text-xs text-zinc-400 text-center">{message}</p>
        )}
      </div>
    );
  }

  /* ── Full-screen mode ── */
  return (
    <div
      className="min-h-screen w-full flex flex-col items-center justify-center bg-gradient-to-b from-zinc-950 via-neutral-950 to-zinc-950 animate-fadeIn"
      style={{ width: "100%", maxWidth: "none" }}
    >
      {/* Logo */}
      <div className="relative mb-8">
        {/* Soft glow behind logo */}
        <div className="absolute inset-0 rounded-3xl blur-2xl bg-sky-500/20 scale-150" />

        <div className="relative h-16 w-16 rounded-3xl overflow-hidden border border-white/10 bg-zinc-900/80 shadow-xl shadow-black/40">
          <img
            src={logoImg}
            alt="InstruMentor"
            className="h-full w-full object-cover"
          />
        </div>

        {/* Spinning ring that orbits the logo */}
        <div
          className="absolute -inset-2 rounded-full border-2 border-transparent border-t-sky-400 border-r-sky-400/30 animate-spin"
          style={{ animationDuration: "1.1s" }}
        />
      </div>

      {/* Brand name */}
      <p className="text-sm font-semibold tracking-tight text-zinc-100 mb-1">
        InstruMentor
      </p>

      {/* Context message */}
      {message && (
        <p className="text-xs text-zinc-500">{message}</p>
      )}
    </div>
  );
};

export default LoadingSpinner;