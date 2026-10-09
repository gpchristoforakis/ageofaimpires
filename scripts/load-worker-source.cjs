// Inline the local ESM core for the existing data-URL Worker test harnesses.
const fs = require('node:fs');
const path = require('node:path');
module.exports = root => {
  const core = fs.readFileSync(path.join(root, 'lib/archivist-core.mjs'), 'utf8')
    .replace(/^export \{[^}]+\};?\s*$/gm, '')
    .replace(/^export /gm, '');
  return fs.readFileSync(path.join(root, '_worker.js'), 'utf8')
    .replace(/^import \{[^}]+\} from "\.\/lib\/archivist-core\.mjs";\r?\n/m, core + '\n')
    .replace(/\r\n/g, '\n');
};
