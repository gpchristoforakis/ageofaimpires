const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const source = require('./load-worker-source.cjs')(path.join(__dirname, '..'));
const worker = import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const selection = 'Which Assistant fits the Job Description best?';
const clarification = 'What are you trying to get done, and what would a usable result look like?';
const prompting = 'How to write more effective prompts.';

async function ask(query, history = []) {
  const request = new Request('https://ageofaimpires.com/api/chat', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, history })
  });
  const response = await (await worker).default.fetch(request, { GEMINI_API_KEY: 'fixture' });
  assert.equal(response.status, 200);
  return response.json();
}

function provider(t, groundedAttempts) {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (_, options) => {
    calls.push(JSON.parse(options.body));
    const candidate = { content: { parts: [{ text: 'Provider advice' }] } };
    if (groundedAttempts.includes(calls.length)) candidate.groundingMetadata = {
      groundingChunks: [{ retrievedContext: { title: 'Compare Two Assistants On One Real Job' } }],
      groundingSupports: [{ groundingChunkIndices: [0] }]
    };
    return Response.json({ candidates: [candidate] });
  });
  return calls;
}

test('selection asks about the job, then sends the reader’s answer and history to retrieval', async t => {
  const calls = provider(t, [1]);
  assert.deepEqual(await ask(selection), { reply: clarification, sources: [] });
  assert.equal(calls.length, 0);
  const history = [{ role: 'user', content: selection }, { role: 'model', content: clarification }];
  const answer = await ask('I need a shopping list for three dinners.', history);
  assert.equal(answer.sources.length, 1);
  assert.equal(calls[0].contents[1].parts[0].text, clarification);
});

for (const [attempts, expectedCalls] of [[[1], 1], [[2], 2], [[], 2]]) {
  test('prompt advice with grounding on attempts ' + JSON.stringify(attempts), async t => {
    const calls = provider(t, attempts);
    const answer = await ask(prompting);
    assert.equal(calls.length, expectedCalls);
    assert.equal(answer.sources.length, attempts.length);
    if (attempts.length) assert.equal(answer.reply, 'Provider advice');
    else assert.match(answer.reply, /couldn’t verify a published source/);
  });
}
