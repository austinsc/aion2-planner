/* Crafting planner: proficiency 1–100 for each of the five crafts, what unlocks when, the Dragon Lord ladder and materials. Data in data.js (C). */
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = n => n.toLocaleString('en-US');
const STORE = 'crafting-planner';
const ROW = C.curve.map(([prof, next, cum]) => ({ prof, next, cum }));
const row = p => ROW[p - 1];
const CRAFT = Object.fromEntries(C.crafts.map(c => [c.key, c]));
const state = { craft: 'Blacksmithing', prof: {}, xp: {}, cls: '', notes: '' };
const lvl = () => state.prof[state.craft] || 1;
const xpIn = () => state.xp[state.craft] || 0;

function loadLocal(){ try { const j = JSON.parse(localStorage.getItem(STORE) || 'null'); if (j) Object.assign(state, j); } catch(e){} if (!CRAFT[state.craft]) state.craft = 'Blacksmithing'; }
function saveLocal(){ try { localStorage.setItem(STORE, JSON.stringify(Object.assign({}, state, { level: lvl() }))); } catch(e){} }
function setSave(t, cls){ const el = $('#saveState'); el.textContent = t; el.className = 'save ' + (cls||''); }
let docRef = null, saveTimer = null;
const snapshot = () => ({ craft: state.craft, prof: state.prof, xp: state.xp, cls: state.cls, notes: state.notes, updatedAt: new Date().toISOString() });
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
    docRef = d.doc('data/users/' + uid + '/progress-crafting');
    const snap = await docRef.get();
    if (snap.exists) Object.assign(state, snap.data()); else await docRef.set(snapshot());
    saveLocal(); renderAll(); setSave('Saved to your account', 'ok');
  } catch (e) { setSave('Saved on this device', 'local'); }
}

/* ---------------- helpers ---------------- */
const stage = p => p < 50 ? 'novice' : p === 50 ? 'test' : p < 100 ? 'pro' : 'max';
const grade = p => p <= 50 ? 'Novice' : 'Professional';
function xpTo(target){ const r = row(lvl()); return Math.max(0, row(target).cum - r.cum - (r.next ? Math.min(xpIn(), r.next - 1) : 0)); }
const seg = (name, opts, cur) => `<div class="btabs" role="group">${opts.map(([v, l]) => `<button class="btab" data-${name}="${esc(v)}" aria-selected="${v === cur}">${esc(l)}</button>`).join('')}</div>`;
const CLASSES = ['Gladiator', 'Templar', 'Assassin', 'Ranger', 'Sorcerer', 'Spiritmaster', 'Cleric', 'Chanter'];
const weaponCraft = cls => C.crafts.find(c => c.classes.includes(cls));
const pct = n => n == null ? '—' : n.toFixed(2).replace(/\.?0+$/, '') + '%';

/* ---------------- NOW ---------------- */
function renderNow(){
  const k = state.craft, c = CRAFT[k], p = lvl(), r = row(p), st = stage(p);
  const done = c.unlocks.filter(([l]) => l <= p), next = c.unlocks.filter(([l]) => l > p);
  const pc = Math.round(100 * (r.cum + Math.min(xpIn(), r.next || 0)) / row(100).cum);
  let h = `<div class="card gold"><header><h2>${esc(k)} ${p}</h2><span class="eyebrow">${grade(p)} · ${pc}% of the XP to 100</span></header>
    <div class="bar" aria-hidden="true"><i style="width:${pc}%"></i><b style="left:${(8809 / 91489 * 100).toFixed(1)}%"></b></div>
    <div class="chips">
      ${r.next ? `<span class="chip">To ${p + 1} <b class="num">${fmt(r.next - Math.min(xpIn(), r.next - 1))} XP</b></span>` : st === 'test' ? `<span class="chip">XP stops here: <b>do the upgrade test</b></span>` : `<span class="chip"><b>Max proficiency</b></span>`}
      ${p < 50 ? `<span class="chip">To 50 <b class="num">${fmt(xpTo(50))} XP</b></span>` : ''}
      ${p < 55 ? `<span class="chip">To 55 <b class="num">${fmt(xpTo(55))} XP</b> <span class="muted">first Dragon Lord recipes</span></span>` : ''}
      ${p < 100 ? `<span class="chip">To 100 <b class="num">${fmt(xpTo(100))} XP</b></span>` : ''}
    </div>
    ${r.next ? `<label class="xpin">XP into this level <input type="number" id="xpIn" min="0" max="${r.next - 1}" value="${Math.min(xpIn(), r.next - 1)}" inputmode="numeric"> <span class="muted">of ${fmt(r.next)}</span></label>` : ''}
    <div class="act">${p < 100 ? `<button class="pill primary" id="nextLvl">${st === 'test' ? 'Test done: go to 51 →' : `Reached ${p + 1} →`}</button>` : ''}</div>
    <p class="note">Each craft levels on its own, and every craft gives XP whether it succeeds or fails. The Professional half (51–100) takes about nine times the XP of the Novice half.</p>
  </div>`;
  h += `<div class="card"><header><h3>Your crafts</h3><span class="eyebrow">pick one to track; each keeps its own proficiency</span></header>${seg('craft', C.crafts.map(x => [x.key, `${x.key} ${state.prof[x.key] || 1}`]), k)}<p class="note">${esc(c.makes)}.</p></div>`;
  h += `<div class="grid2">`;
  h += `<div class="card"><header><h3>${st === 'novice' ? 'What to do now' : st === 'test' ? 'The Professional test' : st === 'pro' ? 'What to do now' : 'Done'}</h3><span class="eyebrow">${grade(p)}</span></header>`;
  if (st === 'novice') h += `<ol class="steps">
      <li class="ph0"><span class="n">1</span><span>Process materials between gear tiers<small>${k === 'Blacksmithing' ? 'Orichalcum Ingots from 1 (bulk, 10 at once, from 25): cheap XP between gear tiers.' : 'Each craft has a materials tab: cheap intermediate crafts keep the XP coming between gear tiers.'}</small></span><span class="cost"></span></li>
      <li class="ph0"><span class="n">2</span><span>Craft each gear tier until a lucky craft lands<small>Orichalcum from about 3, Expert's from 15, Artisan's from 30. Keep every Splendent result: it is the input for the next tier.</small></span><span class="cost"></span></li>
      <li class="ph0"><span class="n">3</span><span>Gather as you go<small>Ore, gems, logs, herbs and Odyle all open at gathering proficiency 1. See the <a href="../essence-extraction/index.html">Essence Extraction planner</a>.</small></span><span class="cost"></span></li>
    </ol>`;
  else if (st === 'test') h += `<p class="note">At 50 your ${esc(k)} XP stops until you pass its upgrade quest (for Blacksmithing, <b>Upgrade: Blacksmithing Specialty Skill</b>). It asks you to craft a test item${k === 'Blacksmithing' ? ': a <b>Novice Blacksmith\'s Hammer (Bound)</b> from 6 Orichalcum Ingots and 3 Odyle' : ''}. The reward lifts the cap to 100.</p>`;
  else if (st === 'pro') h += `<ol class="steps">
      <li class="ph1"><span class="n">1</span><span>${c.part ? `Start on ${esc(c.part)} at 51` : 'Keep cooking the best dish you can'}<small>${c.part ? "Two Balaur's Essence each: this is where crafting starts needing dungeon runs." : 'The White Dragon dishes open at 60, 75 and 90.'}</small></span><span class="cost"></span></li>
      <li class="ph1"><span class="n">2</span><span>${c.part ? 'Dragon Lord gear from 55 or 60' : 'Cooking has no gear'}<small>${c.part ? 'Weapons, rings and most armour at 55; guard, necklace, earrings, gloves, boots and cape at 60. Upcrafts after that have no proficiency gate of their own, but the window warns if you are below the recipe\'s level.' : 'Food is its own reward: buff food you eat every day.'}</small></span><span class="cost"></span></li>
      <li class="ph1"><span class="n">3</span><span>Practical target: ${k === 'Cooking' ? '90' : k === 'Alchemy' ? '85' : '80'}<small>${k === 'Cooking' ? 'For the last White Dragon dish.' : k === 'Alchemy' ? 'For Superior Manastones.' : 'The last gear recipe opens at 60; Durable Balaur parts for the Wise Dragon Lord upcrafts need 80. Past that, proficiency only raises the success rate.'}</small></span><span class="cost"></span></li>
    </ol>`;
  else h += `<p class="note">Proficiency 100 is the cap on Global. Every gear recipe now succeeds as often as it can.</p>`;
  h += `</div>`;
  h += `<div class="card"><header><h3>Unlocks</h3><span class="eyebrow">${esc(k)}</span></header><ul class="list">` +
    c.unlocks.map(([l, t]) => `<li class="${l <= p ? 'got' : ''}"><span class="lvbadge">${l}</span><span style="flex:1 1 200px;font-size:.9rem" class="${l <= p ? 'muted' : ''}">${esc(t)}</span>${l <= p ? '<span class="cost">✓</span>' : next[0] && next[0][0] === l ? '<span class="cost">next</span>' : ''}</li>`).join('') + `</ul></div>`;
  h += `</div>`;
  const wc = state.cls ? weaponCraft(state.cls) : null;
  h += `<div class="card"><header><h3>Which craft for your class</h3><span class="eyebrow">your weapon decides it</span></header>
    ${seg('cls', CLASSES.map(x => [x, x]), state.cls)}
    <p class="note">${wc ? `<b>${esc(state.cls)}:</b> your weapon comes from <b>${esc(wc.key)}</b>. ` : 'Pick your class to see which craft makes your weapon. '}Armorsmithing is the safest second craft: all seven armour slots are worn by every class. Handicrafting makes the rings (the slot that gives Active skill levels), necklaces and earrings. Alchemy makes Manastones. Craft a ring first if you are unsure.</p></div>`;
  h += `<div class="card"><header><h3>Notes</h3><span class="eyebrow">saved with your progress</span></header><textarea id="notes" placeholder="What you are building, materials you still need…">${esc(state.notes)}</textarea></div>`;
  $('#p-now').innerHTML = h;
  const nx = $('#nextLvl'); if (nx) nx.onclick = () => { setLevel(p + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const xi = $('#xpIn'); if (xi) xi.onchange = () => { state.xp[k] = Math.max(0, Math.min(r.next - 1, +xi.value || 0)); persist(); renderNow(); };
  $('#p-now').querySelectorAll('[data-craft]').forEach(b => b.onclick = () => { state.craft = b.dataset.craft; persist(); renderAll(); });
  $('#p-now').querySelectorAll('[data-cls]').forEach(b => b.onclick = () => { state.cls = state.cls === b.dataset.cls ? '' : b.dataset.cls; persist(); renderNow(); });
  const ta = $('#notes'); let nt; ta.oninput = () => { state.notes = ta.value; clearTimeout(nt); nt = setTimeout(persist, 600); };
}

/* ---------------- ROUTE ---------------- */
function renderRoute(){
  let h = `<div class="card gold"><header><h2>The route to Dragon Lord gear</h2><span class="eyebrow">from proficiency 1 to a piece at item level 102</span></header>
    <ol class="steps">
      <li class="ph0"><span class="n">1</span><span>Gather while you level<small>Gathering opens at character level 10 and every node at gathering proficiency 1. Every gear tier uses Odyle; weapons and armour ore, accessories gems, bows and staffs logs.</small></span><span class="cost">lv 10+</span></li>
      <li class="ph0"><span class="n">2</span><span>Process materials, then climb the Orichalcum tiers<small>Orichalcum at about 3, Expert's at 15, Artisan's at 30. A tier's next recipe takes the Splendent piece from the tier below, and a Splendent piece only comes from a lucky craft.</small></span><span class="cost">1–49</span></li>
      <li class="ph0"><span class="n">3</span><span>Pass the upgrade test at 50<small>XP stops until you do. The quest has you craft a test item, and its reward lifts the cap to 100. Each craft has its own test.</small></span><span class="cost">50</span></li>
      <li class="ph1"><span class="n">4</span><span>Balaur parts from 51<small>Fine Thick Balaur Horn (Blacksmithing), Tanned Thick Balaur Leather (Armorsmithing), Enhanced Thick Balaur Scale (Handicrafting and Alchemy). Two Balaur's Essence each.</small></span><span class="cost">51</span></li>
      <li class="ph1"><span class="n">5</span><span>True Dragon Lord (item level 62)<small>Weapons, rings, torso, pants, helmet and shoulders at 55; guard, necklace, earrings, gloves, boots and cape at 60. Needs an Artisan's Splendent piece and dungeon materials.</small></span><span class="cost">55–60</span></li>
      <li class="ph1"><span class="n">6</span><span>Upcraft to 102<small>Each step always succeeds. Hard Balaur parts (65) and Durable ones (80) feed the higher upcrafts, and the White and Wise steps each eat another Artisan's Splendent piece.</small></span><span class="cost">65–80</span></li>
    </ol>
    <p class="note">Level your craft before you run the chain. Counting failures, one Artisan's Splendent piece takes about 313 Orichalcum, 43 Expert's and 6 Artisan's crafts at each recipe's minimum proficiency, against about 97, 21 and 5 at proficiency 55. A slot taken all the way to 102 uses about 3.6 Artisan's Splendent pieces at 55, 3.1 at 100.</p></div>`;
  h += `<div class="card"><header><h3>Success rates</h3><span class="eyebrow">by how far your proficiency is above the recipe's</span></header>
    <div class="tscroll"><table><thead><tr><th>Recipe family</th><th>At its level</th><th>+5</th><th>+10</th><th>Best</th></tr></thead><tbody>` +
    C.rates.map(([n, a, b, c2, best]) => `<tr><td>${esc(n)}</td><td class="num">${pct(a)}</td><td class="num">${pct(b)}</td><td class="num">${pct(c2)}</td><td class="num muted">${esc(best)}</td></tr>`).join('') +
    `</tbody></table></div>
    <ul class="fix">
      <li><b>A failed craft returns nothing.</b> Every craft still gives proficiency XP, success or failure.</li>
      <li><b>Lucky crafts.</b> After a success, 25% of the time the game tries a lucky craft on its own roll, and its result replaces the normal one: that is how Splendent pieces happen. If the lucky craft fails, you get nothing.</li>
      <li><b>Upcrafting always succeeds,</b> and the steps to 78 and 94 land on the next tier up (86 or 102) a flat 25% of the time.</li>
      <li><b>Crafting can't be stopped once started.</b> Taking a hit cancels it as a failure, and support never restores crafting mistakes.</li>
    </ul></div>`;
  h += `<div class="card"><header><h3>How to level each craft</h3></header><ul class="list">` +
    C.crafts.map(c => `<li style="align-items:flex-start"><span class="sk" style="min-width:140px"><span class="nm">${esc(c.key)}</span></span><span class="note" style="flex:1 1 260px">${esc(c.makes)}. Key levels: ${c.unlocks.map(([l]) => l).join(', ')}.</span></li>`).join('') +
    `</ul><p class="note">Crafting happens at profession stations: Elyos at Dawn Legion Base and Zumion Village in Verteron, Asmodians at Safe Haven and Nornir Assembly in Altgard. No recipe charges Kina, and recipes unlock on their own as proficiency rises.</p></div>`;
  $('#p-route').innerHTML = h;
}

/* ---------------- PROFICIENCY TABLE ---------------- */
function renderTable(){
  const c = CRAFT[state.craft], un = Object.fromEntries(c.unlocks.map(([l, t]) => [l, t]));
  let h = `<div class="card"><header><h2>${esc(state.craft)} 1–100</h2><span class="eyebrow">click a row to jump</span></header>
    <p class="note">XP for each level, from the game's own table; the same for every craft. 8,809 XP takes you to 50, and 82,680 more to 100.</p>
    <div class="tscroll"><table><thead><tr><th>Prof</th><th>XP to next</th><th>XP total</th><th>Unlocks</th></tr></thead><tbody>`;
  for (const r of ROW) h += `<tr class="clickable ${r.prof === lvl() ? 'cur' : ''} ${r.prof < lvl() ? 'isdone' : ''}" data-lvl="${r.prof}"><td class="lvcell num">${r.prof}</td>
    <td class="num">${r.next ? fmt(r.next) : r.prof === 50 ? '<span class="keep" style="font-size:.85rem">test</span>' : 'max'}</td><td class="num muted">${fmt(r.cum)}</td><td style="font-size:.85rem">${esc(un[r.prof] || '')}</td></tr>`;
  h += `</tbody></table></div></div>`;
  $('#p-table').innerHTML = h;
  $('#p-table').querySelectorAll('tr.clickable').forEach(tr => tr.onclick = () => { setLevel(+tr.dataset.lvl); showTab('now'); window.scrollTo({ top: 0, behavior: 'smooth' }); });
}

/* ---------------- DRAGON LORD GEAR ---------------- */
function renderGear(){
  let h = `<div class="card gold"><header><h2>The gear ladder</h2><span class="eyebrow">the same in every line; Elyos names</span></header>
    <div class="tscroll"><table><thead><tr><th>Item level</th><th>Grade</th><th>Piece</th><th>How you make it</th></tr></thead><tbody>` +
    C.ladder.map(([il, g, n, how]) => `<tr><td class="lvcell num">${il}</td><td>${esc(g)}</td><td><b>${esc(n)}</b></td><td class="muted" style="font-size:.88rem">${esc(how)}</td></tr>`).join('') +
    `</tbody></table></div>
    <p class="note">Asmodian pieces are the same items under other names (Star Dragon Lord for True, Dark for White, Ebon for Wise): match the item level, not the name. Every slot has a Dragon Lord recipe except bracelets, amulet, belt and runes; bracelets stop at the Pilgrim Bracelet (Epic, 43).</p></div>`;
  h += `<div class="grid2"><div class="card"><header><h3>Crafted or dropped?</h3></header><div class="tscroll"><table><thead><tr><th>Item level</th><th>Crafted</th><th>Dungeon or raid</th></tr></thead><tbody>
      <tr><td class="num">54</td><td class="muted">—</td><td>Krao Cave, Draupnir</td></tr>
      <tr><td class="num">62</td><td>True Dragon Lord</td><td class="muted">—</td></tr>
      <tr><td class="num">70</td><td>Splendent True</td><td>Vakron Sky Island, Urugugu Canyon</td></tr>
      <tr><td class="num">78</td><td>White Dragon Lord</td><td class="muted">—</td></tr>
      <tr><td class="num">86</td><td>Splendent White</td><td>Ferocious Horn Den, Fire Temple</td></tr>
      <tr><td class="num">94</td><td>Wise Dragon Lord</td><td class="muted">—</td></tr>
      <tr><td class="num">102</td><td>Splendent Wise: the only 102 armour and accessories</td><td>Ludra raid: weapons and a guard</td></tr>
    </tbody></table></div>
    <ul class="list" style="font-size:.9rem;margin-top:8px">
      <li><span>Crafted Dragon Lord gear has <b>5 Soul Binding lines</b> against 4 on Unique drops, and no fixed PvE line on Global.</span></li>
      <li><span>Splendent pieces at 70 and 86 have a lower Amplified cap (+1 and +3) than drops at the same item level (+3 and +5).</span></li>
      <li><span>Upcrafting carries the enhancement, Amp and Soul Binding up to the next tier, though not Manastones, so enhance crafted gear.</span></li>
    </ul></div>
    <div class="card"><header><h3>Balaur's Essence per piece</h3><span class="eyebrow">True Dragon Lord</span></header><ul class="list">` +
    C.bills.map(([n, e]) => `<li><span style="flex:1">${esc(n)}</span><b class="num">${e} Essence</b></li>`).join('') +
    `</ul><p class="note">A True Dragon Lord longsword, for example: an Artisan's Splendent sword, 4 Artisan's Ultimate Refining Stones, 22 Fine Thick Balaur Horns (44 Essence and 22 Zircon Hammers), 10 Wrathful Mind, 9 Radiant Orichalcum Ore and 5 Radiant Odyle. The Wise Dragon Lord upcraft takes 41 Fine Durable Balaur Horns and 20 Wrathful Ego.</p>
    <p class="note">Crafting is worth it for one or two slots that won't drop, usually your weapon or a ring, and for consumables. It doesn't replace dungeons: it runs on their materials.</p></div></div>`;
  $('#p-gear').innerHTML = h;
}

/* ---------------- MATERIALS ---------------- */
function renderMats(){
  $('#p-mats').innerHTML = `<div class="card"><header><h2>Where the materials come from</h2></header>
    <div class="tscroll"><table><thead><tr><th>Material</th><th>Where</th><th>Tradeable</th></tr></thead><tbody>` +
    C.materials.map(([m, w, t]) => `<tr><td><b>${esc(m)}</b></td><td class="muted" style="font-size:.88rem">${esc(w)}</td><td>${esc(t)}</td></tr>`).join('') +
    `</tbody></table></div>
    <p class="note">Every drop material also comes in a bound copy. Buying on the Market needs a membership. Odyle turns into any other gathered material of the same grade through Substance Morph, which needs the matching craft's proficiency on the character doing it (Blacksmithing for ore, Handicrafting for gems and logs, Alchemy for herbs; 1–10 for plain grades, 30 for Fine and above).</p></div>
    <div class="card"><header><h3>Leftovers</h3></header><p class="note">The chain leaves plenty of plain pieces behind. Supply Requests (Regular: Craft tab, Alt + J) take crafted pieces of every tier, from plain Orichalcum to Wise Dragon Lord, for Abyss Points.</p></div>`;
}

/* ---------------- ALTS ---------------- */
function renderAlts(){
  $('#p-alts').innerHTML = `<div class="card gold"><header><h2>Alts and trading</h2><span class="eyebrow">does every alt need to craft?</span></header>
    <p class="note">Only an alt that will wear Dragon Lord gear above item level 62 needs crafting of its own. Upcrafted gear binds to the character who upcrafts it, and the upcraft window asks for proficiency in the craft that makes that piece. Everything else one crafter can make and pass on.</p>
    <div class="grid2">
      <div><h3 style="margin-bottom:8px">Your main crafter makes</h3><ul class="list" style="font-size:.9rem">
        <li><span>The low-tier grind and every Artisan's Splendent piece (tradeable until equipped)</span></li>
        <li><span>True Dragon Lord (62) pieces, for an alt that stops at 62</span></li>
        <li><span>Fine, Enhanced and Tanned Balaur parts, potions, food and refined materials</span></li>
        <li><span>Substance Morph conversions (the crafter has the proficiency)</span></li>
      </ul></div>
      <div><h3 style="margin-bottom:8px">Each alt does itself</h3><ul class="list" style="font-size:.9rem">
        <li><span>The upcrafts to 70, 78, 86, 94 and 102 for the slots it wears</span></li>
        <li><span>So: only the craft for those slots, to 55 or 60, and only once it will wear 70+ gear</span></li>
        <li><span>Gathering: not needed, the main passes the materials</span></li>
      </ul></div>
    </div>
    <ul class="fix">
      <li><b>Passing items:</b> tradeable items go into Server Storage, shared by your characters on that server; or use the Market (membership).</li>
      <li><b>Equip last:</b> equipping a piece soul-binds it and makes it untradeable, so hand it over before anyone wears it.</li>
      <li><b>Not confirmed:</b> whether the Hard and Durable Balaur parts are tradeable, and whether being below the upcraft's proficiency blocks the upcraft or only warns. Check the window in game before you level an alt.</li>
    </ul></div>`;
}

/* ---------------- SOURCES ---------------- */
function renderSrc(){
  $('#p-src').innerHTML = `<div class="card"><header><h2>Sources</h2><span class="eyebrow">compiled 21 Oct 2026</span></header>
    <ol class="src">${C.sources.map(s => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a>: ${esc(s.what)}</li>`).join('')}</ol>
    <p class="note">The XP table, success rates, recipe levels and material bills come from game data. Some unlock levels vary by a level or two between slots; the in-game recipe list wins. XP per craft isn't published for Global, so this page doesn't estimate how many crafts each level takes.</p></div>`;
}

/* ---------------- tabs & level ---------------- */
const TABS = ['now', 'route', 'table', 'gear', 'mats', 'alts', 'src'];
function showTab(id){
  document.querySelectorAll('.tab').forEach(t => t.setAttribute('aria-selected', t.dataset.tab === id));
  document.querySelectorAll('.panel').forEach(p => p.classList.toggle('on', p.id === 'p-' + id));
  try { sessionStorage.setItem(STORE + '-tab', id); } catch(e){}
}
document.querySelectorAll('.tab').forEach(t => t.onclick = () => showTab(t.dataset.tab));
function setLevel(L){ L = Math.min(100, Math.max(1, L)); if (L !== lvl()) state.xp[state.craft] = 0; state.prof[state.craft] = L; persist(); renderAll(); }
$('#lvDown').onclick = () => setLevel(lvl() - 1);
$('#lvUp').onclick = () => setLevel(lvl() + 1);
$('#lvRange').oninput = e => setLevel(+e.target.value);
function renderAll(){
  $('#lvOut').value = lvl(); $('#lvRange').value = lvl(); $('#lvCraft').textContent = state.craft;
  renderNow(); renderTable();
}
siteMenu('crafting', '../');
loadLocal();
renderRoute(); renderGear(); renderMats(); renderAlts(); renderSrc(); renderAll();
try { const t = sessionStorage.getItem(STORE + '-tab'); if (t) showTab(t); } catch(e){}
const hash = (location.hash || '').slice(1); if (TABS.includes(hash)) showTab(hash);
connect();
