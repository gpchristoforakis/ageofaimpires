(() => {
  const trigger = document.querySelector('[data-entry-subscribe]');
  const dialog = document.querySelector('#entry-subscribe-dialog');
  if (!trigger || !dialog) return;

  const form = dialog.querySelector('form');
  const submit = form.querySelector('[type="submit"]');
  const status = dialog.querySelector('[data-subscribe-status]');
  const success = dialog.querySelector('[data-subscribe-success]');
  const title = dialog.querySelector('#entry-subscribe-title');
  const nameInput = form.elements.name;
  const emailInput = form.elements.email;
  const errorMessages = {
    name_required: ['Name required', 'Enter a name to continue.'],
    email_required: ['Email required', 'Enter an email address to continue.'],
    invalid_email: ['Invalid email', 'Check the email address and try again.'],
    signup_failed: ['Something went wrong', 'The signup could not be completed. Please try again.'],
  };
  function showMessage(target, code) {
    const [heading, message] = errorMessages[code] || errorMessages.signup_failed;
    const strong = document.createElement('strong');
    strong.textContent = heading;
    target.replaceChildren(strong, document.createTextNode(message));
  }
  function clearField(input) {
    input.removeAttribute('aria-invalid');
    dialog.querySelector(`#${input.id}-error`).textContent = '';
  }
  function fieldError(input, code) {
    input.setAttribute('aria-invalid', 'true');
    showMessage(dialog.querySelector(`#${input.id}-error`), code);
  }
  let pending = false;

  trigger.addEventListener('click', () => dialog.showModal());
  dialog.querySelector('[data-subscribe-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right ||
        event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  });
  dialog.addEventListener('close', () => trigger.focus({ preventScroll: true }));
  dialog.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') return;
    const controls = [...dialog.querySelectorAll('button, input, a[href], [tabindex="0"]')]
      .filter(control => !control.disabled && control.tabIndex >= 0 && control.getClientRects().length);
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (!first) return;
    if (!controls.includes(document.activeElement) ||
        (event.shiftKey && document.activeElement === first) ||
        (!event.shiftKey && document.activeElement === last)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    }
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (pending) return;
    clearField(nameInput);
    clearField(emailInput);
    status.textContent = '';
    const data = new FormData(form);
    const name = String(data.get('name') || '').trim();
    const email = String(data.get('email') || '').trim();
    emailInput.value = email;
    if (!name) fieldError(nameInput, 'name_required');
    if (!email) fieldError(emailInput, 'email_required');
    else if (!emailInput.validity.valid || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      fieldError(emailInput, 'invalid_email');
    }
    const invalid = form.querySelector('[aria-invalid="true"]');
    if (invalid) {
      invalid.focus();
      return;
    }
    pending = true;
    submit.disabled = true;
    submit.textContent = 'Submitting…';
    form.setAttribute('aria-busy', 'true');
    status.removeAttribute('data-error');
    status.textContent = '';
    try {
      const response = await fetch(form.action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email,
          website: String(data.get('website') || '') }),
        signal: AbortSignal.timeout(15000),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || result?.ok !== true) {
        if (result?.code === 'name_required') {
          fieldError(nameInput, result.code);
          nameInput.focus();
          return;
        }
        if (['email_required', 'invalid_email'].includes(result?.code)) {
          fieldError(emailInput, result.code);
          emailInput.focus();
          return;
        }
        throw new Error('signup_failed');
      }
      form.reset();
      form.hidden = true;
      title.hidden = true;
      success.hidden = false;
      dialog.setAttribute('aria-labelledby', 'entry-subscribe-success-title');
      success.querySelector('h2').id = 'entry-subscribe-success-title';
      success.focus();
    } catch {
      status.setAttribute('data-error', '');
      showMessage(status, 'signup_failed');
    } finally {
      pending = false;
      submit.disabled = false;
      submit.textContent = 'Notify Me';
      form.removeAttribute('aria-busy');
    }
  });
  for (const input of [nameInput, emailInput]) {
    input.addEventListener('input', () => clearField(input));
  }
})();
