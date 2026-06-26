import React from "react";
import { Music } from "lucide-react";

const LoadingSpinner = ({ size = "medium", message = "Loading..." }) => {
  const sizeClasses = {
    small: "h-8 w-8",
    medium: "h-11 w-11",
    large: "h-14 w-14",
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-gradient-to-b from-zinc-950 via-neutral-950 to-zinc-950 text-white px-4"
      style={{ width: "100%", maxWidth: "none" }}
    >
      <div className="relative w-full max-w-sm rounded-3xl border border-white/10 bg-white/5 backdrop-blur-2xl shadow-2xl shadow-black/40 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-24 left-0 h-40 w-40 rounded-full bg-indigo-500/25 blur-3xl" />
          <div className="absolute -bottom-24 right-0 h-40 w-40 rounded-full bg-amber-400/25 blur-3xl" />
        </div>

        <div className="relative px-6 py-8 flex flex-col items-center gap-4">
          <div className="inline-flex items-center justify-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 shadow-lg shadow-indigo-500/30">
              <Music className="h-4 w-4 text-white" />
            </span>
            <span className="text-sm font-semibold tracking-tight text-zinc-100">InstruMentor</span>
          </div>

          <div className="mt-2 flex flex-col items-center gap-3">
            <div className="relative">
              <div
                className={`${sizeClasses[size]} rounded-full border border-white/10 bg-zinc-900/60 flex items-center justify-center`}
              >
                <div className="h-1.5 w-1.5 rounded-full bg-amber-300 animate-ping" />
              </div>
              <div className="absolute inset-1 rounded-full border-t border-white/40 animate-spin-slow" />
            </div>

            {message && (
              <p className="mt-2 text-xs text-zinc-300 text-center">
                {message}
              </p>
            )}

            <p className="text-[11px] text-zinc-500 text-center">
              Tuning things for your session…
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoadingSpinner;
