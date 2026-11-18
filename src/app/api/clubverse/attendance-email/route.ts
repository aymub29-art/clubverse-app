import { NextResponse } from "next/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  try {
    // Verify the caller is a signed-in organiser/admin.
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, message: "You must be logged in." },
        { status: 401 }
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || !["organizer", "admin"].includes(profile?.role)) {
      return NextResponse.json(
        { success: false, message: "Organiser access required." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const attendanceToken = body?.attendanceToken;

    if (
      typeof attendanceToken !== "string" ||
      !UUID_PATTERN.test(attendanceToken)
    ) {
      return NextResponse.json(
        { success: false, message: "Invalid attendance token." },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const webhookUrl = process.env.CLUBVERSE_N8N_ATTENDANCE_WEBHOOK_URL;
    const webhookSecret = process.env.CLUBVERSE_N8N_WEBHOOK_SECRET;

    if (!supabaseUrl || !serviceRoleKey || !webhookUrl || !webhookSecret) {
      console.error("Attendance email configuration is incomplete.", {
        supabaseUrlConfigured: Boolean(supabaseUrl),
        serviceRoleKeyConfigured: Boolean(serviceRoleKey),
        webhookUrlConfigured: Boolean(webhookUrl),
        webhookSecretConfigured: Boolean(webhookSecret),
      });

      return NextResponse.json(
        { success: false, message: "Attendance email service is not configured." },
        { status: 500 }
      );
    }

    // Service-role access stays on the server and is never exposed to the browser.
    const admin = createSupabaseAdmin(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: registration, error: registrationError } = await admin
      .from("registrations")
      .select("id, user_id, event_id, status")
      .eq("attendance_token", attendanceToken)
      .eq("status", "attended")
      .maybeSingle();

    if (registrationError) {
      console.error("Attendance registration lookup failed:", registrationError.message);
      return NextResponse.json(
        { success: false, message: "Could not verify recorded attendance." },
        { status: 500 }
      );
    }

    if (!registration) {
      return NextResponse.json(
        { success: false, message: "Recorded attendance not found." },
        { status: 404 }
      );
    }

    const [{ data: event, error: eventError }, { data: studentProfile, error: studentProfileError }, { data: authUser, error: studentError }] =
      await Promise.all([
        admin
          .from("events")
          .select("title, starts_at, location")
          .eq("id", registration.event_id)
          .maybeSingle(),
        admin
          .from("profiles")
          .select("full_name")
          .eq("id", registration.user_id)
          .maybeSingle(),
        admin.auth.admin.getUserById(registration.user_id),
      ]);

    if (eventError || !event) {
      console.error("Attendance event lookup failed:", eventError?.message);
      return NextResponse.json(
        { success: false, message: "Event details not found." },
        { status: 404 }
      );
    }

    if (studentProfileError || studentError || !authUser.user?.email) {
      console.error("Attendance student lookup failed:", {
        profileError: studentProfileError?.message,
        authError: studentError?.message,
      });
      return NextResponse.json(
        { success: false, message: "Student email address could not be verified." },
        { status: 500 }
      );
    }

    const emailResponse = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-clubverse-secret": webhookSecret,
      },
      body: JSON.stringify({
        email: authUser.user.email,
        fullName: studentProfile?.full_name || authUser.user.email,
        eventTitle: event.title,
        eventDate: new Date(event.starts_at).toLocaleString("en-IN", {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone: "Asia/Kolkata",
        }),
        eventLocation: event.location || "To be announced",
        attendanceStatus: "Successfully marked present",
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });

    const responseText = await emailResponse.text();
    if (!emailResponse.ok) {
      console.error("Attendance email webhook failed:", {
        status: emailResponse.status,
        response: responseText.slice(0, 500),
      });
      return NextResponse.json(
        { success: false, message: "Attendance was recorded, but the email could not be sent." },
        { status: 502 }
      );
    }

    let result: { success?: boolean };
    try {
      result = JSON.parse(responseText);
    } catch {
      return NextResponse.json(
        { success: false, message: "Attendance was recorded, but the email service returned an invalid response." },
        { status: 502 }
      );
    }

    if (result?.success !== true) {
      return NextResponse.json(
        { success: false, message: "Attendance was recorded, but email delivery was not confirmed." },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Attendance confirmation email sent.",
    });
  } catch (error) {
    console.error(
      "ClubVerse attendance email API error:",
      error instanceof Error ? error.message : "Unknown error"
    );
    return NextResponse.json(
      { success: false, message: "Attendance was recorded, but the email could not be sent." },
      { status: 500 }
    );
  }
}
