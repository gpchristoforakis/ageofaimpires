const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const source = require('./load-worker-source.cjs')(path.join(__dirname, '..'));
  const worker = (await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)).default;
  const originalFetch = global.fetch;
  const calls = [];
  let replies = [];
  global.fetch = async (url, options) => {
    calls.push({ url, ...options, payload: options.body ? JSON.parse(options.body) : null });
    const reply = replies.shift();
    assert.ok(reply, 'Unexpected provider request');
    if (reply instanceof Error) throw reply;
    return new Response(JSON.stringify(reply.body || {}), { status: reply.status });
  };
  const env = { RESEND_SUBSCRIBE_API_KEY: 'fake-test-key', RESEND_ENTRY_SEGMENT_ID: 'fake-entry-segment',
    ASSETS: { fetch: async () => new Response('static asset') } };
  const signup = async (body, config = env, extra = {}) => {
    const response = await worker.fetch(new Request('https://ageofaimpires.com/api/subscribe', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://ageofaimpires.com', ...extra },
      body: JSON.stringify(body),
    }), config);
    return { status: response.status, body: await response.json() };
  };
  try {
    for (const [payload, code] of [
      [{ name: '', email: 'reader@example.com' }, 'name_required'],
      [{ name: 'Reader', email: '' }, 'email_required'],
      [{ name: 'Reader', email: 'bad-email' }, 'invalid_email'],
    ]) {
      const result = await signup(payload);
      assert.equal(result.status, 400);
      assert.equal(result.body.code, code);
    }
    assert.equal((await signup(null)).status, 400);
    assert.equal((await signup({ name: 'A'.repeat(101), email: 'reader@example.com' })).status, 400);
    assert.equal((await signup({ name: 'A'.repeat(3000) })).status, 413);
    assert.equal((await signup({ name: 'Reader', email: 'reader@example.com' }, env, { Origin: 'https://other.test' })).status, 403);
    assert.equal((await signup({ name: 'Reader', email: 'reader@example.com' }, env, { 'Content-Type': 'text/plain' })).status, 415);
    assert.equal((await signup({ name: 'Reader', email: 'reader@example.com' }, {})).status, 503);
    assert.deepEqual((await signup({ website: 'bot' })).body, { ok: true });
    assert.equal(calls.length, 0, 'Validation must not call Resend');
    assert.equal((await worker.fetch(new Request('https://ageofaimpires.com/api/subscribe'), env)).status, 405);

    replies = [{ status: 404 }, { status: 201, body: { id: 'new-contact' } }];
    assert.deepEqual((await signup({ name: '  Reader Full Name  ', email: 'Reader@example.com' })).body, { ok: true });
    assert.equal(calls[0].url, 'https://api.resend.com/contacts/reader%40example.com');
    assert.equal(calls[0].headers['User-Agent'], 'ageofaimpires-entry-signup/1.0');
    assert.deepEqual(calls[1].payload, { email: 'reader@example.com', first_name: 'Reader Full Name', unsubscribed: false, segments: [{ id: 'fake-entry-segment' }] });

    calls.length = 0;
    replies = [{ status: 200 }, { status: 200 }, { status: 200 }];
    assert.deepEqual((await signup({ name: 'Reader', email: 'reader@example.com' })).body, { ok: true });
    assert.deepEqual(calls.map(call => call.method), ['GET', 'POST', 'PATCH']);
    assert.match(calls[1].url, /\/segments\/fake-entry-segment$/);
    assert.equal(calls[2].payload.unsubscribed, false);

    for (const sequence of [
      [{ status: 401, body: { secret: 'private-provider-error' } }],
      [{ status: 404 }, { status: 500 }],
      [{ status: 200 }, { status: 500 }],
      [{ status: 200 }, { status: 200 }, { status: 500 }],
      [new Error('provider connection failed')],
    ]) {
      replies = sequence;
      const result = await signup({ name: 'Reader', email: 'reader@example.com' });
      assert.equal(result.status, 502);
      assert.deepEqual(result.body, { code: 'signup_failed', error: 'The signup could not be completed. Please try again.' });
    }
    calls.length = 0;
    replies = [{ status: 404 }, { status: 201 }];
    await signup({ name: 'Reader', email: 'reader@example.com' }, { ...env, RESEND_SUBSCRIBE_API_KEY: undefined, RESEND_API_KEY: 'fake-fallback-key' });
    assert.equal(calls[0].headers.Authorization, 'Bearer fake-fallback-key');
    assert.equal(await (await worker.fetch(new Request('https://ageofaimpires.com/how-to'), env)).text(), 'static asset');
    const redirect = await worker.fetch(new Request('https://ageofaimpires.com/articles'), env);
    assert.equal(redirect.status, 301);
    assert.equal(redirect.headers.get('Location'), 'https://ageofaimpires.com/entries');
    console.log('Passed: subscription validation, configuration, new and repeat signups, provider failures, existing routing. No live API requests.');
  } finally { global.fetch = originalFetch; }
})().catch(error => { console.error(error); process.exitCode = 1; });
