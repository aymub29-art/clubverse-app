
"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type ClubEvent = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  location: string | null;
  starts_at: string;
  ends_at?: string | null;
  capacity: number | null;
  status: string;
};

type StudentProfile = {
  id: string;
  full_name: string | null;
  college: string | null;
  department: string | null;
};

type Registration = {
  id: string;
  event_id: string;
  user_id: string;
  status: string;
  registered_at: string;
  attended_at: string | null;
  student?: StudentProfile;
};

type EventForm = {
  title: string;
  description: string;
  category: string;
  location: string;
  startsAt: string;
  capacity: string;
};

const emptyForm: EventForm = {
  title: "",
  description: "",
  category: "Workshop",
  location: "",
  startsAt: "",
  capacity: "",
};

function toLocalDateTime(value: string) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000)
    .toISOString()
    .slice(0, 16);
}

export default function OrganizerPage() {
  const supabase = createClient();
  const router = useRouter();

  const [allowed, setAllowed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [events, setEvents] = useState<ClubEvent[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");

  const [form, setForm] = useState<EventForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [selectedEvent, setSelectedEvent] = useState<ClubEvent | null>(null);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [registrationLoading, setRegistrationLoading] = useState(false);
  const [registrationError, setRegistrationError] = useState("");

  const notify = (text: string, type: "success" | "error" = "success") => {
    setMessage(text);
    setMessageType(type);
  };

  const loadEvents = useCallback(async () => {
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      notify(error.message, "error");
      return;
    }

    setEvents(data || []);
  }, [supabase]);

  useEffect(() => {
    let mounted = true;

    async function initialize() {
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

        if (
          profile?.role !== "admin" &&
          profile?.role !== "organizer"
        ) {
          if (mounted) setChecking(false);
          return;
        }

        if (mounted) {
          setAllowed(true);
          await loadEvents();
        }
      } catch (error) {
        console.error("Organiser initialization:", error);
        if (mounted) {
          notify(
            error instanceof Error ? error.message : "Unable to load dashboard.",
            "error"
          );
        }
      } finally {
        if (mounted) setChecking(false);
      }
    }

    initialize();

    return () => {
      mounted = false;
    };
  }, [router, supabase, loadEvents]);

  // Live attendance updates from mobile QR scanner
  useEffect(() => {
    if (!selectedEvent?.id) return;

    const channel = supabase
      .channel(`clubverse-attendance-${selectedEvent.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "registrations",
          filter: `event_id=eq.${selectedEvent.id}`,
        },
        async () => {
          await viewRegistrations(selectedEvent);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedEvent, supabase]);
  function updateForm<K extends keyof EventForm>(
    key: K,
    value: EventForm[K]
  ) {
    setForm((previous) => ({ ...previous, [key]: value }));
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
  }

  function editEvent(event: ClubEvent) {
    setEditingId(event.id);

    setForm({
      title: event.title,
      description: event.description || "",
      category: event.category || "Workshop",
      location: event.location || "",
      startsAt: toLocalDateTime(event.starts_at),
      capacity: event.capacity?.toString() || "",
    });

    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveEvent(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (busy) return;

    if (new Date(form.startsAt).getTime() <= Date.now()) {
      notify("Please choose a future event date and time.", "error");
      return;
    }

    const capacityValue = form.capacity.trim()
      ? Number(form.capacity)
      : null;

    if (
      capacityValue !== null &&
      (!Number.isInteger(capacityValue) || capacityValue < 1)
    ) {
      notify("Capacity must be a positive whole number.", "error");
      return;
    }

    setBusy(true);
    setMessage("");

    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category,
        location: form.location.trim(),
        starts_at: new Date(form.startsAt).toISOString(),
        capacity: capacityValue,
      };

      if (editingId) {
        const { error } = await supabase
          .from("events")
          .update(payload)
          .eq("id", editingId);

        if (error) throw error;

        notify("Event updated successfully.");
      } else {
        const { data: auth } = await supabase.auth.getUser();

        if (!auth.user) {
          router.replace("/login");
          return;
        }

        const { error } = await supabase.from("events").insert({
          ...payload,
          status: "draft",
          created_by: auth.user.id,
        });

        if (error) throw error;

        notify("Event saved as draft successfully.");
      }

      resetForm();
      await loadEvents();
    } catch (error) {
      console.error("Save event:", error);
      notify(
        error instanceof Error ? error.message : "Unable to save event.",
        "error"
      );
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(id: string, status: string) {
    if (busy) return;

    const confirmation =
      status === "cancelled"
        ? "Are you sure you want to cancel this event?"
        : "Publish this event now?";

    if (!window.confirm(confirmation)) return;

    setBusy(true);
    setMessage("");

    try {
      const { error } = await supabase
        .from("events")
        .update({ status })
        .eq("id", id);

      if (error) throw error;

      notify(`Event ${status} successfully.`);
      await loadEvents();
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Unable to update event.",
        "error"
      );
    } finally {
      setBusy(false);
    }
  }

  async function deleteEvent(event: ClubEvent) {
    if (busy) return;

    const { count, error: countError } = await supabase
      .from("registrations")
      .select("id", { count: "exact", head: true })
      .eq("event_id", event.id);

    if (countError) {
      notify(countError.message, "error");
      return;
    }

    if ((count || 0) > 0) {
      notify(
        `This event has ${count} registration record(s). Cancel it instead of deleting it.`,
        "error"
      );
      return;
    }

    if (!window.confirm(`Permanently delete "${event.title}"?`)) return;

    setBusy(true);

    try {
      const { error } = await supabase
        .from("events")
        .delete()
        .eq("id", event.id);

      if (error) throw error;

      notify("Event deleted successfully.");
      await loadEvents();
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Unable to delete event.",
        "error"
      );
    } finally {
      setBusy(false);
    }
  }

  async function viewRegistrations(event: ClubEvent) {
    setSelectedEvent(event);
    setRegistrations([]);
    setRegistrationError("");
    setRegistrationLoading(true);

    try {
      const { data, error } = await supabase
        .from("registrations")
        .select("id,event_id,user_id,status,registered_at,attended_at")
        .eq("event_id", event.id)
        .order("registered_at", { ascending: false });

      if (error) throw error;

      const rows = data || [];
      const userIds = [...new Set(rows.map((r) => r.user_id))];

      let profiles: StudentProfile[] = [];

      if (userIds.length > 0) {
        const { data: profileData, error: profilesError } =
          await supabase
            .from("profiles")
            .select("id,full_name,college,department")
            .in("id", userIds);

        if (profilesError) throw profilesError;
        profiles = profileData || [];
      }

      const profileMap = new Map(
        profiles.map((profile) => [profile.id, profile])
      );

      setRegistrations(
        rows.map((registration) => ({
          ...registration,
          student: profileMap.get(registration.user_id),
        }))
      );
    } catch (error) {
      console.error("Registration loading:", error);
      setRegistrationError(
        error instanceof Error
          ? error.message
          : "Unable to load registrations."
      );
    } finally {
      setRegistrationLoading(false);
    }
  }

  const filteredEvents = events.filter((event) => {
    const matchesSearch =
      event.title.toLowerCase().includes(search.toLowerCase()) ||
      (event.category || "").toLowerCase().includes(search.toLowerCase()) ||
      (event.location || "").toLowerCase().includes(search.toLowerCase());

    const matchesStatus =
      statusFilter === "all" || event.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const registeredCount = registrations.filter(
    (r) => r.status === "registered"
  ).length;

  const attendedCount = registrations.filter(
    (r) => r.status === "attended"
  ).length;

  const cancelledCount = registrations.filter(
    (r) => r.status === "cancelled"
  ).length;

  if (checking) {
    return (
      <main className="organizer-page">
        <div className="organizer-loading">Checking organiser access...</div>
      </main>
    );
  }

  if (!allowed) {
    return (
      <main className="organizer-page">
        <div className="organizer-denied">
          <h1>Organiser access required.</h1>
          <p>Your account does not currently have organiser permissions.</p>
          <Link href="/dashboard">Return to dashboard</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="organizer-page">
      <nav className="organizer-nav">
        <Link href="/" className="events-brand">
          ClubVerse<span>.</span>
        </Link>

        <div>
          <Link href="/events">View events</Link>
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/organizer/attendance">Scanner</Link>
          <Link href="/organizer/analytics">Analytics ↗</Link>
        </div>
      </nav>

      <section className="organizer-hero">
        <p className="eyebrow">CLUBVERSE CONTROL CENTRE</p>
        <h1>
          Make things
          <br />
          <span>happen.</span>
        </h1>
        <p>
          Create experiences. Bring students together. Build the community.
        </p>
      </section>

      <section className="organizer-content">
        <div className="organizer-section-heading">
          <div>
            <p className="eyebrow">EVENT MANAGEMENT</p>
            <h2>{editingId ? "Edit event" : "Create an event"}</h2>
          </div>
        </div>

        {message && (
          <div
            className={`events-message ${
              messageType === "error" ? "organizer-message-error" : ""
            }`}
            role="status"
          >
            {message}
          </div>
        )}

        <form className="organizer-form" onSubmit={saveEvent}>
          <label>
            Event title
            <input
              required
              maxLength={120}
              value={form.title}
              onChange={(e) => updateForm("title", e.target.value)}
              placeholder="e.g. AI Innovation Workshop"
            />
          </label>

          <label>
            Description
            <textarea
              value={form.description}
              onChange={(e) => updateForm("description", e.target.value)}
              placeholder="What will students experience?"
              rows={4}
            />
          </label>

          <div className="organizer-form-grid">
            <label>
              Category
              <select
                value={form.category}
                onChange={(e) => updateForm("category", e.target.value)}
              >
                <option>Workshop</option>
                <option>Competition</option>
                <option>Hackathon</option>
                <option>Seminar</option>
                <option>Community</option>
                <option>Other</option>
              </select>
            </label>

            <label>
              Venue
              <input
                required
                value={form.location}
                onChange={(e) => updateForm("location", e.target.value)}
                placeholder="Event venue"
              />
            </label>

            <label>
              Date and time
              <input
                required
                type="datetime-local"
                value={form.startsAt}
                onChange={(e) => updateForm("startsAt", e.target.value)}
              />
            </label>

            <label>
              Maximum registrations
              <input
                type="number"
                min="1"
                step="1"
                value={form.capacity}
                onChange={(e) => updateForm("capacity", e.target.value)}
                placeholder="Leave empty for unlimited"
              />
            </label>
          </div>

          <div className="organizer-form-actions">
            <button className="organizer-submit" disabled={busy}>
              {busy
                ? "Saving..."
                : editingId
                  ? "Update event ↗"
                  : "Save as draft ↗"}
            </button>

            {editingId && (
              <button
                type="button"
                className="organizer-cancel-edit"
                onClick={resetForm}
                disabled={busy}
              >
                Discard changes
              </button>
            )}
          </div>
        </form>

        <div className="organizer-section-heading organizer-list-heading">
          <div>
            <p className="eyebrow">YOUR COMMUNITY</p>
            <h2>Manage events</h2>
          </div>
          <span>{events.length} total events</span>
        </div>

        <div className="organizer-toolbar">
          <input
            type="search"
            placeholder="Search events by name, category or venue..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All statuses</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="cancelled">Cancelled</option>
            <option value="completed">Completed</option>
          </select>
        </div>

        {filteredEvents.length === 0 ? (
          <div className="events-empty">
            <h3>{events.length ? "No matching events." : "No events created yet."}</h3>
            <p>
              {events.length
                ? "Try another search or status filter."
                : "Create your first event using the form above."}
            </p>
          </div>
        ) : (
          <div className="organizer-event-list">
            {filteredEvents.map((event) => (
              <article className="organizer-event" key={event.id}>
                <div className="organizer-event-details">
                  <span
                    className={`organizer-status status-${event.status}`}
                  >
                    {event.status}
                  </span>

                  <h3>{event.title}</h3>

                  <p>
                    {event.category || "Community"} ·{" "}
                    {event.location || "Venue not set"}
                  </p>

                  <p>
                    {new Date(event.starts_at).toLocaleString("en-IN", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>

                  <p className="organizer-capacity">
                    Capacity: {event.capacity ?? "Unlimited"}
                  </p>
                </div>

                <div className="organizer-actions">
                  <button
                    className="view-registrations-action"
                    disabled={busy}
                    onClick={() => viewRegistrations(event)}
                  >
                    View registrations
                  </button>

                  <button
                    className="edit-action"
                    disabled={busy}
                    onClick={() => editEvent(event)}
                  >
                    Edit
                  </button>

                  {event.status === "draft" && (
                    <button
                      disabled={busy}
                      onClick={() => changeStatus(event.id, "published")}
                    >
                      Publish
                    </button>
                  )}

                  {event.status === "published" && (
                    <button
                      disabled={busy}
                      onClick={() => changeStatus(event.id, "cancelled")}
                    >
                      Cancel event
                    </button>
                  )}

                  {(event.status === "cancelled" ||
                    event.status === "draft") && (
                    <button
                      className="delete-action"
                      disabled={busy}
                      onClick={() => deleteEvent(event)}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {selectedEvent && (
        <div
          className="organizer-modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setSelectedEvent(null);
          }}
        >
          <section
            className="organizer-registration-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="registration-title"
          >
            <div className="organizer-modal-heading">
              <div>
                <p className="eyebrow">EVENT REGISTRATIONS</p>
                <h2 id="registration-title">{selectedEvent.title}</h2>
              </div>

              <button
                className="organizer-modal-close"
                onClick={() => setSelectedEvent(null)}
                aria-label="Close registrations"
              >
                ×
              </button>
            </div>

            {registrationLoading ? (
              <p className="organizer-modal-loading">
                Loading student registrations...
              </p>
            ) : registrationError ? (
              <div className="organizer-modal-error">
                {registrationError}
              </div>
            ) : (
              <>
                <div className="registration-summary">
                  <article>
                    <strong>{registrations.length}</strong>
                    <span>Total records</span>
                  </article>
                  <article>
                    <strong>{registeredCount}</strong>
                    <span>Registered</span>
                  </article>
                  <article>
                    <strong>{attendedCount}</strong>
                    <span>Attended</span>
                  </article>
                  <article>
                    <strong>{cancelledCount}</strong>
                    <span>Cancelled</span>
                  </article>
                </div>

                {registrations.length === 0 ? (
                  <div className="events-empty">
                    <h3>No registrations yet.</h3>
                    <p>Student registrations will appear here.</p>
                  </div>
                ) : (
                  <div className="registration-table-wrap">
                    <table className="registration-table">
                      <thead>
                        <tr>
                          <th>Student</th>
                          <th>Department</th>
                          <th>College</th>
                          <th>Registered</th>
                          <th>Status</th>
                        </tr>
                      </thead>

                      <tbody>
                        {registrations.map((registration) => (
                          <tr key={registration.id}>
                            <td>
                              <strong>
                                {registration.student?.full_name ||
                                  "Student profile unavailable"}
                              </strong>
                            </td>
                            <td>
                              {registration.student?.department || "—"}
                            </td>
                            <td>
                              {registration.student?.college || "—"}
                            </td>
                            <td>
                              {new Date(
                                registration.registered_at
                              ).toLocaleDateString("en-IN")}
                            </td>
                            <td>
                              <span
                                className={`registration-status registration-${registration.status}`}
                              >
                                {registration.status}
                              </span>
                              {registration.attended_at && (
                                <small className="registration-attended-time">
                                  {new Date(
                                    registration.attended_at
                                  ).toLocaleString("en-IN")}
                                </small>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            <div className="organizer-modal-footer">
              <button onClick={() => setSelectedEvent(null)}>
                Close
              </button>
            </div>
          </section>
        </div>
      )}

      <footer className="events-footer">
        ClubVerse · GDG on Campus – RIT Hassan
      </footer>
    </main>
  );
}

