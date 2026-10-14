/* Shared behaviour for every page: header + tabs, theme, hire-me button, buttons, reveal, counters, tooltips */
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const root = document.documentElement;
  const EMAIL = 'gopikajaideep7@gmail.com';
  const PAGES = [
    ['index.html', 'Home'], ['experience.html', 'Experience'], ['education.html', 'Education'], ['projects.html', 'Projects'],
    ['skills.html', 'Skills'], ['evals.html', 'Evals'], ['agent.html', 'RAG Agent'], ['about.html', 'About'],
  ];
  const here = document.body.dataset.page || 'index.html';

  // ---------- header ----------
  const bar = document.getElementById('site-bar');
  if (bar) {
    bar.className = 'bar';
    bar.innerHTML = `<div class="wrap">
      <a class="brand" href="index.html" aria-label="Gopika Jaideep, home"><span class="logo">GJ</span><b>gopika-jaideep</b></a>
      <nav class="tabs" aria-label="Pages"><span class="pill" aria-hidden="true"></span>${PAGES.map(([h, l]) => `<a href="${h}"${h === here ? ' aria-current="page"' : ''}>${l}</a>`).join('')}</nav>
      <button class="theme" id="themeBtn" type="button"></button></div>`;
    const tabs = bar.querySelector('.tabs'), pill = tabs.querySelector('.pill');
    // the pill marks one tab; whichever tab it sits under gets the light "on pill" text, so text never vanishes into it
    const place = el => {
      tabs.querySelectorAll('a').forEach(a => a.classList.toggle('on-pill', a === el));
      if (!el) { pill.style.width = '0'; return; }
      pill.style.left = el.offsetLeft + 'px'; pill.style.width = el.offsetWidth + 'px';
    };
    const cur = tabs.querySelector('[aria-current]');
    requestAnimationFrame(() => { place(cur); cur?.scrollIntoView({ block: 'nearest', inline: 'center' }); });
    document.fonts?.ready.then(() => place(cur));            // re-measure once the web font has replaced the fallback
    addEventListener('resize', () => place(cur));
    tabs.querySelectorAll('a').forEach(a => { a.addEventListener('mouseenter', () => place(a)); });
    tabs.addEventListener('mouseleave', () => place(cur));
  }

  // ---------- theme: follows the device until the visitor picks ----------
  const darkMQ = matchMedia('(prefers-color-scheme: dark)');
  const effective = () => root.dataset.theme || (darkMQ.matches ? 'dark' : 'light');
  const SUN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/></svg>';
  const MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>';
  const themeBtn = document.getElementById('themeBtn');
  const syncTheme = () => {
    if (!themeBtn) return;
    const next = effective() === 'dark' ? 'light' : 'dark';
    themeBtn.innerHTML = next === 'light' ? SUN : MOON;
    themeBtn.setAttribute('aria-label', `Switch to ${next} mode`); themeBtn.title = `Switch to ${next} mode`;
  };
  themeBtn?.addEventListener('click', () => {
    root.dataset.theme = effective() === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('gj-theme', root.dataset.theme); } catch (e) {}
    syncTheme(); dispatchEvent(new Event('themechange'));
  });
  darkMQ.addEventListener?.('change', () => { syncTheme(); dispatchEvent(new Event('themechange')); });
  new MutationObserver(syncTheme).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  syncTheme();

  // ---------- toast + copy ----------
  const toast = document.createElement('div'); toast.className = 'toast'; toast.setAttribute('role', 'status'); document.body.appendChild(toast);
  let tt; const say = msg => { toast.textContent = msg; toast.classList.add('on'); clearTimeout(tt); tt = setTimeout(() => toast.classList.remove('on'), 1800); };
  const copy = text => {
    try { navigator.clipboard.writeText(text).then(() => say('Copied ✓'), () => say('Select the text to copy it')); }
    catch (e) { say('Select the text to copy it'); }
  };
  document.addEventListener('click', e => { const b = e.target.closest('[data-copy]'); if (b) copy(b.dataset.copy === 'email' ? EMAIL : b.dataset.copy); });

  // ---------- floating hire-me button ----------
  const fab = document.createElement('div');
  fab.className = 'fab';
  fab.innerHTML = `<div class="fab-menu" id="fabMenu">
      <span class="mail">${EMAIL}</span>
      <button type="button" data-copy="email">Copy email</button>
      <a href="https://linkedin.com/in/gopikajaideep" target="_blank" rel="noopener">LinkedIn ↗</a>
      <a href="https://github.com/GopikaJaideep" target="_blank" rel="noopener">GitHub ↗</a>
    </div>
    <button class="fab-main" type="button" aria-expanded="false" aria-controls="fabMenu"><span class="pulse"></span><span class="x">×</span>Hire me</button>`;
  document.body.appendChild(fab);
  const fabBtn = fab.querySelector('.fab-main');
  const setFab = open => { fab.classList.toggle('open', open); fabBtn.setAttribute('aria-expanded', String(open)); };
  fabBtn.addEventListener('click', () => setFab(!fab.classList.contains('open')));
  document.addEventListener('click', e => { if (!fab.contains(e.target)) setFab(false); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') setFab(false); });

  // ---------- footer ----------
  const foot = document.getElementById('site-foot');
  if (foot) { foot.className = 'site wrap'; foot.innerHTML = `<span>© 2026 Gopika Jaideep · Carlton, VIC</span><span>AI/ML engineer · Melbourne</span>`; }

  // ---------- ripple + magnetic buttons ----------
  document.addEventListener('pointerdown', e => {
    const b = e.target.closest('.btn, .chip, .fab-main'); if (!b || reduce) return;
    const r = b.getBoundingClientRect(), s = Math.max(r.width, r.height), sp = document.createElement('span');
    sp.className = 'ripple'; sp.style.cssText = `width:${s}px;height:${s}px;left:${e.clientX - r.left - s / 2}px;top:${e.clientY - r.top - s / 2}px`;
    if (getComputedStyle(b).position === 'static') b.style.position = 'relative';
    b.style.overflow = 'hidden'; b.appendChild(sp); setTimeout(() => sp.remove(), 650);
  });
  if (!reduce && matchMedia('(hover: hover)').matches) {
    document.addEventListener('pointermove', e => {
      const b = e.target.closest('.btn.magnetic'); if (!b) return;
      const r = b.getBoundingClientRect();
      b.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * .18}px, ${(e.clientY - r.top - r.height / 2) * .25}px)`;
    });
    document.addEventListener('pointerout', e => { const b = e.target.closest?.('.btn.magnetic'); if (b && !b.contains(e.relatedTarget)) b.style.transform = ''; });
  }

  // ---------- count-up numbers ----------
  const countUp = el => {
    const end = parseFloat(el.dataset.count), dec = (el.dataset.count.split('.')[1] || '').length, pre = el.dataset.pre || '', dur = 1200;
    if (reduce) { el.textContent = pre + end.toFixed(dec); return; }
    const t0 = performance.now();
    const step = t => { const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3); el.textContent = pre + (end * e).toFixed(dec); if (p < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  };

  // ---------- reveal on scroll: elements are visible at rest; entering view adds motion ----------
  const io = 'IntersectionObserver' in window ? new IntersectionObserver(entries => entries.forEach(en => {
    if (!en.isIntersecting) return;
    const el = en.target; io.unobserve(el);
    el.classList.add('in');
    if (el.dataset.count != null) countUp(el);
    el.dispatchEvent(new CustomEvent('inview'));
  }), { threshold: 0.2 }) : null;
  const watch = scope => (scope || document).querySelectorAll('.reveal, .grow, .growy, [data-count], [data-inview]').forEach(el => io ? io.observe(el) : el.classList.add('in'));
  watch();

  // ---------- tooltip ----------
  const tip = document.createElement('div'); tip.className = 'tip'; tip.setAttribute('role', 'tooltip'); document.body.appendChild(tip);
  const showTip = (html, x, y) => {
    tip.innerHTML = html; tip.classList.add('on');
    const w = tip.offsetWidth, h = tip.offsetHeight;
    tip.style.left = Math.min(innerWidth - w - 10, Math.max(10, x + 14)) + 'px';
    tip.style.top = (y - h - 14 < 10 ? y + 18 : y - h - 14) + 'px';
  };
  const hideTip = () => tip.classList.remove('on');
  const bindTip = (el, html) => {
    el.addEventListener('pointermove', e => showTip(typeof html === 'function' ? html() : html, e.clientX, e.clientY));
    el.addEventListener('pointerleave', hideTip);
    el.addEventListener('focus', () => { const r = el.getBoundingClientRect(); showTip(typeof html === 'function' ? html() : html, r.left + r.width / 2, r.top); });
    el.addEventListener('blur', hideTip);
  };

  // ---------- greeting video ----------
  const hello = document.getElementById('hello');
  if (hello) {
    // loops on its own (loop attribute); reduced-motion visitors get the still poster until they turn sound on
    hello.loop = true;
    const play = () => hello.play()?.catch(() => {});
    if (reduce) hello.removeAttribute('autoplay');
    else if (hello.readyState >= 2) play(); else hello.addEventListener('canplay', play, { once: true });
    const sound = document.getElementById('sound');
    sound?.addEventListener('click', () => {
      hello.muted = !hello.muted; sound.setAttribute('aria-pressed', String(!hello.muted));
      sound.textContent = hello.muted ? 'Sound off' : 'Sound on';
      if (!hello.muted && hello.paused) play();
    });
  }

  // ---------- photo lightbox: any .polaroid or .sticker opens larger ----------
  document.addEventListener('click', e => {
    const ph = e.target.closest('.polaroid, .sticker'); if (!ph) return;
    const img = ph.querySelector('img'); if (!img) return;
    const cap = ph.querySelector('figcaption, .lbl')?.textContent || img.alt;
    const lb = document.createElement('div'); lb.className = 'lightbox'; lb.setAttribute('role', 'dialog'); lb.setAttribute('aria-label', cap);
    lb.innerHTML = `<figure><img src="${ph.dataset.full || img.src}" alt="${img.alt.replace(/"/g, '&quot;')}"><figcaption></figcaption></figure><button type="button" aria-label="Close photo">×</button>`;
    lb.querySelector('figcaption').textContent = cap;
    const close = () => { lb.remove(); document.removeEventListener('keydown', onKey); ph.focus?.(); };
    const onKey = ev => { if (ev.key === 'Escape') close(); };
    lb.addEventListener('click', ev => { if (ev.target === lb || ev.target.closest('button')) close(); });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(lb); lb.querySelector('button').focus();
  });
  document.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches?.('.polaroid, .sticker')) { e.preventDefault(); e.target.click(); } });

  window.GJ = { reduce, say, copy, bindTip, showTip, hideTip, watch, countUp, EMAIL };
})();
