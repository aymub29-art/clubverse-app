"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const supabase = createClient();
  const router = useRouter();

  const [mode, setMode] = useState<"login" | "signup">("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: name },
            emailRedirectTo: `${window.location.origin}/login`,
          },
        });

        if (error) throw error;

        if (data.session) {
          router.push("/dashboard");
          router.refresh();
        } else {
          setMessage("Account created! Check your email to confirm your account.");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        router.push("/dashboard");
        router.refresh();
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <a href="/" className="auth-logo">C<span>.</span> clubverse</a>

      <section className="auth-card">
        <div className="section-label">GDG ON CAMPUS · RIT HASSAN</div>
        <h1>{mode === "signup" ? "Find your people." : "Welcome back."}</h1>
        <p className="auth-description">
          {mode === "signup"
            ? "Create your ClubVerse account and become part of the community."
            : "Sign in to continue your ClubVerse journey."}
        </p>

        <div className="auth-tabs">
          <button className={mode === "signup" ? "selected" : ""} onClick={() => { setMode("signup"); setMessage(""); }}>Create account</button>
          <button className={mode === "login" ? "selected" : ""} onClick={() => { setMode("login"); setMessage(""); }}>Sign in</button>
        </div>

        <form onSubmit={handleSubmit}>
          {mode === "signup" && (
            <label>
              FULL NAME
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" required />
            </label>
          )}

          <label>
            EMAIL ADDRESS
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
          </label>

          <label>
            PASSWORD
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" minLength={8} required />
          </label>

          <button className="auth-submit" disabled={loading}>
            {loading ? "Please wait..." : mode === "signup" ? "Create my account ↗" : "Sign in ↗"}
          </button>
        </form>

        {message && <p className="auth-message" role="status">{message}</p>}

        <p className="auth-footnote">
          By continuing, you agree to use the community respectfully.
        </p>
      </section>
    </main>
  );
}
