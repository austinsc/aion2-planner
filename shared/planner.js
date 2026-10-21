/* Class planner engine. Each <class>-planner/index.html loads its data.js (window.DATA) and then this file.
   DATA holds the generated level steps, skills, boards and routes plus the written guide parts
   (meta, phases, text, stigmas, passives, macro cards, sources). */
const META = DATA.meta, TXT = DATA.text || {};
const SK = Object.fromEntries(DATA.skills.map(s => [s.name, s]));
const BOARDS = Object.fromEntries(DATA.boards.map(b => [b.key, b]));
const NODES = {}; DATA.boards.forEach(b => b.nodes.forEach(n => NODES[n.id] = n));
const PHASES = DATA.phases;
const STORE = META.storageKey || (META.cls + '-planner');

/* ---------------- state ---------------- */
const state = { level: 1, done: {}, nodes: {}, notes: '', board: DATA.boards[0].key };
let db = null, docRef = null, saving = false, pending = false;
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function loadLocal(){ try { const j = JSON.parse(localStorage.getItem(STORE) || 'null'); if (j) Object.assign(state, j); } catch(e){} if (!BOARDS[state.board]) state.board = DATA.boards[0].key; }
function saveLocal(){ try { localStorage.setItem(STORE, JSON.stringify(state)); } catch(e){} }
function setSave(t, cls){ const el = $('#saveState'); el.textContent = t; el.className = 'save ' + (cls||''); }
let saveTimer = null;
function persist(){
  saveLocal();
  if (!docRef) { setSave('Saved on this device', 'local'); return; }
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 500);
}
const snapshot = () => ({ level: state.level, done: state.done, nodes: state.nodes, notes: state.notes, board: state.board, updatedAt: new Date().toISOString() });
async function flush(){
  if (!docRef) return;
  if (saving) { pending = true; return; }
  saving = true; setSave('Saving…');
  try {
    await docRef.set(snapshot());
    setSave('Saved to your account', 'ok');
  } catch (e) { setSave('Saved on this device only', 'local'); }
  saving = false;
  if (pending) { pending = false; flush(); }
}
async function connect(){
  try {
    const [d, u] = await Promise.all([window.claude?.use?.('db'), window.claude?.use?.('user')]);
    if (!d || !u) { setSave('Saved on this device', 'local'); return; }
    const uid = await u.id();
    if (!uid) { setSave('Saved on this device', 'local'); return; }
    db = d; docRef = db.doc('data/users/' + uid + '/' + (META.dbDoc || 'progress-' + META.cls));
    const snap = await docRef.get();
    if (snap.exists) { applyRemote(snap.data()); }
    else { await docRef.set(snapshot()); }
    setSave('Saved to your account', 'ok');
    docRef.onSnapshot(s => { if (s.exists && !s.metadata.hasPendingWrites) applyRemote(s.data()); }, () => {});
  } catch (e) { setSave('Saved on this device', 'local'); }
}
function applyRemote(d){
  if (!d) return;
  state.level = Math.min(45, Math.max(1, +d.level || 1));
  state.done = d.done || {}; state.nodes = d.nodes || {}; state.notes = d.notes || ''; state.board = BOARDS[d.board] ? d.board : state.board;
  saveLocal(); renderAll();
}

/* ---------------- helpers ---------------- */
const initials = n => n.split(/[\s:'-]+/).filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase();
const icon = (name, cls='') => { const s = SK[name]; if (!s) return ''; return s.id ? `<img class="ico ${cls}" src="icons/${s.id}.webp" alt="">` : `<span class="ico ph ${cls}" aria-hidden="true">${esc(initials(name))}</span>`; };
const skTag = (name, cls='', extra='') => { const s = SK[name] || {}; return `<span class="sk ${s.elem||''} ${cls}">${icon(name, cls.includes('lg')?'lg':cls.includes('sm')?'sm':'')}<span class="nm">${esc(name)}</span>${extra}</span>`; };
const step = L => DATA.steps[L-1];
const lvlRow = L => DATA.levels[L-1];
function levelsAt(L){ return step(L).levels; }
function planAt(L){ return DATA.plan.filter(p => p.lvl === L); }
function ownedCost(key){ return BOARDS[key].nodes.filter(n => state.nodes[n.id]).reduce((a,n)=>a+n.cost,0); }
function boardName(k){ return BOARDS[k].name; }
function nodeTitle(n){ return n.label + (n.cost ? ` (${n.cost} crystal${n.cost>1?'s':''})` : ''); }
const firstBoard = DATA.boards[0];
const levelBoards = DATA.boards.filter(b => b.key !== 'azphel');

/* ---------------- NOW ---------------- */
function renderNow(){
  const L = state.level, st = step(L), row = lvlRow(L), plan = planAt(L);
  const isDone = !!state.done[L];
  const lv = levelsAt(L);
  let h = '';
  h += `<div class="card gold">
    <header><h2>Level ${L}</h2><span class="eyebrow">${isDone ? 'Done' : 'In progress'}</span></header>
    <div class="chips">
      <span class="chip">Skill points <b class="num">+${st.gained}</b> <span class="muted num">(${row.sp} total)</span></span>
      <span class="chip">Daevanion crystals <b class="num">${row.dv}</b></span>
      <span class="chip">Stigma slots <b class="num">${row.slots}</b> <span class="muted num">· ${row.stg} pts</span></span>
      ${row.unlock ? `<span class="chip">Unlocks: ${esc(row.unlock)}</span>` : ''}
    </div>
    <div class="act">
      <button class="pill ${isDone ? 'done' : 'primary'}" id="markDone">${isDone ? '✓ Level done' : 'Mark level done'}</button>
      ${L < 45 ? `<button class="pill" id="nextLvl">Done, go to level ${L+1} →</button>` : ''}
    </div>
  </div>`;

  h += `<div class="grid2">`;
  // skill points
  h += `<div class="card"><header><h3>Spend skill points</h3><span class="eyebrow">${st.spend} point${st.spend===1?'':'s'}</span></header>`;
  if (st.alloc.length) {
    h += `<ul class="list">` + st.alloc.map(a => `<li>${skTag(a.skill)}<span class="arrow num">${a.a} → ${a.b}</span><span class="cost num">${a.cost} pt${a.cost>1?'s':''}</span></li>`).join('') + `</ul>`;
  } else h += `<p class="empty">${st.gained ? 'No spending this level.' : 'No skill points yet. Skill points start at level 4.'}</p>`;
  if (st.keep) h += `<p class="keep">${esc(st.keep)}</p>`;
  h += `</div>`;

  // new skills
  h += `<div class="card"><header><h3>New this level</h3></header>`;
  if (st.new.length) h += `<ul class="list">` + st.new.map(n => `<li>${skTag(n)}<span class="muted" style="font-size:.85rem">${esc((SK[n]||{}).role||'')}</span></li>`).join('') + `</ul>`;
  else h += `<p class="empty">Nothing new this level.</p>`;
  if (st.note) h += `<p class="note">${esc(st.note)}</p>`;
  h += `</div>`;

  // specialties
  if (st.specs.length) {
    h += `<div class="card"><header><h3>Specialties to take</h3><span class="eyebrow">skill level 8</span></header><ul class="list">` +
      st.specs.map(s => `<li>${skTag(s.skill)}<span class="pick">${esc(s.pick)}</span></li>`).join('') + `</ul></div>`;
  }

  // daevanion
  h += `<div class="card"><header><h3>Daevanion crystals</h3><span class="eyebrow">${row.dv ? '+4 this level' : 'opens at ' + firstBoard.opens}</span></header>`;
  if (plan.length) {
    h += `<ul class="list">` + plan.map(p => {
      const own = p.nodes.every(id => state.nodes[id]);
      const target = NODES[p.nodes[p.nodes.length-1]];
      return `<li><span class="lvbadge">${boardName(p.board)}</span>${target && target.type==='skill' && target.skill === p.label.replace(/ \+\d+$/, '') ? skTag(target.skill) : `<b>${esc(p.label)}</b>`}<span class="muted" style="font-size:.85rem">step ${p.n} · ${p.nodes.length} node${p.nodes.length>1?'s':''}</span><span class="cost num">${p.cost} cr${own ? ' · ✓ owned' : ''}</span></li>`;
    }).join('') + `</ul>
    <div class="act"><button class="pill" id="ownPlan">Mark these nodes owned</button><button class="pill ghost" id="goBoard">Open the board</button></div>`;
  } else if (row.dv) h += `<p class="empty">Nothing to buy yet: save your crystals for the next step in the route.</p>`;
  else h += `<p class="empty">The ${firstBoard.name} board opens at level ${firstBoard.opens}.</p>`;
  h += `</div>`;
  h += `</div>`; // grid2

  // skill wall
  const learned = DATA.skills.filter(s => s.kind !== 'stigma' && s.learn <= L);
  h += `<div class="card"><header><h3>Your skill levels at ${L}</h3><span class="eyebrow">from skill points · Daevanion nodes add +1 each</span></header><div class="wall">` +
    learned.map(s => { const v = lv[s.name] || 1; return `<div class="cell ${v>=10?'max':''} ${v===1?'one':''}">${icon(s.name)}<span class="lv num">${v}</span><span>${esc(s.name)}</span></div>`; }).join('') + `</div></div>`;
  h += `<div class="card"><header><h3>Notes</h3><span class="eyebrow">saved with your progress</span></header><textarea id="notes" placeholder="Where you are, what you need to buy, gear to fish for…">${esc(state.notes)}</textarea></div>`;
  $('#p-now').innerHTML = h;
  $('#markDone').onclick = () => { if (state.done[L]) delete state.done[L]; else { state.done[L] = true; planAt(L).forEach(p => p.nodes.forEach(id => state.nodes[id] = true)); } persist(); renderAll(); };
  const nx = $('#nextLvl'); if (nx) nx.onclick = () => { state.done[L] = true; planAt(L).forEach(p => p.nodes.forEach(id => state.nodes[id] = true)); state.level = L + 1; persist(); renderAll(); window.scrollTo({top:0,behavior:'smooth'}); };
  const op = $('#ownPlan'); if (op) op.onclick = () => { plan.forEach(p => p.nodes.forEach(id => state.nodes[id] = true)); persist(); renderAll(); };
  const gb = $('#goBoard'); if (gb) gb.onclick = () => { state.board = plan[0].board; showTab('daev'); renderDaev(); };
  const ta = $('#notes'); let nt; ta.oninput = () => { state.notes = ta.value; clearTimeout(nt); nt = setTimeout(persist, 600); };
}
/* ---------------- LEVELS ---------------- */
function renderLevels(){
  const doneCount = Object.keys(state.done).length;
  let h = `<div class="card"><header><h2>Levels 1–45</h2><span class="eyebrow">${doneCount} of 45 done · click a row to jump</span></header>
  <p class="note">${esc(TXT.levels || '')}</p>
  <div class="tscroll"><table><thead><tr><th></th><th>Lv</th><th>Pts</th><th>Spend</th><th>Keep / specialty</th><th>Daevanion</th><th>Notes</th></tr></thead><tbody>`;
  for (let L = 1; L <= 45; L++) {
    const st = step(L), row = lvlRow(L), plan = planAt(L);
    h += `<tr class="clickable ${L===state.level?'cur':''} ${state.done[L]?'isdone':''}" data-lvl="${L}">
      <td><input type="checkbox" class="chk" data-done="${L}" ${state.done[L]?'checked':''} aria-label="Level ${L} done"></td>
      <td class="lvcell num">${L}</td>
      <td class="num">+${st.gained}<br><span class="muted">${row.sp}</span></td>
      <td>${st.new.map(n => `<span class="mini">${icon(n)}<span class="muted">new</span></span>`).join('')}${st.alloc.map(a => `<span class="mini">${icon(a.skill)}<span class="num">${a.a}→${a.b}</span></span>`).join('') || (st.gained ? '' : '<span class="muted">—</span>')}</td>
      <td>${st.keep ? `<span class="keep">${esc(st.keep)}</span>` : ''}${st.specs.map(s => `<div class="mini">${icon(s.skill)}<span>${esc(s.pick)}</span></div>`).join('')}</td>
      <td>${plan.map(p => `<div class="mini"><span class="lvbadge">${boardName(p.board)} ${p.n}</span><span>${esc(p.label)}</span><span class="muted num">${p.cost} cr</span></div>`).join('')}${row.dv && !plan.length ? `<span class="muted num">${row.dv} cr</span>` : ''}</td>
      <td class="muted">${esc(st.note || '')}${row.unlock ? `<div style="font-size:.8rem">${esc(row.unlock)}</div>` : ''}</td></tr>`;
  }
  h += `</tbody></table></div></div>`;
  $('#p-levels').innerHTML = h;
  $('#p-levels').querySelectorAll('tr.clickable').forEach(tr => tr.addEventListener('click', e => { if (e.target.closest('input')) return; state.level = +tr.dataset.lvl; persist(); renderAll(); showTab('now'); window.scrollTo({top:0,behavior:'smooth'}); }));
  $('#p-levels').querySelectorAll('[data-done]').forEach(c => c.addEventListener('change', () => { const L = +c.dataset.done; if (c.checked) { state.done[L] = true; planAt(L).forEach(p => p.nodes.forEach(id => state.nodes[id] = true)); } else delete state.done[L]; persist(); renderAll(); }));
}
/* ---------------- SKILLS ---------------- */
function renderSkills(){
  const L = state.level, lv = levelsAt(L);
  const count = k => DATA.skills.filter(s => s.kind === k).length;
  const groups = [['active','Active skills',`${count('active')} skills raised with skill points; Specialties open at skill level 8, 12, 16 and 20`],['passive','Passive skills','Raised with the same skill points; no Specialties'],['stigma','Stigma skills','Slots at 22, 27, 32 and 37; raised with Stigma points only']];
  let h = '';
  for (const [k, title, sub] of groups) {
    h += `<div class="card"><header><h2>${title}</h2><span class="eyebrow">${sub}</span></header><div>`;
    for (const s of DATA.skills.filter(x => x.kind === k)) {
      const cur = s.kind === 'stigma' ? null : (s.learn <= L ? (lv[s.name] || 1) : null);
      const stg = DATA.stigmas.find(x => x.name === s.name);
      const sp = s.spec || {};
      h += `<div class="skillrow">${icon(s.name,'lg')}<div>
        <div class="head"><span class="sk ${s.elem||''}"><span class="nm">${esc(s.name)}</span></span>
          <span class="lvbadge">Lv ${s.learn}</span>
          ${cur !== null ? `<span class="chip">now <b class="num">${cur}</b></span>` : s.kind!=='stigma' ? `<span class="chip muted">not yet learned</span>` : ''}
          ${s.kind !== 'stigma' ? `<span class="chip">at 45 <b class="num">${s.t45}</b></span>` : stg ? `<span class="chip">slot ${stg.slot} · to <b class="num">${stg.t45}</b></span>` : ''}
        </div>
        <div class="meta">${s.cd ? `<span>Cooldown <b>${esc(s.cd)}</b></span>` : ''}${s.mp && s.mp !== '—' ? `<span>MP <b>${esc(s.mp)}</b></span>` : ''}${s.range && s.range !== '—' ? `<span>Range <b>${esc(s.range)}</b></span>` : ''}</div>
        ${s.role ? `<p class="role">${esc(s.role)}</p>` : ''}
        ${sp['8'] || sp['45'] || sp['12'] || sp['16'] ? `<div class="specs">${sp['8'] ? `<span><b>Skill 8 while levelling</b> ${esc(sp['8'])}</span>` : ''}${sp['45'] ? `<span><b>Pick at 45</b> ${esc(sp['45'])}</span>` : ''}${sp['12'] ? `<span><b>Skill 12</b> ${esc(sp['12'])}</span>` : ''}${sp['16'] ? `<span><b>Skill 16</b> ${esc(sp['16'])}</span>` : ''}</div>` : ''}
      </div></div>`;
    }
    h += `</div></div>`;
  }
  $('#p-skills').innerHTML = h;
}
/* ---------------- DAEVANION ---------------- */
function renderDaev(){
  const L = state.level, b = BOARDS[state.board];
  const nowIds = new Set(planAt(L).filter(p => p.board === b.key).flatMap(p => p.nodes));
  const routeIds = new Set(b.steps.flatMap(s => s.nodes));
  const totalCr = lvlRow(L).dv, spent = DATA.boards.reduce((a,bb)=>a+ownedCost(bb.key),0);
  const opensLine = DATA.boards.map(x => `${x.name} ${x.opens}${x.key === 'azphel' ? ' (PvP, its own crystals)' : ''}`).join(' · ');
  let h = `<div class="card">
    <header><h2>Daevanion boards</h2><span class="eyebrow">${totalCr} crystals by level ${L} · ${spent} marked spent</span></header>
    <p class="note">Numbers are the order to buy the targets on each board; the ringed nodes are the cheapest path to them. Click a node to mark it owned. Marking a level done marks that level's nodes for you. ${esc(opensLine)}.</p>
    <div class="btabs">${DATA.boards.map(x => `<button class="btab" data-board="${x.key}" aria-selected="${x.key===b.key}">${x.name}<small>opens ${x.opens} · ${ownedCost(x.key)} / ${x.nodes.reduce((a,n)=>a+n.cost,0)} cr</small></button>`).join('')}</div>
    <div class="legend">${PHASES.map((p, i) => `<span><i style="background:var(--p${i})"></i>${esc(p.split(' (')[0].replace('District quests and sealed dungeons', 'Quest & dungeon crystals'))}</span>`).join('')}<span><i style="background:var(--ok)"></i>Owned</span><span>Dim: not on the route</span></div>
    <div class="boardwrap">
      <div class="board" style="--cols:${b.cols};grid-template-columns:repeat(${b.cols},1fr)">` +
      b.nodes.map(n => {
        const cls = ['nd','g-'+n.grade, n.st!==null && n.st!==undefined ? 'ph'+n.st : '', routeIds.has(n.id) ? 'route' : '', state.nodes[n.id] ? 'owned' : '', nowIds.has(n.id) ? 'now' : ''].join(' ');
        const inner = n.type === 'skill' ? (n.icon ? `<img src="icons/${n.icon}.webp" alt="">` : `<span class="ph">${esc(initials(n.skill))}</span>`) : n.type === 'stat' ? `<span class="ab">${esc(n.short)}</span>` : '';
        return `<button class="${cls}" style="grid-column:${n.c+1};grid-row:${n.r+1}" data-node="${n.id}" aria-label="${esc(nodeTitle(n))}" ${n.type==='start'?'disabled':''}><span class="frame"></span>${inner}<span class="ring"></span>${n.n ? `<span class="n">${n.n}</span>` : ''}</button>`;
      }).join('') + `</div>
      <div>
        <p class="note" style="margin-bottom:8px"><b>${b.name}</b> opens at level ${b.opens}. Corners: ${esc(b.corners)}.${b.way ? ` On the way, as steps only: ${esc(b.way)}.` : ''}</p>
        <ol class="steps">` + b.steps.map(s => {
          const own = s.nodes.every(id => state.nodes[id]);
          const when = DATA.plan.find(p => p.board===b.key && p.n===s.n);
          return `<li class="ph${s.phase} ${own?'owned':''}" data-step="${b.key}:${s.n}"><span class="n ${s.n?'':'none'}">${s.n||'+'}</span><span>${esc(s.label)}<small>${s.nodes.length} node${s.nodes.length>1?'s':''}${when ? ` · <span class="lv">level ${when.lvl}</span>` : ` · ${esc((b.key === 'azphel' ? (DATA.azphelPhases || ['Core nodes', 'Status Effect nodes'])[s.phase] : PHASES[s.phase]) || '').split(' (')[0]}`}</small></span><span class="cost num">${s.cost} cr ${own?'✓':''}</span></li>`;
        }).join('') + `</ol>
        <div class="act" style="margin-top:10px"><button class="pill ghost" id="clearBoard">Clear owned on ${b.name}</button></div>
      </div>
    </div>
  </div>`;
  // per-level schedule
  const byLevel = DATA.plan.reduce((a, p) => a + p.cost, 0);
  h += `<div class="card"><header><h3>Crystal schedule while levelling</h3><span class="eyebrow">4 crystals a level from ${firstBoard.opens} · ${lvlRow(45).dv} by 45</span></header>
    <p class="note">${esc(TXT.schedule || '')}${byLevel < lvlRow(45).dv ? ` ${lvlRow(45).dv - byLevel} crystals are left over at 45 for the next step.` : ''}</p>
    <div class="tscroll"><table><thead><tr><th>Level</th><th>Board</th><th>Target</th><th>Cost</th><th>Nodes</th></tr></thead><tbody>` +
    DATA.plan.map(p => `<tr class="${p.lvl===L?'cur':''}"><td class="lvcell num">${p.lvl}</td><td>${boardName(p.board)} <span class="muted">#${p.n}</span></td><td>${esc(p.label)}</td><td class="num">${p.cost}</td><td class="muted" style="font-size:.8rem">${p.nodes.map(id => esc(NODES[id].label)).join(' → ')}</td></tr>`).join('') + `</tbody></table></div></div>`;
  // after 45
  h += `<div class="card"><header><h3>After 45: the rest of the route</h3><span class="eyebrow">${DATA.later.map(ph => (ph.title.match(/to (\d+)/) || [])[1]).filter(Boolean).join(' → ')} crystals</span></header>` +
    DATA.later.map(ph => `<div class="phase-h"><span class="dot" style="background:var(--p${ph.phase})"></span><b>${esc(ph.title)}</b><span class="muted num">${ph.total} crystals</span></div><ul class="steps">` +
      ph.items.map(i => `<li class="ph${ph.phase} ${i.nodes.every(id=>state.nodes[id])?'owned':''}"><span class="n ${i.n?'':'none'}">${i.n||'+'}</span><span>${boardName(i.board)}: ${esc(i.label)}<small>${i.nodes.length} node${i.nodes.length>1?'s':''}</small></span><span class="cost num">${i.cost} cr</span></li>`).join('') + `</ul>`).join('') + `</div>`;
  $('#p-daev').innerHTML = h;
  $('#p-daev').querySelectorAll('.btab').forEach(x => x.onclick = () => { state.board = x.dataset.board; persist(); renderDaev(); });
  $('#p-daev').querySelectorAll('.nd[data-node]').forEach(x => {
    x.onclick = () => { const id = x.dataset.node; if (state.nodes[id]) delete state.nodes[id]; else state.nodes[id] = true; persist(); renderDaev(); };
    x.addEventListener('mouseenter', e => showTip(e, nodeTitle(NODES[x.dataset.node]) + (state.nodes[x.dataset.node] ? ' · owned' : '')));
    x.addEventListener('mousemove', moveTip); x.addEventListener('mouseleave', hideTip);
  });
  $('#p-daev').querySelectorAll('.steps li[data-step]').forEach(li => li.onclick = () => {
    const [k, n] = li.dataset.step.split(':'); const s = BOARDS[k].steps.find(x => String(x.n) === n);
    const all = s.nodes.every(id => state.nodes[id]); s.nodes.forEach(id => { if (all) delete state.nodes[id]; else state.nodes[id] = true; }); persist(); renderDaev();
  });
  $('#clearBoard').onclick = () => { b.nodes.forEach(n => delete state.nodes[n.id]); persist(); renderDaev(); };
}
const tip = $('#tip');
function showTip(e, t){ tip.textContent = t; tip.hidden = false; moveTip(e); }
function moveTip(e){ const x = Math.min(e.clientX + 14, window.innerWidth - 270); tip.style.left = x + 'px'; tip.style.top = (e.clientY + 14) + 'px'; }
function hideTip(){ tip.hidden = true; }
/* ---------------- BUILD ---------------- */
function renderBuild(){
  let h = `<div class="card gold"><header><h2>Skill points at 45</h2><span class="eyebrow">${esc(TXT.buildSub || '')}</span></header>
    <p class="note">${esc(TXT.build || '')}</p>
    <ol class="order">` + DATA.build45.map(r => `<li><span class="o">${r.order}</span><span class="skills">${r.skills.map(s => skTag(s)).join('')}${r.alt ? `<span class="muted">${esc(r.alt)}</span>` : ''}</span><span class="to">to level<b class="num">${r.to}</b><span class="num">${r.cum} used</span></span></li>`).join('') + `</ol></div>`;
  h += `<div class="grid2"><div class="card"><header><h3>Passives, in order</h3></header><ol class="order">` +
    DATA.passives.map((p,i) => `<li><span class="o">${i+1}</span><span class="skills">${skTag(p)}</span><span class="to muted" style="max-width:220px;white-space:normal;font-weight:500">${esc((SK[p]||{}).role||'')}</span></li>`).join('') +
    `</ol><p class="note">${esc(TXT.passives || '')}</p></div>`;
  h += `<div class="card"><header><h3>Specialties at 45</h3><span class="eyebrow">two slots each</span></header><ul class="list">` +
    DATA.skills.filter(s => s.spec && s.spec['45']).map(s => `<li style="align-items:flex-start">${skTag(s.name)}<span class="spec" style="flex:1 1 200px"><span class="pick">${esc(s.spec['45'])}</span>${s.spec['12'] ? `<span class="muted" style="font-size:.85rem">At 12: ${esc(s.spec['12'])}</span>` : ''}${s.spec['16'] ? `<span class="muted" style="font-size:.85rem">At 16: ${esc(s.spec['16'])}</span>` : ''}</span></li>`).join('') +
    `</ul><p class="note">${esc(TXT.specs || '')}</p></div></div>`;
  $('#p-build').innerHTML = h;
}
/* ---------------- STIGMAS ---------------- */
function renderStig(){
  let h = `<div class="card gold"><header><h2>Stigmas</h2><span class="eyebrow">${esc(TXT.stigmaSub || '')}</span></header><div class="grid2">` +
    DATA.stigmas.map(s => `<div class="stig">${icon(s.name,'lg')}<div><div class="head" style="display:flex;flex-wrap:wrap;gap:8px;align-items:center"><b>${esc(s.name)}</b><span class="lvbadge">slot ${s.slot} · lv ${s.lvl}</span><span class="chip">to <b class="num">${s.t45}</b></span></div><p class="note">${esc(s.why)}</p></div></div>`).join('') +
    `</div><p class="note">${esc(TXT.stigma || '')}</p></div>`;
  $('#p-stig').innerHTML = h;
}
/* ---------------- MACRO ---------------- */
// Each card is {title, eyebrow, h, gold, blocks}; a block is note, keys, stacks, seq, hand or fix.
const nameTag = (name, cls='sm') => SK[name] ? skTag(name, cls) : `<span class="sk"><span class="nm">${esc(name)}</span></span>`;
const BLOCK = {
  note: b => `<p class="note">${esc(b.text)}</p>`,
  keys: b => `<div class="keys">` + b.items.map(k => `<div class="keytile ${k.macro ? 'macrokey' : ''}"><span class="kcap">${esc(k.cap)}</span><div class="kbody">${k.skill ? nameTag(k.skill) : `<b>${esc(k.label)}</b>`}</div><small>${esc(k.sub || '')}</small></div>`).join('') + `</div>`,
  stacks: b => { let n = 0; return `<div class="mstacks">` + b.items.map(st => `<div class="mstack ${st.small ? 'small' : ''}"><span class="mtag">${esc(st.tag)}</span><ol class="mcells">` +
    st.cells.map(c => { n++; return `<li class="mcell ${n===1?'first':''}"><span class="mn">${n}</span>${icon(c.skill,'sm')}<span class="sk ${(SK[c.skill]||{}).elem||''}"><span class="nm">${esc(c.skill)}</span></span>${c.extra ? `<small>${esc(c.extra)}</small>` : ''}</li>`; }).join('') + `</ol></div>`).join('') + `</div>`; },
  seq: b => `<div class="seq">` + b.items.map((s, i) => `<span class="s"><b>${i+1}</b>${s.skill ? icon(s.skill,'sm') : ''}${esc(s.label || s.skill)}</span>` + (i < b.items.length - 1 ? `<span class="a">${esc(s.arrow || '→')}</span>` : '')).join('') + `</div>`,
  hand: b => `<ul class="when">` + b.items.map(x => `<li><span class="who">${x.skills.map(n => nameTag(n)).join('')}</span><span class="why">${esc(x.why)}</span></li>`).join('') + `</ul>`,
  fix: b => `<ul class="fix">` + b.items.map(x => `<li><b>${esc(x.b)}</b> ${esc(x.text)}</li>`).join('') + `</ul>`,
};
function renderMacro(){
  $('#p-macro').innerHTML = DATA.macro.map(c => `<div class="card ${c.gold ? 'gold' : ''}"><header><h${c.h || 3}>${esc(c.title)}</h${c.h || 3}>${c.eyebrow ? `<span class="eyebrow">${esc(c.eyebrow)}</span>` : ''}</header>` +
    c.blocks.map(b => BLOCK[b.t](b)).join('\n') + `</div>`).join('');
}
/* ---------------- ARCANA ---------------- */
// The five Arcana cards: the version to keep (it sets the set and the Pantheon stat) and the skill lines to aim for.
const PANTHEON = {
  Wisdom: ['Lumiel', 'MP cost reduction', 'Smite (Double Chance)'], Time: ['Siel', 'Combat Speed', 'Smite Resist'],
  Destruction: ['Zikel', 'Attack Increase', 'Perfect Resist'], Illusion: ['Kaisinel', 'Cooldown Reduction', 'Endurance Penetration'],
  Death: ['Triniel', 'Critical Hit', 'Regeneration Penetration'], Justice: ['Nezekan', 'Defense', 'Perfect activation chance'],
  Freedom: ['Vaizel', 'Accuracy', 'Evasion'], Space: ['Israphel', 'Move Speed', 'Block Chance'],
  Destiny: ['Marchutan', 'MP', 'Endurance Chance'], Life: ['Yustiel', 'HP', 'Regeneration activation chance'],
};
const ARCANA_SETS = {
  Vigor: { name: 'Primal Vigor', b2: '+60 PvE Attack while your HP is 70% or more', b4: '+150 PvE Attack while your HP is 70% or more' },
  Magic: { name: 'Magic Armor', b2: '1,500 MP back when your MP falls to 20% or less (30 s cooldown)', b4: '+1,000 PvE Defense while your MP is 50% or more' },
};
const ARCANA_POOL = { Chalice: 'Rolls any of your Active and Passive skills (22)', Parchment: 'Rolls from one half of your Active skills (6)', Compass: 'Rolls from the other half of your Active skills (6)', Bell: 'Rolls from one half of your Passive skills (5)', Mirror: 'Rolls from the other half of your Passive skills (5)' };
const ARCANA_ICON = {
  Chalice: '<path d="M7 3h10v4a5 5 0 0 1-10 0z"/><path d="M12 12v6M8 21h8M9 18h6"/>',
  Parchment: '<path d="M6 4h11a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7"/><path d="M6 4a2 2 0 0 0-2 2v1h4V6a2 2 0 0 0-2-2zM7 20a2 2 0 0 1-2-2V7M9 9h7M9 13h7M9 17h4"/>',
  Compass: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
  Bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0M12 3v2"/>',
  Mirror: '<ellipse cx="12" cy="9" rx="6" ry="7"/><path d="M12 16v5M9 21h6M9.5 6.5l2-2"/>',
};
function renderArcana(){
  const A = DATA.arcana || { cards: [] };
  const count = { Vigor: 0, Magic: 0 }; A.cards.forEach(c => count[c.set] = (count[c.set] || 0) + 1);
  const alts = t => (A.alts || []).filter(a => a.card === t);
  const lineTag = o => `${SK[o.skill] ? skTag(o.skill, 'sm') : `<span class="sk"><span class="nm">${esc(o.skill)}</span></span>`}${o.size ? `<b class="sz num">+${o.size}</b>` : ''}`;
  let h = `<div class="card gold"><header><h2>Arcana at 45</h2><span class="eyebrow">five cards · worn from level 45</span></header>
    <p class="note">Which version of each card to keep, and the skill lines to aim for. The version (of Vigor or of Magic) decides the card's set and its Pantheon stat. A number is the line's target size: each card level raises a random line by 1, up to +4 a line, so treat it as a target. A line without a number is fine at any size.</p>
    <div class="acards">` + A.cards.map(c => {
      const P = PANTHEON[c.stat] || ['', '', ''], S = ARCANA_SETS[c.set] || { name: c.set };
      return `<article class="acard set-${esc(c.set.toLowerCase())}">
        <div class="atop"><span class="aico" aria-hidden="true"><svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${ARCANA_ICON[c.type] || ''}</svg></span>
          <div><h3>${esc(c.type)}</h3><small>of ${esc(c.set)} · ${esc(S.name)}</small></div></div>
        <div class="astat"><b>${esc(c.stat)}</b><span>${esc(P[1])} · ${esc(P[2])}</span></div>
        <ol class="alines">${c.lines.map(l => `<li>${l.opts.map(lineTag).join('<span class="or">or</span>')}${l.note ? `<small>${esc(l.note)}</small>` : ''}</li>`).join('')}
          ${c.rest ? `<li class="rest">${esc(c.rest.replace(/^the rest: /, 'Other lines: '))}</li>` : ''}</ol>
        <p class="apool">${esc(ARCANA_POOL[c.type] || '')}</p>
        ${alts(c.type).map(a => `<p class="aalt"><b>Also played</b>${esc(a.text)}</p>`).join('')}
      </article>`;
    }).join('') + `</div>
    ${A.note ? `<p class="note">${esc(A.note)}</p>` : ''}</div>`;
  h += `<div class="grid2"><div class="card"><header><h3>Set bonuses with these cards</h3><span class="eyebrow">${count.Vigor || 0} Vigor · ${count.Magic || 0} Magic</span></header><ul class="list">` +
    Object.entries(ARCANA_SETS).flatMap(([k, S]) => [[2, S.b2], [4, S.b4]].map(([n, b]) => `<li><span class="chip ${(count[k] || 0) >= n ? 'on' : 'off'}">${esc(S.name)} ${n}</span><span class="${(count[k] || 0) >= n ? '' : 'muted'}" style="font-size:.9rem;flex:1 1 180px;min-width:0">${esc(b)}</span><span class="cost">${(count[k] || 0) >= n ? '✓ active' : '—'}</span></li>`)).join('') +
    `</ul><p class="note">Five cards fit one four-card bonus or both two-card bonuses, not both. Four Vigor cards trade a Magic card's Pantheon stat and the MP refill for +150 PvE Attack; flat Attack is worth under 1% per 100 on endgame gear, more on lighter gear.</p></div>`;
  h += `<div class="card"><header><h3>How cards work</h3></header><ul class="list" style="font-size:.9rem">
      <li><b>Lines by grade</b><span class="muted">Common 1, Rare 2, Epic 3, Unique 4, each a skill or passive from that card's pool. A card also adds item level (20 to 80 by grade).</span></li>
      <li><b>Levelling</b><span class="muted">Feed cards or Training Arcana from Transcendence dungeons into the card you wear. Feeding a levelled card into a better one returns all its EXP, so switch whenever a better card drops.</span></li>
      <li><b>Crafting (Transmute)</b><span class="muted">5 Mysterious Crystals and 2,000,000 Kina, plus 10 crystals and 3,000,000 Kina for each line you choose, up to two. Crystals come from extracting cards, the Season 1 challenge and the Season Shop, and can't be traded.</span></li>
      <li><b>Craft the Chalice first</b><span class="muted">It is the only card that can roll any skill, so your top skill shows up on only about 18% of Unique Chalices; choosing the line is worth the crystals.</span></li>
    </ul></div></div>`;
  h += `<div class="card"><header><h3>Pantheon stats on these cards</h3><span class="eyebrow">each stat has two effects</span></header><div class="tscroll"><table><thead><tr><th>Stat</th><th>Deity</th><th>Effects</th><th>On</th></tr></thead><tbody>` +
    [...new Set(A.cards.map(c => c.stat))].map(st => `<tr><td><b>${esc(st)}</b></td><td class="muted">${esc((PANTHEON[st] || [''])[0])}</td><td>${esc((PANTHEON[st] || []).slice(1).join(' · '))}</td><td class="muted">${esc(A.cards.filter(c => c.stat === st).map(c => c.card).join(', '))}</td></tr>`).join('') +
    `</tbody></table></div><p class="note">The other versions: Chalice and Parchment come in both sets too; the Compass of Vigor carries Freedom and of Magic Death, the Bell Justice or Destruction, and the Mirror Illusion or Wisdom. For damage, sources rank Wisdom, Time and Destruction highest.</p></div>`;
  $('#p-arcana').innerHTML = h;
}
/* ---------------- SOURCES ---------------- */
function renderSrc(){
  const a = (u, t) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(t)}</a>`;
  const cls = META.cls;
  $('#p-src').innerHTML = `<div class="card"><header><h2>Sources</h2><span class="eyebrow">compiled ${esc(META.compiled || '18 Oct 2026')}</span></header>
  <ol class="src">` + DATA.sources.map(s => `<li>${s.url ? a(s.url, s.title) : s.links.map(l => a(l[0], l[1])).join(' and ')}: ${esc(s.what)}</li>`).join('') +
    `<li>${a('https://aion2maps.com/guides/' + cls + '/#arcana', 'Aion 2 Maps: ' + META.name + ' Arcana')}, ${a('https://aion2maps.com/guides/arcana/', 'Arcana')} and ${a('https://aion2maps.com/guides/pantheon-stats/', 'Pantheon stats')}: the cards and lines to keep, set bonuses, card pools and crafting costs, and what each Pantheon stat does.</li>
    <li>Game art: skill icons and Daevanion node frames are &copy; NCSOFT Corporation, all rights reserved. Icons were taken from ${a('https://metabot.gg/en/aion-2/skills', 'Metabot')} and node frames from ${a(`https://wikily.gg/aion-2/daevanion/${cls}/nezekan`, 'Wikily')}. They identify skills and nodes in this unofficial fan tool, which NCSOFT does not endorse. AION is a trademark of NCSOFT Corporation.</li>
  </ol>
  <p class="note">${esc(TXT.src || '')}</p></div>`;
}
/* ---------------- tabs & level ---------------- */
const TABS = ['now','levels','skills','daev','build','stig','arcana','macro','src'];
function showTab(id){
  document.querySelectorAll('.tab').forEach(t => t.setAttribute('aria-selected', t.dataset.tab === id));
  document.querySelectorAll('.panel').forEach(p => p.classList.toggle('on', p.id === 'p-' + id));
  try { sessionStorage.setItem(STORE + '-tab', id); } catch(e){}
}
document.querySelectorAll('.tab').forEach(t => t.onclick = () => showTab(t.dataset.tab));
function setLevel(L){ state.level = Math.min(45, Math.max(1, L)); persist(); renderAll(); }
$('#lvDown').onclick = () => setLevel(state.level - 1);
$('#lvUp').onclick = () => setLevel(state.level + 1);
$('#lvRange').oninput = e => setLevel(+e.target.value);
function renderAll(){
  $('#lvOut').value = state.level; $('#lvRange').value = state.level;
  renderNow(); renderLevels(); renderSkills(); renderDaev(); renderBuild(); renderStig(); renderArcana(); renderMacro();
}
if (typeof siteMenu === 'function') siteMenu(META.cls, '../');
loadLocal();
renderSrc(); renderAll();
try { const t = sessionStorage.getItem(STORE + '-tab'); if (t) showTab(t); } catch(e){}
const hash = (location.hash || '').slice(1); if (TABS.includes(hash)) showTab(hash);
connect();
