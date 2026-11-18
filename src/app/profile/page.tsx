"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import TalentSection from "./talents-section";

export default function ProfilePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    full_name: "",
    college: "",
    department: "",
    bio: "",
  });

  useEffect(() => {
    async function loadProfile() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, college, department, bio")
        .eq("id", user.id)
        .single();

      if (error) {
        setMessage("Unable to load your profile. Please refresh.");
      } else if (data) {
        setForm({
          full_name: data.full_name || "",
          college: data.college || "",
          department: data.department || "",
          bio: data.bio || "",
        });
      }

      setLoading(false);
    }

    loadProfile();
  }, [router]);

  function updateField(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      setMessage("Your session has expired. Please sign in again.");
      setSaving(false);
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: form.full_name.trim(),
        college: form.college.trim(),
        department: form.department.trim(),
        bio: form.bio.trim(),
      })
      .eq("id", user.id);

    if (error) {
      setMessage("Could not save profile: " + error.message);
    } else {
      setMessage("Your profile has been saved successfully!");
    }

    setSaving(false);
  }

  if (loading) {
    return <main className="profile-loading">Loading your profile...</main>;
  }

  return (
    <main className="profile-page">
      <header className="profile-header">
        <a href="/" className="logo">
          <span className="logo-symbol">C<span>.</span></span>
          <span>clubverse</span>
        </a>
        <a href="/dashboard" className="profile-back">← Dashboard</a>
      </header>

      <section className="profile-content">
        <div className="section-label">YOUR IDENTITY · YOUR COMMUNITY</div>
        <h1>Make it <em>yours.</em></h1>
        <p className="profile-intro">
          Tell the community a little about yourself. Your profile helps
          people discover who you are and what you're interested in.
        </p>

        <form className="profile-form" onSubmit={saveProfile}>
          <div className="profile-form-heading">
            <div>
              <span>01 / PERSONAL INFORMATION</span>
              <h2>Your details.</h2>
            </div>
            <div className="profile-initial">
              {(form.full_name.trim()[0] || "S").toUpperCase()}
            </div>
          </div>

          <label>
            FULL NAME
            <input
              value={form.full_name}
              onChange={(e) => updateField("full_name", e.target.value)}
              placeholder="Enter your full name"
              maxLength={100}
              required
            />
          </label>

          <label>
            COLLEGE / INSTITUTION
            <input
              value={form.college}
              onChange={(e) => updateField("college", e.target.value)}
              placeholder="Your college name"
              maxLength={150}
            />
          </label>

          <label>
            DEPARTMENT
            <input
              value={form.department}
              onChange={(e) => updateField("department", e.target.value)}
              placeholder="e.g. Computer Science and Engineering"
              maxLength={100}
            />
          </label>

          <label>
            ABOUT YOU
            <textarea
              value={form.bio}
              onChange={(e) => updateField("bio", e.target.value)}
              placeholder="Tell us about your interests, goals and what you enjoy building..."
              maxLength={500}
              rows={5}
            />
            <small>{form.bio.length}/500 characters</small>
          </label>

          <TalentSection />

          {message && (
            <p className={message.includes("successfully") ? "profile-success" : "profile-error"} role="status">
              {message}
            </p>
          )}

          <div className="profile-actions">
            <button type="button" className="profile-cancel" onClick={() => router.push("/dashboard")}>
              Cancel
            </button>
            <button type="submit" className="profile-save" disabled={saving}>
              {saving ? "Saving..." : "Save my profile ↗"}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
