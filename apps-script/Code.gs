// Seul ce joueur est autorisé à modifier les rotations et les matchs.
const CAPITAINE = "Bourdeaud'hui Anthony";

// ── CONFIGURATION DES ONGLETS ────────────────────────────────
const SHEETS = {
  joueurs: {
    name: 'Joueurs',
    headers: ['Nom', 'Niveau', 'Côté préféré'],
    key: ['Nom'],
  },
  journees: {
    name: 'Journées',
    headers: ['N° journée', 'Date', 'Heure', 'Club / Adresse', 'Statut'],
    key: ['N° journée'],
  },
  rotations: {
    name: 'Rotations',
    headers: ['N° journée', 'N° rotation', 'Joueur 1', 'Joueur 2', 'Joueur 3', 'Joueur 4', 'Somme niveaux'],
    key: ['N° journée', 'N° rotation'],
  },
  matchs: {
    name: 'Matchs',
    headers: ['N° journée', 'N° rotation', 'N° match', 'Paire A', 'Paire B', 'Score set 1', 'Score set 2', 'Score set 3', 'Résultat'],
    key: ['N° journée', 'N° rotation', 'N° match'],
  },
  disponibilites: {
    name: 'Disponibilités',
    headers: ['Joueur', 'N° journée', 'Disponible'],
    key: ['Joueur', 'N° journée'],
  },
};

// ── SETUP (à exécuter une seule fois depuis l'éditeur Apps Script) ──
function initializeSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  Object.values(SHEETS).forEach(cfg => {
    let sheet = ss.getSheetByName(cfg.name);
    if (!sheet) sheet = ss.insertSheet(cfg.name);
    sheet.clear();
    // Format en texte brut pour empêcher Google Sheets de convertir automatiquement
    // des valeurs comme "Dimanche 30 août 2026" ou "6-3" en dates.
    sheet.getRange(1, 1, 1000, cfg.headers.length).setNumberFormat('@');
    sheet.getRange(1, 1, 1, cfg.headers.length).setValues([cfg.headers]);
    sheet.setFrozenRows(1);
  });

  const defaultSheet = ss.getSheetByName('Sheet1') || ss.getSheetByName('Feuille 1');
  if (defaultSheet && ss.getSheets().length > Object.keys(SHEETS).length) {
    ss.deleteSheet(defaultSheet);
  }

  const joueurs = [
    ["Schoonjans Michel", "P200", "Indifférent"],
    ["Pluymakers Fabrice", "P200", "Indifférent"],
    ["Bourdeaud'hui Anthony", "P200", "Indifférent"],
    ["Noclain Sébastien", "P50", "Indifférent"],
    ["Lorent Lionel", "P200", "Indifférent"],
    ["Nicolas Czetwertynski", "P200", "Indifférent"],
    ["Alexandre Leonard", "P100", "Indifférent"],
    ["Nicolas Tamigniau", "P200", "Indifférent"],
    ["Florent Plusquin", "P200", "Indifférent"],
  ];
  const journees = [
    [1, "Dimanche 30 août 2026", "12h00", "", "à venir"],
    [2, "Dimanche 6 septembre 2026", "12h00", "", "à venir"],
    [3, "Dimanche 13 septembre 2026", "12h00", "", "à venir"],
    [4, "Dimanche 20 septembre 2026", "12h00", "", "à venir"],
    [5, "Dimanche 27 septembre 2026", "12h00", "", "à venir"],
  ];

  const jSheet = ss.getSheetByName(SHEETS.joueurs.name);
  jSheet.getRange(2, 1, joueurs.length, joueurs[0].length).setValues(joueurs);

  const jourSheet = ss.getSheetByName(SHEETS.journees.name);
  jourSheet.getRange(2, 1, journees.length, journees[0].length).setValues(journees);

  SpreadsheetApp.flush();
  Logger.log('Feuilles initialisées avec succès.');
}

// ── HELPERS GÉNÉRIQUES ───────────────────────────────────────
function getSheet_(key) {
  const cfg = SHEETS[key];
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(cfg.name);
  if (!sheet) throw new Error('Onglet manquant : ' + cfg.name + ' — exécute initializeSheets() une première fois.');
  return sheet;
}

function sheetToObjects_(key) {
  const cfg = SHEETS[key];
  const sheet = getSheet_(key);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0];
  return values.slice(1)
    .filter(row => row.some(c => c !== '' && c !== null))
    .map(row => {
      const obj = {};
      headers.forEach((h, i) => { obj[headerToField_(h)] = row[i]; });
      return obj;
    });
}

// Convertit un en-tête FR en clé JS courte utilisée par le frontend
function headerToField_(header) {
  const map = {
    'Nom': 'nom',
    'Niveau': 'niveau',
    'Côté préféré': 'cote',
    'N° journée': 'journee',
    'Date': 'date',
    'Heure': 'heure',
    'Club / Adresse': 'clubAdresse',
    'Statut': 'statut',
    'N° rotation': 'rotation',
    'Joueur 1': 'joueur1',
    'Joueur 2': 'joueur2',
    'Joueur 3': 'joueur3',
    'Joueur 4': 'joueur4',
    'Somme niveaux': 'sommeNiveaux',
    'N° match': 'match',
    'Paire A': 'paireA',
    'Paire B': 'paireB',
    'Score set 1': 'set1',
    'Score set 2': 'set2',
    'Score set 3': 'set3',
    'Résultat': 'resultat',
    'Joueur': 'joueur',
    'Disponible': 'disponible',
  };
  return map[header] || header;
}

function fieldToHeader_(key, field) {
  const cfg = SHEETS[key];
  return cfg.headers.find(h => headerToField_(h) === field);
}

// Met à jour la ligne correspondant aux colonnes-clé, ou l'ajoute si absente.
function upsertRow_(key, rowObj) {
  const cfg = SHEETS[key];
  const sheet = getSheet_(key);
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const keyCols = cfg.key.map(h => headers.indexOf(h));

  const rowValues = headers.map(h => {
    const field = headerToField_(h);
    const v = rowObj[field];
    if (Array.isArray(v)) return v.join(' / ');
    return v === undefined ? '' : v;
  });

  for (let r = 1; r < values.length; r++) {
    const match = keyCols.every(ci => String(values[r][ci]) === String(rowValues[ci]));
    if (match) {
      sheet.getRange(r + 1, 1, 1, rowValues.length).setValues([rowValues]);
      return;
    }
  }
  sheet.appendRow(rowValues);
}

// ── ENDPOINTS ─────────────────────────────────────────────────
function doGet(e) {
  const data = {
    joueurs: sheetToObjects_('joueurs'),
    journees: sheetToObjects_('journees'),
    rotations: sheetToObjects_('rotations'),
    matchs: sheetToObjects_('matchs'),
    disponibilites: sheetToObjects_('disponibilites'),
  };
  return jsonOutput_({ status: 'ok', data });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action;
    const p = body.payload || {};

    if (action === 'setDisponibilite') {
      upsertRow_('disponibilites', { joueur: p.joueur, journee: p.journee, disponible: p.disponible });
    } else if (action === 'setCote') {
      const sheet = getSheet_('joueurs');
      const values = sheet.getDataRange().getValues();
      const headers = values[0];
      const nomCol = headers.indexOf('Nom');
      const coteCol = headers.indexOf('Côté préféré');
      let found = false;
      for (let r = 1; r < values.length; r++) {
        if (values[r][nomCol] === p.joueur) {
          sheet.getRange(r + 1, coteCol + 1).setValue(p.cote);
          found = true;
          break;
        }
      }
      if (!found) throw new Error('Joueur introuvable : ' + p.joueur);
    } else if (action === 'setRotation') {
      if (p.actionBy !== CAPITAINE) throw new Error('Seul le capitaine peut modifier les rotations.');
      upsertRow_('rotations', p);
    } else if (action === 'setMatch') {
      if (p.actionBy !== CAPITAINE) throw new Error('Seul le capitaine peut modifier les matchs.');
      upsertRow_('matchs', p);
    } else {
      throw new Error('Action inconnue : ' + action);
    }

    return jsonOutput_({ status: 'ok' });
  } catch (err) {
    return jsonOutput_({ status: 'error', message: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function jsonOutput_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
