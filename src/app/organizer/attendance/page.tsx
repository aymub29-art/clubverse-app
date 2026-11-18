"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type ScanResult = "success" | "duplicate" | "error" | "";

export default function AttendancePage() {
  const supabase = createClient();
  const scannerRef = useRef<any>(null);
  const processingRef = useRef(false);
  const mountedRef = useRef(true);

  const [allowed, setAllowed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState(
    "Start the camera or enter a QR token manually."
  );
  const [result, setResult] = useState<ScanResult>("");
  const [manualToken, setManualToken] = useState("");

  const stopScanner = useCallback(async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;

    if (scanner) {
      try {
        if (scanner.isScanning) {
          await scanner.stop();
        }
        await scanner.clear();
      } catch (error) {
        console.warn("Scanner cleanup:", error);
      }
    }

    if (mountedRef.current) setScanning(false);
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    async function checkAccess() {
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          window.location.href = "/login";
          return;
        }

        const { data: profile, error } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();

        if (error) throw error;

        if (mountedRef.current) {
          setAllowed(
            profile?.role === "organizer" || profile?.role === "admin"
          );
        }
      } catch (error) {
        console.error("Access check:", error);
        if (mountedRef.current) {
          setAllowed(false);
          setMessage("Unable to verify organiser access.");
        }
      } finally {
        if (mountedRef.current) setChecking(false);
      }
    }

    checkAccess();

    return () => {
      mountedRef.current = false;
      const scanner = scannerRef.current;
      scannerRef.current = null;

      if (scanner) {
        scanner.stop().catch(() => {}).finally(() => {
          scanner.clear().catch(() => {});
        });
      }
    };
  }, [supabase]);

  async function markAttendance(rawToken: string) {
    const token = rawToken.trim();

    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        token
      )
    ) {
      setMessage("Invalid QR token. Enter a valid ClubVerse pass.");
      setResult("error");
      return;
    }

    if (processingRef.current) return;

    processingRef.current = true;
    setProcessing(true);
    setResult("");
    setMessage("Verifying registration and recording attendance...");

    await stopScanner();

    try {
      const { data, error } = await supabase.rpc(
        "mark_event_attendance",
        { p_token: token }
      );

      if (error) throw error;

      if (data === "ATTENDANCE_MARKED") {
        setMessage("Attendance successfully recorded!");
        setResult("success");
        setManualToken("");
      } else if (data === "ALREADY_MARKED") {
        setMessage("This student has already been marked present.");
        setResult("duplicate");
      } else {
        setMessage(
          typeof data === "string"
            ? `Attendance not recorded: ${data}`
            : "Unexpected response from attendance service."
        );
        setResult("error");
      }
    } catch (error: any) {
      console.error("Attendance error:", error);
      setMessage(
        error?.message || "Unable to record attendance. Please try again."
      );
      setResult("error");
    } finally {
      processingRef.current = false;
      if (mountedRef.current) setProcessing(false);
    }
  }

  async function startScanner() {
    if (scanning || processing) return;

    if (!navigator.mediaDevices?.getUserMedia) {
      setMessage(
        "Camera access requires HTTPS or localhost. Use manual token entry."
      );
      setResult("error");
      return;
    }

    setMessage("Requesting camera access...");
    setResult("");

    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode("clubverse-qr-reader");
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 230, height: 230 } },
        (decodedText) => {
          if (!processingRef.current) {
            void markAttendance(decodedText);
          }
        },
        () => {}
      );

      setScanning(true);
      setMessage("Camera active. Point it at a student's QR pass.");
    } catch (error: any) {
      scannerRef.current = null;
      setScanning(false);
      setMessage(
        error?.message ||
          "Camera unavailable. Check browser permissions or use manual entry."
      );
      setResult("error");
    }
  }

  if (checking) {
    return <main className="qr-page">Checking organiser access...</main>;
  }

  if (!allowed) {
    return (
      <main className="qr-page">
        <div className="organizer-denied">
          <h1>Organiser access required.</h1>
          <p>{message}</p>
          <Link href="/dashboard">Return to dashboard</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="qr-page">
      <nav className="events-nav">
        <Link href="/" className="events-brand">
          ClubVerse<span>.</span>
        </Link>
        <div>
          <Link href="/organizer">Organiser</Link>
          <Link href="/organizer/analytics">Analytics</Link>
          <Link href="/events">Events</Link>
        </div>
      </nav>

      <section className="qr-hero">
        <p className="eyebrow">CLUBVERSE CHECK-IN</p>
        <h1>
          Every arrival
          <br />
          <span>counts.</span>
        </h1>
        <p>
          Scan a registered student's QR pass to securely record event
          attendance.
        </p>
      </section>

      <section className="qr-content">
        <div className="scanner-card">
          <h2>Attendance scanner</h2>

          <div id="clubverse-qr-reader" className="qr-reader" />

          <p
            className={`scanner-message ${result}`}
            role="status"
            aria-live="polite"
          >
            {message}
          </p>

          {!scanning ? (
            <button
              className="qr-print"
              onClick={startScanner}
              disabled={processing}
            >
              {processing ? "Please wait..." : "Start camera scanner"}
            </button>
          ) : (
            <button
              className="qr-print"
              onClick={async () => {
                await stopScanner();
                setMessage("Scanner stopped. You can restart anytime.");
              }}
            >
              Stop scanner
            </button>
          )}

          <div className="manual-scan">
            <h3>Manual QR token entry</h3>
            <p>Use this option if the camera is unavailable.</p>

            <input
              value={manualToken}
              onChange={(event) => setManualToken(event.target.value)}
              placeholder="Paste QR token UUID"
              disabled={processing}
            />

            <button
              onClick={() => markAttendance(manualToken)}
              disabled={processing || !manualToken.trim()}
            >
              {processing ? "Verifying..." : "Verify attendance"}
            </button>
          </div>

          <div className="scanner-help">
            <strong>Check-in security</strong>
            <p>
              Only valid registered ClubVerse QR tokens can mark attendance.
              Duplicate check-ins are rejected by the database.
            </p>
          </div>
        </div>
      </section>

      <footer className="events-footer">
        ClubVerse · GDG on Campus – RIT Hassan
      </footer>
    </main>
  );
}
