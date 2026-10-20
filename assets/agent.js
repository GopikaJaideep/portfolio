/* RAG Agent page: visualises the shared pipeline in rag-core.js (pipeline diagram, router + retrieval charts, trace). */
(() => {
  const GJ = window.GJ, RAG = window.RAG, $ = id => document.getElementById(id);
  const { esc, f2, T } = RAG;
  const traceEl = $('trace'), answerEl = $('answer');
  const STAGES = ['router', 'guard', 'retrieve', 'agent', 'verify'];
  const stage = (name, state) => {
    const g = $('s-' + name); if (!g) return;
    g.classList.remove('active', 'done', 'fail', 'skip'); if (state) g.classList.add(state);
    const i = STAGES.indexOf(name), w = $('w' + i); if (w) w.classList.toggle('lit', state === 'active');
  };
  const resetStages = () => { STAGES.forEach(s => stage(s, null)); for (let i = 1; i <= 4; i++) $('w' + i).classList.remove('lit'); };
  const LBL = { projects: 'projects', experience: 'experience', skills: 'skills', education: 'education', contact: 'contact', off_topic: 'off-topic' };
  function drawProbs(probs) {
    $('probBars').innerHTML = probs.map((x, i) => `<div class="r${i === 0 ? ' top' : ''}${x.c === 'off_topic' && i === 0 ? ' off' : ''}"><span>${LBL[x.c]}</span><div class="tr"><div class="fl" style="width:0"></div></div><span class="v">${f2(x.p)}</span></div>`).join('');
    setTimeout(() => [...$('probBars').querySelectorAll('.fl')].forEach((f, i) => f.style.width = (probs[i].p * 100).toFixed(1) + '%'), 40);
  }
  function drawRanks(R) {
    const matched = R.fused.filter(x => x.lex > 0), rest = R.fused.filter(x => !(x.lex > 0));
    const top = matched.concat(rest).slice(0, 5), max = matched[0]?.s || 1;
    $('rankBars').innerHTML = top.map((x, i) => `<div class="r${x.lex > 0 && i === 0 ? ' top' : ''}"><span title="${x.d.id}">${x.d.id}</span><div class="tr"><div class="fl" style="width:0"></div></div><span class="v">${x.lex > 0 ? f2(x.s / max) : 'excl.'}</span></div>`).join('');
    setTimeout(() => [...$('rankBars').querySelectorAll('.fl')].forEach((f, i) => f.style.width = (top[i].lex > 0 ? top[i].s / max * 100 : 4).toFixed(1) + '%'), 40);
    $('rankBars').querySelectorAll('.r').forEach((r, i) => GJ.bindTip(r, `<b>${esc(top[i].d.title)}</b><span class="m">${top[i].d.id} · bm25 ${f2(top[i].lex)}${top[i].lex > 0 ? '' : ' · no keyword match, excluded'}</span>`));
  }
  const chips = list => `<div class="srcs">${list.map(t => `<button class="chip" type="button" data-redirect="${esc(t)}">${esc(t)} →</button>`).join('')}</div>`;
  function render(res) {
    answerEl.classList.toggle('refuse', res.kind !== 'answer');
    if (res.kind === 'answer') {
      answerEl.innerHTML = `<span class="lbl">${res.label}</span>${res.cited.html}` +
        (res.cited.sources.length ? `<div class="srcs">${res.cited.sources.map((s, i) => `<a href="${s.href}">[${i + 1}] ${esc(s.title)} →</a>`).join('')}</div>` : '');
    } else if (res.kind === 'joke') {
      answerEl.innerHTML = `<span class="lbl">Off-topic · politely declined 😄</span>${esc(res.line)}${chips(res.redirects)}`;
    } else if (res.kind === 'honest') {
      answerEl.innerHTML = `<span class="lbl">Not in my portfolio · no guessing</span>I searched all ${RAG.DOCS.length} passages for ${res.terms.map(t => `"${esc(t)}"`).join(' or ')} and came up empty. I'd rather say so than claim a skill I can't cite; my own verifier would never forgive me. Here's what I can show you instead:${chips(res.next)}`;
    } else if (res.kind === 'stopped') {
      answerEl.innerHTML = '<span class="lbl">Stopped</span>';
    }
  }

  let runId = 0, ctl = null;
  async function run(query) {
    const id = ++runId; ctl?.abort(); ctl = new AbortController();
    traceEl.innerHTML = ''; resetStages();
    const live = () => id === runId;
    const hooks = {
      pace: true,
      stage: (n, s) => live() && stage(n, s),
      log: line => { if (!live()) return; traceEl.innerHTML += (traceEl.innerHTML ? '\n' : '') + line; traceEl.scrollTop = traceEl.scrollHeight; },
      probs: p => live() && drawProbs(p),
      ranks: R => live() && drawRanks(R),
      status: label => { if (!live()) return; answerEl.classList.toggle('refuse', /Off-topic/.test(label)); answerEl.innerHTML = `<span class="lbl">${esc(label)}</span><span class="typing">Thinking</span>`; $('stopBtn').hidden = false; $('askBtn').disabled = true; },
      partial: text => live() && (answerEl.innerHTML = `<span class="lbl">Agent · writing</span><span class="typing">${esc(text)}</span>`),
    };
    try {
      const res = await RAG.ask(query, hooks, ctl.signal);
      if (live()) render(res);
    } catch (e) {
      if (live()) { answerEl.classList.add('refuse'); answerEl.innerHTML = '<span class="lbl">Something went wrong</span>Please try again.'; }
    } finally {
      if (live()) { $('stopBtn').hidden = true; $('askBtn').disabled = false; }
    }
  }

  function setMode(i) {
    const pill = $('modePill');
    if (i.provider === 'claude') { pill.textContent = '● LLM agent ready · Claude'; pill.classList.add('on'); $('modeNote').textContent = 'Uses Claude on your own Claude account; you\'ll be asked once.'; $('genSub').textContent = 'Claude agent + tool'; $('traceMode').textContent = 'mode: agent · claude'; }
    else if (i.provider === 'groq') { pill.textContent = '● LLM agent ready · open model'; pill.classList.add('on'); $('modeNote').textContent = 'Runs on a free open-source model via Groq. Your question isn\'t stored.'; $('genSub').textContent = 'open-model agent + tool'; $('traceMode').textContent = 'mode: agent · groq'; }
    else { pill.textContent = 'Extractive mode'; pill.classList.remove('on'); $('modeNote').textContent = 'No LLM in this view, so answers are retrieved passages, word for word.'; $('genSub').textContent = 'extractive fallback'; $('traceMode').textContent = 'mode: extractive'; }
  }

  // ---------- wire up ----------
  const qInput = $('q');
  $('askForm').addEventListener('submit', e => { e.preventDefault(); const v = qInput.value.trim(); if (v) run(v); });
  qInput.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); $('askForm').requestSubmit(); } });
  qInput.addEventListener('input', () => { qInput.style.height = ''; qInput.style.height = Math.min(qInput.scrollHeight, 160) + 'px'; });
  $('stopBtn').addEventListener('click', () => ctl?.abort());
  document.querySelectorAll('#sugg .chip').forEach(b => b.addEventListener('click', () => { qInput.value = b.textContent; run(b.textContent); }));
  answerEl.addEventListener('click', e => { const b = e.target.closest('[data-redirect]'); if (b) { qInput.value = b.dataset.redirect; run(b.dataset.redirect); } });
  $('nbN').textContent = RAG.NB.examples;

  // first paint: a worked example with every stage done, no LLM call
  (() => {
    const q = 'What have you built with RAG?', r = RAG.NB.predict(q), R = RAG.retrieve(q, 'projects'), retrieved = new Set(R.top.map(x => x.d.id));
    qInput.value = q; drawProbs(r.probs); drawRanks(R); STAGES.forEach(s => stage(s, 'done'));
    traceEl.innerHTML = `<span class="t-dim"># router: naive Bayes trained in your browser on ${RAG.NB.examples} labelled questions · ${RAG.NB.classes.length} classes · ${RAG.NB.V}-word vocabulary\n# index: ${RAG.DOCS.length} passages · bm25 + trigram · rrf k=60</span>\n<span class="t-cmd">$ ask "${q}"</span>  <span class="t-dim">(example)</span>\n${T('[router]', `naive-bayes → <span class="t-num">${r.label}</span> p=<span class="t-num">${f2(r.p)}</span>`)}\n${T('[rrf k=60]', R.top.map(x => x.d.id).join(' · '))}`;
    const cited = RAG.renderCited(R.top.slice(0, 2).map(x => `${x.d.text} [${x.d.id}]`).join(' '), retrieved);
    render({ kind: 'answer', cited, label: 'Example answer · retrieved passages' });
  })();
  $('modePill').textContent = 'checking for an LLM…'; $('modeNote').textContent = '';
  // don't look stuck: if no provider has answered in 5 s, show extractive mode until one does
  setTimeout(() => { if ($('modePill').textContent.startsWith('checking')) { $('modePill').textContent = 'Extractive mode'; $('modeNote').textContent = 'Answers use retrieved passages while the LLM connects.'; } }, 5000);
  RAG.ready.then(setMode); RAG.onChange(setMode);
})();
