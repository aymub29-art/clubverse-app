
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Profile = {
  full_name: string | null;
  college: string | null;
  department: string | null;
  role: string;
};

type EventItem = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  location: string | null;
  starts_at: string;
};

type Registration = {
  id: string;
  event_id: string;
  status: string;
  registered_at: string;
  attended_at: string | null;
};

export default function DashboardPage() {
  const supabase = createClient();
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [eventNames, setEventNames] = useState<Record<string, string>>({});
  const [registeredEventIds, setRegisteredEventIds] = useState<string[]>([]);
  const [upcomingCount, setUpcomingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState("");

  const loadDashboard = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);

    setError("");

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        router.replace("/login");
        return;
      }

      const now = new Date().toISOString();

      const [profileResult, eventResult, registrationResult] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("full_name,college,department,role")
            .eq("id", user.id)
            .single(),

          supabase
            .from("events")
            .select(
              "id,title,description,category,location,starts_at",
              { count: "exact" }
            )
            .eq("status", "published")
            .order("starts_at", { ascending: true })
            .limit(6),

          supabase
            .from("registrations")
            .select("id,event_id,status,registered_at,attended_at")
            .eq("user_id", user.id)
            .order("registered_at", { ascending: false }),
        ]);

      if (profileResult.error) throw profileResult.error;
      if (eventResult.error) throw eventResult.error;
      if (registrationResult.error) throw registrationResult.error;

      const records = registrationResult.data || [];
      const eventRows = eventResult.data || [];

      setProfile(profileResult.data);
      setEvents(eventRows);
      setUpcomingCount(eventResult.count || 0);
      setRegistrations(records);

      setRegisteredEventIds(
        records
          .filter(
            (r) => r.status === "registered" || r.status === "attended"
          )
          .map((r) => r.event_id)
      );

      const ids = [...new Set(records.map((r) => r.event_id))];

      if (ids.length > 0) {
        const { data: names, error: namesError } = await supabase
          .from("events")
          .select("id,title")
          .in("id", ids);

        if (namesError) throw namesError;

        const nameMap: Record<string, string> = {};
        (names || []).forEach((event) => {
          nameMap[event.id] = event.title;
        });

        setEventNames(nameMap);
      } else {
        setEventNames({});
      }

      setLastUpdated(new Date().toLocaleTimeString("en-IN"));
    } catch (err) {
      console.error("Dashboard loading error:", err);
      setError(
        err instanceof Error ? err.message : "Unable to load your dashboard."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router, supabase]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  async function logout() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      setError("Unable to log out. Please try again.");
      return;
    }

    router.replace("/login");
    router.refresh();
  }

  const isOrganizer =
    profile?.role === "organizer" || profile?.role === "admin";

  const activeRegistrations = registrations.filter(
    (r) => r.status === "registered" || r.status === "attended"
  );

  const attended = registrations.filter(
    (r) => r.status === "attended"
  ).length;

  const cancelled = registrations.filter(
    (r) => r.status === "cancelled"
  ).length;

  const firstName = profile?.full_name?.trim().split(/\s+/)[0] || "there";

  if (loading) {
    return (
      <main className="dashboard-loading">
        <div className="dashboard-loader" />
        <p>Preparing your ClubVerse...</p>
      </main>
    );
  }

  return (
    <main className="dashboard-page">
      <header className="dashboard-header">
        <Link href="/" className="logo">
          <span className="logo-symbol">C<span>.</span></span>
          <span>clubverse</span>
        </Link>

        <nav className="cv-nav">
          <Link href="/events">Events</Link>
          <Link href="/my-qr">My QR Pass</Link>
          <Link href="/profile">Profile</Link>
          {isOrganizer && <Link href="/organizer">Organiser</Link>}
          <button onClick={logout} className="logout-button">
            Log out ↗
          </button>
        </nav>
      </header>

      <section className="dashboard-content">
        <div className="dashboard-welcome">
          <div>
            <div className="section-label">
              YOUR COMMUNITY · YOUR SPACE
            </div>

            <h1>
              Hey, {firstName}.
              <br />
              <em>Welcome back.</em>
            </h1>

            <p>
              Your next idea, connection or opportunity starts here.
            </p>
          </div>

          <div className="dashboard-profile-card">
            <div className="profile-avatar">
              {(profile?.full_name?.[0] || "S").toUpperCase()}
            </div>

            <strong>{profile?.full_name || "Student"}</strong>
            <span>{profile?.role?.toUpperCase() || "STUDENT"}</span>

            <small>
              {profile?.department || "Department not added"}
            </small>
            <small>
              {profile?.college || "College not added"}
            </small>

            <Link href="/profile">Edit profile ↗</Link>
          </div>
        </div>

        <div className="dashboard-refresh-row">
          <small>Last updated: {lastUpdated || "Not available"}</small>

          <button
            onClick={() => loadDashboard(true)}
            disabled={refreshing}
          >
            {refreshing ? "Refreshing..." : "↻ Refresh dashboard"}
          </button>
        </div>

        {error && (
          <div className="dashboard-error" role="alert">
            {error}
            <button onClick={() => loadDashboard(true)}>
              Try again
            </button>
          </div>
        )}

        <div className="dashboard-stats">
          <article>
            <span>PUBLISHED EVENTS</span>
            <strong>{upcomingCount}</strong>
            <small>Available in ClubVerse</small>
          </article>

          <article>
            <span>ACTIVE REGISTRATIONS</span>
            <strong>{activeRegistrations.length}</strong>
            <small>{cancelled} cancelled excluded</small>
          </article>

          <article>
            <span>EVENTS ATTENDED</span>
            <strong>{attended}</strong>
            <small>Successfully checked in</small>
          </article>
        </div>

        <section className="dashboard-section">
          <div className="dashboard-section-heading">
            <div>
              <div className="section-label">01 / DISCOVER</div>
              <h2>What's happening.</h2>
            </div>

            <Link href="/events">Explore all ↗</Link>
          </div>

          {events.length === 0 ? (
            <div className="dashboard-empty">
              <span>✳</span>
              <h3>New experiences are on the way.</h3>
              <p>Published community events will appear here.</p>
              <Link href="/events">Explore community ↗</Link>
            </div>
          ) : (
            <div className="dashboard-event-grid">
              {events.map((event) => {
                const alreadyRegistered =
                  registeredEventIds.includes(event.id);

                return (
                  <article className="dashboard-event" key={event.id}>
                    <span>{event.category || "COMMUNITY"}</span>

                    <h3>{event.title}</h3>

                    <p>
                      {event.description ||
                        "Discover this community experience."}
                    </p>

                    <small>
                      {new Date(event.starts_at).toLocaleString("en-IN", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </small>

                    <small>
                      {event.location || "Location to be announced"}
                    </small>

                    {alreadyRegistered && (
                      <span className="dashboard-already-registered">
                        ✓ ALREADY REGISTERED
                      </span>
                    )}

                    <Link href="/events">
                      {alreadyRegistered
                        ? "View events ↗"
                        : "Explore event ↗"}
                    </Link>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="dashboard-section">
          <div className="dashboard-section-heading">
            <div>
              <div className="section-label">02 / YOUR ACTIVITY</div>
              <h2>My registrations.</h2>
            </div>

            <Link href="/my-qr">My passes ↗</Link>
          </div>

          {registrations.length === 0 ? (
            <div className="dashboard-empty">
              <span>↗</span>
              <h3>Your journey starts with an event.</h3>
              <p>You haven't registered for an event yet.</p>
              <Link href="/events">Discover events ↗</Link>
            </div>
          ) : (
            <>
              <div className="registration-list">
                {registrations.map((registration) => (
                  <div
                    className="registration-item"
                    key={registration.id}
                  >
                    <div>
                      <span>EVENT REGISTRATION</span>
                      <strong>
                        {eventNames[registration.event_id] ||
                          "ClubVerse Event"}
                      </strong>

                      <small>
                        Registered on{" "}
                        {new Date(
                          registration.registered_at
                        ).toLocaleDateString("en-IN")}
                      </small>
                    </div>

                    <div className="dashboard-registration-status">
                      <span
                        className={`registration-status ${registration.status}`}
                      >
                        {registration.status.toUpperCase()}
                      </span>

                      {registration.attended_at && (
                        <small>
                          Checked in:{" "}
                          {new Date(
                            registration.attended_at
                          ).toLocaleString("en-IN")}
                        </small>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="dashboard-pass-link">
                <div>
                  <strong>Your event passes are ready.</strong>
                  <p>Open your QR passes for event entry.</p>
                </div>

                <Link href="/my-qr">Open my QR passes ↗</Link>
              </div>
            </>
          )}
        </section>

        <section className="cv-quick-links">
          <div className="section-label">03 / QUICK ACCESS</div>
          <h2>Your ClubVerse.</h2>

          <div className="cv-quick-grid">
            <Link href="/events">
              <span>01</span>
              <strong>Explore events ↗</strong>
              <small>Find your next opportunity</small>
            </Link>

            <Link href="/my-qr">
              <span>02</span>
              <strong>My QR passes ↗</strong>
              <small>Access your event tickets</small>
            </Link>

            <Link href="/profile">
              <span>03</span>
              <strong>My profile ↗</strong>
              <small>Manage your information</small>
            </Link>

            {isOrganizer && (
              <Link href="/organizer">
                <span>04</span>
                <strong>Organiser console ↗</strong>
                <small>Create and manage events</small>
              </Link>
            )}

            {isOrganizer && (
              <Link href="/organizer/attendance">
                <span>05</span>
                <strong>Attendance scanner ↗</strong>
                <small>Scan participant QR codes</small>
              </Link>
            )}

            {isOrganizer && (
              <Link href="/organizer/analytics">
                <span>06</span>
                <strong>Analytics ↗</strong>
                <small>Understand community participation</small>
              </Link>
            )}
          </div>
        </section>

        <section className="dashboard-account">
          <div>
            <span>YOUR NEXT STEP</span>
            <h3>Make your next move.</h3>
            <p>
              Discover events, meet people and build something meaningful.
            </p>
          </div>

          <Link href="/events">Explore ClubVerse ↗</Link>
        </section>
      </section>

      <footer className="footer">
        <Link href="/" className="logo">
          <span className="logo-symbol">C<span>.</span></span>
          <span>clubverse</span>
        </Link>

        <span>GDG ON CAMPUS · RIT HASSAN</span>
      </footer>
    </main>
  );
}


