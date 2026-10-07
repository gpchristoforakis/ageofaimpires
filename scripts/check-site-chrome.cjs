const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '..');
const excluded = new Set(['.git', 'node_modules', 'dist', '.astro', '.wrangler',
  'assets', 'audio', 'media', 'components', 'docs', 'scripts']);
const profiles = [
  'https://www.instagram.com/ageofaimpires/',
  'https://www.linkedin.com/company/age-of-aimpires/',
  'https://x.com/ageofaimpires',
];

function findPages(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return excluded.has(entry.name) ? [] : findPages(file);
    return entry.isFile() && entry.name.endsWith('.html') ? [file] : [];
  });
}

const failures = [];
const pages = findPages(root);
for (const file of pages) {
  const html = fs.readFileSync(file, 'utf8');
  const header = html.match(/<header\b[^>]*>[\s\S]*?<\/header>/i)?.[0] || '';
  const footer = html.match(/<footer\b[^>]*>[\s\S]*?<\/footer>/i)?.[0] || '';
  const head = html.match(/<head\b[^>]*>[\s\S]*?<\/head>/i)?.[0] || '';
  const name = path.relative(root, file);
  const fail = message => failures.push(`${name}: ${message}`);
  for (const asset of ['site-theme.js', 'site-theme.css']) {
    const tags = [...head.matchAll(/<(?:script|link)\b[^>]*>/gi)];
    const tag = tags.find(match => match[0].includes(`/${asset}`))?.[0];
    const reference = tag?.match(/(?:src|href)="([^"]+)"/)?.[1];
    if (!reference) {
      fail(`missing shared ${asset} in the head`);
      continue;
    }
    const assetPath = reference.split(/[?#]/)[0];
    const local = path.resolve(assetPath.startsWith('/') ? root : path.dirname(file),
      assetPath.replace(/^\//, ''));
    if (!fs.existsSync(local)) fail(`shared asset does not exist: ${reference}`);
    else if (asset.endsWith('.css')) {
      const hash = crypto.createHash('sha256')
        .update(fs.readFileSync(local, 'utf8').replace(/\r\n/g, '\n'))
        .digest('hex').slice(0, 12);
      if (!reference.includes(`?v=${hash}`)) fail(`outdated stylesheet version: ${reference}`);
    }
    if (asset.endsWith('.js') && /\s(?:async|defer)(?:\s|=|>)/i.test(tag)) {
      fail('theme initialization must run before rendering');
    }
  }
  const toggle = header.match(/<button\b[^>]*\bdata-theme-toggle\b[^>]*>/i)?.[0];
  if (!toggle || !/aria-label="[^"]+"/.test(toggle) || !/aria-pressed="(?:true|false)"/.test(toggle)) {
    fail('missing accessible header theme toggle');
  }
  const social = footer.match(/<nav\b[^>]*class="[^"]*\baoai-social-links\b[^"]*"[^>]*>[\s\S]*?<\/nav>/i)?.[0];
  if (!social) {
    fail('missing social icons in the footer');
    continue;
  }
  const links = [...social.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/gi)].map(match => match[0]);
  if (links.length !== profiles.length) fail('the footer must include all three publication profiles');
  for (const profile of profiles) {
    const link = links.find(link => link.includes(`href="${profile}"`));
    if (!link || !/aria-label="[^"]+"/.test(link) || !/<svg\b/i.test(link)) {
      fail(`missing accessible icon: ${profile}`);
    }
    if (link?.includes('target="_blank"') && !/rel="[^"]*\bnoopener\b/.test(link)) {
      fail(`unsafe external link: ${profile}`);
    }
  }
}

if (!pages.length) failures.push('No site pages found.');
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Passed: shared theme assets, accessible toggle and three social icons on ${pages.length} pages.`);
}
