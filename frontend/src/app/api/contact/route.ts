import { NextRequest, NextResponse } from "next/server";

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const name = String(body?.name || "").trim();
    const email = String(body?.email || "").trim();
    const organization = String(body?.organization || "").trim();
    const category = String(body?.category || "").trim();
    const message = String(body?.message || "").trim();

    if (!name || !email || !category || !message) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    if (!isValidEmail(email)) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }
    if (message.length > 5000) {
      return NextResponse.json({ error: "Message too long" }, { status: 400 });
    }

    const formspreeEndpoint = process.env.CONTACT_FORMSPREE_ENDPOINT || process.env.FORMSPREE_ENDPOINT;
    const webhookUrl = process.env.CONTACT_WEBHOOK_URL;
    const toEmail = process.env.CONTACT_TO_EMAIL;
    const resendKey = process.env.RESEND_API_KEY;

    if (webhookUrl) {
      try {
        const resp = await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, organization, category, message, source: "openplanet-contact" }),
        });
        if (resp.ok) {
          return NextResponse.json({ ok: true }, { status: 200 });
        }
      } catch (e) {
        // fall through
      }
    }

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
            subject: `[OpenPlanet Contact] ${category}`,
            text: `Name: ${name}\nEmail: ${email}\nOrganization: ${organization}\nCategory: ${category}\n\n${message}`,
          }),
        });
        if (resp.ok) {
          return NextResponse.json({ ok: true }, { status: 200 });
        }
      } catch (e) {
        // fall through
      }
    }

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
          return NextResponse.json({ ok: true }, { status: 200 });
        }
      } catch (e) {
        // fall through
      }
    }

    return NextResponse.json({ error: "Contact delivery not configured" }, { status: 503 });
  } catch (error) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
