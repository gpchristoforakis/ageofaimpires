import { registry } from './archive.mjs';
// Explicit offline transport fixture. Never used by the default live server.
export async function demoGeminiFetch(_url, options) {
  const question = JSON.parse(options.body).contents.at(-1).parts[0].text;
  const doc = registry.find(row => row.slug === 'age-of-aimpires-entry-01');
  const supported = /completion boundary|actually finished/i.test(question);
  return Response.json({ candidates: [{ content: { parts: [{ text: supported
    ? 'Demo fixture: The Completion Boundary defines what must be true for a job to count as finished. A model stopping is not sufficient; the result must satisfy the agreed requirements.'
    : 'Unverified fixture reply that must be suppressed.' }] }, groundingMetadata: supported ? {
    groundingChunks: [{ retrievedContext: { uri: doc.fileSearchDocName, title: doc.title } }],
    groundingSupports: [{ groundingChunkIndices: [0] }],
  } : {} }] });
}
