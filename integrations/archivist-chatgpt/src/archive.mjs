import {
  ARCHIVIST_SOURCE_REGISTRY, ARCHIVIST_STORE, mapArchivistSources,
  queryArchivistCandidate, archivistReply,
} from '../../../lib/archivist-core.mjs';

export const LIMITATION = 'The available archive did not provide verifiable support for an answer to this question.';
export const registry = ARCHIVIST_SOURCE_REGISTRY.filter(doc => doc.retrievalEligible && doc.fileSearchDocName);

export class ToolError extends Error {
  constructor(code, message, retryable = false) {
    super(message); this.code = code; this.retryable = retryable;
  }
}

export const publicSource = doc => ({
  id: doc.slug, title: doc.title, url: doc.canonicalUrl,
  page_type: doc.pageType, publication_date: doc.publicationDate ?? null,
});

const citationInstruction = 'SOURCE IDENTITIES FOR THIS MCP ADAPTER:\n' +
  'Use the exact published source titles and page types in this catalogue. ' +
  'Only sources with page_type entry and an age-of-aimpires-entry-NN ID have an Entry number. ' +
  'Frameworks and guides have no Entry number. A numbered section such as 02 is not Entry #02. ' +
  'When citing a framework, use its title rather than inventing an Entry number. ' +
  'This catalogue identifies sources; their actual retrieved text remains the only evidence for claims.\n' +
  JSON.stringify(registry.map(publicSource));

// Generated prose must not introduce Entry numbers absent from its supported
// source list. This is an identity check, not a general entailment verifier.
export function entryReferencesSupported(answer, sources) {
  const supported = new Set(sources.filter(source => source.page_type === 'entry')
    .map(source => Number(/^age-of-aimpires-entry-(\d+)$/.exec(source.id)?.[1])));
  const mentions = answer.matchAll(/\bEntr(?:y|ies)\s*#?\d{1,3}(?:\s*(?:,|and|&)\s*#?\d{1,3})*/gi);
  for (const mention of mentions) {
    for (const number of mention[0].match(/\d+/g) ?? []) {
      if (!supported.has(Number(number))) return false;
    }
  }
  return true;
}

// Unlike source-card filtering, any invalid answer-referenced chunk rejects
// the complete answer. Unreferenced retrieval candidates are not evidence.
export function strictSources(grounding) {
  const chunks = grounding?.groundingChunks;
  const supports = grounding?.groundingSupports;
  if (!Array.isArray(chunks) || !chunks.length || !Array.isArray(supports) || !supports.length) return null;
  const seen = new Map();
  for (const support of supports) {
    if (!Array.isArray(support?.groundingChunkIndices) || !support.groundingChunkIndices.length) return null;
    for (const index of support.groundingChunkIndices) {
      if (!Number.isInteger(index) || index < 0 || index >= chunks.length) return null;
      const ctx = chunks[index]?.retrievedContext;
      if (!ctx || typeof ctx !== 'object' || Array.isArray(ctx)) return null;
      if (ctx.fileSearchStore !== undefined && ctx.fileSearchStore !== ARCHIVIST_STORE) return null;
      const mapped = mapArchivistSources({ groundingChunks: [chunks[index]], groundingSupports: [{ groundingChunkIndices: [0] }] });
      if (mapped.length !== 1) return null;
      const doc = registry.find(row => row.fileSearchDocName === mapped[0].fileSearchDocName);
      if (!doc) return null;
      seen.set(doc.canonicalUrl, publicSource(doc));
    }
  }
  return seen.size ? [...seen.values()] : null;
}

export async function queryArchive({ question }, options = {}) {
  if (typeof question !== 'string' || !question.trim() || question.length > 4000) {
    throw new ToolError('invalid_arguments', 'Supply a self-contained archive question of 1–4,000 characters.');
  }
  if (!options.apiKey) throw new ToolError('archive_unavailable', 'The archive is not configured in this environment.', false);
  try {
    const candidate = await queryArchivistCandidate({ query: question.trim(), history: [] }, options.apiKey,
      { ...options, systemInstructionSuffix: citationInstruction });
    const sources = strictSources(candidate?.groundingMetadata);
    const answer = archivistReply(candidate);
    if (!sources || !entryReferencesSupported(answer, sources)) return { status: 'no_supported_sources', content_origin: 'file_search', answer: LIMITATION, sources: [] };
    return { status: 'grounded', content_origin: 'file_search', answer, sources };
  } catch (error) {
    if (error instanceof ToolError) throw error;
    if (options.signal?.aborted || ['AbortError', 'TimeoutError'].includes(error?.name)) {
      throw new ToolError('archive_timeout', 'The archive took too long to respond. Please try again.', true);
    }
    throw new ToolError('archive_unavailable', 'The Archivist could not reach the archive. Please try again later.', true);
  }
}
