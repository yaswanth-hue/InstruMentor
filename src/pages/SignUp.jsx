import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { auth, db, googleProvider } from "../firebase";
import { createUserWithEmailAndPassword, signInWithPopup } from "firebase/auth";
import { collection, query, where, getDocs, addDoc } from "firebase/firestore";

const SignUp = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSignUp = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const q = query(collection(db, "users"), where("email", "==", email));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        setError("This account is already registered. Please log in.");
        return;
      }

      const userCredential = await createUserWithEmailAndPassword(auth, email, password);

      await addDoc(collection(db, "users"), {
        uid: userCredential.user.uid,
        email,
      });

      navigate("/home");
    } catch {
      setError("Failed to create an account. Try again.");
    }
  };

  const handleGoogleSignUp = async () => {
    setError("");

    try {
      const result = await signInWithPopup(auth, googleProvider);
      const userEmail = result.user.email;

      const q = query(collection(db, "users"), where("email", "==", userEmail));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        setError("This account is already registered. Please log in.");
        return;
      }

      await addDoc(collection(db, "users"), {
        uid: result.user.uid,
        email: userEmail,
      });

      navigate("/home");
    } catch {
      setError("Google Sign-Up failed. Try again.");
    }
  };

  return (
    <>
      <Helmet>
        <title>Sign Up | InstruMentor - Join the Musical Network</title>
        <meta
          name="description"
          content="Create an InstruMentor account to connect with other musicians, join audio rooms, and follow structured courses."
        />
      </Helmet>

      <div
        className="min-h-screen flex items-center justify-center bg-gradient-to-b from-zinc-950 via-neutral-950 to-zinc-950 text-white px-4"
        style={{ width: "100%", maxWidth: "none" }}
      >
        <div className="relative w-full max-w-md rounded-3xl border border-white/10 bg-white/5 backdrop-blur-2xl shadow-2xl shadow-black/40 overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-40 left-0 h-72 w-72 rounded-full bg-amber-400/25 blur-3xl" />
            <div className="absolute -bottom-40 right-0 h-72 w-72 rounded-full bg-purple-500/25 blur-3xl" />
          </div>

          <div className="relative">
            <div className="w-full px-6 py-8 sm:px-8">
              <div className="mb-6 text-center md:text-left">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">Sign up</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight">Create your InstruMentor account</h2>
              </div>

              {error && (
                <p className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                  {error}
                </p>
              )}

              <form onSubmit={handleSignUp} className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-300">Email</label>
                  <input
                    type="email"
                    placeholder="you@example.com"
                    className="w-full rounded-xl border border-white/10 bg-zinc-900/70 px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-400/80 focus:border-transparent transition-all"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-300">Password</label>
                  <input
                    type="password"
                    placeholder="Create a password"
                    className="w-full rounded-xl border border-white/10 bg-zinc-900/70 px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-400/80 focus:border-transparent transition-all"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="mt-2 w-full inline-flex items-center justify-center rounded-xl bg-amber-400 text-zinc-950 px-4 py-3 text-sm font-semibold shadow-lg shadow-amber-400/20 hover:bg-amber-300 transition-colors"
                >
                  Sign up
                </button>
              </form>

              <div className="my-5 flex items-center gap-3 text-xs text-zinc-500">
                <div className="h-px flex-1 bg-white/10" />
                <span>or continue with</span>
                <div className="h-px flex-1 bg-white/10" />
              </div>

              <button
                onClick={handleGoogleSignUp}
                className="w-full rounded-xl border border-white/15 bg-zinc-900/70 px-4 py-3 text-sm font-semibold text-zinc-100 hover:bg-zinc-800/80 hover:border-white/30 transition-colors"
              >
                Sign up with Google
              </button>

              <p className="mt-6 text-center text-xs text-zinc-400">
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => navigate("/login")}
                  className="font-semibold text-amber-300 hover:text-amber-200 cursor-pointer"
                >
                  Log in
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default SignUp;
