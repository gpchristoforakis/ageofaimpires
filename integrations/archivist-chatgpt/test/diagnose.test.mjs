import test from 'node:test';
import assert from 'node:assert/strict';
import { diagnose, safeMessage, listArchiveStores } from '../scripts/diagnose.mjs';

test('diagnostic redacts the exact key and recognisable provider keys', () => {
  assert.equal(safeMessage('Bad key secret-key\nAIzaAbc_def-123 AQ.token.part', 'secret-key'),
    'Bad key [REDACTED] [REDACTED] [REDACTED]');
  assert.equal(safeMessage('x'.repeat(900), 'key').length, 800);
});

test('diagnostic uses metadata GETs and reports denied archive access without leaking keys', async () => {
  const output = [], requests = [];
  const original = console.log;
  console.log = text => output.push(text);
  try {
    const result = await diagnose('private-test-key', async (url, options) => {
      requests.push({ url, options });
      return requests.length === 1
        ? Response.json({ name: 'model' })
        : Response.json({ error: { status: 'PERMISSION_DENIED', message: 'Denied private-test-key' } }, { status: 403 });
    });
    assert.equal(result, false);
    assert.equal(requests.length, 2);
    assert.ok(requests.every(row => !row.options.method && !row.options.body && !row.url.includes('private-test-key')));
    assert.ok(output.join('\n').includes('Archive: HTTP 403'));
    assert.ok(!output.join('\n').includes('private-test-key'));
  } finally { console.log = original; }
});

test('missing key makes no API requests', async () => {
  const original = console.log;
  console.log = () => {};
  try { assert.equal(await diagnose('', () => { throw new Error('unexpected request'); }), false); }
  finally { console.log = original; }
});

test('store listing follows pagination and redacts key text in metadata', async () => {
  const original = console.log, output = [], requests = [];
  console.log = text => output.push(text);
  try {
    const result = await listArchiveStores('private-test-key', async (url, options) => {
      requests.push({ url, options });
      return requests.length === 1
        ? Response.json({ fileSearchStores: [{ name: 'fileSearchStores/other', displayName: 'private-test-key' }], nextPageToken: 'page-two' })
        : Response.json({ fileSearchStores: [{ name: 'fileSearchStores/age-of-aimpires-archive-oygcx3s6yi3t', displayName: 'Archive' }] });
    });
    assert.equal(result, true);
    assert.equal(requests[1].url.searchParams.get('pageToken'), 'page-two');
    assert.ok(requests.every(row => !row.options.method && !row.options.body));
    assert.ok(output.join('\n').includes('Configured archive present: yes'));
    assert.ok(!output.join('\n').includes('private-test-key'));
  } finally { console.log = original; }
});

test('an empty store list does not imply archive access', async () => {
  const original = console.log;
  console.log = () => {};
  try { assert.equal(await listArchiveStores('key', async () => Response.json({})), false); }
  finally { console.log = original; }
});
