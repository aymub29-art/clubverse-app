"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const INTERESTS = [
  "Coding", "Graphic Design", "Photography", "Video Editing",
  "Public Speaking", "Event Management", "Marketing", "Social Media",
  "Content Writing", "Leadership", "Technical Support", "Volunteering",
  "Music", "Sports", "Organising", "Research"
];

const SKILLS = [
  "Programming", "Canva", "Figma", "Photography",
  "Video Editing", "Communication", "Teamwork",
  "Writing", "Presentation", "Planning", "Marketing",
  "Problem Solving"
];

const AVAILABILITY = ["Weekdays", "Weekends", "Both", "Flexible"];

type TalentProfile = {
  interests: string[];
  skills: string[];
  learning_goals: string[];
  availability: string[];
  experience_level: string;
};

const emptyProfile: TalentProfile = {
  interests: [],
  skills: [],
  learning_goals: [],
  availability: [],
  experience_level: "beginner",
};

export default function TalentSection() {
  const [profile, setProfile] = useState<TalentProfile>(emptyProfile);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadTalentProfile() {
      const supabase = createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        setMessage("Please sign in to manage your interests.");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("student_talent_profiles")
        .select("interests, skills, learning_goals, availability, experience_level")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        setMessage("Unable to load your talent profile: " + error.message);
      } else if (data) {
        setProfile({
          interests: data.interests || [],
          skills: data.skills || [],
          learning_goals: data.learning_goals || [],
          availability: data.availability || [],
          experience_level: data.experience_level || "beginner",
        });
      }

      setLoading(false);
    }

    loadTalentProfile();
  }, []);

  function toggleValue(field: "interests" | "skills" | "learning_goals" | "availability", value: string) {
    setProfile((current) => {
      const values = current[field];
      return {
        ...current,
        [field]: values.includes(value)
          ? values.filter((item) => item !== value)
          : [...values, value],
      };
    });
  }

  async function saveTalentProfile() {
    setSaving(true);
    setMessage("");

    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      setMessage("Your session has expired. Please sign in again.");
      setSaving(false);
      return;
    }

    if (profile.interests.length === 0) {
      setMessage("Please select at least one interest.");
      setSaving(false);
      return;
    }

    const { error } = await supabase
      .from("student_talent_profiles")
      .upsert({
        user_id: user.id,
        interests: profile.interests,
        skills: profile.skills,
        learning_goals: profile.learning_goals,
        availability: profile.availability,
        experience_level: "beginner",
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

    if (error) {
      setMessage("Could not save your interests: " + error.message);
    } else {
      setMessage("Your talent profile has been saved successfully!");
    }

    setSaving(false);
  }

  if (loading) {
    return <section className="talent-section">Loading your talent profile...</section>;
  }

  return (
    <section className="talent-section">
      <div className="talent-heading">
        <span>02 / DISCOVER YOUR POTENTIAL</span>
        <h2>My interests & talents.</h2>
        <p>
          Tell us what you enjoy and what you want to learn.
          You do not need previous experience to participate.
        </p>
      </div>

      <div className="talent-group">
        <h3>What are you interested in?</h3>
        <p>Select everything you would enjoy doing.</p>
        <div className="talent-options">
          {INTERESTS.map((item) => (
            <button
              type="button"
              key={item}
              className={`talent-chip ${profile.interests.includes(item) ? "selected" : ""}`}
              aria-pressed={profile.interests.includes(item)}
              onClick={() => toggleValue("interests", item)}
            >
              {profile.interests.includes(item) ? "✓ " : "+ "}{item}
            </button>
          ))}
        </div>
      </div>

      <div className="talent-group">
        <h3>What can you already do?</h3>
        <p>Optional. Beginners can leave this empty.</p>
        <div className="talent-options">
          {SKILLS.map((item) => (
            <button
              type="button"
              key={item}
              className={`talent-chip ${profile.skills.includes(item) ? "selected" : ""}`}
              aria-pressed={profile.skills.includes(item)}
              onClick={() => toggleValue("skills", item)}
            >
              {profile.skills.includes(item) ? "✓ " : "+ "}{item}
            </button>
          ))}
        </div>
      </div>

      <div className="talent-group">
        <h3>What would you like to learn?</h3>
        <p>Choose activities where you want to gain experience.</p>
        <div className="talent-options">
          {SKILLS.map((item) => (
            <button
              type="button"
              key={item}
              className={`talent-chip ${profile.learning_goals.includes(item) ? "selected" : ""}`}
              aria-pressed={profile.learning_goals.includes(item)}
              onClick={() => toggleValue("learning_goals", item)}
            >
              {profile.learning_goals.includes(item) ? "✓ " : "+ "}{item}
            </button>
          ))}
        </div>
      </div>

      <div className="talent-group">
        <h3>When are you available?</h3>
        <div className="talent-options">
          {AVAILABILITY.map((item) => (
            <button
              type="button"
              key={item}
              className={`talent-chip ${profile.availability.includes(item) ? "selected" : ""}`}
              aria-pressed={profile.availability.includes(item)}
              onClick={() => toggleValue("availability", item)}
            >
              {profile.availability.includes(item) ? "✓ " : "+ "}{item}
            </button>
          ))}
        </div>
      </div>

      <div className="talent-beginner-note">
        <strong>🌱 Beginner-friendly profile</strong>
        <p>
          Your experience level is set to Beginner. ClubVerse will
          recommend opportunities based on your interests and learning
          goals, not just your existing skills.
        </p>
      </div>

      {message && (
        <p className={message.includes("successfully") ? "talent-success" : "talent-error"} role="status">
          {message}
        </p>
      )}

      <button
        type="button"
        className="talent-save"
        onClick={saveTalentProfile}
        disabled={saving}
      >
        {saving ? "Saving..." : "Save my interests ↗"}
      </button>
    </section>
  );
}
