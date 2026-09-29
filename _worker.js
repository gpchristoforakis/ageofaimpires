const CONTACT_PATH = "/api/contact";
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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === CONTACT_PATH) {
      try {
        return await handleContact(request, env);
      } catch (error) {
        console.error("Contact handler error:", error);
        return json({ error: "The message could not be delivered." }, 500);
      }
    }

    return env.ASSETS.fetch(request);
  },
};
