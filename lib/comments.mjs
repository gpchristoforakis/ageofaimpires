// The page allowlist is shared with the integration test; arbitrary threads are not accepted.
export const commentPages = new Set([
  '/', '/about', '/entries', '/frameworks', '/notebook', '/how-to',
  '/age-of-aimpires-entry-01', '/age-of-aimpires-entry-02', '/age-of-aimpires-entry-03', '/age-of-aimpires-entry-04',
  '/framework-ai-tasks', '/framework-effective-task-cost', '/framework-effective-task-cost-operators-deep-dive',
  '/compare-assistants-on-one-task', '/time-cost-calculator',
  '/connect-the-source-not-your-entire-digital-life', '/give-the-job-its-own-rules',
  '/how-to-check-whether-you-have-this-feature', '/tell-your-ai-how-you-like-to-work',
]);

function reply(body, status = 200) {
  return new Response(JSON.stringify(body), {status, headers: {
    'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  }});
}
function canonical(value) {
  if (typeof value !== 'string') return null;
  const page = value.replace(/\.html$/, '').replace(/\/$/, '') || '/';
  return page === '/index' ? '/' : page;
}
async function readBody(request) {
  const reader = request.body?.getReader();
  if (!reader) return null;
  let size = 0;
  const chunks = [];
  while (true) {
    const {done, value} = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 16000) { await reader.cancel(); throw new RangeError(); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder().decode(bytes));
}
export async function handleComments(request, env) {
  const fail = (message, status) => reply({error: message}, status);
  if (!['GET', 'POST'].includes(request.method)) return fail('Method not allowed.', 405);
  const url = new URL(request.url);
  if (request.method === 'POST' && (request.headers.get('Origin') !== url.origin ||
      request.headers.get('Sec-Fetch-Site') === 'cross-site')) return fail('Request origin not allowed.', 403);
  if (!env.COMMENTS_DB) return fail('Comments are temporarily unavailable. Please try again later.', 503);
  try {
    if (request.method === 'GET') {
      const page = canonical(url.searchParams.get('page'));
      const after = Number(url.searchParams.get('after') || 0);
      if (!commentPages.has(page) || !Number.isSafeInteger(after) || after < 0) return fail('Invalid page or cursor.', 400);
      const {results} = await env.COMMENTS_DB.prepare(
        "SELECT id, name, comment, created_at FROM comments WHERE page = ? AND (? = 0 OR id < ?) ORDER BY id DESC LIMIT 21"
      ).bind(page, after, after).all();
      return reply({comments: results.slice(0, 20), next: results.length > 20 ? results[19].id : null});
    }
    if (!(request.headers.get('Content-Type') || '').toLowerCase().startsWith('application/json')) return fail('Use JSON.', 415);
    let body;
    try { body = await readBody(request); }
    catch (error) { return fail('Invalid or oversized comment.', error instanceof RangeError ? 413 : 400); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return fail('Invalid comment.', 400);
    if (body.website) return reply({ok: true, published: true}, 202);
    const page = canonical(body.page);
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const comment = typeof body.comment === 'string' ? body.comment.trim() : '';
    if (!commentPages.has(page) || !name || name.length > 80 || /[\u0000-\u001f\u007f]/.test(name) ||
        !comment || comment.length > 3000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(comment) ||
        body.consent !== true || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.requestId || '')) {
      return fail('Enter a name, a comment of up to 3,000 characters, and confirm publication consent.', 400);
    }
    const ip = request.headers.get('CF-Connecting-IP');
    if (!env.COMMENTS_RATE_SECRET || !ip) return fail('Comments are temporarily unavailable. Please try again later.', 503);
    const now = Date.now();
    const day = Math.floor(now / 86400000);
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.COMMENTS_RATE_SECRET), {name: 'HMAC', hash: 'SHA-256'}, false, ['sign']);
    const bytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(day + ':' + ip));
    const rateKey = Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
    const db = env.COMMENTS_DB;
    // One transaction: concurrent submissions cannot bypass the per-day limit.
    const result = await db.batch([
      db.prepare('DELETE FROM comment_limits WHERE expires_at < ?').bind(now),
      db.prepare('INSERT INTO comment_limits (key, count, expires_at) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET count = count + 1').bind(rateKey, (day + 2) * 86400000),
      db.prepare("INSERT OR IGNORE INTO comments (request_id, page, name, comment, created_at) SELECT ?, ?, ?, ?, ? WHERE (SELECT count FROM comment_limits WHERE key = ?) <= 5").bind(body.requestId, page, name, comment, now, rateKey),
      db.prepare('SELECT id FROM comments WHERE request_id = ?').bind(body.requestId),
    ]);
    if (!result[3].results.length) return fail('The daily comment limit has been reached. Please try again tomorrow.', 429);
    return reply({ok: true, published: true}, 202);
  } catch {
    return fail('Comments could not be loaded or saved. Please try again later.', 503);
  }
}
