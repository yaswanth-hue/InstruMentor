import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { signInWithGoogle, signInWithEmail } from "../firebase";

const LoginPage = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await signInWithEmail(email, password);
      navigate("/home");
    } catch (err) {
      setError(err.message);
    }
  };

  const handleGoogleLogin = async () => {
    setError("");
    try {
      await signInWithGoogle();
      navigate("/home");
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <>
      <Helmet>
        <title>Login | InstruMentor - Access Your Musical Network</title>
        <meta
          name="description"
          content="Log in to InstruMentor to connect with musicians, share your music, learn from courses, and collaborate with artists worldwide."
        />
        <meta property="og:title" content="Login | InstruMentor - Access Your Musical Network" />
        <meta
          property="og:description"
          content="Log in to InstruMentor to connect with musicians and access your musical network."
        />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={typeof window !== "undefined" ? window.location.href : ""} />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content="Login | InstruMentor" />
        <meta name="twitter:description" content="Log in to InstruMentor to access your musical network." />
      </Helmet>

      <div
        className="min-h-screen flex items-center justify-center bg-gradient-to-b from-zinc-950 via-neutral-950 to-zinc-950 text-white px-4"
        style={{ width: "100%", maxWidth: "none" }}
      >
        <div className="relative w-full max-w-md rounded-3xl border border-white/10 bg-white/5 backdrop-blur-2xl shadow-2xl shadow-black/40 overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-40 -left-10 h-72 w-72 rounded-full bg-purple-500/25 blur-3xl" />
            <div className="absolute -bottom-40 right-0 h-72 w-72 rounded-full bg-indigo-500/25 blur-3xl" />
          </div>

          <div className="relative">
            <div className="w-full px-6 py-8 sm:px-8">
              <div className="mb-6 text-center md:text-left">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">Log in</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight">Access your musical network</h2>
              </div>

              {error && (
                <p className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                  {error}
                </p>
              )}

              <form onSubmit={handleEmailLogin} className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-300">Email</label>
                  <input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-zinc-900/70 px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-400/80 focus:border-transparent transition-all"
                    required
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-300">Password</label>
                  <input
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-zinc-900/70 px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-400/80 focus:border-transparent transition-all"
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="mt-2 w-full inline-flex items-center justify-center rounded-xl bg-amber-400 text-zinc-950 px-4 py-3 text-sm font-semibold shadow-lg shadow-amber-400/20 hover:bg-amber-300 transition-colors"
                >
                  Log in
                </button>
              </form>

              <div className="my-5 flex items-center gap-3 text-xs text-zinc-500">
                <div className="h-px flex-1 bg-white/10" />
                <span>or continue with</span>
                <div className="h-px flex-1 bg-white/10" />
              </div>

              <button
                onClick={handleGoogleLogin}
                className="w-full rounded-xl border border-white/15 bg-zinc-900/70 px-4 py-3 text-sm font-semibold text-zinc-100 hover:bg-zinc-800/80 hover:border-white/30 transition-colors"
              >
                Sign in with Google
              </button>

              <p className="mt-6 text-center text-xs text-zinc-400">
                Don't have an account?{" "}
                <Link to="/signup" className="font-semibold text-amber-300 hover:text-amber-200">
                  Sign up
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default LoginPage;
