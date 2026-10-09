import { ToolError } from './archive.mjs';

export const DAILY_QUERY_LIMIT = 25;
export const MONTHLY_QUERY_LIMIT = 250;
export const MAX_OUTPUT_TOKENS = 2048;

// This one durable record is shared by every public Worker instance. It stores
// counters only: no prompts, responses, credentials, account IDs or IP addresses.
export function reserveAttempt(previous, now = new Date()) {
  const day = now.toISOString().slice(0, 10);
  const month = day.slice(0, 7);
  const state = {
    day, month,
    daily: previous?.day === day ? previous.daily : 0,
    monthly: previous?.month === month ? previous.monthly : 0,
  };
  if (!Number.isInteger(state.daily) || state.daily < 0 ||
      !Number.isInteger(state.monthly) || state.monthly < 0) {
    throw new Error('Invalid stored budget');
  }
  const allowed = state.daily < DAILY_QUERY_LIMIT && state.monthly < MONTHLY_QUERY_LIMIT;
  if (allowed) { state.daily++; state.monthly++; }
  return { allowed, state };
}

export class ArchiveQueryBudget {
  constructor(ctx) { this.storage = ctx.storage; }
  async fetch(request) {
    if (request.method !== 'POST' || new URL(request.url).pathname !== '/reserve') {
      return new Response('Not found', { status: 404 });
    }
    const allowed = await this.storage.transaction(async txn => {
      const result = reserveAttempt(await txn.get('usage'));
      if (result.allowed) await txn.put('usage', result.state);
      return result.allowed;
    });
    return Response.json({ allowed });
  }
}

// Each outbound provider attempt, including a retry, consumes a permit before
// sending the question. Failed or interrupted requests do not refund permits.
export function budgetedGeminiFetch(namespace, fetchImpl = globalThis.fetch) {
  return async (url, init) => {
    if (String(url) !== 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent') {
      throw new ToolError('archive_unavailable', 'The archive endpoint is unavailable.');
    }
    let permit;
    try {
      if (!namespace) throw new Error('Missing budget');
      const stub = namespace.get(namespace.idFromName('public-provider-attempts-v1'));
      const response = await stub.fetch('https://budget.internal/reserve', { method: 'POST' });
      if (!response.ok) throw new Error('Budget service failed');
      permit = await response.json();
      if (typeof permit.allowed !== 'boolean') throw new Error('Invalid permit');
    } catch {
      throw new ToolError('archive_unavailable', 'The archive usage limit could not be checked. Please try again later.', true);
    }
    if (!permit.allowed) throw new ToolError('archive_limit_reached',
      'The shared archive query allowance has been reached. Try again after the daily or monthly UTC reset. Published pages remain available through fetch_entry.', true);
    init?.signal?.throwIfAborted();
    const payload = JSON.parse(init.body);
    payload.generationConfig = { ...payload.generationConfig, maxOutputTokens: MAX_OUTPUT_TOKENS };
    return fetchImpl(url, { ...init, body: JSON.stringify(payload) });
  };
}
