(() => {
  const key = 'ageofaimpires:theme:v1';
  const root = document.documentElement;
  const system = window.matchMedia('(prefers-color-scheme: dark)');
  const valid = value => value === 'light' || value === 'dark';
  let preference = null;

  function readPreference() {
    try {
      const saved = window.localStorage.getItem(key);
      preference = valid(saved) ? saved : null;
    } catch {
      // Keep the current choice when browser storage is unavailable.
    }
  }

  function applyTheme() {
    const theme = preference || (system.matches ? 'dark' : 'light');
    root.dataset.theme = theme;
    document.querySelectorAll('[data-theme-toggle]').forEach(button => {
      button.hidden = false;
      button.setAttribute('aria-pressed', String(theme === 'dark'));
      button.title = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
    });
  }

  readPreference();
  applyTheme();

  function connectControls() {
    document.querySelectorAll('[data-theme-toggle]').forEach(button => {
      button.addEventListener('click', () => {
        preference = root.dataset.theme === 'dark' ? 'light' : 'dark';
        try {
          window.localStorage.setItem(key, preference);
        } catch {
          // Switching still works for this page without persistent storage.
        }
        applyTheme();
      });
    });
    applyTheme();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', connectControls, { once: true });
  } else {
    connectControls();
  }

  system.addEventListener('change', () => {
    if (!preference) applyTheme();
  });
  window.addEventListener('storage', event => {
    if (event.key !== key && event.key !== null) return;
    preference = valid(event.newValue) ? event.newValue : null;
    applyTheme();
  });
  window.addEventListener('pageshow', () => {
    readPreference();
    applyTheme();
  });
})();
