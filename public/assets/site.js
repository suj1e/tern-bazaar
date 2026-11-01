const navToggle = document.querySelector('.nav-toggle');
const nav = document.querySelector('#site-nav');
if (navToggle && nav) {
  document.documentElement.classList.add('nav-enhanced');
  navToggle.hidden = false;
  const close = () => { nav.classList.remove('is-open'); navToggle.setAttribute('aria-expanded', 'false'); };
  navToggle.addEventListener('click', () => {
    const open = navToggle.getAttribute('aria-expanded') !== 'true';
    navToggle.setAttribute('aria-expanded', String(open));
    nav.classList.toggle('is-open', open);
  });
  nav.addEventListener('click', event => { if (event.target.closest('a')) close(); });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && navToggle.getAttribute('aria-expanded') === 'true') { close(); navToggle.focus(); }
  });
}

for (const button of document.querySelectorAll('[data-copy]')) {
  button.addEventListener('click', async () => {
    const status = button.closest('.install-panel').querySelector('.copy-feedback');
    button.disabled = true;
    status.textContent = '';
    status.removeAttribute('data-error');
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(button.dataset.copy);
      button.textContent = 'Copied';
      status.textContent = 'Command copied. Paste it into your terminal after reviewing the source.';
    } catch {
      button.textContent = 'Try copying again';
      status.setAttribute('data-error', '');
      status.textContent = 'The browser could not access the clipboard. Select the command above and copy it manually.';
    } finally { button.disabled = false; }
  });
}

const form = document.querySelector('.directory-tools');
if (form) {
  const search = form.querySelector('input');
  const category = form.querySelector('select');
  const rows = [...document.querySelectorAll('[data-plugin]')];
  const empty = document.querySelector('#no-results');
  const count = document.querySelector('#results-count');
  const apply = (updateURL = true) => {
    const terms = search.value.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    let visible = 0;
    for (const row of rows) {
      const match = (!category.value || row.dataset.category === category.value) && terms.every(term => row.dataset.search.includes(term));
      row.hidden = !match;
      if (match) visible++;
    }
    empty.hidden = visible !== 0;
    count.textContent = `Showing ${visible} ${visible === 1 ? 'plugin' : 'plugins'}${search.value.trim() ? ` for “${search.value.trim()}”` : ''}`;
    if (updateURL) {
      const url = new URL(location.href);
      if (search.value.trim()) url.searchParams.set('q', search.value.trim()); else url.searchParams.delete('q');
      if (category.value) url.searchParams.set('category', category.value); else url.searchParams.delete('category');
      history.replaceState(null, '', url);
    }
  };
  const restore = () => {
    const params = new URLSearchParams(location.search);
    search.value = params.get('q') || '';
    const selected = params.get('category') || '';
    category.value = [...category.options].some(option => option.value === selected) ? selected : '';
    apply(false);
  };
  form.addEventListener('submit', event => { event.preventDefault(); apply(); });
  search.addEventListener('input', () => apply());
  category.addEventListener('change', () => apply());
  form.addEventListener('reset', () => { search.value = ''; category.value = ''; apply(); });
  document.querySelector('[data-clear-filters]').addEventListener('click', () => { form.reset(); search.focus(); });
  window.addEventListener('popstate', restore);
  restore();
}

// A handful of quiet lights, never an interaction layer or a background worker.
const canvas = document.querySelector('#night-lights');
const context = canvas?.getContext('2d');
if (context) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let width = 0, height = 0, frame = 0, previous = 0;
  const lights = Array.from({ length: 26 }, (_, i) => ({ x: ((i * 73 + 17) % 101) / 101, y: ((i * 31 + 7) % 97) / 97, r: .6 + (i % 3) * .3, speed: .0015 + (i % 4) * .0003 }));
  const resize = () => {
    width = innerWidth; height = innerHeight;
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  const draw = now => {
    frame = requestAnimationFrame(draw);
    if (now - previous < 40) return;
    const delta = Math.min((now - previous) / 1000, .1);
    previous = now;
    context.clearRect(0, 0, width, height);
    for (const light of lights) {
      light.y -= light.speed * delta;
      if (light.y < 0) light.y = 1;
      context.beginPath(); context.arc(light.x * width, light.y * height, light.r, 0, Math.PI * 2);
      context.fillStyle = 'rgba(165,217,205,.34)'; context.fill();
    }
  };
  const sync = () => {
    cancelAnimationFrame(frame); frame = 0; previous = 0;
    context.clearRect(0, 0, width, height);
    if (!document.hidden && !reduced.matches) frame = requestAnimationFrame(draw);
  };
  addEventListener('resize', resize, { passive: true });
  document.addEventListener('visibilitychange', sync);
  reduced.addEventListener('change', sync);
  resize(); sync();
}
