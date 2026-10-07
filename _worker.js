const CONTACT_PATH = "/api/contact";
const SUBSCRIBE_PATH = "/api/subscribe";
const RECIPIENT = "hello@ageofaimpires.com";
const SENDER = "AGE OF AIMPIRES <hello@ageofaimpires.com>";

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function normalize(value, maxLength) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function handleContact(request, env) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  if (!env.RESEND_API_KEY) {
    console.error("RESEND_API_KEY is not configured.");
    return json({ error: "Email service is not configured." }, 503);
  }

  const requestUrl = new URL(request.url);
  const origin = request.headers.get("Origin");
  if (origin) {
    try {
      if (new URL(origin).host !== requestUrl.host) {
        return json({ error: "Request origin not allowed." }, 403);
      }
    } catch {
      return json({ error: "Request origin not allowed." }, 403);
    }
  }

  const contentType = request.headers.get("Content-Type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return json({ error: "Invalid request format." }, 415);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  // Honeypot: bots that fill this field receive a neutral success response.
  const website = normalize(body.website, 200);
  if (website) {
    return json({ ok: true });
  }

  const rawEmail = String(body.email ?? "").trim();
  const rawPhone = String(body.phone ?? "").trim();
  const rawMessage = String(body.message ?? "").trim();

  if (rawEmail.length > 254 || rawPhone.length > 60 || rawMessage.length > 5000) {
    return json({ error: "One or more fields are too long." }, 400);
  }

  const email = rawEmail;
  const phone = rawPhone;
  const message = rawMessage;

  if (!validEmail(email)) {
    return json({ error: "Please enter a valid email address." }, 400);
  }
  if (message.length < 2) {
    return json({ error: "Please enter a message." }, 400);
  }
  const safeEmail = escapeHtml(email);
  const safePhone = escapeHtml(phone || "Not provided");
  const safeMessage = escapeHtml(message).replaceAll("\n", "<br>");

  const resendResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: SENDER,
      to: [RECIPIENT],
      reply_to: email,
      subject: "New AGE OF AIMPIRES contact message",
      html: `
        <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#111c2c;max-width:680px">
          <h2 style="margin:0 0 24px">New AGE OF AIMPIRES contact message</h2>
          <p><strong>Email:</strong> ${safeEmail}</p>
          <p><strong>Phone / WhatsApp:</strong> ${safePhone}</p>
          <p><strong>Message:</strong></p>
          <p>${safeMessage}</p>
        </div>`,
      text: `New AGE OF AIMPIRES contact message\n\nEmail: ${email}\nPhone / WhatsApp: ${phone || "Not provided"}\n\nMessage:\n${message}`,
    }),
  });

  if (!resendResponse.ok) {
    const errorText = await resendResponse.text();
    console.error("Resend error:", resendResponse.status, errorText);
    return json({ error: "The message could not be delivered." }, 502);
  }

  return json({ ok: true });
}

async function handleSubscribe(request, env) {
  const failure = (status = 502) => json({
    code: "signup_failed", error: "The signup could not be completed. Please try again.",
  }, status);
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  const origin = request.headers.get("Origin");
  if (request.headers.get("Sec-Fetch-Site") === "cross-site" ||
      (origin && origin !== new URL(request.url).origin)) {
    return failure(403);
  }
  if (!(request.headers.get("Content-Type") || "").toLowerCase().includes("application/json")) {
    return failure(415);
  }
  const rawBody = await request.text();
  if (rawBody.length > 2048) return failure(413);
  let body;
  try { body = JSON.parse(rawBody); } catch { return failure(400); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return failure(400);
  if (normalize(body.website, 200)) return json({ ok: true });
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!name) return json({ code: "name_required", error: "Enter a name to continue." }, 400);
  if (!email) return json({ code: "email_required", error: "Enter an email address to continue." }, 400);
  if (!validEmail(email)) return json({ code: "invalid_email", error: "Check the email address and try again." }, 400);
  if (name.length > 100 || /[\u0000-\u001f\u007f]/.test(name)) return failure(400);

  const apiKey = env.RESEND_SUBSCRIBE_API_KEY || env.RESEND_API_KEY;
  const segmentId = env.RESEND_ENTRY_SEGMENT_ID;
  if (!apiKey || !segmentId) return failure(503);
  const provider = (path, method = "GET", payload) => fetch(`https://api.resend.com${path}`, {
    method,
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "User-Agent": "ageofaimpires-entry-signup/1.0" },
    ...(payload ? { body: JSON.stringify(payload) } : {}),
    signal: AbortSignal.timeout(10000),
  });
  const contactPath = `/contacts/${encodeURIComponent(email)}`;
  const existing = await provider(contactPath);
  if (existing.status === 404) {
    // Keep the supplied name intact; do not guess how to split a person's name.
    const created = await provider("/contacts", "POST", {
      email, first_name: name, unsubscribed: false, segments: [{ id: segmentId }],
    });
    if (!created.ok) return failure();
  } else if (existing.ok) {
    // An explicit signup can rejoin the entry list without duplicating a contact.
    const added = await provider(`${contactPath}/segments/${encodeURIComponent(segmentId)}`, "POST");
    if (!added.ok) return failure();
    const updated = await provider(contactPath, "PATCH", { first_name: name, unsubscribed: false });
    if (!updated.ok) return failure();
  } else {
    return failure();
  }
  return json({ ok: true });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Preserve existing bookmarks after the directory is renamed to Entries.
    if (["/articles", "/articles/", "/articles.html"].includes(url.pathname)) {
      url.pathname = "/entries";
      return Response.redirect(url.toString(), 301);
    }

    if (url.pathname === CONTACT_PATH) {
      try {
        return await handleContact(request, env);
      } catch (error) {
        console.error("Contact handler error:", error);
        return json({ error: "The message could not be delivered." }, 500);
      }
    }

    if (url.pathname === SUBSCRIBE_PATH) {
      try {
        return await handleSubscribe(request, env);
      } catch {
        // Do not expose provider responses, subscriber details, or credentials.
        return json({ code: "signup_failed", error: "The signup could not be completed. Please try again." }, 502);
      }
    }

    return env.ASSETS.fetch(request);
  },
};
