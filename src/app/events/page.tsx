"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Event = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string | null;
  capacity: number | null;
};

export default function EventsPage() {
  const supabase = createClient();
  const router = useRouter();

  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [registered, setRegistered] = useState<string[]>([]);

  useEffect(() => {
    async function loadEvents() {
      const { data, error } = await supabase
        .from("events")
        .select("id,title,description,category,location,starts_at,ends_at,capacity")
        .eq("status", "published")
        .gte("starts_at", new Date(0).toISOString())
        .order("starts_at", { ascending: true });

      if (error) {
        setMessage(error.message);
      } else {
        setEvents(data || []);
      }

      const { data: authData } = await supabase.auth.getUser();

      if (authData.user) {
        const { data: myRegistrations } = await supabase
          .from("registrations")
          .select("event_id")
          .eq("user_id", authData.user.id)
          .eq("status", "registered");

        setRegistered((myRegistrations || []).map((item) => item.event_id));
      }

      setLoading(false);
    }

    loadEvents();
  }, []);

  async function register(eventId: string) {
    setMessage("");
    setRegistering(eventId);

    try {
      const { data: authData } = await supabase.auth.getUser();

      if (!authData.user) {
        router.push("/login");
        return;
      }

      // First, complete the actual event registration.
      const { error: registrationError } = await supabase.rpc(
        "register_for_event",
        { p_event_id: eventId }
      );

      if (registrationError) {
        setMessage(registrationError.message);
        return;
      }

      setRegistered((previous) =>
        previous.includes(eventId) ? previous : [...previous, eventId]
      );

      // Fetch the confirmed registration ID for the secure email API.
      const { data: registration, error: lookupError } = await supabase
        .from("registrations")
        .select("id")
        .eq("event_id", eventId)
        .eq("user_id", authData.user.id)
        .eq("status", "registered")
        .maybeSingle();

      if (lookupError || !registration) {
        setMessage(
          "Registration successful! Your QR pass is available, but the confirmation email could not be prepared."
        );
        return;
      }

      // Ask our server to verify the registration and contact n8n.
      const emailResponse = await fetch(
        "/api/clubverse/registration-email",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ registrationId: registration.id }),
        }
      );

      const emailResult = await emailResponse.json();

      if (emailResponse.ok && emailResult.success) {
        setMessage("Registration successful! Confirmation email sent. Opening your QR pass...");
        router.push("/my-qr");
      } else {
        setMessage(
          "Registration successful! Your QR pass is ready, but the confirmation email could not be sent."
        );
      }
    } catch (error) {
      console.error("Registration error:", error);
      setMessage(
        "Something went wrong. Please check your registration before trying again."
      );
    } finally {
      setRegistering(null);
    }
  }

  return (
    <main className="events-page">
      <nav className="events-nav">
        <Link href="/" className="events-brand">ClubVerse<span>.</span></Link>
        <div>
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/profile">Profile</Link>
        </div>
      </nav>

      <section className="events-hero">
        <p className="eyebrow">THE CLUBVERSE COMMUNITY</p>
        <h1>Find your next<br /><span>big moment.</span></h1>
        <p>Discover workshops, competitions and experiences happening in our community.</p>
      </section>

      <section className="events-content">
        <div className="events-heading">
          <div>
            <p className="eyebrow">WHAT'S HAPPENING</p>
            <h2>Explore events</h2>
          </div>
          <span>{events.length} events</span>
        </div>

        {message && <div className="events-message">{message}</div>}

        {loading ? (
          <p className="events-empty">Loading events...</p>
        ) : events.length === 0 ? (
          <div className="events-empty">
            <h3>Something exciting is coming.</h3>
            <p>There are no published events right now. Check back soon.</p>
          </div>
        ) : (
          <div className="events-grid">
            {events.map((event) => (
              <article className="event-card" key={event.id}>
                <div className="event-card-top">
                  <span>{event.category || "Community"}</span>
                  <span>{new Date(event.starts_at).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}</span>
                </div>
                <h3>{event.title}</h3>
                <p>{event.description || "Join the community for this experience."}</p>
                <div className="event-meta">
                  <span>◷ {new Date(event.starts_at).toLocaleTimeString("en-IN", {
                    hour: "numeric",
                    minute: "2-digit",
                  })}</span>
                  <span>⌖ {event.location || "Venue to be announced"}</span>
                  <span>{event.capacity === null ? "Open capacity" : `${event.capacity} seats maximum`}</span>
                </div>
                <button
                  className="event-register"
                  disabled={registering === event.id}
                  onClick={() =>
                    registered.includes(event.id)
                      ? router.push("/my-qr")
                      : register(event.id)
                  }
                >
                  {registering === event.id
                    ? "Registering..."
                    : registered.includes(event.id)
                    ? "View QR Pass ↗"
                    : "Register now ↗"}
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      <footer className="events-footer">
        ClubVerse · GDG on Campus – RIT Hassan
      </footer>
    </main>
  );
}
