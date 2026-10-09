import { parseDocument } from 'htmlparser2';
import { registry, publicSource, ToolError } from './archive.mjs';

const normalizeText = text => text.replace(/\s+/g, ' ').trim();
const eligibleUrl = value => registry.some(doc => doc.canonicalUrl === value);

function stripInlineMedia(html) {
  const startPattern = /\b(src|poster)\s*=\s*(["'])data:/gi;
  const parts = [];
  let offset = 0;
  for (let match; (match = startPattern.exec(html));) {
    // A native substring search avoids regex backtracking over megabytes of
    // base64. Skip the payload altogether before looking for the next attribute.
    const end = html.indexOf(match[2], startPattern.lastIndex);
    if (end === -1) continue;
    parts.push(html.slice(offset, match.index), match[1] + '=""');
    offset = end + 1;
    startPattern.lastIndex = offset;
  }
  return parts.length ? parts.join('') + html.slice(offset) : html;
}

export async function boundedText(response, limit, signal) {
  if (Number(response.headers.get('content-length')) > limit) { await response.body?.cancel(); throw new ToolError('entry_too_large', 'The published entry exceeds the response limit.'); }
  if (!response.body) return '';
  const reader = response.body.getReader();
  const abort = () => { void reader.cancel().catch(() => {}); };
  signal?.addEventListener('abort', abort, { once: true });
  const buffers = []; let size = 0;
  try {
    while (true) {
      signal?.throwIfAborted();
      const { done, value } = await reader.read();
      signal?.throwIfAborted();
      if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); throw new ToolError('entry_too_large', 'The published entry exceeds the response limit.'); }
      buffers.push(value);
    }
  } finally { signal?.removeEventListener('abort', abort); reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const part of buffers) { bytes.set(part, offset); offset += part.byteLength; }
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

const excludedTags = new Set(['script','style','noscript','nav','footer','form','button','iframe','audio','video']);
const excludedClasses = new Set(['share-row','share-status','mini-player','audio-transcript','comment-box','comment-form','cookie-banner','back-to-top','entry-footer','next-link','aoai-studio-footer','sr-only','site-header','aoai-header']);
const blockTags = new Set(['blockquote','ul','ol','pre','table','figcaption','math']);
const blockClasses = new Set(['formula','equation','deck','source-formula','etc-marginalia-formula']);
const targetTags = new Set(['h1','h2','h3','h4','h5','h6','p','blockquote','ul','ol','pre','table','figcaption','math']);
const heading = node => /^h[1-6]$/.test(node.name ?? '');
const classes = node => (node.attribs?.class ?? '').split(/\s+/);
const hasBlockClass = node => classes(node).some(value => blockClasses.has(value));
const isBlock = node => blockTags.has(node.name) || hasBlockClass(node);

export function extractEntry(html, doc) {
  html = stripInlineMedia(html).replace(/<(script|style|noscript)(?=[\s>])[^>]*>[\s\S]*?<\/\1\s*>/gi, '');
  // Cheerio used this same HTML parser. Walk its DOM once instead of repeatedly
  // running CSS selectors, cloning list subtrees and walking every ancestor.
  const document = parseDocument(html, { decodeEntities: true });
  let canonicalLink, openGraphUrl, foundCanonical = false, foundOpenGraph = false;
  const inspect = node => {
    const attrs = node.attribs ?? {};
    if (node.name === 'link' && attrs.rel?.toLowerCase() === 'canonical' && !foundCanonical) { canonicalLink = attrs.href; foundCanonical = true; }
    if (node.name === 'meta' && attrs.property === 'og:url' && !foundOpenGraph) { openGraphUrl = attrs.content; foundOpenGraph = true; }
    for (const child of node.children ?? []) inspect(child);
  };
  inspect(document);
  const canonical = canonicalLink || openGraphUrl;
  if (canonical && new URL(canonical, doc.canonicalUrl).href !== doc.canonicalUrl) {
    throw new ToolError('entry_identity_mismatch', 'The page identity does not match the published entry.');
  }
  let main, article;
  const clean = node => {
    node.children = (node.children ?? []).filter(child => {
      const attrs = child.attribs ?? {};
      return !excludedTags.has(child.name) && !(child.name === 'header' && node.name === 'body') &&
        !classes(child).some(value => excludedClasses.has(value)) &&
        !Object.hasOwn(attrs, 'data-transcript') && !Object.hasOwn(attrs, 'data-comment-form');
    });
    for (const child of node.children) {
      if (child.name === 'main' && !main) main = child;
      if (child.name === 'article' && !article) article = child;
      if (child.children) clean(child);
    }
  };
  clean(document);
  const container = main ?? article;
  if (!container) throw new ToolError('entry_unavailable', 'The published page has no recognizable editorial content.');
  const textCache = new WeakMap();
  const textOf = node => {
    if (textCache.has(node)) return textCache.get(node);
    const text = node.type === 'text' ? node.data : node.name === 'br' ? '\n' : (node.children ?? []).map(textOf).join('');
    textCache.set(node, text);
    return text;
  };
  const sections = [], lines = [];
  const renderList = (list, indent = '') => {
    const items = list.children.filter(child => child.name === 'li');
    items.forEach((item, index) => {
      const ownText = item.children.filter(child => child.name !== 'ul' && child.name !== 'ol').map(textOf).join('');
      lines.push(indent + (list.name === 'ol' ? (index + 1) + '. ' : '- ') + normalizeText(ownText));
      item.children.filter(child => child.name === 'ul' || child.name === 'ol').forEach(nested => renderList(nested, indent + '  '));
    });
  };
  const renderTable = table => {
    const caption = normalizeText(table.children.filter(child => child.name === 'caption').map(textOf).join(''));
    if (caption) lines.push(caption);
    const rows = node => {
      for (const child of node.children ?? []) {
        if (child.name === 'tr') lines.push(child.children.filter(cell => cell.name === 'th' || cell.name === 'td').map(cell => normalizeText(textOf(cell))).join(' | '));
        rows(child);
      }
    };
    rows(table);
  };
  const visit = (node, blocked) => {
    if (heading(node)) {
      const title = normalizeText(textOf(node));
      let anchor = node.attribs?.id;
      if (!anchor) {
        for (let parent = node.parent; parent; parent = parent.parent) {
          if ((parent.name === 'section' || parent.name === 'div') && Object.hasOwn(parent.attribs ?? {}, 'id')) { anchor = parent.attribs.id; break; }
        }
      }
      if (title) sections.push({ heading: title, anchor: anchor || null });
    }
    if (!blocked && (targetTags.has(node.name) || hasBlockClass(node) || classes(node).includes('section-number'))) {
      const text = normalizeText(textOf(node));
      if (text) {
        if (heading(node)) lines.push('#'.repeat(Number(node.name[1])) + ' ' + text);
        else if (node.name === 'pre') lines.push('\x60\x60\x60\n' + textOf(node).trim() + '\n\x60\x60\x60');
        else if (node.name === 'blockquote') lines.push('> ' + text);
        else if (node.name === 'ul' || node.name === 'ol') renderList(node);
        else if (node.name === 'table') renderTable(node);
        else lines.push(text);
        lines.push('');
      }
    }
    const descendantsBlocked = blocked || isBlock(node);
    for (const child of node.children ?? []) visit(child, descendantsBlocked);
  };
  let blocked = false;
  for (let parent = container; parent; parent = parent.parent) blocked ||= isBlock(parent);
  for (const child of container.children) visit(child, blocked);
  const text = lines.join('\n').trim();
  if (!text) throw new ToolError('entry_unavailable', 'The published entry has no readable editorial text.');
  if (text.length > 60000 || sections.length > 500 || sections.some(section => section.heading.length > 1000 || (section.anchor?.length ?? 0) > 500)) {
    throw new ToolError('entry_too_large', 'The published entry exceeds the response limit.');
  }
  return { status: 'ok', content_origin: 'live_site', source: publicSource(doc), text, sections };
}

export async function fetchEntry({ id }, options = {}) {
  const doc = registry.find(row => row.slug === id);
  if (!doc) throw new ToolError('entry_not_found', 'That entry is not available in the public archive.');
  const deadline = AbortSignal.timeout(options.entryTimeoutMs ?? 20000);
  const signal = options.signal ? AbortSignal.any([options.signal, deadline]) : deadline;
  const fetchImpl = options.entryFetchImpl ?? options.fetchImpl ?? globalThis.fetch;
  try {
    let target = doc.canonicalUrl;
    for (let redirects = 0; redirects <= 3; redirects++) {
      signal.throwIfAborted();
      if (!eligibleUrl(target)) throw new ToolError('entry_identity_mismatch', 'The page redirected outside the approved archive.');
      const response = await fetchImpl(target, { redirect: 'manual', signal, headers: { Accept: 'text/html,application/xhtml+xml', 'User-Agent': 'TheArchivist-MCP/0.1 (+https://ageofaimpires.com)' } });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        await response.body?.cancel();
        if (!location || redirects === 3) throw new ToolError('entry_identity_mismatch', 'The published entry has an invalid redirect.');
        target = new URL(location, target).href;
        continue;
      }
      if ([404, 410].includes(response.status)) { await response.body?.cancel(); throw new ToolError('entry_not_found', 'That entry is not available in the public archive.'); }
      if (!response.ok || !/^(text\/html|application\/xhtml\+xml)(?:;|$)/i.test(response.headers.get('content-type') || '')) {
        await response.body?.cancel(); throw new ToolError('entry_unavailable', 'The published entry could not be read.', true);
      }
      if (target !== doc.canonicalUrl) { await response.body?.cancel(); throw new ToolError('entry_identity_mismatch', 'The page identity does not match the published entry.'); }
      return extractEntry(await boundedText(response, 4 * 1024 * 1024, signal), doc);
    }
  } catch (error) {
    if (error instanceof ToolError) throw error;
    throw new ToolError('entry_unavailable', 'The published entry could not be read. Please try again later.', true);
  }
}
