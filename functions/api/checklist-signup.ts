import { createAccessToken, type ChecklistEnv } from '../_shared/access-token';

interface SignupBody { email?: unknown; company?: unknown; }

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const jsonHeaders = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };

export async function onRequestPost(context: { request: Request; env: ChecklistEnv }): Promise<Response> {
  let body: SignupBody;
  try {
    body = await context.request.json() as SignupBody;
  } catch {
    return Response.json({ error: 'Enter a valid email address.' }, { status: 400, headers: jsonHeaders });
  }

  if (typeof body.company === 'string' && body.company.trim()) {
    return Response.json({ message: 'Check your email for your secure checklist access link.' }, { headers: jsonHeaders });
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!email || email.length > 254 || !emailPattern.test(email)) {
    return Response.json({ error: 'Enter a valid email address.' }, { status: 400, headers: jsonHeaders });
  }

  const { CHECKLIST_SIGNING_SECRET: secret, RESEND_API_KEY: apiKey, CHECKLIST_FROM_EMAIL: fromEmail } = context.env;
  if (!secret || secret.length < 32 || !apiKey || !fromEmail) {
    console.error('Checklist delivery is missing required server configuration.');
    return Response.json({ error: 'Checklist delivery is temporarily unavailable. Please try again later.' }, { status: 503, headers: jsonHeaders });
  }

  const origin = context.env.SITE_ORIGIN?.replace(/\/$/, '') || 'https://ageofaimpires.com';
  const token = await createAccessToken(email, secret);
  const accessUrl = `${origin}/en/checklists/your-first-ai-assistant/?token=${encodeURIComponent(token)}`;
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: fromEmail,
      to: [email],
      subject: 'Your First AI Assistant checklist',
      html: `<p>Your checklist is ready.</p><p><a href="${accessUrl}">Open Your First AI Assistant</a></p><p>This secure link works for 30 days. If it expires, request another from Age of AI Empires.</p><p>You have not been added to a marketing list.</p>`,
      text: `Your checklist is ready:\n\n${accessUrl}\n\nThis secure link works for 30 days. If it expires, request another from Age of AI Empires.\n\nYou have not been added to a marketing list.`,
    }),
  });

  if (!response.ok) {
    console.error('Checklist email provider returned an error.', response.status);
    return Response.json({ error: 'We could not send the access link. Please try again.' }, { status: 502, headers: jsonHeaders });
  }

  return Response.json({ message: 'Check your email for your secure checklist access link. If you requested one before, this fresh link replaces nothing and works independently.' }, { headers: jsonHeaders });
}
