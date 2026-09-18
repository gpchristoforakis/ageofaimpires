import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const outputDir = path.resolve('public/og');
await mkdir(outputDir, { recursive: true });

const palette = {
  canvas: '#f5f0e8',
  paper: '#fffdf8',
  ink: '#2b2b2b',
  muted: '#6f6a62',
  gold: '#c9a46a',
  goldDeep: '#8a642e',
  red: '#b75d46',
  teal: '#4d8580',
  line: '#d9d0c2',
};

const frame = (content) => `
  <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
    <rect width="1200" height="630" fill="${palette.canvas}"/>
    <rect x="36" y="36" width="1128" height="558" rx="24" fill="none" stroke="${palette.line}" stroke-width="2"/>
    ${content}
  </svg>`;

const defaultCard = frame(`
  <text x="82" y="92" fill="${palette.ink}" font-family="Arial, sans-serif" font-size="20" font-weight="700" letter-spacing="4">AGE OF <tspan fill="${palette.goldDeep}">AI</tspan> EMPIRES</text>
  <text x="82" y="162" fill="${palette.goldDeep}" font-family="Arial, sans-serif" font-size="16" font-weight="700" letter-spacing="3">AI, WORK, MONEY, TIME &amp; ATTENTION</text>
  <text x="82" y="258" fill="${palette.ink}" font-family="Georgia, serif" font-size="72" letter-spacing="-2">
    <tspan x="82" dy="0">AI changes the cost</tspan>
    <tspan x="82" dy="80">of thinking.</tspan>
  </text>
  <text x="86" y="476" fill="${palette.muted}" font-family="Arial, sans-serif" font-size="25">Clear thinking about the price of a useful result.</text>
  <line x1="770" y1="212" x2="1084" y2="212" stroke="${palette.gold}" stroke-width="4"/>
  <circle cx="770" cy="212" r="13" fill="${palette.paper}" stroke="${palette.ink}" stroke-width="3"/>
  <circle cx="770" cy="212" r="5" fill="${palette.ink}"/>
  <circle cx="1084" cy="212" r="13" fill="${palette.paper}" stroke="${palette.teal}" stroke-width="3"/>
  <circle cx="1084" cy="212" r="5" fill="${palette.teal}"/>
  <path d="M850 212 C870 132 940 132 950 212" fill="none" stroke="${palette.red}" stroke-width="4"/>
  <path d="M930 212 C940 304 1018 315 1042 250" fill="none" stroke="${palette.red}" stroke-width="4"/>
  <path d="M986 430 L1060 330" fill="none" stroke="${palette.teal}" stroke-width="4"/>
  <circle cx="1060" cy="330" r="7" fill="${palette.teal}"/>
  <text x="82" y="552" fill="${palette.ink}" font-family="Arial, sans-serif" font-size="18" font-weight="700">ageofaimpires.com</text>
`);

const articleCard = frame(`
  <text x="82" y="92" fill="${palette.ink}" font-family="Arial, sans-serif" font-size="20" font-weight="700" letter-spacing="4">AGE OF <tspan fill="${palette.goldDeep}">AI</tspan> EMPIRES</text>
  <text x="82" y="164" fill="${palette.goldDeep}" font-family="Arial, sans-serif" font-size="17" font-weight="700" letter-spacing="3">PART I / THE LLM TASK-COST PARADOX</text>
  <text x="82" y="255" fill="${palette.ink}" font-family="Georgia, serif" font-size="64" letter-spacing="-2">
    <tspan x="82" dy="0">Why better AI can cost</tspan>
    <tspan x="82" dy="72">more</tspan><tspan dx="16" fill="${palette.red}">per task.</tspan>
  </text>
  <rect x="82" y="402" width="1036" height="92" rx="14" fill="${palette.paper}" stroke="${palette.ink}" stroke-width="2"/>
  <text x="118" y="458" fill="${palette.ink}" font-family="Georgia, serif" font-size="29">ETC = Direct Cost + Remediation Leakage + Expansion Leakage</text>
  <line x1="82" y1="530" x2="1118" y2="530" stroke="${palette.line}" stroke-width="2"/>
  <text x="82" y="566" fill="${palette.muted}" font-family="Arial, sans-serif" font-size="19">The completed task—not the token—is the useful unit of analysis.</text>
`);

for (const [name, svg] of [
  ['default.png', defaultCard],
  ['llm-task-cost-paradox.png', articleCard],
]) {
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(path.join(outputDir, name));
}

console.log('Generated two 1200×630 social cards in public/og/.');
