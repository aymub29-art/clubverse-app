
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type ClubEvent = {
  id: string;
  title: string;
  category: string | null;
  starts_at: string;
  capacity: number | null;
  status: string;
};

type Registration = {
  event_id: string;
  status: string;
};

export default function AnalyticsPage() {
  const supabase = createClient();
  const router = useRouter();

  const [events, setEvents] = useState<ClubEvent[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState("");

  const loadAnalytics = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    setError("");

    try {
      const { data: auth, error: authError } =
        await supabase.auth.getUser();

      if (authError || !auth.user) {
        router.replace("/login");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", auth.user.id)
        .single();

      if (profileError) throw profileError;

      if (profile?.role !== "organizer" && profile?.role !== "admin") {
        setError("Organiser access required.");
        return;
      }

      const [eventResult, registrationResult] = await Promise.all([
        supabase
          .from("events")
          .select("id,title,category,starts_at,capacity,status")
          .order("starts_at", { ascending: true }),

        supabase
          .from("registrations")
          .select("event_id,status"),
      ]);

      if (eventResult.error) throw eventResult.error;
      if (registrationResult.error) throw registrationResult.error;

      setEvents(eventResult.data || []);
      setRegistrations(registrationResult.data || []);
      setLastUpdated(new Date().toLocaleTimeString("en-IN"));
    } catch (err) {
      console.error("Analytics error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load analytics."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router, supabase]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const activeRegistrations = useMemo(
    () =>
      registrations.filter(
        (r) => r.status === "registered" || r.status === "attended"
      ),
    [registrations]
  );

  const attended = useMemo(
    () => registrations.filter((r) => r.status === "attended").length,
    [registrations]
  );

  const cancelled = useMemo(
    () => registrations.filter((r) => r.status === "cancelled").length,
    [registrations]
  );

  const published = events.filter(
    (event) => event.status === "published"
  ).length;

  const attendanceRate = activeRegistrations.length
    ? Math.round((attended / activeRegistrations.length) * 100)
    : 0;

  const totalCapacity = events.reduce(
    (sum, event) => sum + Math.max(event.capacity || 0, 0),
    0
  );

  const capacityUtilisation = totalCapacity
    ? Math.min(
        100,
        Math.round((activeRegistrations.length / totalCapacity) * 100)
      )
    : 0;

  const eventStats = events.map((event) => {
    const records = registrations.filter(
      (registration) => registration.event_id === event.id
    );

    const registered = records.filter(
      (r) => r.status === "registered"
    ).length;

    const present = records.filter(
      (r) => r.status === "attended"
    ).length;

    const cancelledCount = records.filter(
      (r) => r.status === "cancelled"
    ).length;

    const active = registered + present;

    return {
      ...event,
      registered,
      attended: present,
      cancelled: cancelledCount,
      active,
      rate: active
        ? Math.round((present / active) * 100)
        : 0,
      capacityRate:
        event.capacity && event.capacity > 0
          ? Math.min(100, Math.round((active / event.capacity) * 100))
          : null,
    };
  });

  const mostPopular = [...eventStats]
    .filter((event) => event.active > 0)
    .sort((a, b) => b.active - a.active)[0];

  if (loading) {
    return (
      <main className="analytics-page">
        <div className="analytics-loading">
          <div className="analytics-loader" />
          <p>Preparing your community insights...</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="analytics-page">
        <div className="analytics-error">
          <h2>Analytics unavailable</h2>
          <p>{error}</p>
          <Link href="/organizer">
            Back to organiser dashboard ↗
          </Link>
          <button onClick={() => loadAnalytics()}>
            Try again
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="analytics-page">
      <nav className="analytics-nav">
        <Link href="/" className="events-brand">
          ClubVerse<span>.</span>
        </Link>

        <div>
          <Link href="/organizer">Organiser</Link>
          <Link href="/organizer/attendance">Scanner</Link>
          <Link href="/dashboard">Dashboard</Link>
        </div>
      </nav>

      <section className="analytics-hero">
        <p className="eyebrow">CLUBVERSE INTELLIGENCE</p>

        <h1>
          Numbers tell
          <br />
          <span>the story.</span>
        </h1>

        <p>
          Understand participation, measure engagement and track
          your community&apos;s growth.
        </p>
      </section>

      <section className="analytics-content">
        <div className="analytics-heading">
          <div>
            <p className="eyebrow">LIVE PERFORMANCE</p>
            <h2>Community overview</h2>
            <small>
              Last updated: {lastUpdated || "Not yet updated"}
            </small>
          </div>

          <button
            onClick={() => loadAnalytics(true)}
            disabled={refreshing}
          >
            {refreshing ? "Refreshing..." : "↻ Refresh data"}
          </button>
        </div>

        <div className="analytics-stats">
          <article>
            <span>TOTAL EVENTS</span>
            <strong>{events.length}</strong>
            <small>{published} currently published</small>
          </article>

          <article>
            <span>ACTIVE REGISTRATIONS</span>
            <strong>{activeRegistrations.length}</strong>
            <small>
              {cancelled} cancelled registrations excluded
            </small>
          </article>

          <article>
            <span>ATTENDEES</span>
            <strong>{attended}</strong>
            <small>Successfully checked in</small>
          </article>

          <article>
            <span>ATTENDANCE RATE</span>
            <strong>{attendanceRate}%</strong>
            <small>Of active registrations</small>
          </article>
        </div>

        <div className="analytics-insights">
          <article>
            <span className="analytics-insight-label">
              CAPACITY UTILISATION
            </span>

            <strong>{capacityUtilisation}%</strong>

            <p>
              {totalCapacity > 0
                ? `${activeRegistrations.length} active registrations across ${totalCapacity} total seats`
                : "Capacity data is unavailable for these events"}
            </p>

            <div className="analytics-progress">
              <div style={{ width: `${capacityUtilisation}%` }} />
            </div>
          </article>

          <article>
            <span className="analytics-insight-label">
              MOST POPULAR EVENT
            </span>

            <strong className="analytics-popular-title">
              {mostPopular?.title || "No registrations yet"}
            </strong>

            <p>
              {mostPopular
                ? `${mostPopular.active} active registrations`
                : "Your event insights will appear here"}
            </p>
          </article>
        </div>

        <div className="analytics-section-heading">
          <div>
            <p className="eyebrow">EVENT PERFORMANCE</p>
            <h2>Participation breakdown</h2>
          </div>

          <span>{events.length} events</span>
        </div>

        {eventStats.length === 0 ? (
          <div className="events-empty">
            <h3>No event data yet.</h3>
            <p>
              Create an event to begin tracking community participation.
            </p>
            <Link href="/organizer">
              Create an event ↗
            </Link>
          </div>
        ) : (
          <div className="analytics-event-list">
            {eventStats.map((event) => (
              <article className="analytics-event" key={event.id}>
                <div className="analytics-event-top">
                  <div>
                    <span className="analytics-category">
                      {event.category || "COMMUNITY"}
                    </span>

                    <h3>{event.title}</h3>

                    <small>
                      {new Date(event.starts_at).toLocaleDateString(
                        "en-IN",
                        {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        }
                      )}
                    </small>
                  </div>

                  <span
                    className={`organizer-status status-${event.status}`}
                  >
                    {event.status}
                  </span>
                </div>

                <div className="analytics-event-numbers">
                  <div>
                    <strong>{event.registered}</strong>
                    <span>Registered</span>
                  </div>

                  <div>
                    <strong>{event.attended}</strong>
                    <span>Attended</span>
                  </div>

                  <div>
                    <strong>{event.rate}%</strong>
                    <span>Attendance</span>
                  </div>
                </div>

                <div className="analytics-progress">
                  <div style={{ width: `${event.rate}%` }} />
                </div>

                <div className="analytics-event-extra">
                  <span>
                    Cancelled: <strong>{event.cancelled}</strong>
                  </span>

                  <span>
                    Capacity:{" "}
                    <strong>
                      {event.capacityRate === null
                        ? "Not set"
                        : `${event.active}/${event.capacity} (${event.capacityRate}%)`}
                    </strong>
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}

        <div className="analytics-note">
          <strong>Data integrity</strong>
          <p>
            Metrics are calculated from ClubVerse event and registration
            records. Cancelled registrations are excluded from active
            registration and attendance-rate calculations. Attendance is
            counted only after a successful QR check-in.
          </p>
        </div>
      </section>

      <footer className="events-footer">
        ClubVerse · GDG on Campus – RIT Hassan
      </footer>
    </main>
  );
}
