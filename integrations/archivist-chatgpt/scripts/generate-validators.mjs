import { writeFile, mkdir } from 'node:fs/promises';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import standaloneCode from 'ajv/dist/standalone/index.js';
import contracts from '../../../docs/archivist-chatgpt-contracts.json' with { type: 'json' };
const ajv = new Ajv2020({ allErrors: true, strict: true, code: { source: true } }); addFormats(ajv);
const names = {};
for (const tool of contracts.tools) {
  for (const [suffix, schema] of [['Input', tool.inputSchema], ['Output', tool.outputSchema]]) {
    const id = tool.name + suffix; ajv.addSchema({ ...schema, $id: id }); names[id] = id;
  }
}
await mkdir(new URL('../src/', import.meta.url), { recursive: true });
await writeFile(new URL('../src/validators.cjs', import.meta.url), '// Generated from docs/archivist-chatgpt-contracts.json. Regenerate with npm run generate.\n' + standaloneCode(ajv, names));
console.log('Generated standalone validators; runtime compilation is unnecessary.');
