
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { createClient } from "@/lib/supabase/client";

type Registration = {
  id: string;
  event_id: string;
  attendance_token: string;
  status: string;
  events?: { title: string; starts_at: string } | null;
};

export default function MyQRPage() {
  const supabase = createClient();
  const [items, setItems] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [emailLoading, setEmailLoading] = useState<string | null>(null);
  const [emailMessages, setEmailMessages] = useState<Record<string, string>>({});

  useEffect(() => {
    async function load() {
      const { data: auth } = await supabase.auth.getUser();

      if (!auth.user) {
        window.location.href = "/login";
        return;
      }

      const { data, error } = await supabase
        .from("registrations")
        .select("id,event_id,attendance_token,status")
        .eq("user_id", auth.user.id)
        .in("status", ["registered", "attended"]);

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      const registrations = data || [];
      const eventIds = registrations.map((r) => r.event_id);

      let eventMap: Record<string, { title: string; starts_at: string }> = {};

      if (eventIds.length) {
        const { data: eventData } = await supabase
          .from("events")
          .select("id,title,starts_at")
          .in("id", eventIds);

        for (const event of eventData || []) {
          eventMap[event.id] = {
            title: event.title,
            starts_at: event.starts_at,
          };
        }
      }

      setItems(
        registrations.map((r) => ({
          ...r,
          events: eventMap[r.event_id] || null,
        }))
      );

      setLoading(false);
    }

    load();
  }, []);

  async function resendEmail(registrationId: string) {
    setEmailLoading(registrationId);
    setEmailMessages((prev) => ({ ...prev, [registrationId]: "" }));

    try {
      const response = await fetch("/api/clubverse/registration-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registrationId }),
      });

      const result = await response.json();

      setEmailMessages((prev) => ({
        ...prev,
        [registrationId]: response.ok && result.success
          ? "Confirmation email sent successfully. Check your inbox and spam folder."
          : result.message || "Could not send email. Please try again.",
      }));
    } catch {
      setEmailMessages((prev) => ({
        ...prev,
        [registrationId]: "Unable to contact the email service. Please try again.",
      }));
    } finally {
      setEmailLoading(null);
    }
  }

  return (
    <main className="qr-page">
      <nav className="events-nav">
        <Link href="/" className="events-brand">ClubVerse<span>.</span></Link>
        <div>
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/events">Events</Link>
        </div>
      </nav>

      <section className="qr-hero">
        <p className="eyebrow">YOUR EVENT PASSES</p>
        <h1>Your place.<br /><span>Your moment.</span></h1>
        <p>Show your personal QR code to the organiser at the event entrance.</p>
      </section>

      <section className="qr-content">
        <h2>My registrations</h2>

        {loading && <p>Loading your passes...</p>}
        {error && <div className="events-message">{error}</div>}

        {!loading && !error && items.length === 0 && (
          <div className="events-empty">
            <h3>No active registrations</h3>
            <p>Register for an event to receive your QR pass.</p>
            <Link href="/events">Explore events ↗</Link>
          </div>
        )}

        <div className="qr-grid">
          {items.map((item) => (
            <article className="qr-card" key={item.id}>
              <div className="qr-card-heading">
                <span className="eyebrow">CLUBVERSE ENTRY PASS</span>
                <span className={item.status === "attended" ? "qr-done" : "qr-active"}>
                  {item.status === "attended" ? "ATTENDED" : "REGISTERED"}
                </span>
              </div>

              <h3>{item.events?.title || "ClubVerse Event"}</h3>

              {item.events?.starts_at && (
                <p>{new Date(item.events.starts_at).toLocaleString("en-IN")}</p>
              )}

              <div className="qr-code">
                <QRCodeSVG value={item.attendance_token} size={190} level="H" />
              </div>

              <p className="qr-instruction">
                Present this QR code to an authorised event organiser.
              </p>

              <button className="qr-print" onClick={() => window.print()}>
                Print / Save pass
              </button>

              {["registered", "attended"].includes(item.status) && (
                <>
                  <button
                    className="qr-print"
                    style={{ marginTop: "10px", background: "#e9e5df", color: "#20201f" }}
                    onClick={() => resendEmail(item.id)}
                    disabled={emailLoading === item.id}
                  >
                    {emailLoading === item.id
                      ? "Sending email..."
                      : "Resend confirmation email"}
                  </button>

                  {emailMessages[item.id] && (
                    <p className="qr-instruction" role="status">
                      {emailMessages[item.id]}
                    </p>
                  )}
                </>
              )}
            </article>
          ))}
        </div>
      </section>

      <footer className="events-footer">
        ClubVerse · GDG on Campus – RIT Hassan
      </footer>
    </main>
  );
}

