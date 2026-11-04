(() => {
  const section = document.querySelector('[data-comments]');
  if (!section) return;
  const page = section.dataset.comments;
  const list = section.querySelector('[data-comments-list]');
  const loadStatus = section.querySelector('[data-comments-load-status]');
  const more = section.querySelector('[data-comments-more]');
  const form = section.querySelector('form');
  const submit = form.querySelector('[type=submit]');
  const status = form.querySelector('[data-comment-status]');
  let next = 0, loading = false, sending = false, requestId = null, refreshAfterLoad = false;
  async function load() {
    if (loading) return;
    loading = true;
    more.disabled = true;
    list.setAttribute('aria-busy', 'true');
    loadStatus.textContent = 'Loading comments…';
    try {
      const response = await fetch('/api/comments?page=' + encodeURIComponent(page) + '&after=' + next, {signal: AbortSignal.timeout(12000)});
      const data = await response.json();
      if (!response.ok || !Array.isArray(data.comments)) throw new Error();
      for (const comment of data.comments) {
        const item = document.createElement('li');
        const name = document.createElement('strong');
        name.textContent = comment.name;
        const time = document.createElement('time');
        const date = new Date(comment.created_at);
        time.dateTime = date.toISOString();
        time.textContent = date.toLocaleDateString(undefined, {year: 'numeric', month: 'short', day: 'numeric'});
        const text = document.createElement('p');
        text.textContent = comment.comment;
        item.append(name, time, text);
        list.append(item);
      }
      next = data.next;
      more.hidden = next === null;
      more.textContent = 'Load More Comments';
      loadStatus.textContent = list.children.length ? '' : 'No published comments yet. Add yours below.';
    } catch {
      loadStatus.textContent = 'Comments could not be loaded. Please try again.';
      more.textContent = 'Retry Loading Comments';
      more.hidden = false;
    } finally {
      loading = false;
      more.disabled = false;
      list.removeAttribute('aria-busy');
      if (refreshAfterLoad) { refreshAfterLoad = false; refresh(); }
    }
  }
  function refresh() {
    if (loading) { refreshAfterLoad = true; return; }
    list.replaceChildren();
    next = 0;
    return load();
  }
  more.addEventListener('click', load);
  form.addEventListener('input', () => { if (!sending) requestId = null; });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (sending || !form.reportValidity()) return;
    const fields = new FormData(form);
    const name = String(fields.get('name') || '').trim();
    const comment = String(fields.get('comment') || '').trim();
    if (!name || !comment) { status.textContent = 'Enter a name and a comment.'; return; }
    requestId ||= crypto.randomUUID();
    sending = true;
    submit.disabled = true;
    form.querySelectorAll('input, textarea').forEach(field => { field.disabled = true; });
    form.setAttribute('aria-busy', 'true');
    submit.textContent = 'Submitting…';
    status.textContent = '';
    try {
      const response = await fetch('/api/comments', {
        method: 'POST', headers: {'Content-Type': 'application/json'}, signal: AbortSignal.timeout(12000),
        body: JSON.stringify({page, name, comment, consent: fields.get('consent') === 'on', website: fields.get('website'), requestId}),
      });
      const data = await response.json();
      if (!response.ok || data.ok !== true) {
        status.textContent = response.status === 429 ? 'The daily comment limit has been reached. Please try again tomorrow.' : 'Your comment could not be submitted. Your text is still here; please try again.';
        return;
      }
      form.reset();
      requestId = null;
      status.textContent = 'Thank you. Your comment is now published.';
      await refresh();
    } catch {
      status.textContent = 'We could not confirm submission. Your text is still here; retrying will not duplicate the same submission.';
    } finally {
      sending = false;
      submit.disabled = false;
      form.querySelectorAll('input, textarea').forEach(field => { field.disabled = false; });
      submit.textContent = 'Post Comment';
      form.removeAttribute('aria-busy');
    }
  });
  load();
})();
