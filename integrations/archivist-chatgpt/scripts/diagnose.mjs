import { pathToFileURL } from 'node:url';

const API = 'https://generativelanguage.googleapis.com/v1beta/';
const MODEL = 'models/gemini-3.1-flash-lite';
const STORE = 'fileSearchStores/age-of-aimpires-archive-oygcx3s6yi3t';

export function safeMessage(value, key) {
  let message = typeof value === 'string' ? value : '';
  if (key) message = message.split(key).join('[REDACTED]');
  return message.replace(/AIza[\w-]+|AQ\.[\w.-]+/g, '[REDACTED]')
    .replace(/[\r\n\t]+/g, ' ').slice(0, 800);
}

export async function diagnose(apiKey, fetchImpl = globalThis.fetch) {
  if (!apiKey?.trim()) {
    console.log('GEMINI_API_KEY is missing. Run this in the same Command Prompt where you set it.');
    return false;
  }
  console.log('Checking Gemini model and existing archive access. No answer generation; key is not printed.');
  let passed = true;
  for (const [label, resource] of [['Model', MODEL], ['Archive', STORE]]) {
    try {
      const response = await fetchImpl(API + resource, {
        headers: { 'x-goog-api-key': apiKey }, signal: AbortSignal.timeout(20000),
      });
      let payload;
      try { payload = await response.json(); } catch { payload = {}; }
      console.log(`${label}: HTTP ${response.status}${response.ok ? ' - accessible' : ' - failed'}`);
      if (!response.ok) {
        passed = false;
        console.log(safeMessage(payload.error?.status, apiKey) || 'No provider status supplied.');
        console.log(safeMessage(payload.error?.message, apiKey) || 'No provider explanation supplied.');
      }
    } catch (error) {
      passed = false;
      const code = String(error?.cause?.code || error?.name || 'network_error');
      console.log(`${label}: request failed (${safeMessage(code, apiKey)}).`);
    }
  }
  return passed;
}

export async function listArchiveStores(apiKey, fetchImpl = globalThis.fetch) {
  if (!apiKey?.trim()) {
    console.log('GEMINI_API_KEY is missing. Use the same Command Prompt where you set it.');
    return false;
  }
  console.log('Listing archive names accessible to this key. Read-only; no document content or key values.');
  let token, count = 0, found = false;
  for (let page = 0; page < 5; page++) {
    const url = new URL(API + 'fileSearchStores');
    url.searchParams.set('pageSize', '20');
    if (token) url.searchParams.set('pageToken', token);
    try {
      const response = await fetchImpl(url, {
        headers: { 'x-goog-api-key': apiKey }, signal: AbortSignal.timeout(20000),
      });
      let payload;
      try { payload = await response.json(); } catch { payload = {}; }
      if (!response.ok) {
        console.log(`Store listing: HTTP ${response.status} - failed`);
        console.log(safeMessage(payload.error?.status, apiKey) || 'No provider status supplied.');
        console.log(safeMessage(payload.error?.message, apiKey) || 'No provider explanation supplied.');
        return false;
      }
      for (const store of Array.isArray(payload.fileSearchStores) ? payload.fileSearchStores : []) {
        count++;
        found ||= store.name === STORE;
        console.log(`${safeMessage(store.displayName, apiKey) || '(unnamed)'} | ${safeMessage(store.name, apiKey)}`);
      }
      token = typeof payload.nextPageToken === 'string' ? payload.nextPageToken : null;
      if (!token) break;
    } catch (error) {
      console.log(`Store listing: request failed (${safeMessage(String(error?.cause?.code || error?.name || 'network_error'), apiKey)}).`);
      return false;
    }
  }
  console.log(`Accessible stores listed: ${count}. Configured archive present: ${found ? 'yes' : 'no'}.`);
  if (token) console.log('Listing stopped at 100 stores; additional pages exist.');
  return found;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const check = process.argv.includes('--stores') ? listArchiveStores : diagnose;
  process.exitCode = await check(process.env.GEMINI_API_KEY) ? 0 : 1;
}
