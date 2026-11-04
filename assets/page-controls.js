(() => {
  function connect() {
    document.querySelectorAll('[data-back-to-top]').forEach(button => {
      const sync = () => button.classList.toggle('is-visible', window.scrollY > 520);
      sync();
      window.addEventListener('scroll', sync, {passive: true});
      window.addEventListener('pageshow', sync);
      button.addEventListener('click', () => {
        window.scrollTo({top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'});
        const target = document.querySelector('main h1, main');
        if (target) {
          if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
          target.focus({preventScroll: true});
        }
      });
    });
    document.querySelectorAll('[data-audio-player]').forEach((player, index) => {
      const audio = player.querySelector('audio');
      const button = player.querySelector('.mini-player-button');
      if (!audio || !button) return;
      const audioLabel = player.dataset.audioPlayer === 'overview' ? 'audio overview' : 'narration';
      const status = document.createElement('p');
      status.className = 'audio-playback-status';
      status.id = 'audio-playback-status-' + index;
      status.setAttribute('role', 'status');
      player.after(status);
      button.setAttribute('aria-describedby', status.id);
      const sync = () => {
        const playing = !audio.paused && !audio.ended;
        button.setAttribute('aria-label', (playing ? 'Pause ' : 'Play ') + audioLabel);
        button.setAttribute('aria-pressed', String(playing));
        const icon = player.querySelector('.mini-player-icon');
        if (icon) icon.textContent = playing ? '❚❚' : '▶';
      };
      const failed = () => {
        audio.pause();
        sync();
        status.textContent = 'Audio could not be played. Please try again.';
      };
      audio.addEventListener('error', failed);
      audio.addEventListener('playbackerror', failed);
      audio.addEventListener('playing', () => { status.textContent = ''; sync(); });
      ['play', 'pause', 'ended'].forEach(event => audio.addEventListener(event, sync));
      sync();
      if (audio.error) failed();
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', connect, {once: true});
  else connect();
})();
