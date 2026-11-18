
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // 1. Verify logged-in user
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

    // 2. Validate registration ID
    const body = await request.json();
    const registrationId = body?.registrationId;

    if (
      typeof registrationId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        registrationId
      )
    ) {
      return NextResponse.json(
        { success: false, message: "Invalid registration ID." },
        { status: 400 }
      );
    }

    // 3. Verify registration belongs to this user
    const { data: registration, error: registrationError } =
      await supabase
        .from("registrations")
        .select("id, status, event_id")
        .eq("id", registrationId)
        .eq("user_id", user.id)
        .maybeSingle();

    if (registrationError) {
      console.error("Registration lookup failed:", registrationError.message);

      return NextResponse.json(
        { success: false, message: "Could not verify registration." },
        { status: 500 }
      );
    }

    if (!registration || !["registered", "attended"].includes(registration.status)) {
      return NextResponse.json(
        { success: false, message: "Valid registration not found." },
        { status: 404 }
      );
    }

    // 4. Fetch event details
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("title, starts_at, location")
      .eq("id", registration.event_id)
      .maybeSingle();

    if (eventError || !event) {
      console.error("Event lookup failed:", eventError?.message);

      return NextResponse.json(
        { success: false, message: "Event not found." },
        { status: 404 }
      );
    }

    // 5. Fetch profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("Profile lookup failed:", profileError.message);

      return NextResponse.json(
        { success: false, message: "Could not load your profile." },
        { status: 500 }
      );
    }

    // 6. Verify environment configuration
    const webhookUrl = process.env.CLUBVERSE_N8N_WEBHOOK_URL;
    const webhookSecret = process.env.CLUBVERSE_N8N_WEBHOOK_SECRET;

    if (!webhookUrl || !webhookSecret || !user.email) {
      console.error("Email configuration missing:", {
        webhookUrlConfigured: Boolean(webhookUrl),
        webhookSecretConfigured: Boolean(webhookSecret),
        userEmailAvailable: Boolean(user.email),
      });

      return NextResponse.json(
        { success: false, message: "Email service is not configured." },
        { status: 500 }
      );
    }

    // 7. Send verified registration details to n8n
    let emailResponse: Response;

    try {
      emailResponse = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-clubverse-secret": webhookSecret,
        },
        body: JSON.stringify({
          email: user.email,
          fullName: profile?.full_name || user.email,
          eventTitle: event.title,
          eventDate: new Date(event.starts_at).toLocaleString("en-IN", {
            dateStyle: "medium",
            timeStyle: "short",
            timeZone: "Asia/Kolkata",
          }),
          eventLocation: event.location || "To be announced",
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(20000),
      });
    } catch (fetchError) {
      console.error(
        "n8n connection failed:",
        fetchError instanceof Error ? fetchError.message : "Unknown error"
      );

      return NextResponse.json(
        {
          success: false,
          message: "Could not connect to the email service. Check server terminal.",
        },
        { status: 502 }
      );
    }

    // 8. Capture n8n error safely
    const responseText = await emailResponse.text();

    if (!emailResponse.ok) {
      console.error("ClubVerse n8n HTTP error:", {
        status: emailResponse.status,
        response: responseText.slice(0, 1000),
      });

      return NextResponse.json(
        {
          success: false,
          message: `Email service error (HTTP ${emailResponse.status}). Check server terminal.`,
        },
        { status: 502 }
      );
    }

    // 9. Validate n8n confirmation
    let result: { success?: boolean };

    try {
      result = JSON.parse(responseText);
    } catch {
      console.error("n8n returned a non-JSON response:", responseText.slice(0, 1000));

      return NextResponse.json(
        {
          success: false,
          message: "Email service returned an invalid response.",
        },
        { status: 502 }
      );
    }

    if (result?.success !== true) {
      console.error("n8n did not confirm email delivery.");

      return NextResponse.json(
        {
          success: false,
          message: "Email service did not confirm delivery.",
        },
        { status: 502 }
      );
    }

    // 10. Success
    return NextResponse.json({
      success: true,
      message: "Confirmation email sent. Check your inbox and spam folder.",
    });
  } catch (error) {
    console.error(
      "ClubVerse registration email API error:",
      error instanceof Error ? error.message : "Unknown error"
    );

    return NextResponse.json(
      { success: false, message: "Something went wrong." },
      { status: 500 }
    );
  }
}


