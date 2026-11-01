import { NextRequest, NextResponse } from "next/server";

// Maximum allowable JSON body size (64 KB)
const MAX_BODY_BYTES = 64 * 1024;

// Sliding window rate limiter: max 5 requests per 10 minutes per IP
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 5;
const ipSubmissions = new Map<string, number[]>();

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return req.headers.get("x-real-ip") || "127.0.0.1";
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const timestamps = ipSubmissions.get(ip) || [];
  const validTimestamps = timestamps.filter((ts) => now - ts < RATE_LIMIT_WINDOW_MS);

  // Periodic cleanup if map grows large
  if (ipSubmissions.size > 1000) {
    for (const [k, v] of ipSubmissions.entries()) {
      if (v.every((ts) => now - ts >= RATE_LIMIT_WINDOW_MS)) {
        ipSubmissions.delete(k);
      }
    }
  }

  if (validTimestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }

  validTimestamps.push(now);
  ipSubmissions.set(ip, validTimestamps);
  return true;
}

const ALLOWED_CATEGORIES = new Set([
  "Feedback / Suggestion",
  "Bug Report",
  "Data Question",
  "Partnership / Collaboration",
  "Privacy Request",
  "Other",
]);

function isValidEmail(email: string): boolean {
  // Format validation only — does not prove mailbox existence or ownership
  if (email.length > 254) return false;
  return /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/.test(
    email
  );
}

export async function POST(req: NextRequest) {
  // Enforce body size limit via Content-Length header if available
  const contentLength = req.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > MAX_BODY_BYTES) {
    return NextResponse.json(
      { error: "Payload too large. Maximum size is 64KB." },
      { status: 413 }
    );
  }

  // Rate limiting by client IP
  const clientIp = getClientIp(req);
  if (!checkRateLimit(clientIp)) {
    return NextResponse.json(
      { error: "Too many contact submissions. Please wait a few minutes before trying again." },
      {
        status: 429,
        headers: { "Retry-After": "600" },
      }
    );
  }

  try {
    const rawBody = await req.text();
    if (rawBody.length > MAX_BODY_BYTES) {
      return NextResponse.json(
        { error: "Payload too large. Maximum size is 64KB." },
        { status: 413 }
      );
    }

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Malformed JSON payload." }, { status: 400 });
    }

    const name = String(body?.name || "").trim();
    const email = String(body?.email || "").trim();
    const organization = String(body?.organization || "").trim();
    const category = String(body?.category || "").trim();
    const message = String(body?.message || "").trim();

    // Required fields check
    if (!name || !email || !category || !message) {
      return NextResponse.json(
        { error: "Missing required fields: name, email, category, and message are required." },
        { status: 400 }
      );
    }

    // Input length and validation limits
    if (name.length > 100) {
      return NextResponse.json(
        { error: "Name exceeds maximum length of 100 characters." },
        { status: 400 }
      );
    }

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: "Invalid email format." },
        { status: 400 }
      );
    }

    if (organization.length > 100) {
      return NextResponse.json(
        { error: "Organization exceeds maximum length of 100 characters." },
        { status: 400 }
      );
    }

    if (!ALLOWED_CATEGORIES.has(category)) {
      return NextResponse.json(
        { error: "Invalid category selected." },
        { status: 400 }
      );
    }

    if (message.length < 5) {
      return NextResponse.json(
        { error: "Message is too short. Please provide at least 5 characters." },
        { status: 400 }
      );
    }

    if (message.length > 5000) {
      return NextResponse.json(
        { error: "Message exceeds maximum length of 5000 characters." },
        { status: 400 }
      );
    }

    // Check delivery providers in order
    const webhookUrl = process.env.CONTACT_WEBHOOK_URL;
    const resendKey = process.env.RESEND_API_KEY;
    const toEmail = process.env.CONTACT_TO_EMAIL;
    const formspreeEndpoint =
      process.env.CONTACT_FORMSPREE_ENDPOINT || process.env.FORMSPREE_ENDPOINT;

    // 1. Webhook delivery
    if (webhookUrl) {
      try {
        const resp = await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            email,
            organization,
            category,
            message,
            source: "openplanet-contact",
            timestamp: new Date().toISOString(),
          }),
        });
        if (resp.ok) {
          return NextResponse.json({ ok: true, message: "Message sent successfully." }, { status: 200 });
        }
      } catch {
        // Fall through to next provider
      }
    }

    // 2. Resend API delivery
    if (resendKey && toEmail) {
      try {
        const resp = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: process.env.CONTACT_FROM_EMAIL || "OpenPlanet <noreply@openplanetrisk.com>",
            to: [toEmail],
            reply_to: email,
            subject: `[OpenPlanet Contact: ${category}]`,
            text: `Name: ${name}\nEmail: ${email}\nOrganization: ${organization || "N/A"}\nCategory: ${category}\n\nMessage:\n${message}`,
          }),
        });
        if (resp.ok) {
          return NextResponse.json({ ok: true, message: "Message sent successfully." }, { status: 200 });
        }
      } catch {
        // Fall through to next provider
      }
    }

    // 3. Formspree delivery
    if (formspreeEndpoint) {
      try {
        const form = new FormData();
        form.append("name", name);
        form.append("email", email);
        form.append("organization", organization);
        form.append("category", category);
        form.append("message", message);
        const resp = await fetch(formspreeEndpoint, {
          method: "POST",
          body: form,
          headers: { Accept: "application/json" },
        });
        if (resp.ok) {
          return NextResponse.json({ ok: true, message: "Message sent successfully." }, { status: 200 });
        }
      } catch {
        // Fall through
      }
    }

    // No delivery provider configured
    return NextResponse.json(
      {
        error: "Contact delivery is not configured on this deployment. Please reach out to the deployment owner.",
      },
      { status: 503 }
    );
  } catch {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
  }
}
