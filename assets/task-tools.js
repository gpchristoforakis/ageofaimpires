(() => {
  // Share the existing How-To progress key and honour manual read/unread choices.
  const end = document.querySelector('[data-guide-read-end]');
  if (end && 'IntersectionObserver' in window) {
    let scrolled = false;
    let visible = false;
    const markRead = () => {
      if (!scrolled || !visible || document.visibilityState !== 'visible') return;
      try {
        const key = 'ageofaimpires:how-to-progress:v1';
        const saved = JSON.parse(window.localStorage.getItem(key) || '{}');
        const progress = saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
        const id = end.dataset.guideReadEnd;
        if (progress[id]?.manual !== true) {
          progress[id] = {read: true, manual: false};
          window.localStorage.setItem(key, JSON.stringify(progress));
        }
      } catch {
        // Reading the guide still works when storage is unavailable.
      }
      observer.disconnect();
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('visibilitychange', markRead);
    };
    const onScroll = () => { scrolled ||= window.scrollY > 0; markRead(); };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      markRead();
    }, {threshold: 1, rootMargin: '-100px 0px 0px 0px'});
    observer.observe(end);
    window.addEventListener('scroll', onScroll, {passive: true});
    document.addEventListener('visibilitychange', markRead);
  }

  document.querySelectorAll('[data-task-copy]').forEach(button => {
    button.addEventListener('click', async () => {
      const source = document.getElementById(button.dataset.taskCopy);
      const status = button.parentElement.querySelector('[data-task-copy-status]');
      if (!source) return;
      try {
        await navigator.clipboard.writeText(source.textContent.trim());
        if (status) status.textContent = 'Copied. Paste the same text into both assistants.';
      } catch {
        if (status) status.textContent = 'Select the text above and copy it.';
      }
    });
  });

  const calculator = document.querySelector('[data-time-calculator]');
  if (!calculator) return;
  const input = id => calculator.querySelector('#' + id);
  const fields = ['hourlyRate', 'taskMinutes', 'expansionMinutes'].map(input);
  const error = calculator.querySelector('[data-time-error]');
  const read = field => {
    const value = Number.parseFloat(field.value);
    return Number.isFinite(value) ? Math.max(0, value) : 0;
  };
  const currency = new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' });
  function calculate() {
    const [rate, taskMinutes, expansionMinutes] = fields.map(read);
    const taskCost = rate * taskMinutes / 60;
    const expansionCost = rate * expansionMinutes / 60;
    const valid = fields.every(field => field.validity.valid) && Number.isFinite(taskCost + expansionCost) && Number.isFinite(taskMinutes + expansionMinutes);
    error.textContent = valid ? '' : 'Enter finite, non-negative numbers. Clear an input to count it as zero.';
    fields.forEach(field => field.setAttribute('aria-invalid', String(!field.validity.valid)));
    const values = {
      taskTotal: currency.format(taskCost),
      expansionTotal: currency.format(expansionCost),
      totalTime: (taskMinutes + expansionMinutes).toLocaleString('en-GB', { maximumFractionDigits: 10 }) + (taskMinutes + expansionMinutes === 1 ? ' minute' : ' minutes'),
      totalCost: currency.format(taskCost + expansionCost),
    };
    Object.entries(values).forEach(([id, value]) => input(id).textContent = valid ? value : '—');
  }
  fields.forEach(field => field.addEventListener('input', calculate));
  calculate();
})();
