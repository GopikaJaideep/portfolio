/* Cartoon guide + AI agent.
   - Floats after the pointer anywhere on screen (keeps beside the cursor, arm pointing at it), reacts to scrolling,
     hovering and clicks, and gives page tips.
   - Click it to chat. It answers with the shared RAG pipeline (rag-core.js) and can act on the site:
     fly to pages and projects, run the eval suite, inject mutants, simulate a regression, switch theme, copy the email.
   Loaded after site.js and rag-core.js. */
(() => {
  const GJ = window.GJ || {}, RAG = window.RAG, reduce = !!GJ.reduce;
  const page = document.body.dataset.page || 'index.html';
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const store = { get(k, d) { try { return JSON.parse(sessionStorage.getItem(k)) ?? d; } catch (e) { return d; } }, set(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
  // on/off is the visitor's choice from the header switch, remembered across visits ('gj-buddy' was an older test-era key, cleared here)
  let off = false; try { localStorage.removeItem('gj-buddy'); off = localStorage.getItem('gj-cartoon') === 'off'; } catch (e) {}

  // ---------- the character ----------
  const el = document.createElement('div');
  el.className = 'buddy'; el.id = 'buddy';
  el.innerHTML = `<div class="buddy-bubble" role="status" aria-live="polite"></div>
    <span class="buddy-shadow" aria-hidden="true"></span>
    <button class="buddy-body" type="button" aria-haspopup="dialog" aria-controls="buddyChat" aria-label="Chat with Assistant Gopika, an AI agent for this portfolio">
      <img class="pose" src="assets/avatar/cross-smile.webp" alt="" width="155" height="520" draggable="false"></button>
    <button class="buddy-x" type="button" aria-label="Hide Assistant Gopika">×</button>`;
  document.body.appendChild(el);
  const body = el.querySelector('.buddy-body'), bubble = el.querySelector('.buddy-bubble'), shadow = el.querySelector('.buddy-shadow');

  // ---------- the chat panel ----------
  const chat = document.createElement('section');
  chat.className = 'buddy-chat'; chat.id = 'buddyChat'; chat.hidden = true;
  chat.setAttribute('role', 'dialog'); chat.setAttribute('aria-label', 'Chat with Assistant Gopika');
  chat.innerHTML = `<header class="bc-head"><img src="assets/avatar/wave.webp" alt="" width="34" height="62"><div><b>Assistant Gopika</b><span id="bcMode">AI agent · checking…</span></div>
      <button type="button" class="bc-x" aria-label="Close chat">×</button></header>
    <div class="bc-log" id="bcLog" aria-live="polite"></div>
    <div class="bc-sugg" id="bcSugg"></div>
    <form class="bc-form" id="bcForm" autocomplete="off"><label class="sr" for="bcIn">Message Assistant Gopika</label>
      <input id="bcIn" type="text" maxlength="200" placeholder="Ask me, or tell me where to go…"><button class="btn solid" type="submit" aria-label="Send">→</button></form>`;
  document.body.appendChild(chat);
  const logEl = chat.querySelector('#bcLog'), input = chat.querySelector('#bcIn'), sugg = chat.querySelector('#bcSugg');

  // ---------- speech bubble ----------
  let lastSay = 0, sayTimer;
  function say(text, ms = 3200, force = false) {
    if (!text || el.hidden || !chat.hidden) return;
    const now = performance.now();
    if (!force && now - lastSay < 2500) return;
    lastSay = now; bubble.textContent = text; bubble.classList.add('on');
    clearTimeout(sayTimer); sayTimer = setTimeout(() => bubble.classList.remove('on'), ms);
  }
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const INTRO = {
    'index.html': "Hi! I'm Assistant Gopika, an AI agent. Click me and I'll show you around.",
    'experience.html': 'Click any bar on the timeline, or click me and ask about my roles.',
    'education.html': 'Press "Play through", or ask me about Monash.',
    'projects.html': "Open a card's Details. CareWise is my favourite.",
    'skills.html': 'Click a skill and watch its projects light up.',
    'evals.html': 'Want me to run the whole eval suite? Click me and say "run the evals".',
    'agent.html': 'This page shows my brain at work. Ask it something!',
    'about.html': 'This is the part where you hire me. The button is bottom-right!',
  };
  const FACTS = ['I built a six-agent system without any agent framework.', '500+ red-team queries, 0% unsafe outputs on the ones tested.', 'My mutation tests caught 4 out of 4 broken safety controls.', 'I speak four languages. Python is my fifth.', 'I once organised a walkathon for 370+ people.', 'I lead a 7-person data team at AusWise.'];
  function lineFor(t) {
    if (t.closest('.fab-main')) return 'Best button on the page, if you ask me.';
    if (t.closest('[data-copy]')) return 'Copy my email. I reply fast!';
    const tab = t.closest('.tabs a'); if (tab) return tab.getAttribute('aria-current') ? "We're already here!" : `Off to ${tab.textContent}? Lead the way.`;
    if (t.closest('.next')) return 'Next page! Follow me.';
    const proj = t.closest('.p'); if (proj && !t.closest('.btn')) return `${proj.querySelector('h2')?.textContent || 'That one'}: one of my builds.`;
    const bar = t.closest('.g-bar'); if (bar) return (bar.getAttribute('aria-label') || '').split(',')[0] + '. Good times.';
    if (t.closest('.sc')) return 'Click it to see where I used it.';
    if (t.closest('.sticker, .polaroid')) return pick(['That\'s me!', 'Ah, good memories.', 'Click to see it bigger.']);
    if (t.closest('a[target="_blank"]')) return 'That one opens in a new tab.';
    if (t.closest('.btn, .chip, .bt, .st-tab')) return pick(['Go on, press it!', 'Ooh, a button.', 'Click it. You know you want to.']);
    return null;
  }

  // ---------- movement: anywhere on screen ----------
  const W = () => el.offsetWidth, H = () => el.offsetHeight, PAD = 8, TOP = 64;
  let x = PAD + 8, y = innerHeight - 180, tx = x, ty = y, face = 1, tilt = 0, hop = 0, hopV = 0, squash = 0;
  let pointerX = null, pointerY = null, lastMove = performance.now(), lastScrollY = scrollY, scrollV = 0, waved = false, frozenUntil = 0, hoverSelf = false, reading = null;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const home = () => { tx = PAD + 8; ty = innerHeight - H() - PAD; };
  function aimAt(px, py) {
    // stand beside the cursor with the free arm pointing at it; switch sides near the right edge
    const w = W(), h = H(), leftSide = px > innerWidth - w - 90;
    face = leftSide ? -1 : 1;                                  // art's free arm points left; mirrored when standing on the left
    tx = clamp(leftSide ? px - w - 26 : px + 26, PAD, innerWidth - w - PAD);
    ty = clamp(py - h * 0.45, TOP, innerHeight - h - PAD);
  }
  home(); y = ty;
  addEventListener('pointermove', e => {
    pointerX = e.clientX; pointerY = e.clientY; lastMove = performance.now(); waved = false;
    // when the pointer comes close the cartoon stops and waits to be clicked, instead of stepping away from it
    const near = Math.hypot(clamp(e.clientX, x, x + W()) - e.clientX, clamp(e.clientY, y, y + H()) - e.clientY) < 90;
    if (near) { if (!reading) { tx = x; ty = y; } frozenUntil = performance.now() + 900; return; }
    if (finePointer && !reduce && chat.hidden && !hoverSelf && !reading && performance.now() > frozenUntil) aimAt(e.clientX, e.clientY);
  }, { passive: true });
  // touch: fly to wherever the visitor taps
  addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' || reduce || reading || !chat.hidden || el.contains(e.target) || chat.contains(e.target)) return;
    aimAt(e.clientX, e.clientY + 40);
  }, { passive: true });
  body.addEventListener('pointerenter', () => { hoverSelf = true; say('Click me to chat. I can answer questions or show you around!', 3000); });
  body.addEventListener('pointerleave', () => { hoverSelf = false; frozenUntil = performance.now() + 700; });
  addEventListener('scroll', () => {
    const d = scrollY - lastScrollY; lastScrollY = scrollY; lastMove = performance.now();
    scrollV = clamp(d, -40, 40);
    if (Math.abs(d) > 2 && hop === 0 && !reduce) hopV = -Math.min(5, 1.5 + Math.abs(d) / 12);
    if (innerHeight + scrollY >= document.documentElement.scrollHeight - 4) say(page === 'about.html' ? 'You made it to the very end. Hire me?' : 'End of the page! The "Next" card is right there.', 3600);
  }, { passive: true });
  addEventListener('resize', () => { tx = clamp(tx, PAD, innerWidth - W() - PAD); ty = clamp(ty, TOP, innerHeight - H() - PAD); placeChat(); });

  let hoverEl = null;
  document.addEventListener('pointerover', e => {
    const t = e.target.closest('a, button, .p, .g-bar, .sc, .chip, .sticker, .polaroid');
    if (!t || t === hoverEl || el.contains(t) || chat.contains(t)) return;
    hoverEl = t; say(lineFor(t));
  });
  document.addEventListener('click', e => {
    if (el.contains(e.target) || chat.contains(e.target)) return;
    if (e.target.closest('.btn, .chip, button') && !reduce) { hopV = -6; squash = .12; }
  });

  // ---------- avatar poses: walk, wave, think, and a few relaxed idle stances ----------
  const POSES = { walk: 'walk', step: 'step', wave: 'wave', think: 'think', smile: 'cross-smile', cross: 'cross', behind: 'behind' };
  Object.values(POSES).forEach(n => { const i = new Image(); i.src = `assets/avatar/${n}.webp`; });   // preload so swaps are instant
  const poseImg = el.querySelector('.pose');
  let curPose = 'smile';
  const setPose = p => { if (p !== curPose) { curPose = p; poseImg.src = `assets/avatar/${POSES[p]}.webp`; } };
  let vx = 0, vy = 0, phase = 0, stride = 0, idlePose = 'smile', idleSwapAt = performance.now() + 6000;
  let waveUntil = 0, nodUntil = 0, thinking = false, thinkUntil = 0, busyN = 0;
  GJ.think = on => { busyN = Math.max(0, busyN + (on ? 1 : -1)); if (!on && !busyN) nod(); };   // pages wrap long runs (evals) in think(true) / think(false)
  // reading a project: when a project drawer opens, step up beside it, hands folded behind the back, and read along.
  // The drawer is a modal dialog in the top layer, so the cartoon joins the top layer as a popover to stay visible above its backdrop.
  const canPop = typeof el.showPopover === 'function';
  function startReading(d) {
    reading = d;
    if (canPop) { el.popover = 'manual'; try { el.showPopover(); } catch {} }
    const dw = d.getBoundingClientRect().width, w = W();
    const left = innerWidth - dw - w - 14;
    tx = left >= PAD ? left : PAD + 4;                       // beside the drawer, or tucked in its corner on narrow screens
    ty = innerHeight - H() - PAD;
    face = -1;                                               // turn toward the drawer
    say(pick(['Ooh, good pick. Take your time.', 'Reading along with you.', 'Hands folded, eyes on the architecture.', "I'll wait here while you read."]), 3200, true);
  }
  function stopReading() {
    if (!reading) return;
    reading = null; idleSwapAt = performance.now() + 4000;
    if (canPop) { try { el.hidePopover(); } catch {} el.removeAttribute('popover'); }
  }
  document.querySelectorAll('dialog.drawer').forEach(d => {
    new MutationObserver(() => (d.open && !el.hidden ? startReading(d) : stopReading())).observe(d, { attributes: true, attributeFilter: ['open'] });
    d.addEventListener('close', stopReading);
  });
  const wave = (ms = 1600) => { waveUntil = performance.now() + ms; };
  const nod = () => { nodUntil = performance.now() + 900; };

  let t0 = performance.now();
  function frame(now) {
    const dt = Math.min(48, now - t0) / 16.7; t0 = now;
    if (!el.hidden) {
      // walk toward the target at a human pace (jog when it's far), easing in and out
      const dx = tx - x, dy = ty - y, dist = Math.hypot(dx, dy);
      const pace = dist > 420 ? 6.5 : 3.2;                       // px per frame: walk, or jog for long trips
      const want = dist > 2 ? Math.min(pace, dist * 0.08) : 0;
      const ux = dist ? dx / dist : 0, uy = dist ? dy / dist : 0;
      vx += (ux * want - vx) * 0.18 * dt; vy += (uy * want - vy) * 0.18 * dt;
      x += vx * dt; y += vy * dt;
      const speed = Math.hypot(vx, vy), walking = speed > 0.35;
      // stride phase advances with distance covered: about one step per 24px
      phase += speed * dt / 24 * Math.PI;
      stride += ((walking ? Math.min(1, speed / 3.2) : 0) - stride) * 0.2;
      const s = Math.sin(phase), c = Math.cos(phase), A = stride;
      const sideways = Math.abs(vx) > Math.abs(vy) * 0.7;
      let stepTilt = 0;
      if (walking && sideways) {
        // side-view walk: the profile pose faces left, so mirror it when heading right; small rock with each step
        setPose('walk'); face = vx > 0 ? -1 : 1; stepTilt = s * 2.5 * A;
      } else if (walking) {
        // walking toward or away from the viewer: the front step pose, mirrored every step so the legs alternate
        setPose('step'); face = s >= 0 ? 1 : -1; stepTilt = s * 1.5 * A;
      } else {
        // standing: wave, think, or rotate through relaxed stances now and then
        if (now > idleSwapAt) { idlePose = pick(['smile', 'smile', 'behind', 'cross']); idleSwapAt = now + 6000 + Math.random() * 6000; }
        setPose(now < waveUntil ? 'wave' : (thinking || busyN || now < thinkUntil) ? 'think' : reading ? 'behind' : idlePose);
        if (pointerX != null) face = pointerX < x + W() / 2 ? -1 : 1;   // the wave pose's hand is on the art's right: turn it toward the visitor's cursor
      }
      const breath = Math.sin(now / 900);
      const nodTilt = now < nodUntil ? Math.sin((nodUntil - now) / 70) * 3 : 0;
      poseImg.style.transform = `scaleY(${(1 + (walking ? 0 : breath * 0.01)).toFixed(4)}) rotate(${(stepTilt + nodTilt).toFixed(2)}deg)`;

      let lean = scrollV * 0.12; scrollV *= 0.85;
      tilt += (lean - tilt) * 0.15;
      hopV += 0.55 * dt; hop += hopV * dt;
      if (hop > 0) { if (hopV > 2) squash = Math.min(0.16, hopV / 40); hop = 0; hopV = 0; }
      squash *= 0.86;
      const bob = -Math.abs(c) * 3.2 * A;                         // up and down with each step
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${(y + hop + bob).toFixed(1)}px, 0)`;
      body.style.transform = `scaleX(${face}) rotate(${(tilt * face).toFixed(2)}deg) scale(${(1 + squash * 0.6).toFixed(3)}, ${(1 - squash).toFixed(3)})`;
      shadow.style.opacity = Math.max(0.3, 1 + hop / 40).toFixed(2);
      shadow.style.transform = `scaleX(${(1 + hop / 60 - Math.abs(c) * 0.06 * A).toFixed(3)})`;
      el.classList.toggle('right', x > innerWidth / 2);
      el.classList.toggle('low', y > innerHeight / 2);
      if (!waved && !reading && chat.hidden && now - lastMove > 14000) {
        waved = true; home(); wave(2000);
        say(pick(['Still there? Click me and ask me anything.', 'Psst. Say "run the evals" and watch me go.', "I'm very hireable, just saying."]), 4000, true);
      }
    }
    requestAnimationFrame(frame);
  }
  if (reduce) el.style.transform = `translate3d(${PAD + 8}px, ${innerHeight - 180}px, 0)`;
  else requestAnimationFrame(frame);

  // ---------- on / off: a round switch sitting just above the "Hire me" button ----------
  const ICON_ON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="5" r="2.6"/><path d="M12 8.5v6.5M8 11.5l4-1.5 4 1.5M9.5 21l2.5-6 2.5 6"/></svg>';
  const ICON_OFF = ICON_ON.replace('</svg>', '<path d="M4 4l16 16"/></svg>');
  const tog = document.createElement('button');
  tog.type = 'button'; tog.className = 'buddy-tog'; tog.id = 'buddyTog';
  const fabMain = document.querySelector('.fab .fab-main');
  if (fabMain) fabMain.before(tog); else document.body.appendChild(tog);
  function syncSwitch() {
    const on = !el.hidden;
    tog.innerHTML = on ? ICON_ON : ICON_OFF;
    tog.setAttribute('aria-pressed', String(on));
    tog.setAttribute('aria-label', on ? 'Hide Assistant Gopika' : 'Show Assistant Gopika'); tog.title = on ? 'Hide Assistant Gopika' : 'Show Assistant Gopika';
  }
  function show() {
    el.hidden = false; try { localStorage.removeItem('gj-cartoon'); } catch (e) {}
    home(); x = tx; y = ty; syncSwitch(); wave(1600); say("I'm back!", 2500, true);
  }
  function hide() {
    closeChat(); stopReading(); el.hidden = true; try { localStorage.setItem('gj-cartoon', 'off'); } catch (e) {}
    syncSwitch(); GJ.say?.('Assistant Gopika hidden. Turn it back on with the little person button above "Hire me".');
  }
  tog.addEventListener('click', () => (el.hidden ? show() : hide()));
  el.querySelector('.buddy-x').addEventListener('click', hide);
  if (off) el.hidden = true;
  syncSwitch();

  // ---------- chat ----------
  const SUGGEST = ['Take me to your projects', 'What have you built with RAG?', 'Run the eval suite', 'Show me CareWise', 'Switch to dark mode', 'Copy your email'];
  let history = store.get('gj-chat', []);
  const save = () => store.set('gj-chat', history.slice(-14));
  function addMsg(who, html, keep = true) {
    const m = document.createElement('div'); m.className = 'bc-msg ' + who; m.innerHTML = html; logEl.appendChild(m);
    logEl.scrollTop = logEl.scrollHeight;
    if (keep) { history.push({ who, html }); save(); }
    return m;
  }
  function renderSugg(list = SUGGEST) { sugg.innerHTML = list.slice(0, 4).map(t => `<button class="chip" type="button" data-q="${esc(t)}">${esc(t)}</button>`).join(''); }
  function placeChat() {
    if (chat.hidden) return;
    if (innerWidth < 640) { chat.style.left = ''; chat.style.top = ''; return; }   // bottom sheet on phones (CSS)
    const cw = chat.offsetWidth, ch = chat.offsetHeight, bx = x, bw = W();
    const left = bx + bw + 16 + cw < innerWidth ? bx + bw + 16 : Math.max(PAD, bx - cw - 16);
    chat.style.left = clamp(left, PAD, innerWidth - cw - PAD) + 'px';
    chat.style.top = clamp(y + H() - ch, TOP, innerHeight - ch - PAD) + 'px';
  }
  function openChat() {
    bubble.classList.remove('on');
    if (!history.length) addMsg('bot', `Hi! I'm Assistant Gopika, the AI agent for this portfolio. Ask me about my work, or tell me where to go and I'll take you there.`);
    chat.hidden = false; body.setAttribute('aria-expanded', 'true');
    if (innerWidth >= 640 && x > innerWidth - W() - 380 && x < 380) home();
    placeChat(); renderSugg(); input.focus({ preventScroll: true });
    store.set('gj-chat-open', true);
  }
  function closeChat() { if (chat.hidden) return; chat.hidden = true; body.setAttribute('aria-expanded', 'false'); store.set('gj-chat-open', false); ctl?.abort(); }
  body.addEventListener('click', () => { if (!reduce) { hopV = -8; squash = .16; } wave(1400); chat.hidden ? openChat() : closeChat(); });
  chat.querySelector('.bc-x').addEventListener('click', closeChat);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !chat.hidden) { closeChat(); body.focus(); } });
  history.forEach(m => addMsg(m.who, m.html, false));

  // agent mode label
  const modeEl = chat.querySelector('#bcMode');
  const setMode = i => { modeEl.textContent = i.provider === 'claude' ? 'AI agent · Claude' : i.provider === 'groq' ? 'AI agent · open model' : 'AI agent · search mode'; };
  RAG?.ready.then(setMode); RAG?.onChange?.(setMode);

  // ---------- actions the agent can take ----------
  const PAGES = [
    [/\bhome|start|main page\b/, 'index.html', 'Home'], [/\bexperience|work history|jobs?|roles?|career\b/, 'experience.html', 'Experience'],
    [/\beducation|degree|study|monash|uni(versity)?\b/, 'education.html', 'Education'], [/\bprojects?|portfolio|builds?\b/, 'projects.html', 'Projects'],
    [/\bskills?|tech stack|stack|tools\b/, 'skills.html', 'Skills'], [/\bevals?|evaluations?|results|metrics|benchmarks?\b/, 'evals.html', 'Evals'],
    [/\brag agent|agent page|playground\b/, 'agent.html', 'the RAG Agent page'], [/\babout|contact|hire|cite|bibtex\b/, 'about.html', 'About'],
  ];
  const PROJECTS = [[/carewise/, 'carewise', 'CareWise'], [/trace ?ai/, 'traceai', 'TraceAI'], [/quitory/, 'quitory', 'Quitory'], [/photo ?alchemy/, 'photoalchemy', 'PhotoAlchemy'],
    [/aloka/, 'aloka', 'ALOKA'], [/parking ?spy|parking/, 'parkingspy', 'ParkingSpy'], [/intrusion|nids/, 'nids', 'Intrusion detection'], [/auswise analytics|social media|instagram/, 'auswise', 'Social media analytics']];
  const EVAL_IDS = { carewise: 1, traceai: 1, quitory: 1, parkingspy: 1, nids: 1 };
  const NAV = /\b(take me|go to|go|show me|show|open|navigate|bring me|fly( me)?|jump to|let'?s see|visit|head to|see (your|the))\b/;
  function plan(q) {
    const l = q.toLowerCase();
    const theme = l.match(/\b(dark|light)\b.*\b(mode|theme)\b|\b(mode|theme)\b.*\b(dark|light)\b|lights (off|on)/);
    if (theme || /\b(switch|toggle|change) (the )?theme\b/.test(l)) {
      const want = /dark|lights off/.test(l) ? 'dark' : /light|lights on/.test(l) ? 'light' : null;
      return { type: 'theme', want };
    }
    if (/\b(copy|grab|give me|send me|share)\b.*\bemail\b|\bemail address\b/.test(l)) return { type: 'copy' };
    if (/\b(hide|go away|stop following|leave me alone)\b/.test(l)) return { type: 'hide' };
    if (/\b(inject|run|break)\b.*\bmutants?\b|\bmutation tests?\b.*\b(run|show)\b/.test(l)) return { type: 'click', href: 'evals.html#traceai', label: 'TraceAI\'s evals', sel: '#mutGo', done: 'Injecting the mutants now. Watch the tests catch every one!' };
    if (/\b(run|replay|start)\b.*\bred[- ]?team/.test(l)) return { type: 'click', href: 'evals.html#quitory', label: 'Quitory\'s evals', sel: '#rtGo', done: 'Replaying 500 red-team queries. Spoiler: all safe.' };
    if (/\b(simulate|show|trigger)\b.*\bregression\b/.test(l)) return { type: 'click', href: 'index.html', label: 'the eval gate', sel: '#regress', done: 'Regression switched on. Watch the gate stop the bad changes.', scrollTo: '#regress' };
    if (/\b(run|start|execute|kick off)\b.*\b(evals?|eval suite|tests?|suite)\b/.test(l)) return { type: 'click', href: 'evals.html', label: 'the Evals page', sel: '#runAll', done: 'Running the full eval suite. Fingers crossed (not needed, they all pass).' };
    if (/\blinkedin\b/.test(l) && NAV.test(l)) return { type: 'link', href: 'https://linkedin.com/in/gopikajaideep', label: 'my LinkedIn' };
    if (/\bgithub\b/.test(l) && NAV.test(l)) return { type: 'link', href: 'https://github.com/GopikaJaideep', label: 'my GitHub' };
    if (NAV.test(l) || /^(projects?|skills?|evals?|education|experience|about|home)\.?$/.test(l.trim())) {
      const pj = PROJECTS.find(([re]) => re.test(l));
      if (pj) { const toEvals = /\bevals?|results|metrics\b/.test(l) && EVAL_IDS[pj[1]]; return { type: 'nav', href: (toEvals ? 'evals.html#' : 'projects.html#') + pj[1], label: toEvals ? `${pj[2]}'s evals` : pj[2] }; }
      const pg = PAGES.find(([re]) => re.test(l));
      if (pg) return { type: 'nav', href: pg[1], label: pg[2] };
    }
    return null;
  }
  // navigate with a little flight; the next page's guide picks up where this one left off
  function flyTo(href, label, after) {
    const [file, hash] = href.split('#'), same = (file || 'index.html') === page;
    if (same) {
      runLocal(hash, after);
      return;
    }
    store.set('gj-after', { say: `Here we are: ${label}!`, ...(after || {}) });
    store.set('gj-chat-open', !chat.hidden);
    if (!reduce) { ty = -H() - 40; tx = innerWidth / 2 - W() / 2; hopV = -10; }
    setTimeout(() => { location.href = href; }, reduce ? 50 : 650);
  }
  function runLocal(hash, after) {
    if (hash) {
      const tab = document.getElementById('t-' + hash), open = document.querySelector(`[data-open="${hash}"]`), target = document.getElementById(hash);
      if (tab) tab.click();                                         // evals page tab
      if (open) { closeChat(); if (!document.getElementById('drawer')?.open) open.click(); }   // projects page drawer (may already be open from the hash)
      else target?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
    }
    if (after?.scrollTo) document.querySelector(after.scrollTo)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
    if (after?.sel) setTimeout(() => { const b = document.querySelector(after.sel); b?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' }); setTimeout(() => b?.click(), 500); }, 300);
    if (after?.done) setTimeout(() => say(after.done, 4200, true), 400);
  }
  function act(p) {
    if (p.type === 'theme') {
      const cur = document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      const want = p.want || (cur === 'dark' ? 'light' : 'dark');
      if (want !== cur) document.getElementById('themeBtn')?.click();
      return `Done: ${want} mode ${want === 'dark' ? '🌙' : '☀️'}`;
    }
    if (p.type === 'copy') { GJ.copy?.(GJ.EMAIL || 'gopikajaideep7@gmail.com'); return `Copied <b>${esc(GJ.EMAIL || 'gopikajaideep7@gmail.com')}</b> to your clipboard. I reply fast!`; }
    if (p.type === 'hide') { setTimeout(hide, 900); return 'Okay, I\'ll give you some space. Bring me back from the "Hire me" menu anytime.'; }
    if (p.type === 'link') return `Here's <a href="${p.href}" target="_blank" rel="noopener">${esc(p.label)} ↗</a>. It opens in a new tab.`;
    if (p.type === 'nav') { flyTo(p.href, p.label); return `Flying over to ${esc(p.label)}… ✈️`; }
    if (p.type === 'click') { flyTo(p.href, p.label, { sel: p.sel, done: p.done, scrollTo: p.scrollTo }); return (p.href.split('#')[0] === page ? '' : `Taking you to ${esc(p.label)}… `) + 'On it! ⚡'; }
    return '';
  }

  // ---------- answering ----------
  let ctl = null;
  async function send(q) {
    q = q.trim(); if (!q) return;
    addMsg('me', esc(q)); input.value = ''; renderSugg([]);
    const p = plan(q);
    if (p) { nod(); addMsg('bot', act(p)); renderSugg(); return; }
    if (!RAG) { addMsg('bot', 'My brain didn\'t load on this page. Try the RAG Agent page!'); return; }
    ctl?.abort(); ctl = new AbortController();
    const typing = addMsg('bot typing', '<span class="dots"><i></i><i></i><i></i></span> <span class="st">Routing your question…</span>', false);
    const st = typing.querySelector('.st');
    const hooks = {
      stage: (n, s) => { if (s === 'active') st.textContent = { router: 'Routing your question…', guard: 'Checking it\'s about my work…', retrieve: `Searching ${RAG.DOCS.length} passages…`, agent: 'Thinking…', verify: 'Checking my citations…' }[n] || st.textContent; },
      status: label => { st.textContent = /comeback/.test(label) ? 'Thinking of something witty…' : 'Thinking…'; },
      partial: text => { typing.classList.remove('typing'); typing.innerHTML = esc(text); logEl.scrollTop = logEl.scrollHeight; },
    };
    thinking = true; thinkUntil = performance.now() + 1100;   // hold the pose long enough to read, even for instant answers
    try {
      const res = await RAG.ask(q, hooks, ctl.signal);
      thinking = false; nod();
      typing.remove();
      if (res.kind === 'answer') {
        const go = res.cited.sources.map(s => `<button class="chip" type="button" data-go="${s.href}" data-label="${esc(s.title)}">Take me to ${esc(s.title)} ✈️</button>`).join('');
        addMsg('bot', `${res.cited.html}${go ? `<div class="bc-acts">${go}</div>` : ''}`);
      } else if (res.kind === 'joke') {
        addMsg('bot', `${esc(res.line)} 😄<div class="bc-acts">${res.redirects.map(t => `<button class="chip" type="button" data-q="${esc(t)}">${esc(t)}</button>`).join('')}</div>`);
      } else if (res.kind === 'honest') {
        addMsg('bot', `I searched all ${RAG.DOCS.length} passages for ${res.terms.map(t => `"${esc(t)}"`).join(' or ')} and found nothing, so I won't claim it. Here's what I can show you:<div class="bc-acts">${res.next.map(t => `<button class="chip" type="button" data-q="${esc(t)}">${esc(t)}</button>`).join('')}</div>`);
      }
    } catch (e) {
      thinking = false; typing.remove(); addMsg('bot', 'Hmm, something went wrong on my side. Try asking again?');
    }
    renderSugg();
  }
  chat.querySelector('#bcForm').addEventListener('submit', e => { e.preventDefault(); send(input.value); });
  chat.addEventListener('click', e => {
    const q = e.target.closest('[data-q]'); if (q) { send(q.dataset.q); return; }
    const g = e.target.closest('[data-go]'); if (g) { addMsg('bot', `Flying over to ${esc(g.dataset.label)}… ✈️`); flyTo(g.dataset.go, g.dataset.label); }
  });

  // ---------- arriving from another page ----------
  const after = store.get('gj-after', null);
  if (after) {
    store.set('gj-after', null);
    if (!reduce) { y = -H() - 40; hopV = 0; }                     // drop in from the top
    setTimeout(() => {
      wave(1800); if (store.get('gj-chat-open', false)) openChat();
      if (after.say) { if (!chat.hidden) addMsg('bot', esc(after.say)); else say(after.say, 3600, true); }
      runLocal(location.hash.slice(1), after);
    }, 700);
  } else {
    if (store.get('gj-chat-open', false) && !el.hidden) setTimeout(openChat, 400);
    else setTimeout(() => { wave(2000); say(INTRO[page], 4200, true); }, 1300);
  }

  // contextual tips as sections scroll into view
  const TIPS = {
    'evals.html': [['#mut', 'Inject the mutants. The tests catch them all.']],
    'projects.html': [['#traceai', 'TraceAI guards against a real risk: stalking.'], ['#aloka', 'ALOKA was my computer-vision app for Android!']],
    'agent.html': [['#probBars', 'That chart is my naive Bayes router thinking.']],
    'skills.html': [['#top8', 'Python shows up everywhere. No surprise there.']],
  };
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { io.unobserve(en.target); say(en.target.__buddyTip, 3600); } }), { threshold: 0.6 });
    (TIPS[page] || []).forEach(([sel, tip]) => { const n = document.querySelector(sel); if (n) { n.__buddyTip = tip; io.observe(n); } });
  }

  window.GJ = Object.assign(window.GJ || {}, { buddySay: say, buddyAsk: send });
})();
