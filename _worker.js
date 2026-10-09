import { queryArchivistCandidate, archivistReply, mapArchivistSources, ArchivistError } from "./lib/archivist-core.mjs";

const CONTACT_PATH = "/api/contact";
const SUBSCRIBE_PATH = "/api/subscribe";
const CHAT_PATH = "/api/chat";
const VOICE_TOKEN_PATH = "/api/voice/token";
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

// Locked donor: aab5f99b3dfdfb69a674b996acb331606a481831. Chat metadata only; no ingestion or filesystem runtime.

function chatError(code, error, status) {
  return json({ code, error }, status);
}

async function readChatBody(request) {
  const limit = 65536;
  if (Number(request.headers.get("Content-Length")) > limit) return null;
  const reader = request.body?.getReader();
  if (!reader) return "";
  const chunks = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > limit) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

function validChatPayload(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return false;
  if (typeof body.query !== "string" || !body.query.trim() || body.query.length > 4000) return false;
  const history = body.history === undefined ? [] : body.history;
  if (!Array.isArray(history) || history.length > 8) return false;
  let historyLength = 0;
  for (const message of history) {
    if (!message || !["user", "model"].includes(message.role) ||
        typeof message.content !== "string" || !message.content.trim() || message.content.length > 8000) return false;
    historyLength += message.content.length;
  }
  if (historyLength > 32000) return false;
  if (body.context !== undefined) {
    if (!body.context || typeof body.context !== "object" || Array.isArray(body.context)) return false;
    const limits = { current_url: 2048, current_page: 300, current_entry: 100, current_section: 300, site_language: 35 };
    for (const [key, value] of Object.entries(body.context)) {
      if (!Object.hasOwn(limits, key) || typeof value !== "string" || value.length > limits[key]) return false;
    }
    if (body.context.current_url) {
      try {
        const url = new URL(body.context.current_url);
        if (url.origin !== "https://ageofaimpires.com" || url.username || url.password) return false;
      } catch { return false; }
    }
  }
  return true;
}

// Only answer-supported retrieved chunks can produce public source cards.
// Unknown identities never fall back to title or snippet guesses.

async function queryArchivist(body, apiKey) {
  try {
    const candidate = await queryArchivistCandidate(body, apiKey);
    return json({ reply: archivistReply(candidate), sources: mapArchivistSources(candidate?.groundingMetadata) });
  } catch (error) {
    if (error instanceof ArchivistError) return chatError(error.code, error.message, error.status);
    throw error;
  }
}

async function handleChat(request, env) {
  if (request.method !== "POST") return chatError("method_not_allowed", "Method not allowed.", 405);
  const origin = request.headers.get("Origin");
  if (request.headers.get("Sec-Fetch-Site") === "cross-site" || (origin && origin !== new URL(request.url).origin)) {
    return chatError("origin_not_allowed", "Request origin not allowed.", 403);
  }
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("Content-Type") || "")) {
    return chatError("invalid_content_type", "Send the question as JSON.", 415);
  }
  let body;
  try {
    const raw = await readChatBody(request);
    if (raw === null) return chatError("request_too_large", "The question or conversation is too long.", 413);
    body = JSON.parse(raw);
  } catch { return chatError("invalid_request", "The question could not be read. Please try again.", 400); }
  if (!validChatPayload(body)) return chatError("invalid_request", "Check the question and conversation format.", 400);
  if (!env.GEMINI_API_KEY) return chatError("chat_not_configured", "The Archivist is temporarily unavailable. Please try again later.", 503);
  return queryArchivist(body, env.GEMINI_API_KEY);
}

async function handleVoiceToken(request, env) {
  const failure = (code, error, status) => json({ code, error }, status);
  if (request.method !== "POST") return failure("method_not_allowed", "Method not allowed.", 405);
  const origin = request.headers.get("Origin");
  if (request.headers.get("Sec-Fetch-Site") === "cross-site" || (origin && origin !== new URL(request.url).origin)) {
    return failure("origin_not_allowed", "Request origin not allowed.", 403);
  }
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("Content-Type") || "")) {
    return failure("invalid_content_type", "Send the request as JSON.", 415);
  }
  try {
    const raw = await readChatBody(request);
    if (raw === null || raw.length > 1024) return failure("request_too_large", "The request is too large.", 413);
    const body = JSON.parse(raw);
    if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).length) {
      return failure("invalid_request", "Invalid voice request.", 400);
    }
  } catch { return failure("invalid_request", "Invalid voice request.", 400); }
  if (!env.GEMINI_API_KEY) return failure("voice_not_configured", "Voice is not configured in this environment.", 503);
  const now = Date.now();
  const response = await fetch("https://generativelanguage.googleapis.com/v1alpha/auth_tokens", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
    body: JSON.stringify({ uses: 1, expireTime: new Date(now + 30 * 60 * 1000).toISOString(),
      newSessionExpireTime: new Date(now + 2 * 60 * 1000).toISOString() }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) return failure("voice_unavailable", "Voice could not connect. Please try again later.", 502);
  const result = await response.json();
  if (typeof result.name !== "string" || !result.name.startsWith("auth_tokens/") || result.name.includes(env.GEMINI_API_KEY)) {
    return failure("voice_unavailable", "Voice could not connect. Please try again later.", 502);
  }
  return json({ token: result.name });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // New server-only modules and prototype files are not publication assets.
    let assetPath;
    try {
      assetPath = new URL('https://static.invalid' + decodeURIComponent(url.pathname).replace(/\/{2,}/g, '/')).pathname;
    } catch { return new Response('Not Found', { status: 404 }); }
    if (assetPath.startsWith('/lib/') || assetPath.startsWith('/integrations/archivist-chatgpt/')) {
      return new Response('Not Found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
    }

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

    if (url.pathname === CHAT_PATH) {
      try { return await handleChat(request, env); }
      catch (error) {
        const timedOut = error?.name === "TimeoutError" || error?.name === "AbortError";
        return chatError(timedOut ? "chat_timeout" : "chat_unavailable",
          timedOut ? "The archive took too long to respond. Please try again." : "The Archivist could not reach the archive. Please try again later.",
          timedOut ? 504 : 502);
      }
    }

    if (url.pathname === VOICE_TOKEN_PATH) {
      try { return await handleVoiceToken(request, env); }
      catch (error) {
        const timedOut = error?.name === "TimeoutError" || error?.name === "AbortError";
        return json({ code: timedOut ? "voice_timeout" : "voice_unavailable",
          error: timedOut ? "Voice connection timed out. Please try again." : "Voice could not connect. Please try again later." }, timedOut ? 504 : 502);
      }
    }

    return env.ASSETS.fetch(request);
  },
};
