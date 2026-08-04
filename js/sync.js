// ── SYNC "CLOUD TOUJOURS GAGNANT" ───────────────────────────
// Écriture optimiste locale + queue FIFO envoyée vers Apps Script.
// À chaque pull, les données du Sheet remplacent intégralement le cache local.

let syncState = 'idle'; // idle | syncing | synced | error | offline
let lastSyncTime = null;
let pullTimer = null;

function setSyncState(state) {
  syncState = state;
  document.querySelectorAll('.sync-dot').forEach(el => {
    el.className = 'sync-dot ' + state;
  });
  const text = document.getElementById('sync-status-text');
  if (text) {
    if (!scriptUrl) text.textContent = 'Non configuré';
    else if (state === 'syncing') text.textContent = 'Synchronisation…';
    else if (state === 'error') text.textContent = 'Erreur de synchronisation';
    else if (state === 'offline') text.textContent = 'Hors ligne — en attente';
    else if (lastSyncTime) text.textContent = 'Dernière sync : ' + new Date(lastSyncTime).toLocaleTimeString('fr-BE');
    else text.textContent = 'URL configurée — sync en attente';
  }
}

// Applique une action de queue à un jeu de données donné (mutation en place)
function applyAction(target, action) {
  const p = action.payload;
  if (action.type === 'setDisponibilite') {
    let d = target.disponibilites.find(x => x.joueur === p.joueur && Number(x.journee) === Number(p.journee));
    if (!d) { d = { joueur: p.joueur, journee: p.journee }; target.disponibilites.push(d); }
    d.disponible = p.disponible;
  } else if (action.type === 'setCote') {
    const j = target.joueurs.find(x => x.nom === p.joueur);
    if (j) j.cote = p.cote;
  } else if (action.type === 'setRotation') {
    let r = target.rotations.find(x => Number(x.journee) === Number(p.journee) && Number(x.rotation) === Number(p.rotation));
    if (!r) { r = { journee: p.journee, rotation: p.rotation }; target.rotations.push(r); }
    Object.assign(r, p);
  } else if (action.type === 'setMatch') {
    let m = target.matchs.find(x => Number(x.journee) === Number(p.journee) && Number(x.rotation) === Number(p.rotation) && Number(x.match) === Number(p.match));
    if (!m) { m = { journee: p.journee, rotation: p.rotation, match: p.match }; target.matchs.push(m); }
    Object.assign(m, p);
  }
}

function enqueue(type, payload) {
  applyAction(data, { type, payload });
  saveData();
  queue.push({ type, payload, ts: Date.now() });
  saveQueue();
  flushQueue();
}

async function postAction(action) {
  const res = await fetch(scriptUrl, {
    method: 'POST',
    body: JSON.stringify({ action: action.type, payload: action.payload }),
  });
  const json = await res.json();
  if (json.status !== 'ok') {
    const err = new Error(json.message || 'Erreur serveur');
    err.rejected = true; // le serveur a traité la requête et l'a refusée : inutile de réessayer
    throw err;
  }
}

let flushing = false;
async function flushQueue() {
  if (!scriptUrl || flushing) return;
  if (!navigator.onLine) { setSyncState('offline'); return; }
  if (queue.length === 0) return;
  flushing = true;
  setSyncState('syncing');
  try {
    while (queue.length > 0) {
      try {
        await postAction(queue[0]);
        queue.shift();
        saveQueue();
      } catch (e) {
        if (e.rejected) {
          // Action définitivement refusée (ex. droit capitaine) : on l'abandonne pour ne pas bloquer la file.
          console.warn('Action refusée, abandonnée :', e.message);
          toast('⚠️ ' + e.message);
          queue.shift();
          saveQueue();
          continue;
        }
        throw e; // erreur réseau : on garde l'action en file et on réessaiera plus tard
      }
    }
    setSyncState('synced');
    await pullFromCloud(true);
  } catch (e) {
    console.error(e);
    setSyncState('error');
  } finally {
    flushing = false;
  }
}

async function pullFromCloud(silent = false) {
  if (!scriptUrl) return;
  if (!silent) setSyncState('syncing');
  try {
    const res = await fetch(scriptUrl + '?action=getAll&t=' + Date.now());
    const json = await res.json();
    if (json.status === 'ok' && json.data) {
      data = json.data;
      // Le cloud gagne toujours, mais on rejoue par-dessus les écritures encore
      // en attente d'envoi pour ne pas faire disparaître une saisie hors-ligne.
      queue.forEach(action => applyAction(data, action));
      saveData();
      lastSyncTime = Date.now();
      setSyncState('synced');
      if (typeof renderCurrentView === 'function') renderCurrentView();
    } else {
      throw new Error(json.message || 'Réponse invalide');
    }
  } catch (e) {
    console.error(e);
    setSyncState('error');
  }
}

function saveScriptUrl(url) {
  scriptUrl = url.trim();
  localStorage.setItem(URL_KEY, scriptUrl);
  setSyncState('idle');
  pullFromCloud();
  startSyncLoop();
}

function startSyncLoop() {
  if (pullTimer) clearInterval(pullTimer);
  if (!scriptUrl) return;
  pullTimer = setInterval(() => {
    if (document.visibilityState === 'visible') pullFromCloud(true);
  }, 25000);
}

window.addEventListener('online', () => flushQueue());
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && scriptUrl) pullFromCloud(true);
});
