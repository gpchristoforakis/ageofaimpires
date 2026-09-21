const minutes = document.getElementById('minutes');
const hourly = document.getElementById('hourly');
const minutesValue = document.getElementById('minutes-value');
const hourlyValue = document.getElementById('hourly-value');
const timeValue = document.getElementById('time-value');
const calculationDetail = document.getElementById('calculation-detail');
const announcement = document.getElementById('calculator-announcement');
const formatter = new Intl.NumberFormat('en-IE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function updateCalculator(announce = false) {
  const duration = Number(minutes.value);
  const rate = Number(hourly.value);
  const value = duration / 60 * rate;
  const [whole, fraction] = formatter.format(value).split('.');
  minutesValue.innerHTML = `${duration} <span>min</span>`;
  hourlyValue.innerHTML = `€${rate} <span>/ hour</span>`;
  timeValue.innerHTML = `€${whole}<span>.${fraction}</span>`;
  calculationDetail.textContent = `${duration} ${duration === 1 ? 'minute' : 'minutes'} at €${rate} an hour.`;
  minutes.setAttribute('aria-valuetext', `${duration} minutes`);
  hourly.setAttribute('aria-valuetext', `${rate} euros per hour`);
  for (const input of [minutes, hourly]) {
    const fill = (Number(input.value) - Number(input.min)) / (Number(input.max) - Number(input.min)) * 100;
    input.style.setProperty('--fill', `${fill}%`);
  }
  if (announce) announcement.textContent = `What that time was worth: €${formatter.format(value)}. ${calculationDetail.textContent}`;
}

for (const input of [minutes, hourly]) {
  input.addEventListener('input', () => updateCalculator());
  input.addEventListener('change', () => updateCalculator(true));
}
updateCalculator();

const form = document.getElementById('signup-form');
const email = document.getElementById('email');
const signupStatus = document.getElementById('signup-status');
const submitButton = form.querySelector('button[type="submit"]');

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  signupStatus.hidden = false;
  if (!form.reportValidity()) {
    signupStatus.textContent = 'Enter a valid email address.';
    return;
  }

  submitButton.disabled = true;
  signupStatus.textContent = 'Sending your secure access link…';
  try {
    const response = await fetch('/api/checklist-signup', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ email: email.value, company: form.elements.company.value }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'We could not send the link. Please try again.');
    form.reset();
    signupStatus.textContent = result.message || 'Check your email for your secure checklist access link.';
  } catch (error) {
    signupStatus.textContent = error instanceof Error ? error.message : 'We could not send the link. Please try again.';
  } finally {
    submitButton.disabled = false;
  }
});
