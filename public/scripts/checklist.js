const checks = [...document.querySelectorAll('.guide-step input[type="checkbox"]')];
const sections = [...document.querySelectorAll('.guide-section')];
const storageKey = 'aoaie-checklist-v1';
const progress = document.getElementById('guide-progress');
const expandButton = document.getElementById('expand-guide');
const announcement = document.getElementById('progress-announcement');
let storageAvailable = true;

function storageFallback() {
  storageAvailable = false;
  document.getElementById('save-note').textContent = 'Progress lasts for this page visit. Browser storage is unavailable.';
}
try {
  const saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
  if (Array.isArray(saved)) checks.forEach(check => { check.checked = saved.includes(check.id); });
  localStorage.setItem(storageKey, JSON.stringify(checks.filter(check => check.checked).map(check => check.id)));
} catch { storageFallback(); }

function updateProgress(announce = false) {
  const completed = checks.filter(check => check.checked);
  document.getElementById('done-count').textContent = completed.length;
  progress.value = completed.length;
  progress.textContent = `${completed.length} of ${checks.length}`;
  sections.forEach(section => {
    const items = [...section.querySelectorAll('input[type="checkbox"]')];
    section.querySelector('.section-count').textContent = `${items.filter(check => check.checked).length} / ${items.length}`;
  });
  document.getElementById('progress-note').textContent = completed.length === checks.length
    ? 'All 24 steps reviewed. Take the next real job from here.'
    : 'Tick a step when you’ve tried it or made the decision.';
  if (announce) announcement.textContent = `${completed.length} of ${checks.length} steps complete.`;
}
function persistProgress() {
  if (!storageAvailable) return;
  try { localStorage.setItem(storageKey, JSON.stringify(checks.filter(check => check.checked).map(check => check.id))); }
  catch { storageFallback(); }
}
checks.forEach(check => check.addEventListener('change', () => { updateProgress(true); persistProgress(); }));
document.getElementById('reset-guide').addEventListener('click', () => {
  checks.forEach(check => { check.checked = false; });
  updateProgress(true);
  persistProgress();
});
function updateExpandLabel() {
  expandButton.textContent = sections.every(section => section.open) ? 'Close all sections' : 'Open all sections';
}
expandButton.addEventListener('click', () => {
  const open = !sections.every(section => section.open);
  sections.forEach(section => { section.open = open; });
  updateExpandLabel();
});
sections.forEach(section => section.addEventListener('toggle', updateExpandLabel));
function openLinkedSection() {
  const section = sections.find(item => `#${item.id}` === location.hash);
  if (section) { section.open = true; section.scrollIntoView({ block: 'start' }); }
}
document.querySelectorAll('.guide-nav a').forEach(link => link.addEventListener('click', () => {
  const section = sections.find(item => `#${item.id}` === link.hash);
  if (section) section.open = true;
}));
window.addEventListener('hashchange', openLinkedSection);
document.querySelectorAll('.copy-prompt').forEach(button => button.addEventListener('click', async () => {
  const status = button.parentElement.querySelector('.copy-status');
  try {
    await navigator.clipboard.writeText(button.parentElement.querySelector('blockquote').textContent.trim());
    status.textContent = 'Copied.';
  } catch { status.textContent = 'Select the text above to copy it.'; }
}));
let printState;
window.addEventListener('beforeprint', () => {
  printState = sections.map(section => section.open);
  sections.forEach(section => { section.open = true; });
});
window.addEventListener('afterprint', () => {
  if (printState) sections.forEach((section, index) => { section.open = printState[index]; });
  printState = undefined;
  updateExpandLabel();
});
document.getElementById('print-guide').addEventListener('click', () => window.print());
updateProgress();
updateExpandLabel();
openLinkedSection();
