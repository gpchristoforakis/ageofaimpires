import { verifyAccessToken, type ChecklistEnv } from '../../../_shared/access-token';
import { checklistHtml } from '../../../_shared/checklist-page';

const protectedHeaders = {
  'content-type': 'text/html; charset=utf-8',
  'cache-control': 'private, no-store, max-age=0',
  'x-robots-tag': 'noindex, nofollow, noarchive',
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
};

function accessError(message: string, status: number): Response {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive"><title>Checklist access — Age of AI Empires</title><link rel="stylesheet" href="/styles/visual-home.css"></head><body><main class="wrap" style="min-height:75vh;display:grid;align-content:center;max-width:720px"><p class="eyebrow">THE SETUP CHECKLIST</p><h1 style="margin-bottom:24px">Your access link needs refreshing.</h1><p>${message}</p><p><a class="button primary" href="/en/#checklist">Request a new access link <span aria-hidden="true">↗</span></a></p></main></body></html>`;
  return new Response(html, { status, headers: protectedHeaders });
}

export async function onRequestGet(context: { request: Request; env: ChecklistEnv }): Promise<Response> {
  const secret = context.env.CHECKLIST_SIGNING_SECRET;
  if (!secret || secret.length < 32) return accessError('Checklist access is temporarily unavailable. Please try again later.', 503);
  const token = new URL(context.request.url).searchParams.get('token');
  if (!token) return accessError('Use the secure link sent to your email address.', 401);
  const payload = await verifyAccessToken(token, secret);
  if (!payload) return accessError('This link is invalid or has expired. Request a fresh link below.', 401);
  return new Response(checklistHtml, { headers: protectedHeaders });
}
