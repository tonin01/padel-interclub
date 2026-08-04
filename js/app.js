// ── STATE ────────────────────────────────────────────────────
let currentView = 'journees';
let currentDetailJournee = null;

// ── UTILS ────────────────────────────────────────────────────
function escHtml(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escAttr(s) {
  return escHtml(s).replace(/"/g, '&quot;');
}
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._tm);
  toast._tm = setTimeout(() => t.classList.remove('show'), 2200);
}
function isIOS() {
  return /iP(hone|od|iPad)/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

// ── NAVIGATION ───────────────────────────────────────────────
function switchView(view) {
  currentView = view;
  document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
  document.getElementById('view-' + view).classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const navId = view === 'detail' ? 'nav-journees' : 'nav-' + view;
  const navBtn = document.getElementById(navId);
  if (navBtn) navBtn.classList.add('active');
  renderCurrentView();
  document.getElementById('scroll').scrollTop = 0;
}

function renderCurrentView() {
  if (currentView === 'journees') renderJournees();
  else if (currentView === 'detail') renderDetail(currentDetailJournee);
  else if (currentView === 'dispos') renderDispos();
  else if (currentView === 'equipe') renderEquipe();
  else if (currentView === 'reglages') renderReglages();
}

function openJournee(numero) {
  currentDetailJournee = numero;
  switchView('detail');
}

// ── VUE JOURNÉES ─────────────────────────────────────────────
function renderJournees() {
  const list = data.journees.slice().sort((a, b) => a.numero - b.numero);
  let html = '';
  list.forEach(j => {
    const statutRaw = (j.statut || 'à venir').trim();
    const isJouee = statutRaw.toLowerCase().indexOf('jou') > -1;
    const cls = isJouee ? 'jouee' : 'a-venir';
    let summary;
    if (cls === 'jouee') {
      const matchs = data.matchs.filter(m => Number(m.journee) === Number(j.numero));
      const played = matchs.filter(m => m.resultat);
      const wins = played.filter(m => (m.resultat || '').indexOf('Victoire A') === 0).length;
      summary = played.length ? `${wins}/${played.length} match(s) gagné(s)` : 'Aucun score saisi';
    } else {
      const dispos = data.disponibilites.filter(d => Number(d.journee) === Number(j.numero) && d.disponible === 'Oui');
      summary = `${dispos.length} joueur(s) disponible(s)`;
    }
    html += `<div class="journee-card ${cls}" onclick="openJournee(${j.numero})">
      <div class="journee-top">
        <div>
          <div class="journee-num">Journée ${j.numero}</div>
          <div class="journee-date">${escHtml(j.date)}</div>
          <div class="journee-heure">${escHtml(j.heure || '')}</div>
        </div>
        <span class="badge ${cls}">${escHtml(statutRaw)}</span>
      </div>
      <div class="journee-adresse">📍 ${j.clubAdresse ? escHtml(j.clubAdresse) : 'Adresse à définir'}</div>
      <div class="journee-summary">${summary}</div>
    </div>`;
  });
  document.getElementById('journees-list').innerHTML = html || '<p class="hint">Aucune journée.</p>';
}

// ── VUE DÉTAIL JOURNÉE ───────────────────────────────────────
function renderDetail(numero) {
  const j = journeeByNumero(numero);
  const container = document.getElementById('detail-content');
  if (!j) { container.innerHTML = '<p class="hint">Journée introuvable.</p>'; return; }

  let html = `<div class="detail-header">
    <div class="detail-date">Journée ${j.numero} — ${escHtml(j.date)}</div>
    <div class="detail-heure">🕐 ${escHtml(j.heure || '')}</div>
    <div class="detail-adresse-row ${j.clubAdresse ? '' : 'disabled'}" data-adresse="${escAttr(j.clubAdresse || '')}" onclick="handleAdresseClick(this)">
      <span class="detail-adresse-icon">📍</span>
      <span>${j.clubAdresse ? escHtml(j.clubAdresse) : 'Adresse à définir dans le Google Sheet'}</span>
    </div>
  </div>`;

  [1, 2].forEach(r => { html += renderRotationCard(j.numero, r); });

  container.innerHTML = html;
  if (isCapitaine()) {
    [1, 2].forEach(r => updateRotationSum(j.numero, r));
    [1, 2].forEach(r => {
      const rot = data.rotations.find(x => Number(x.journee) === Number(j.numero) && Number(x.rotation) === r);
      if (rot) { [1, 2].forEach(m => updateMatchResultPreview(j.numero, r, m)); }
    });
  }
}

function playerOptionsHtml(selectedNom) {
  let html = '<option value="">— Choisir —</option>';
  data.joueurs.forEach(p => {
    const sel = p.nom === selectedNom ? ' selected' : '';
    html += `<option value="${escAttr(p.nom)}"${sel}>${escHtml(p.nom)} (${escHtml(p.niveau)} · ${escHtml(p.cote)})</option>`;
  });
  return html;
}

function renderRotationCard(journee, rotation) {
  const rot = data.rotations.find(x => Number(x.journee) === Number(journee) && Number(x.rotation) === rotation);

  let html = `<div class="section">
    <div class="section-header"><span class="section-title">Rotation ${rotation}</span></div>
    <div class="section-body">`;

  if (isCapitaine()) {
    const slots = ['joueur1', 'joueur2', 'joueur3', 'joueur4'];
    let selectsHtml = '';
    slots.forEach((slot, i) => {
      const val = rot ? rot[slot] : '';
      selectsHtml += `<div class="player-select-row">
        <select id="rot-${journee}-${rotation}-p${i + 1}" onchange="updateRotationSum(${journee},${rotation})">${playerOptionsHtml(val)}</select>
      </div>`;
    });
    html += `<div class="rotation-players">${selectsHtml}</div>
      <div class="rotation-sum">
        <span>Somme des niveaux</span>
        <span class="val" id="sum-${journee}-${rotation}">0 / 900</span>
      </div>
      <div class="rotation-actions">
        <button class="btn-primary" id="save-rot-${journee}-${rotation}" onclick="saveRotation(${journee},${rotation})">Enregistrer la rotation</button>
      </div>`;
  } else if (rot) {
    const players = [rot.joueur1, rot.joueur2, rot.joueur3, rot.joueur4];
    html += `<div class="rotation-players">` + players.map(nom => {
      const j = joueurByNom(nom);
      return `<div class="player-row"><span class="name">${escHtml(nom)}</span><span class="meta">${j ? escHtml(j.niveau) + ' · ' + escHtml(j.cote) : ''}</span></div>`;
    }).join('') + `</div>
      <div class="rotation-sum"><span>Somme des niveaux</span><span class="val ok">${rotationSum(players)} / 900</span></div>`;
  } else {
    html += `<div class="rotation-players"><p class="hint">Composition à venir — gérée par le capitaine (${escHtml(CAPITAINE)}).</p></div>`;
  }

  if (rot) {
    [1, 2].forEach(m => { html += renderMatchBlock(journee, rotation, m, rot); });
  } else if (isCapitaine()) {
    html += `<div class="match-block"><p class="hint">Compose et enregistre la rotation ci-dessus pour saisir les matchs.</p></div>`;
  }

  html += `</div></div>`;
  return html;
}

function updateRotationSum(journee, rotation) {
  const ids = [1, 2, 3, 4].map(i => `rot-${journee}-${rotation}-p${i}`);
  const values = ids.map(id => document.getElementById(id).value).filter(v => v);
  const sum = rotationSum(values);
  const nonEmpty = ids.map(id => document.getElementById(id).value);
  const filled = nonEmpty.filter(v => v).length;
  const hasDuplicate = new Set(values).size !== values.length;
  const el = document.getElementById(`sum-${journee}-${rotation}`);
  el.textContent = `${sum} / 900` + (hasDuplicate ? ' — joueur en double' : '');
  el.className = 'val ' + (sum > 900 || hasDuplicate ? 'over' : 'ok');
  const btn = document.getElementById(`save-rot-${journee}-${rotation}`);
  if (btn) btn.disabled = sum > 900 || hasDuplicate || filled !== 4;
}

function saveRotation(journee, rotation) {
  if (!isCapitaine()) { toast('Seul le capitaine peut composer les rotations'); return; }
  const ids = [1, 2, 3, 4].map(i => `rot-${journee}-${rotation}-p${i}`);
  const values = ids.map(id => document.getElementById(id).value);
  if (values.some(v => !v)) { toast('Choisis 4 joueurs'); return; }
  if (new Set(values).size !== values.length) { toast('Un joueur est en double'); return; }
  const sum = rotationSum(values);
  if (sum > 900) { toast('Somme des niveaux > 900'); return; }
  enqueue('setRotation', {
    journee, rotation,
    joueur1: values[0], joueur2: values[1], joueur3: values[2], joueur4: values[3],
    sommeNiveaux: sum,
    actionBy: currentPlayer,
  });
  toast('✓ Rotation enregistrée');
  renderDetail(journee);
}

function renderMatchBlock(journee, rotation, matchNum, rot) {
  const existing = data.matchs.find(m => Number(m.journee) === Number(journee) && Number(m.rotation) === Number(rotation) && Number(m.match) === Number(matchNum));
  const players = [rot.joueur1, rot.joueur2, rot.joueur3, rot.joueur4];
  const paireA = existing ? (Array.isArray(existing.paireA) ? existing.paireA : String(existing.paireA || '').split(' / ')) : [];

  if (!isCapitaine()) {
    if (!existing) {
      return `<div class="match-block"><div class="match-title">Match ${matchNum}</div><p class="hint">Score pas encore saisi.</p></div>`;
    }
    const sets = [existing.set1, existing.set2, existing.set3].filter(Boolean).join(' · ');
    return `<div class="match-block">
      <div class="match-title">Match ${matchNum}</div>
      <p class="hint">Notre paire : <b>${escHtml(paireA.join(' / '))}</b></p>
      <p class="hint">Paire adverse : ${escHtml(existing.paireB || '—')}</p>
      <p class="hint">Sets : ${escHtml(sets || '—')}</p>
      <div class="match-result">${escHtml(existing.resultat || '')}</div>
    </div>`;
  }

  let chipsHtml = '';
  players.forEach(nom => {
    const sel = paireA.indexOf(nom) > -1 ? ' selected' : '';
    chipsHtml += `<span class="chip${sel}" data-nom="${escAttr(nom)}" onclick="toggleChip(this)">${escHtml(nom)}</span>`;
  });

  const s1 = existing ? existing.set1 || '' : '';
  const s2 = existing ? existing.set2 || '' : '';
  const s3 = existing ? existing.set3 || '' : '';

  return `<div class="match-block">
    <div class="match-title">Match ${matchNum}</div>
    <label>Notre paire (choisis 2 joueurs)</label>
    <div class="pair-check-row" id="chips-${journee}-${rotation}-${matchNum}">${chipsHtml}</div>
    <label>Paire adverse</label>
    <input type="text" id="paireB-${journee}-${rotation}-${matchNum}" placeholder="Nom du club — Prénom Nom / Prénom Nom" value="${escAttr(existing ? existing.paireB : '')}">
    <label>Scores par set (format jeux A-jeux B, ex. 6-3)</label>
    <div class="set-inputs">
      <input type="text" id="set1-${journee}-${rotation}-${matchNum}" placeholder="Set 1" value="${escAttr(s1)}" oninput="updateMatchResultPreview(${journee},${rotation},${matchNum})">
      <input type="text" id="set2-${journee}-${rotation}-${matchNum}" placeholder="Set 2" value="${escAttr(s2)}" oninput="updateMatchResultPreview(${journee},${rotation},${matchNum})">
      <input type="text" id="set3-${journee}-${rotation}-${matchNum}" placeholder="Super TB" value="${escAttr(s3)}" oninput="updateMatchResultPreview(${journee},${rotation},${matchNum})">
    </div>
    <div class="match-result" id="result-${journee}-${rotation}-${matchNum}">${escHtml(existing ? existing.resultat : '')}</div>
    <button class="btn-secondary" onclick="saveMatch(${journee},${rotation},${matchNum})">Enregistrer le match</button>
  </div>`;
}

function toggleChip(el) {
  const group = el.parentElement;
  const selected = group.querySelectorAll('.chip.selected');
  if (el.classList.contains('selected')) {
    el.classList.remove('selected');
  } else {
    if (selected.length >= 2) { toast('Choisis seulement 2 joueurs'); return; }
    el.classList.add('selected');
  }
}

function updateMatchResultPreview(journee, rotation, matchNum) {
  const s1 = document.getElementById(`set1-${journee}-${rotation}-${matchNum}`).value;
  const s2 = document.getElementById(`set2-${journee}-${rotation}-${matchNum}`).value;
  const s3 = document.getElementById(`set3-${journee}-${rotation}-${matchNum}`).value;
  const result = computeMatchResult(s1, s2, s3);
  document.getElementById(`result-${journee}-${rotation}-${matchNum}`).textContent = result;
}

function saveMatch(journee, rotation, matchNum) {
  if (!isCapitaine()) { toast('Seul le capitaine peut saisir les scores'); return; }
  const chips = document.querySelectorAll(`#chips-${journee}-${rotation}-${matchNum} .chip.selected`);
  if (chips.length !== 2) { toast('Choisis 2 joueurs pour notre paire'); return; }
  const paireA = Array.from(chips).map(c => c.dataset.nom);
  const paireB = document.getElementById(`paireB-${journee}-${rotation}-${matchNum}`).value.trim();
  const set1 = document.getElementById(`set1-${journee}-${rotation}-${matchNum}`).value.trim();
  const set2 = document.getElementById(`set2-${journee}-${rotation}-${matchNum}`).value.trim();
  const set3 = document.getElementById(`set3-${journee}-${rotation}-${matchNum}`).value.trim();
  const resultat = computeMatchResult(set1, set2, set3);
  enqueue('setMatch', { journee, rotation, match: matchNum, paireA, paireB, set1, set2, set3, resultat, actionBy: currentPlayer });
  toast('✓ Match enregistré');
  renderDetail(journee);
}

// ── NAVIGATION GPS ───────────────────────────────────────────
function handleAdresseClick(el) {
  const adresse = el.dataset.adresse;
  if (!adresse) return;
  // Sur mobile, l'API Partager ouvre le sélecteur natif du téléphone
  // (Google Maps, Waze, Plans, etc. — toutes les apps installées).
  if (navigator.share) {
    const mapsUrl = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(adresse);
    navigator.share({ title: 'Aller au club', text: adresse, url: mapsUrl }).catch(() => {});
    return;
  }
  openNavModal(adresse);
}
function openNavModal(adresse) {
  document.getElementById('nav-address-text').textContent = adresse;
  const enc = encodeURIComponent(adresse);
  let html = `<a class="btn-accent" href="https://www.google.com/maps/search/?api=1&query=${enc}" target="_blank" rel="noopener">🗺️ Google Maps</a>
    <a class="btn-accent" href="https://waze.com/ul?q=${enc}&navigate=yes" target="_blank" rel="noopener">🚗 Waze</a>`;
  if (isIOS()) {
    html += `<a class="btn-accent" href="maps://?q=${enc}">📍 Plans</a>`;
  }
  document.getElementById('nav-buttons').innerHTML = html;
  document.getElementById('modal-nav-overlay').classList.add('open');
}
function closeNavModal() {
  document.getElementById('modal-nav-overlay').classList.remove('open');
}
function closeNavModalIfBg(e) {
  if (e.target === document.getElementById('modal-nav-overlay')) closeNavModal();
}

// ── VUE DISPOS ───────────────────────────────────────────────
function renderDispos() {
  const body = document.getElementById('mes-dispos-body');
  if (!currentPlayer) {
    body.innerHTML = '<div class="settings-content"><p class="hint">Identifie-toi depuis l\'onglet Réglages pour saisir tes disponibilités.</p></div>';
  } else {
    let html = '';
    data.journees.slice().sort((a, b) => a.numero - b.numero).forEach(j => {
      const d = dispoFor(currentPlayer, j.numero);
      const val = d ? d.disponible : '';
      html += `<div class="dispo-row">
        <span class="lbl">J${j.numero} — ${escHtml(j.date)}</span>
        <div class="toggle-group">
          <button class="toggle-btn oui${val === 'Oui' ? ' active' : ''}" onclick="toggleDispo(${j.numero},'Oui')">Oui</button>
          <button class="toggle-btn non${val === 'Non' ? ' active' : ''}" onclick="toggleDispo(${j.numero},'Non')">Non</button>
        </div>
      </div>`;
    });
    const me = joueurByNom(currentPlayer);
    const cote = me ? me.cote : 'Indifférent';
    html += `<div class="cote-group">
      ${COTES.map(c => `<button class="cote-btn${cote === c ? ' active' : ''}" onclick="setCote('${c}')">${c}</button>`).join('')}
    </div>`;
    body.innerHTML = html;
  }
  renderDisposGrid();
}

function toggleDispo(journee, disponible) {
  if (!currentPlayer) { toast('Identifie-toi d\'abord'); return; }
  enqueue('setDisponibilite', { joueur: currentPlayer, journee, disponible });
  toast('✓ Disponibilité mise à jour');
  renderDispos();
}

function setCote(cote) {
  if (!currentPlayer) { toast('Identifie-toi d\'abord'); return; }
  enqueue('setCote', { joueur: currentPlayer, cote });
  toast('✓ Côté préféré enregistré');
  renderDispos();
}

function renderDisposGrid() {
  const journees = data.journees.slice().sort((a, b) => a.numero - b.numero);
  let html = '<table class="dispo-grid-table"><thead><tr><th class="name">Joueur</th>';
  journees.forEach(j => { html += `<th>J${j.numero}</th>`; });
  html += '</tr></thead><tbody>';
  data.joueurs.forEach(p => {
    html += `<tr><td class="name">${escHtml(p.nom)}</td>`;
    journees.forEach(j => {
      const d = dispoFor(p.nom, j.numero);
      let cell = '<span class="dot-unk">–</span>';
      if (d && d.disponible === 'Oui') cell = '<span class="dot-yes">✓</span>';
      else if (d && d.disponible === 'Non') cell = '<span class="dot-no">✕</span>';
      html += `<td>${cell}</td>`;
    });
    html += '</tr>';
  });
  html += '</tbody></table>';
  document.getElementById('dispos-grid').innerHTML = html;
}

// ── VUE ÉQUIPE ───────────────────────────────────────────────
function renderEquipe() {
  let html = '';
  data.joueurs.forEach(p => {
    html += `<div class="player-row">
      <span class="name">${escHtml(p.nom)}</span>
      <span class="meta">${escHtml(p.niveau)} · ${escHtml(p.cote)}</span>
    </div>`;
  });
  document.getElementById('equipe-body').innerHTML = html || '<p class="hint">Aucun joueur.</p>';
}

// ── VUE RÉGLAGES ─────────────────────────────────────────────
function renderReglages() {
  document.getElementById('reglages-joueur').textContent = currentPlayer || 'Non identifié';
  document.getElementById('script-url-input').value = scriptUrl;
  setSyncState(syncState);
}

function onSaveScriptUrl() {
  const val = document.getElementById('script-url-input').value.trim();
  if (!val || !val.startsWith('https://')) { toast('URL invalide'); return; }
  saveScriptUrl(val);
  toast('✓ URL enregistrée');
}

// ── IDENTIFICATION ───────────────────────────────────────────
function openIdentifyModal(isChange) {
  const sel = document.getElementById('identify-select');
  sel.innerHTML = data.joueurs.map(p => `<option value="${escAttr(p.nom)}"${p.nom === currentPlayer ? ' selected' : ''}>${escHtml(p.nom)}</option>`).join('');
  document.getElementById('modal-identify-overlay').classList.add('open');
}

function confirmIdentify() {
  const sel = document.getElementById('identify-select');
  currentPlayer = sel.value;
  localStorage.setItem(PLAYER_KEY, currentPlayer);
  document.getElementById('modal-identify-overlay').classList.remove('open');
  toast('✓ Bienvenue ' + currentPlayer.split(' ')[0]);
  renderCurrentView();
}

// ── SERVICE WORKER ───────────────────────────────────────────
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js').catch(err => console.warn('SW registration failed', err));
  }
}

// ── INIT ─────────────────────────────────────────────────────
function init() {
  renderCurrentView();
  if (!currentPlayer) openIdentifyModal(false);
  setSyncState(scriptUrl ? 'idle' : 'idle');
  if (scriptUrl) {
    setTimeout(() => pullFromCloud(true), 800);
    startSyncLoop();
  }
  registerServiceWorker();
}

init();
