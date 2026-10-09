import { build } from 'esbuild';
import { mkdir, copyFile, writeFile, readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = new URL('../', import.meta.url);
await mkdir(new URL('dist/', root), { recursive: true });
const inputs = new Set();
for (const [entry, output] of [['src/main.mjs', 'archivist-server.mjs'], ['scripts/smoke.mjs', 'archivist-smoke.mjs']]) {
  const result = await build({ entryPoints: [fileURLToPath(new URL(entry, root))], outfile: fileURLToPath(new URL('dist/' + output, root)), bundle: true, platform: 'node', format: 'esm', target: 'node24', metafile: true,
    banner: { js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);" },
  });
  for (const input of Object.keys(result.metafile.inputs)) inputs.add(input.replaceAll('\\', '/'));
}
await copyFile(new URL('README.md', root), new URL('dist/README.md', root));
await copyFile(new URL('scripts/diagnose.mjs', root), new URL('dist/archivist-diagnose.mjs', root));
await writeFile(new URL('dist/Start-Demo.ps1', root), 'Set-Location -LiteralPath $PSScriptRoot\nnode ./archivist-server.mjs --demo\n');
await writeFile(new URL('dist/Start-Live.ps1', root), 'Set-Location -LiteralPath $PSScriptRoot\nnode ./archivist-server.mjs\n');
const notices = [];
await mkdir(new URL('dist/THIRD-PARTY-LICENSES/', root), { recursive: true });
const packages = new Set();
for (const input of inputs) {
  const matches = [...input.matchAll(/(?:^|\/)node_modules\/((?:@[^/]+\/)?[^/]+)/g)];
  const match = matches.at(-1);
  if (match) packages.add(input.slice(0, match.index) + (match[0].startsWith('/') ? '/' : '') + 'node_modules/' + match[1]);
}
for (const directory of [...packages].sort()) {
  const absolute = path.resolve(fileURLToPath(root), directory);
  const metadata = JSON.parse(await readFile(path.join(absolute, 'package.json'), 'utf8'));
  notices.push(`${metadata.name} ${metadata.version}: ${metadata.license ?? 'See included licence'}`);
  const destination = new URL('dist/THIRD-PARTY-LICENSES/' + metadata.name.replaceAll('/', '-') + '/', root);
  await mkdir(destination, { recursive: true });
  const files = (await readdir(absolute)).filter(name => /^(licen[sc]e|copying|notice)/i.test(name));
  for (const name of files) await copyFile(path.join(absolute, name), new URL(name, destination));
}
await writeFile(new URL('dist/THIRD-PARTY-NOTICES.txt', root), notices.join('\n') + '\n');
await copyFile(new URL('artifacts/demo-smoke.json', root), new URL('dist/sample-results.json', root));
console.log('Built standalone Node server in dist/.');
