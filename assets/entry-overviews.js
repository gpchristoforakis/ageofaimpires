(() => {
  const players = [...document.querySelectorAll('.entry-frame')].flatMap(frame => {
    const audio = frame.querySelector('audio');
    const button = frame.querySelector('[data-overview-button]');
    if (!audio || !button) return [];
    const title = frame.querySelector('h2').textContent;
    button.setAttribute('aria-controls', audio.id);
    return [{ audio, button, title, status: frame.querySelector('[data-overview-status]') }];
  });
  function update(player) {
    const playing = !player.audio.paused && !player.audio.ended;
    player.button.setAttribute('aria-pressed', String(playing));
    player.button.setAttribute('aria-label', `${playing ? 'Pause' : 'Play'} audio overview: ${player.title}`);
    player.button.querySelector('[data-overview-icon]').textContent = playing ? 'Ⅱ' : '▶';
    player.button.querySelector('[data-overview-label]').textContent = 'Audio overview';
  }
  players.forEach(player => {
    ['play', 'pause', 'ended'].forEach(event => player.audio.addEventListener(event, () => update(player)));
    player.audio.addEventListener('error', () => {
      if (player.status) player.status.textContent = 'The audio could not be loaded. Please try again.';
      update(player);
    });
    player.button.addEventListener('click', async () => {
      if (player.status) player.status.textContent = '';
      if (!player.audio.paused) { player.audio.pause(); return; }
      players.forEach(other => { if (other !== player) other.audio.pause(); });
      try { await player.audio.play(); }
      catch (_) {
        if (player.status) player.status.textContent = 'The audio could not be played. Please try again.';
        update(player);
      }
    });
  });
})();
