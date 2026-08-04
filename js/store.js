// ── CONSTANTS ────────────────────────────────────────────────
const DATA_KEY = 'padel_data_v1';
const QUEUE_KEY = 'padel_queue_v1';
const URL_KEY = 'padel_script_url';
const PLAYER_KEY = 'padel_player';

const COTES = ['Droite', 'Gauche', 'Indifférent'];

// Seul ce joueur peut composer les rotations et saisir les scores.
const CAPITAINE = "Bourdeaud'hui Anthony";
function isCapitaine() {
  return currentPlayer === CAPITAINE;
}

// ── SEED DATA ────────────────────────────────────────────────
// Doit rester identique aux données écrites par initializeSheets() dans apps-script/Code.gs
function seedJoueurs() {
  return [
    { nom: "Schoonjans Michel", niveau: "P200", cote: "Indifférent" },
    { nom: "Pluymakers Fabrice", niveau: "P200", cote: "Indifférent" },
    { nom: "Bourdeaud'hui Anthony", niveau: "P200", cote: "Indifférent" },
    { nom: "Noclain Sébastien", niveau: "P50", cote: "Indifférent" },
    { nom: "Lorent Lionel", niveau: "P200", cote: "Indifférent" },
    { nom: "Nicolas Czetwertynski", niveau: "P200", cote: "Indifférent" },
    { nom: "Alexandre Leonard", niveau: "P100", cote: "Indifférent" },
    { nom: "Nicolas Tamigniau", niveau: "P200", cote: "Indifférent" },
    { nom: "Florent Plusquin", niveau: "P200", cote: "Indifférent" },
  ];
}

function seedJournees() {
  return [
    { numero: 1, date: "Dimanche 30 août 2026", heure: "12h00", clubAdresse: "", statut: "à venir" },
    { numero: 2, date: "Dimanche 6 septembre 2026", heure: "12h00", clubAdresse: "", statut: "à venir" },
    { numero: 3, date: "Dimanche 13 septembre 2026", heure: "12h00", clubAdresse: "", statut: "à venir" },
    { numero: 4, date: "Dimanche 20 septembre 2026", heure: "12h00", clubAdresse: "", statut: "à venir" },
    { numero: 5, date: "Dimanche 27 septembre 2026", heure: "12h00", clubAdresse: "", statut: "à venir" },
  ];
}

function defaultData() {
  return {
    joueurs: seedJoueurs(),
    journees: seedJournees(),
    rotations: [],
    matchs: [],
    disponibilites: [],
  };
}

// ── CACHE ────────────────────────────────────────────────────
function loadData() {
  try {
    const raw = localStorage.getItem(DATA_KEY);
    return raw ? JSON.parse(raw) : defaultData();
  } catch (e) {
    return defaultData();
  }
}

function saveData() {
  localStorage.setItem(DATA_KEY, JSON.stringify(data));
}

function loadQueue() {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveQueue() {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

let data = loadData();
let queue = loadQueue();
let scriptUrl = localStorage.getItem(URL_KEY) || '';
let currentPlayer = localStorage.getItem(PLAYER_KEY) || '';

// ── HELPERS MÉTIER ───────────────────────────────────────────
function niveauValue(niveau) {
  const n = parseInt(String(niveau || '').replace(/[^0-9]/g, ''), 10);
  return isNaN(n) ? 0 : n;
}

function rotationSum(noms) {
  return noms.reduce((sum, nom) => {
    const j = data.joueurs.find(p => p.nom === nom);
    return sum + (j ? niveauValue(j.niveau) : 0);
  }, 0);
}

function joueurByNom(nom) {
  return data.joueurs.find(p => p.nom === nom);
}

function journeeByNumero(n) {
  return data.journees.find(j => Number(j.numero) === Number(n));
}

function rotationsForJournee(n) {
  return data.rotations.filter(r => Number(r.journee) === Number(n))
    .sort((a, b) => a.rotation - b.rotation);
}

function matchsForRotation(journee, rotation) {
  return data.matchs.filter(m => Number(m.journee) === Number(journee) && Number(m.rotation) === Number(rotation))
    .sort((a, b) => a.match - b.match);
}

function dispoFor(joueur, journee) {
  return data.disponibilites.find(d => d.joueur === joueur && Number(d.journee) === Number(journee));
}

// Parse "6-3" -> {a:6,b:3} ou null si invalide/vide
function parseSet(str) {
  if (!str) return null;
  const m = String(str).trim().match(/^(\d+)\s*-\s*(\d+)$/);
  if (!m) return null;
  return { a: parseInt(m[1], 10), b: parseInt(m[2], 10) };
}

function setWinner(set) {
  if (!set) return null;
  if (set.a === set.b) return null;
  return set.a > set.b ? 'A' : 'B';
}

// Calcule le résultat du point de vue de la Paire A
function computeMatchResult(set1Str, set2Str, set3Str) {
  const s1 = parseSet(set1Str), s2 = parseSet(set2Str), s3 = parseSet(set3Str);
  const w1 = setWinner(s1), w2 = setWinner(s2);
  if (!w1 || !w2) return '';
  if (w1 === w2) {
    return `Victoire ${w1} 2-0`;
  }
  const w3 = setWinner(s3);
  if (!w3) return 'En attente du super tie-break';
  return `Victoire ${w3} 2-1 (SB ${set3Str})`;
}
