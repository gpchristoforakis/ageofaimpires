const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const pages = ['framework-ai-tasks.html', 'compare-assistants-on-one-task.html', 'time-cost-calculator.html'];
const connected = [...pages, 'frameworks.html', 'how-to.html', 'framework-effective-task-cost.html', 'age-of-aimpires-entry-01.html', 'age-of-aimpires-entry-02.html', 'age-of-aimpires-entry-03.html'];
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
let checked = 0;
for (const p of connected) {
  const html = read(p);
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(x => x[1]);
  assert.equal(ids.length, new Set(ids).size, p + ': duplicate ids');
  for (const m of html.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
    const ref = m[1];
    if (/^(https?:|mailto:|tel:|data:)/.test(ref) || ref === '#') continue;
    const [pathname, fragment] = ref.split('#');
    const dest = pathname ? path.join(root, pathname.split('?')[0].replace(/^\//, '')) : path.join(root, p);
    assert.ok(fs.existsSync(dest), p + ': missing ' + ref);
    if (fragment && dest.endsWith('.html')) assert.ok(read(path.relative(root, dest)).includes('id="' + fragment + '"'), p + ': anchor ' + ref);
    checked++;
  }
}
for (const p of pages) {
  const html = read(p);
  const url = 'https://ageofaimpires.com/' + p.replace('.html', '');
  assert.ok(html.includes('<link rel="canonical" href="' + url + '">'), p + ': canonical');
  assert.ok(read('sitemap.xml').includes('<loc>' + url + '</loc>'), p + ': sitemap');
  assert.ok(html.includes('assets/og-default.png'), p + ': social preview');
  assert.equal((html.match(/<h1\b/g) || []).length, 1, p + ': h1');
  assert.ok(html.includes('>Guides</a>'), p + ': current Guides nav');
  for (const asset of ['assets/task-framework.css', 'assets/task-tools.js']) {
    const hash = crypto.createHash('sha256').update(read(asset).replace(/\r\n/g, '\n')).digest('hex').slice(0, 12);
    assert.ok(html.includes(asset + '?v=' + hash), p + ': stale asset reference ' + asset);
  }
}
const guide = read('compare-assistants-on-one-task.html');
const framework = read('framework-ai-tasks.html');
assert.ok(guide.includes('data-guide-read-end="guide-16"'));
assert.ok(read('how-to.html').includes('data-guide-id="guide-16" data-guide-available="true"'));
for (const phrase of ['Mary: Send the revised budget by Thursday.', 'No owner or deadline was agreed for the FAQ.', '<td>Tom</td><td>Friday</td>']) {
  assert.ok(guide.includes(phrase) && framework.includes(phrase), 'Shared scenario: ' + phrase);
}
const calc = read('time-cost-calculator.html');
assert.equal((calc.match(/<input\b/g) || []).length, 3);
assert.equal((calc.match(/<output\b/g) || []).length, 4);
assert.ok(calc.indexOf('AI usage fees are not included.') < calc.indexOf('class="task-results"'));
const elements = {};
for (const id of ['hourlyRate', 'taskMinutes', 'expansionMinutes', 'taskTotal', 'expansionTotal', 'totalTime', 'totalCost']) {
  const match = calc.match(new RegExp('<input[^>]*id="' + id + '"[^>]*value="([^"]*)"'));
  elements[id] = {value: match ? match[1] : '', textContent: '', validity: {valid: true}, addEventListener(_, fn) {this.handler = fn;}, setAttribute() {}};
}
const error = {textContent: ''};
const dom = {querySelector: s => s === '[data-time-error]' ? error : elements[s.slice(1)]};
vm.runInNewContext(read('assets/task-tools.js'), {document: {querySelectorAll: () => [], querySelector: s => s === '[data-time-calculator]' ? dom : null}, window: {}, Intl});
const result = () => ['taskTotal', 'expansionTotal', 'totalTime', 'totalCost'].map(x => elements[x].textContent);
assert.deepEqual(result(), ['€25.00', '€43.75', '55 minutes', '€68.75']);
function check(inputs, expected, valid = true) {
  ['hourlyRate', 'taskMinutes', 'expansionMinutes'].forEach((id, i) => {elements[id].value = inputs[i]; elements[id].validity.valid = valid;});
  elements.taskMinutes.handler();
  assert.deepEqual(result(), expected);
}
check(['100','30','60'], ['€50.00','€100.00','90 minutes','€150.00']);
check(['0','20','35'], ['€0.00','€0.00','55 minutes','€0.00']);
check(['','',''], ['€0.00','€0.00','0 minutes','€0.00']);
check(['75','0.5','0.5'], ['€0.63','€0.63','1 minute','€1.25']);
check(['-75','-20','-35'], ['—','—','—','—'], false);
assert.ok(error.textContent.includes('non-negative'));
console.log('Passed: ' + connected.length + ' pages, ' + checked + ' local links/assets, metadata, task examples and calculator cases.');
