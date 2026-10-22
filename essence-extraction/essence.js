/* Essence Extraction planner: proficiency 1–100, what to gather and where, and where the skill points go. Data in data.js (E). */
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = n => n.toLocaleString('en-US');
const STORE = 'essence-planner';
const ROW = E.curve.map(([prof, next, cum, c, s]) => ({ prof, next, cum, c, s }));
const row = p => ROW[p - 1];
const state = { level: 1, xp: 0, faction: 'asmo', main: 'Ore', quest: false, notes: '' };

function loadLocal(){ try { const j = JSON.parse(localStorage.getItem(STORE) || 'null'); if (j) Object.assign(state, j); } catch(e){} }
function saveLocal(){ try { localStorage.setItem(STORE, JSON.stringify(state)); } catch(e){} }
function setSave(t, cls){ const el = $('#saveState'); el.textContent = t; el.className = 'save ' + (cls||''); }
let db = null, docRef = null, saveTimer = null;
const snapshot = () => ({ level: state.level, xp: state.xp, faction: state.faction, main: state.main, quest: state.quest, notes: state.notes, updatedAt: new Date().toISOString() });
function persist(){
  saveLocal();
  if (!docRef) { setSave('Saved on this device', 'local'); return; }
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => { try { setSave('Saving…'); await docRef.set(snapshot()); setSave('Saved to your account', 'ok'); } catch(e) { setSave('Saved on this device only', 'local'); } }, 500);
}
async function connect(){
  try {
    const [d, u] = await Promise.all([window.claude?.use?.('db'), window.claude?.use?.('user')]);
    const uid = d && u ? await u.id() : null;
    if (!uid) { setSave('Saved on this device', 'local'); return; }
    db = d; docRef = db.doc('data/users/' + uid + '/progress-essence');
    const snap = await docRef.get();
    if (snap.exists) Object.assign(state, snap.data()); else await docRef.set(snapshot());
    saveLocal(); renderAll(); setSave('Saved to your account', 'ok');
  } catch (e) { setSave('Saved on this device', 'local'); }
}

/* ---------------- skill point plan ---------------- */
// Common: Proficient Handling and Delicate Touch together to 5, Lady Luck to 5 (exactly the 45 Novice points),
// then Proficient Handling and Delicate Touch to 10 with the 50 Professional points. Levels 6–10 need Professional.
const COMMON_ORDER = [];
for (let l = 1; l <= 5; l++) COMMON_ORDER.push(['Proficient Handling', l], ['Delicate Touch', l]);
for (let l = 1; l <= 5; l++) COMMON_ORDER.push(['Lady Luck', l]);
for (let l = 6; l <= 10; l++) COMMON_ORDER.push(['Proficient Handling', l], ['Delicate Touch', l]);
const commonCost = l => l <= 5 ? l : 5;
// Specialty: Odyle (morphs into anything) and your main material maxed; Gem Seeker before the Ruby test.
// Levels 2–3 of a tree need Professional. If your main is not Gems, the Gem Seeker point leaves your main Appraiser at 2.
function specialtyOrder(main){
  const m = main === 'Cooking Ingredient' ? 'Cooking' : main;
  const o = [['Odyle', 'Seeker', 1]];
  if (m !== 'Gem') o.push([m, 'Seeker', 1]);
  o.push(['Odyle', 'Plentiful Harvest', 1], ['Gem', 'Seeker', 1], [m, 'Plentiful Harvest', 1], ['Odyle', 'Appraiser', 1]);
  if (m === 'Gem') o.splice(5, 0, ['Gem', 'Appraiser', 1]);
  o.push(['Odyle', 'Plentiful Harvest', 2], ['Odyle', 'Plentiful Harvest', 3], ['Odyle', 'Appraiser', 2], ['Odyle', 'Appraiser', 3],
    [m, 'Plentiful Harvest', 2], [m, 'Plentiful Harvest', 3]);
  if (m === 'Gem') o.push(['Gem', 'Appraiser', 2], ['Gem', 'Appraiser', 3]); else o.push([m, 'Appraiser', 1], [m, 'Appraiser', 2]);
  return o;
}
// Walk proficiency 1..100 and buy in order as points come in; record what is bought at each level.
function pointPlan(main){
  const buys = {}, have = { c: 0, s: 0 };
  let ci = 0, si = 0;
  const sOrder = specialtyOrder(main);
  for (const r of ROW) {
    have.c += r.c; have.s += r.s;
    const pro = r.prof >= 51, b = [];
    while (ci < COMMON_ORDER.length) {
      const [n, l] = COMMON_ORDER[ci];
      if ((l > 5 && !pro) || commonCost(l) > have.c) break;
      have.c -= commonCost(l); ci++; b.push({ kind: 'c', name: n, lvl: l, cost: commonCost(l) });
    }
    while (si < sOrder.length) {
      const [t, n, l] = sOrder[si];
      if ((l > 1 && !pro) || have.s < 1) break;
      have.s -= 1; si++; b.push({ kind: 's', name: `${t} ${n}`, lvl: l, cost: 1 });
    }
    buys[r.prof] = { buys: b, spareC: have.c, spareS: have.s };
  }
  return buys;
}
function levelsAt(plan, p){
  const lv = {};
  for (let i = 1; i <= p; i++) plan[i].buys.forEach(b => lv[b.name] = b.lvl);
  return lv;
}

/* ---------------- helpers ---------------- */
const F = () => E.factions[state.faction];
const isAsmo = () => state.faction === 'asmo';
const nodesOf = m => isAsmo() ? m.asmo : m.elyos;
function xpTo(target){ const r = row(state.level); return Math.max(0, row(target).cum - r.cum - (r.next ? Math.min(state.xp, r.next - 1) : 0)); }
function attempts(xp){ const [lo, hi] = E.xpPerAttempt; return xp ? `${fmt(Math.ceil(xp / hi))}–${fmt(Math.ceil(xp / lo))}` : '0'; }
const stage = p => p < 50 ? 'novice' : p === 50 ? 'test' : p < 100 ? 'pro' : 'max';
const grade = p => p <= 50 ? 'Novice' : 'Professional';
const spot = s => `<li><span class="sk"><span class="nm">${esc(s.name)}</span></span><span class="muted" style="font-size:.85rem">${esc(s.what || '')}</span>${s.n ? `<span class="cost num">${s.n} ${s.kind === 'zone' ? 'points' : 'nodes'}</span>` : ''}</li>`;
const buyTag = b => `<span class="chip">${esc(b.name)} <b class="num">${b.lvl}</b>${b.kind === 'c' ? `<span class="muted num">${b.cost} pt${b.cost > 1 ? 's' : ''}</span>` : ''}</span>`;
const seg = (name, opts, cur) => `<div class="btabs" role="group">${opts.map(([v, l]) => `<button class="btab" data-${name}="${esc(v)}" aria-selected="${v === cur}">${esc(l)}</button>`).join('')}</div>`;

/* ---------------- NOW ---------------- */
function renderNow(){
  const p = state.level, r = row(p), st = stage(p), plan = pointPlan(state.main), lv = levelsAt(plan, p), f = F();
  const to50 = p < 50 ? xpTo(50) : 0, to100 = xpTo(100);
  const pct = Math.round(100 * (r.cum + Math.min(state.xp, r.next || 0)) / row(100).cum);
  let h = `<div class="card gold"><header><h2>Proficiency ${p}</h2><span class="eyebrow">${grade(p)} · ${pct}% of the way to 100</span></header>
    <div class="bar" aria-hidden="true"><i style="width:${pct}%"></i><b style="left:${(2127 / 7204 * 100).toFixed(1)}%"></b></div>
    <div class="chips">
      ${r.next ? `<span class="chip">To ${p + 1} <b class="num">${fmt(r.next - Math.min(state.xp, r.next - 1))} XP</b></span>` : st === 'test' ? `<span class="chip">XP stops here: <b>do the upgrade test</b></span>` : `<span class="chip"><b>Max proficiency</b></span>`}
      ${p < 50 ? `<span class="chip">To 50 <b class="num">${fmt(to50)} XP</b> <span class="muted">≈ ${attempts(to50)} attempts</span></span>` : ''}
      ${p < 100 ? `<span class="chip">To 100 <b class="num">${fmt(to100)} XP</b> <span class="muted">≈ ${attempts(to100)} attempts</span></span>` : ''}
    </div>
    ${r.next ? `<label class="xpin">XP into this level <input type="number" id="xpIn" min="0" max="${r.next - 1}" value="${Math.min(state.xp, r.next - 1)}" inputmode="numeric"> <span class="muted">of ${r.next}</span></label>` : ''}
    <div class="act">
      ${p < 100 ? `<button class="pill primary" id="nextLvl">${st === 'test' ? 'Test done: go to 51 →' : `Reached ${p + 1} →`}</button>` : ''}
    </div>
    <p class="note">Attempt counts are a rough estimate (12–18 XP an attempt, worked out from Global players' 40–60 Sapphire veins to reach 50). XP per attempt is not published.</p>
  </div>`;
  h += `<div class="grid2">`;
  // what to do
  h += `<div class="card"><header><h3>${st === 'novice' ? 'Gather: Novice loop' : st === 'test' ? 'The Professional test' : st === 'pro' ? 'Gather: Professional loop' : 'Done'}</h3><span class="eyebrow">${esc(f.name)} · ${esc(f.map)}</span></header>`;
  if (st === 'novice') {
    h += `<p class="note">Gather every node you pass while questing from character level 10. To push it, loop the densest spots below and take everything: node level never matters, and failed attempts still give XP. Fill gaps with Odyle in the air and herbs or cooking ingredients, the quickest nodes.</p>
      <ul class="list">${f.spots.map(spot).join('')}</ul>`;
    if (p >= 45) h += `<p class="keep">The test starts at 50 and needs Ruby: make sure you have Gem Seeker by then (plan below).</p>`;
  } else if (st === 'test') {
    h += `<p class="note">At 50 the quest <b>[Upgrade] Essence Extraction Specialty Skill</b> starts on its own. Talk to <b>${esc(f.npc)}</b> (${esc(f.npcAt)}), then extract Ruby until a <b>Splendent Ruby (Bound)</b> drops, and hand it in. It only drops while the quest is active; no drop rate is published. Rubies sit high on cliffs, so look from the air.</p>
      <ul class="list">${f.ruby.map(spot).join('')}</ul>
      <div class="act"><button class="pill ${state.quest ? 'done' : ''}" id="questDone">${state.quest ? '✓ Test done' : 'Mark the test done'}</button></div>`;
  } else if (st === 'pro') {
    h += `<p class="note">Same loops, 5,077 XP to 100. Now the Specialty points go deep: Odyle first (it morphs into anything), then your main material. Gather your main material and Odyle by preference; everything else still pays XP.</p>
      <ul class="list">${f.spots.map(spot).join('')}</ul>`;
  } else h += `<p class="note">Proficiency 100 is the cap on Global. Higher grades exist in the game files but have no nodes yet.</p>`;
  h += `</div>`;
  // points
  const here = plan[p].buys;
  h += `<div class="card"><header><h3>Skill points at ${p}</h3><span class="eyebrow">main material: ${esc(state.main)}</span></header>
    ${here.length ? `<p class="note">Spend now:</p><div class="chips">${here.map(buyTag).join('')}</div>` : `<p class="empty">Nothing new to spend at ${p}.</p>`}
    <p class="note">You should have:</p>
    <div class="chips">${Object.entries(lv).map(([n, l]) => `<span class="chip">${esc(n)} <b class="num">${l}</b></span>`).join('') || '<span class="empty">No points yet: the first comes at 2.</span>'}</div>
    ${plan[p].spareC ? `<p class="keep">${plan[p].spareC} Common point${plan[p].spareC > 1 ? 's' : ''} held for the next level of ${esc((COMMON_ORDER.find(([n, l]) => !(lv[n] >= l)) || [''])[0])}.</p>` : ''}
  </div>`;
  h += `</div>`;
  h += `<div class="card"><header><h3>Your setup</h3><span class="eyebrow">changes the spots and the Specialty plan</span></header>
    <div class="grid2"><div><p class="eyebrow" style="margin-bottom:6px">Faction</p>${seg('faction', [['asmo', 'Asmodian · Altgard'], ['elyos', 'Elyos · Verteron']], state.faction)}</div>
    <div><p class="eyebrow" style="margin-bottom:6px">Main material (your craft)</p>${seg('main', E.mains.map(m => [m, m]), state.main)}</div></div>
    <p class="note">Pick the material your main craft uses: Ore for Blacksmithing and Armorsmithing, Gems for Handicrafting accessories, Logs for bows and staffs, Herbs for Alchemy. Odyle is in every plan.</p></div>`;
  h += `<div class="card"><header><h3>Notes</h3><span class="eyebrow">saved with your progress</span></header><textarea id="notes" placeholder="Your loop, a good channel, what you still need…">${esc(state.notes)}</textarea></div>`;
  $('#p-now').innerHTML = h;
  const nx = $('#nextLvl'); if (nx) nx.onclick = () => { if (st === 'test') state.quest = true; setLevel(p + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const qd = $('#questDone'); if (qd) qd.onclick = () => { state.quest = !state.quest; persist(); renderNow(); };
  const xi = $('#xpIn'); if (xi) xi.onchange = () => { state.xp = Math.max(0, Math.min(r.next - 1, +xi.value || 0)); persist(); renderNow(); };
  $('#p-now').querySelectorAll('[data-faction]').forEach(b => b.onclick = () => { state.faction = b.dataset.faction; persist(); renderAll(); });
  $('#p-now').querySelectorAll('[data-main]').forEach(b => b.onclick = () => { state.main = b.dataset.main; persist(); renderAll(); });
  const ta = $('#notes'); let nt; ta.oninput = () => { state.notes = ta.value; clearTimeout(nt); nt = setTimeout(persist, 600); };
}

/* ---------------- ROUTE ---------------- */
function renderRoute(){
  const f = F(), other = E.factions[isAsmo() ? 'elyos' : 'asmo'];
  const cur = stage(state.level);
  const stageCard = (key, title, eyebrow, body) => `<div class="card ${cur === key ? 'gold' : ''}"><header><h3>${title}</h3><span class="eyebrow">${eyebrow}${cur === key ? ' · you are here' : ''}</span></header>${body}</div>`;
  let h = `<div class="card"><header><h2>The fastest route</h2><span class="eyebrow">7,204 XP from 1 to 100</span></header>
    <p class="note">Gathering costs nothing and has no daily cap, every node on Global counts from proficiency 1, and failed attempts still give XP. So the route is simply: reach as many nodes a minute as you can, and never sit at 50. No guide publishes XP-per-minute numbers, so the spots below are the densest by node count.</p></div>`;
  h += stageCard('novice', '1 → 50: Novice', '2,127 XP · roughly 120–180 attempts', `
    <ol class="steps">
      <li class="ph0"><span class="n">1</span><span>From character level 10, gather everything on your quest path<small>No quest needed: walk up to a node and press F. Ore and Odyle are the most common nodes.</small></span><span class="cost"></span></li>
      <li class="ph0"><span class="n">2</span><span>Loop the densest spots for ${esc(f.name)}s<small>${f.spots.slice(0, 4).map(s => esc(s.name)).join(' · ')}</small></span><span class="cost"></span></li>
      <li class="ph0"><span class="n">3</span><span>Prefer quick nodes when you have a choice<small>Herbs, cooking ingredients and Odyle (gauge 360) before ore and logs (450) and gems (630). An inference from gauge size.</small></span><span class="cost"></span></li>
      <li class="ph0"><span class="n">4</span><span>Points: Proficient Handling and Delicate Touch together, then Lady Luck<small>All three reach 5 at exactly 50. Specialty: Odyle Seeker, your main Seeker, Odyle Plentiful Harvest, and Gem Seeker by 40.</small></span><span class="cost"></span></li>
    </ol>`);
  h += stageCard('test', '50: the Professional test', 'XP stops until it is done', `
    <p class="note">The quest starts on its own at 50. See <b>${esc(f.npc)}</b> at ${esc(f.npcAt)}, then extract Ruby until a Splendent Ruby (Bound) drops and hand it in. It only drops while the quest is active.</p>
    <ul class="list">${f.ruby.map(spot).join('')}</ul>`);
  h += stageCard('pro', '51 → 100: Professional', '5,077 XP · roughly 290–430 attempts', `
    <ol class="steps">
      <li class="ph1"><span class="n">1</span><span>Same loops<small>Eltnen and Morheim stay closed until the level-46 content; the Abyss (Chaotic Lower Reshanta) adds 240 Odyle nodes, in a PvP zone.</small></span><span class="cost"></span></li>
      <li class="ph1"><span class="n">2</span><span>Max Odyle's Specialty tree, then your main material's<small>Odyle morphs 1:1 into any gathered material of the same grade, so it is never wasted.</small></span><span class="cost"></span></li>
      <li class="ph1"><span class="n">3</span><span>Common points: Proficient Handling and Delicate Touch to 10<small>95 points: 40 + 40 + Lady Luck's 15. The other community split is Lady Luck 10, Proficient Handling 9, Delicate Touch 6.</small></span><span class="cost"></span></li>
    </ol>`);
  h += `<div class="card"><header><h3>Densest spots</h3><span class="eyebrow">nodes near each teleport; zone totals are all gathering points</span></header><div class="grid2">
    <div><p class="eyebrow" style="margin-bottom:6px">${esc(f.name)} · ${esc(f.map)} (yours)</p><ul class="list">${f.spots.map(spot).join('')}</ul></div>
    <div><p class="eyebrow" style="margin-bottom:6px">${esc(other.name)} · ${esc(other.map)}</p><ul class="list">${other.spots.map(spot).join('')}</ul></div></div></div>`;
  h += `<div class="card"><header><h3>Mistakes that cost XP</h3></header><ul class="fix">${E.mistakes.map(([b, t]) => `<li><b>${esc(b)}</b> ${esc(t)}</li>`).join('')}</ul></div>`;
  h += `<div class="card"><header><h3>Good to know</h3></header><ul class="list">${E.tips.map(t => `<li><span class="note">${esc(t)}</span></li>`).join('')}</ul></div>`;
  $('#p-route').innerHTML = h;
}

/* ---------------- PROFICIENCY TABLE ---------------- */
function renderTable(){
  const plan = pointPlan(state.main);
  let h = `<div class="card"><header><h2>Proficiency 1–100</h2><span class="eyebrow">click a row to jump</span></header>
    <p class="note">XP needed for each level, from the game's own table. Every level gives a Common point, except 10, 20, 30 and 40 (a Specialty point instead) and 50, 60, 70, 80, 90 and 100 (both). 95 Common and 14 Specialty in all.</p>
    <div class="tscroll"><table><thead><tr><th>Prof</th><th>XP to next</th><th>XP total</th><th>Points</th><th>Spend</th></tr></thead><tbody>`;
  for (const r of ROW) {
    const b = plan[r.prof].buys;
    h += `<tr class="clickable ${r.prof === state.level ? 'cur' : ''} ${r.prof < state.level ? 'isdone' : ''}" data-lvl="${r.prof}"><td class="lvcell num">${r.prof}</td>
      <td class="num">${r.next ? fmt(r.next) : r.prof === 50 ? '<span class="keep" style="font-size:.85rem">test</span>' : 'max'}</td><td class="num muted">${fmt(r.cum)}</td>
      <td class="num">${r.c ? `+${r.c} C` : ''}${r.s ? ` +${r.s} S` : ''}</td>
      <td style="font-size:.85rem">${b.map(x => `${esc(x.name)} ${x.lvl}`).join(' · ')}</td></tr>`;
  }
  h += `</tbody></table></div></div>`;
  $('#p-table').innerHTML = h;
  $('#p-table').querySelectorAll('tr.clickable').forEach(tr => tr.onclick = () => { setLevel(+tr.dataset.lvl); showTab('now'); window.scrollTo({ top: 0, behavior: 'smooth' }); });
}

/* ---------------- SKILL POINTS ---------------- */
function renderPoints(){
  const plan = pointPlan(state.main), lv100 = levelsAt(plan, 100), so = specialtyOrder(state.main);
  let h = `<div class="card gold"><header><h2>Common skills</h2><span class="eyebrow">95 points · work on every node</span></header>
    <ul class="list">${E.common.map(c => `<li style="align-items:flex-start"><span class="sk" style="min-width:170px"><span class="nm">${esc(c.name)}</span></span><span class="note" style="flex:1 1 260px">${esc(c.effect)}</span><span class="chip">at 100 <b class="num">${lv100[c.name] || 0}</b></span></li>`).join('')}</ul>
    <p class="note">Levels 1–5 cost 1, 2, 3, 4 and 5 points (15 in all) and can be bought as Novice; levels 6–10 cost 5 each and need Professional. Maxing all three would take 120 points and there are 95, so one stays at 5: Lady Luck, which only helps on attempts that are already going badly.</p>
    <ol class="order">
      <li><span class="o">1</span><span class="skills">Proficient Handling and Delicate Touch, a level each in turn, to 5</span><span class="to">by<b class="num">${Object.keys(plan).find(k => plan[k].buys.some(b => b.name === 'Delicate Touch' && b.lvl === 5))}</b></span></li>
      <li><span class="o">2</span><span class="skills">Lady Luck to 5</span><span class="to">by<b class="num">${Object.keys(plan).find(k => plan[k].buys.some(b => b.name === 'Lady Luck' && b.lvl === 5))}</b></span></li>
      <li><span class="o">3</span><span class="skills">Proficient Handling and Delicate Touch to 10</span><span class="to">by<b class="num">${Object.keys(plan).find(k => plan[k].buys.some(b => b.name === 'Delicate Touch' && b.lvl === 10))}</b></span></li>
    </ol></div>`;
  h += `<div class="card"><header><h2>Specialty skills</h2><span class="eyebrow">14 points · one tree per node type</span></header>
    <ul class="list">${E.specialty.map(c => `<li style="align-items:flex-start"><span class="sk" style="min-width:170px"><span class="nm">${esc(c.name)}</span></span><span class="note" style="flex:1 1 260px">${esc(c.effect)}</span><span class="chip">${c.levels} level${c.levels > 1 ? 's' : ''}</span></li>`).join('')}</ul>
    <p class="note">Each type (Ore, Gem, Log, Herb, Cooking Ingredient, Odyle) has its own Seeker, Plentiful Harvest and Appraiser, 7 points to max; levels 2 and 3 need Professional. 14 points max exactly two types. A respec costs 50,000 Kina.</p>
    <div style="margin-top:4px"><p class="eyebrow" style="margin-bottom:6px">Main material</p>${seg('main', E.mains.map(m => [m, m]), state.main)}</div>
    <div class="tscroll"><table><thead><tr><th>#</th><th>Skill</th><th>Level</th><th>At proficiency</th></tr></thead><tbody>` +
    so.map(([t, n, l], i) => { const at = Object.keys(plan).find(k => plan[k].buys.some(b => b.kind === 's' && b.name === `${t} ${n}` && b.lvl === l)); return `<tr class="${+at <= state.level ? 'isdone' : ''}"><td class="num">${i + 1}</td><td>${esc(t)} ${esc(n)}</td><td class="num">${l}</td><td class="num lvcell">${at || '—'}</td></tr>`; }).join('') +
    `</tbody></table></div>
    <p class="note">${state.main === 'Gem' ? 'With Gems as your main, Gem Seeker counts twice: Odyle and Gems both end maxed.' : `Gem Seeker for the Ruby test costs your main tree its last Appraiser level, so ${esc(state.main)} Appraiser stops at 2. Respec Gem Seeker out after the test (50,000 Kina) if you want the last level.`}</p></div>`;
  $('#p-points').innerHTML = h;
  $('#p-points').querySelectorAll('[data-main]').forEach(b => b.onclick = () => { state.main = b.dataset.main; persist(); renderAll(); });
}

/* ---------------- MATERIALS ---------------- */
function renderMats(){
  const f = F();
  const mats = E.materials.filter(m => nodesOf(m) || m.group === 'Odyle');
  let h = `<div class="card"><header><h2>Materials in ${esc(f.map)}</h2><span class="eyebrow">${esc(f.name)} · ${mats.length} materials</span></header>
    <p class="note">Every material needs proficiency 1. Ore, gems, logs and Odyle roll one of four grades (common, Fine, Pure, Radiant); cooking ingredients give 1 or 3. The gauge is how full the Success bar must get: smaller is quicker. Node counts are for ${esc(f.map)}, the only open ${esc(f.name)} map for now.</p>
    <div class="tscroll"><table><thead><tr><th>Material</th><th>Kind</th><th>Gauge</th><th>Nodes</th><th>Used for</th></tr></thead><tbody>` +
    mats.map(m => `<tr><td><a href="${esc(m.url)}" target="_blank" rel="noopener">${esc(m.name)}</a></td><td>${esc(m.kind)}</td><td class="num">${m.gauge}</td><td class="num">${fmt(nodesOf(m))}${m.abyss ? `<br><span class="muted">+${m.abyss} Abyss</span>` : ''}</td><td class="muted" style="font-size:.85rem">${esc(m.uses)}</td></tr>`).join('') +
    `</tbody></table></div>
    <div style="margin-top:4px">${seg('faction', [['asmo', 'Asmodian · Altgard'], ['elyos', 'Elyos · Verteron']], state.faction)}</div></div>`;
  h += `<div class="card"><header><h3>Odyle</h3><span class="eyebrow">the one to keep</span></header>
    <p class="note">Odyle is extracted in flight, so it is limited by your flight time; there is an option for auto-flight on Odyle nodes. Conquest dungeons also leave Odyle nodes after the last boss. Every crafting chain uses it, and Substance Morph turns 1 Odyle into 1 ore, gem, log or herb of the same grade (it always succeeds; it needs the matching craft's proficiency). It also turns into Odyle Energy, up to 4 times a week per character.</p></div>`;
  $('#p-mats').innerHTML = h;
  $('#p-mats').querySelectorAll('[data-faction]').forEach(b => b.onclick = () => { state.faction = b.dataset.faction; persist(); renderAll(); });
}

/* ---------------- SOURCES ---------------- */
function renderSrc(){
  $('#p-src').innerHTML = `<div class="card"><header><h2>Sources</h2><span class="eyebrow">compiled 18 Oct 2026</span></header>
    <ol class="src">${E.sources.map(s => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a>: ${esc(s.what)}</li>`).join('')}</ol>
    <p class="note">The XP table, points, skill effects, materials and node counts come from game data and agree across sources. Three things are not published anywhere: XP per attempt, time per attempt and node respawn time, so the attempt counts are estimates and the advice to favour small-gauge nodes is an inference. Guides disagree on attempts per node (3 in the game data, 2 to 4 in several guides). There are no gathering tools in AION 2: all gathering bonuses come from the skill points above.</p></div>`;
}

/* ---------------- tabs & level ---------------- */
const TABS = ['now', 'route', 'table', 'points', 'mats', 'src'];
function showTab(id){
  document.querySelectorAll('.tab').forEach(t => t.setAttribute('aria-selected', t.dataset.tab === id));
  document.querySelectorAll('.panel').forEach(p => p.classList.toggle('on', p.id === 'p-' + id));
  try { sessionStorage.setItem(STORE + '-tab', id); } catch(e){}
}
document.querySelectorAll('.tab').forEach(t => t.onclick = () => showTab(t.dataset.tab));
function setLevel(L){ L = Math.min(100, Math.max(1, L)); if (L !== state.level) state.xp = 0; state.level = L; persist(); renderAll(); }
$('#lvDown').onclick = () => setLevel(state.level - 1);
$('#lvUp').onclick = () => setLevel(state.level + 1);
$('#lvRange').oninput = e => setLevel(+e.target.value);
function renderAll(){
  $('#lvOut').value = state.level; $('#lvRange').value = state.level;
  renderNow(); renderRoute(); renderTable(); renderPoints(); renderMats();
}
siteMenu('essence', '../');
loadLocal();
renderSrc(); renderAll();
try { const t = sessionStorage.getItem(STORE + '-tab'); if (t) showTab(t); } catch(e){}
const hash = (location.hash || '').slice(1); if (TABS.includes(hash)) showTab(hash);
connect();
