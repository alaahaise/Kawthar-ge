const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');
const { buildTemplate, buildExport, parseImport } = require('./excel');

let mainWindow;
let splashWindow;
let splashCree = 0;
let SQL;
let db;

const userDataPath = app.getPath('userData');
const dbPath = path.join(userDataPath, 'students.db');
const photosDir = path.join(userDataPath, 'photos');

function ensureDirs() {
  if (!fs.existsSync(userDataPath)) fs.mkdirSync(userDataPath, { recursive: true });
  if (!fs.existsSync(photosDir)) fs.mkdirSync(photosDir, { recursive: true });
}

/**
 * Écriture du fichier .db.
 *
 * En « lot », l'écriture est différée : le remplissage de la base de
 * démonstration effectue plusieurs milliers d'opérations, et réécrire tout le
 * fichier à chaque ligne rendait l'opération interminable et fragile (une
 * interruption laissait une base vide). Un point de contrôle périodique
 * limite les pertes en cas d'arrêt.
 */
let batchMode = false;
let batchDirty = false;

function saveDbToDisk() {
  if (batchMode) {
    batchDirty = true;
    return;
  }
  const data = db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
}

/** Force l'écriture immédiate (fin de lot, ou demande explicite). */
function flushDbToDisk() {
  batchDirty = false;
  const data = db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
}

ipcMain.handle('db:beginBatch', () => {
  batchMode = true;
  batchDirty = false;
  return { success: true };
});

ipcMain.handle('db:endBatch', () => {
  batchMode = false;
  if (batchDirty) flushDbToDisk();
  return { success: true, ecrit: batchDirty };
});

ipcMain.handle('db:checkpoint', () => {
  if (batchMode && batchDirty) flushDbToDisk();
  return { success: true };
});

// ---------- Dates (format affiché jj/mm/aaaa) ----------

function formatTodayDDMMYYYY() {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

function yearFromDisplayDate(dateStr) {
  if (!dateStr) return String(new Date().getFullYear());
  const parts = String(dateStr).split('/');
  return parts.length === 3 ? parts[2] : String(new Date().getFullYear());
}

/** Convertit "jj/mm/aaaa" en "aaaa-mm-jj" (null si le format est invalide). */
function displayDateToIso(dateStr) {
  const s = String(dateStr || '').trim();
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return null;
  const [dd, mm, yyyy] = s.split('/');
  if (Number(mm) < 1 || Number(mm) > 12 || Number(dd) < 1 || Number(dd) > 31) return null;
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Expression SQL qui convertit une colonne texte "jj/mm/aaaa" en "aaaa-mm-jj"
 * afin de pouvoir trier / comparer des dates chronologiquement (un simple
 * ORDER BY sur du jj/mm/aaaa est faux : "02/01/2026" < "15/12/2025" en texte).
 */
function dateIsoExpr(col) {
  return (
    `(CASE WHEN length(${col}) = 10 AND ${col} GLOB '[0-9][0-9]/[0-9][0-9]/[0-9][0-9][0-9][0-9]' ` +
    `THEN substr(${col},7,4) || '-' || substr(${col},4,2) || '-' || substr(${col},1,2) ELSE NULL END)`
  );
}

function getLastInsertId() {
  const stmt = db.prepare('SELECT last_insert_rowid() as id');
  stmt.step();
  const row = stmt.getAsObject();
  stmt.free();
  return row.id;
}

function rowsFromQuery(stmt) {
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

function query(sql, params) {
  const stmt = db.prepare(sql);
  if (params && params.length) stmt.bind(params);
  return rowsFromQuery(stmt);
}

function getColumns(table) {
  try {
    return query(`PRAGMA table_info(${table})`).map((r) => r.name);
  } catch (err) {
    return [];
  }
}

function hasColumn(table, column) {
  return getColumns(table).includes(column);
}

function tableSql(name) {
  const rows = query("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?", [name]);
  return rows.length ? rows[0].sql : null;
}

/**
 * Migration structurelle : le paiement et l'inscription sont désormais rattachés
 * à un COURS (matière + enseignant) et non plus à la seule matière.
 *
 * SQLite ne sait pas modifier une contrainte UNIQUE : on reconstruit donc les
 * tables concernées en conservant les données. L'ordre importe — les paiements
 * sont reconstruits après les inscriptions, car ils en récupèrent l'enseignant.
 */
function migrateCoursSchema() {
  // --- 1. student_matieres : autoriser plusieurs enseignants pour une matière ---
  const smSql = tableSql('student_matieres');
  if (smSql && /UNIQUE\s*\(\s*student_id\s*,\s*matiere_id\s*\)/i.test(smSql)) {
    db.run('BEGIN');
    try {
      db.run(`CREATE TABLE student_matieres_tmp (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL,
        matiere_id INTEGER NOT NULL,
        teacher_id INTEGER,
        date_inscription TEXT,
        UNIQUE(student_id, matiere_id, teacher_id)
      )`);
      db.run(`INSERT OR IGNORE INTO student_matieres_tmp (id, student_id, matiere_id, teacher_id, date_inscription)
              SELECT id, student_id, matiere_id, teacher_id, date_inscription FROM student_matieres`);
      db.run('DROP TABLE student_matieres');
      db.run('ALTER TABLE student_matieres_tmp RENAME TO student_matieres');
      db.run('COMMIT');
    } catch (err) {
      db.run('ROLLBACK');
      throw new Error(`Migration des inscriptions impossible : ${err.message}`);
    }
  }

  // --- 2. paiements : ajouter l'enseignant à la clé ---
  const paySql = tableSql('paiements');
  if (paySql && !/teacher_id/i.test(paySql)) {
    db.run('BEGIN');
    try {
      db.run(`CREATE TABLE paiements_tmp (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL,
        matiere_id INTEGER NOT NULL,
        teacher_id INTEGER,
        annee INTEGER NOT NULL,
        mois INTEGER NOT NULL,
        montant INTEGER NOT NULL DEFAULT 0,
        paye INTEGER NOT NULL DEFAULT 0,
        date_paiement TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        UNIQUE(student_id, matiere_id, teacher_id, annee, mois)
      )`);
      // L'ancien paiement était rattaché à la matière : on lui rattache
      // l'enseignant avec lequel l'élève était inscrit à cette matière.
      db.run(`INSERT OR IGNORE INTO paiements_tmp
                (id, student_id, matiere_id, teacher_id, annee, mois, montant, paye, date_paiement, created_at, updated_at)
              SELECT p.id, p.student_id, p.matiere_id,
                     (SELECT sm.teacher_id FROM student_matieres sm
                       WHERE sm.student_id = p.student_id AND sm.matiere_id = p.matiere_id
                         AND sm.teacher_id IS NOT NULL ORDER BY sm.id LIMIT 1),
                     p.annee, p.mois, p.montant, p.paye, p.date_paiement, p.created_at, p.updated_at
              FROM paiements p`);
      db.run('DROP TABLE paiements');
      db.run('ALTER TABLE paiements_tmp RENAME TO paiements');
      db.run('COMMIT');
    } catch (err) {
      db.run('ROLLBACK');
      throw new Error(`Migration des paiements impossible : ${err.message}`);
    }
  }
}

// ---------- Base de données ----------

async function initDatabase() {
  ensureDirs();
  SQL = await initSqlJs({
    locateFile: (file) => path.join(__dirname, 'node_modules', 'sql.js', 'dist', file)
  });

  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run('PRAGMA foreign_keys = ON');

  // Paramètres persistants (année de travail en cours, préférences).
  db.run(`
    CREATE TABLE IF NOT EXISTS parametres (
      cle TEXT PRIMARY KEY,
      valeur TEXT
    );
  `);

  // Un « cours » = une matière enseignée par un enseignant, avec son propre
  // tarif. C'est l'unité d'inscription et de paiement : si deux enseignants
  //Dispennent la même matière, ce sont deux cours distincts, deux grilles de
  // paiement distinctes.
  db.run(`
    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      matricule TEXT UNIQUE NOT NULL,
      nom TEXT NOT NULL,
      prenom TEXT NOT NULL,
      date_naissance TEXT,
      classe TEXT,
      telephone TEXT,
      telephone_parent TEXT,
      adresse TEXT,
      photo TEXT,
      date_inscription TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS matieres (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nom TEXT UNIQUE NOT NULL
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS teachers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nom TEXT NOT NULL,
      telephone TEXT
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS matiere_teachers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      matiere_id INTEGER NOT NULL,
      teacher_id INTEGER NOT NULL,
      prix_mensuel INTEGER NOT NULL DEFAULT 0,
      UNIQUE(matiere_id, teacher_id)
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS student_matieres (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      matiere_id INTEGER NOT NULL,
      teacher_id INTEGER,
      date_inscription TEXT,
      UNIQUE(student_id, matiere_id)
    );
  `);

  // ---------- Migrations douces (bases créées avec un schéma précédent) ----------

  //ALTER ADD COLUMN échoue si la colonne existe déjà : on ignore l'erreur.
  const softMigrations = [
    'ALTER TABLE students ADD COLUMN date_inscription TEXT',
    'ALTER TABLE students ADD COLUMN telephone_parent TEXT',
    // Enseignants : on scinde le nom en prénom + nom et on ajoute un code unique.
    'ALTER TABLE teachers ADD COLUMN prenom TEXT',
    'ALTER TABLE teachers ADD COLUMN code TEXT',
    'ALTER TABLE teachers ADD COLUMN email TEXT',
    'ALTER TABLE teachers ADD COLUMN specialite TEXT',
    // Matières : tarif mensuel par défaut (le tarif réel est porté par le cours).
    'ALTER TABLE matieres ADD COLUMN prix_mensuel INTEGER DEFAULT 0',
    'ALTER TABLE matieres ADD COLUMN description TEXT',
    // Cours : un enseignant qui assure une matière, avec SON tarif mensuel.
    'ALTER TABLE matiere_teachers ADD COLUMN prix_mensuel INTEGER NOT NULL DEFAULT 0'
  ];
  softMigrations.forEach((sql) => {
    try {
      db.run(sql);
    } catch (err) {
      // Seul le cas "la colonne existe déjà" est normal ; tout autre échec
      // (SQL invalide, table absente) doit remonter, sinon il se manifeste
      // plus tard sous forme d'un "no such column" énigmatique.
      if (!/duplicate column name/i.test(err.message)) {
        throw new Error(`Migration impossible : ${sql} -> ${err.message}`);
      }
    }
  });

  try {
    db.run('ALTER TABLE students DROP COLUMN lieu_naissance');
  } catch (err) {
    // colonne absente ou SQLite trop ancien pour DROP COLUMN — sans conséquence
  }

  migrateCoursSchema();

  // Table des paiements mensuels (un étudiant x une matière x un mois).
  db.run(`
    CREATE TABLE IF NOT EXISTS paiements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      matiere_id INTEGER NOT NULL,
      teacher_id INTEGER,
      annee INTEGER NOT NULL,
      mois INTEGER NOT NULL,
      montant INTEGER NOT NULL DEFAULT 0,
      paye INTEGER NOT NULL DEFAULT 0,
      date_paiement TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(student_id, matiere_id, teacher_id, annee, mois)
    );
  `);

  db.run('CREATE INDEX IF NOT EXISTS idx_paiements_look ON paiements (matiere_id, teacher_id, annee, mois)');
  db.run('CREATE INDEX IF NOT EXISTS idx_student_matieres_student ON student_matieres (student_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_student_matieres_matiere ON student_matieres (matiere_id)');

  // Nettoyage : supprime toute matière "fantôme" (nom vide/blanc) qui a pu être
  // créée avant l'ajout de la validation dans matieres:add, ou par une édition
  // manuelle de la base. Ces lignes s'affichaient comme une barre sans étiquette
  // dans le graphique du tableau de bord.
  try {
    const orphanIds = query("SELECT id FROM matieres WHERE nom IS NULL OR TRIM(nom) = ''").map((r) => r.id);
    orphanIds.forEach((id) => {
      db.run('DELETE FROM paiements WHERE matiere_id = ?', [id]);
      db.run('DELETE FROM student_matieres WHERE matiere_id = ?', [id]);
      db.run('DELETE FROM matiere_teachers WHERE matiere_id = ?', [id]);
      db.run('DELETE FROM matieres WHERE id = ?', [id]);
    });
  } catch (err) {
    // table matieres absente au tout premier lancement — sans conséquence
  }

  // Rattache les paiements d'étudiants supprimés manuellement dans la base
  // (les suppressions normales passant par l'application sont déjà nettoyées).
  try {
    db.run(
      'DELETE FROM paiements WHERE student_id NOT IN (SELECT id FROM students) OR matiere_id NOT IN (SELECT id FROM matieres)'
    );
  } catch (err) {
    // sans conséquence
  }

  // Complète les enseignants créés avant l'ajout du code / du prénom.
  backfillTeacherCodes();

  saveDbToDisk();
}

// ---------- Codes auto-générés ----------

function getNextTeacherCode() {
  const rows = query("SELECT code FROM teachers WHERE code IS NOT NULL AND TRIM(code) <> ''");
  const used = new Set(rows.map((r) => String(r.code)));
  let maxSeq = 0;
  used.forEach((code) => {
    const m = code.match(/^ENS(\d+)$/i);
    if (m) maxSeq = Math.max(maxSeq, parseInt(m[1], 10));
  });

  let n = maxSeq + 1;
  let code = 'ENS' + String(n).padStart(4, '0');
  while (used.has(code)) {
    n += 1;
    code = 'ENS' + String(n).padStart(4, '0');
  }
  return code;
}

function backfillTeacherCodes() {
  if (!hasColumn('teachers', 'code')) return;
  const orphan = query("SELECT id FROM teachers WHERE code IS NULL OR TRIM(code) = ''");
  orphan.forEach((t) => {
    // Les anciens enregistrements ne stockaient qu'un texte libre "Nom" : on
    // laisse le prénom vide, l'admin peut le compléter depuis la fiche.
    db.run('UPDATE teachers SET code = ? WHERE id = ?', [getNextTeacherCode(), t.id]);
  });

  //Garantit l'unicité des codes si deux enseignants anciens avaient le même.
  const dupes = query('SELECT code, COUNT(*) c FROM teachers GROUP BY code HAVING c > 1');
  dupes.forEach((row) => {
    const ids = query('SELECT id FROM teachers WHERE code = ? ORDER BY id ASC', [row.code]).map((r) => r.id);
    ids.slice(1).forEach((id) => {
      db.run('UPDATE teachers SET code = ? WHERE id = ?', [getNextTeacherCode(), id]);
    });
  });
}

// ---------- Fenêtre ----------

/**
 * Écran de démarrage affiché pendant l'ouverture de la base : sans lui,
 * l'application reste blanche une seconde ou deux sans explication.
 */
function showSplash() {
  splashCree = Date.now();
  splashWindow = new BrowserWindow({
    width: 640,
    height: 420,
    frame: false,
    resizable: false,
    movable: false,
    center: true,
    skipTaskbar: true,
    show: true,
    backgroundColor: '#f2f5fb',
    webPreferences: { contextIsolation: true, nodeIntegration: false }
  });
  splashWindow.loadFile(path.join(__dirname, 'src', 'splash.html'));
  // Une fenêtre de chargement qui reste ouverte casserait l'application.
  splashWindow.on('closed', () => {
    splashWindow = null;
  });
}

function setSplashStatus(text) {
  if (!splashWindow || splashWindow.isDestroyed()) return;
  splashWindow.webContents.executeJavaScript(
    `window.setSplashStatus && window.setSplashStatus(${JSON.stringify(text)})`
  ).catch(() => {});
}

function closeSplash() {
  if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close();
}

/**
 * Planifie la fermeture de l'écran de démarrage, une seule fois.
 *
 * 'ready-to-show' peut s'être déclenché AVANT l'abonnement du rappel : sur une
 * machine rapide ou une base déjà en cache, la fenêtre est déjà peinte au
 * moment où on écoute. Le rappel n'est alors jamais appelé et l'écran de
 * chargement reste bloqué jusqu'au filet de sécurité de 8 s — l'application
 * paraît figée au démarrage. C'est pour cela que la fermeture est protégée par
 * ce verrou, et que le rendu signale en plus sa propre disponibilité.
 */
let splashFermeturePlanifiee = false;
function scheduleSplashCloseOnce(minimumMs) {
  if (splashFermeturePlanifiee) return;
  splashFermeturePlanifiee = true;
  scheduleSplashClose(minimumMs);
}

// Signal explicite du rendu : il connaît le moment exact où l'interface est
// prête (données chargées, graphiques rendus), ce que le processus principal ne
// peut pas deviner.
ipcMain.handle('app:pret', () => {
  // 1,2 s : en dessous, l'écran de chargement n'est qu'un clignement, ce qui
  // paraît moins professionnel que de ne pas l'afficher du tout.
  scheduleSplashCloseOnce(1200);
  return { success: true };
});

/**
 * Ferme l'écran de démarrage une fois la fenêtre principale prête, en
 * respectant une durée minimale : sinon il n'apparaît qu'une fraction de
 * seconde et clignote, ce qui paraît moins professionnel que de ne pas
 * l'afficher du tout.
 */
function scheduleSplashClose(minimumMs) {
  const rester = Math.max(0, (splashCree || Date.now()) + (minimumMs || 1200) - Date.now());
  setTimeout(closeSplash, rester);
}

function createWindow() {
  Menu.setApplicationMenu(null);

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 860,
    minWidth: 1050,
    minHeight: 680,
    backgroundColor: '#f2f5fb',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  // Remonte les erreurs du renderer dans la console du processus principal :
  // sans cela une exception dans l'interface est totalement silencieuse.
  mainWindow.webContents.on('console-message', (_e, level, message, line, sourceId) => {
    // level 3 = error, level 2 = warning
    if (level >= 2) {
      console.error(`[renderer] ${message} (${sourceId}:${line})`);
    }
  });
}

app.whenReady().then(async () => {
  showSplash();
  setSplashStatus('Ouverture de la base de données…');
  await initDatabase();
  setSplashStatus('Préparation de l\'interface…');
  createWindow();

  // Le splash reste affiché tant que la fenêtre principale charge son script.
  mainWindow.once('ready-to-show', () => scheduleSplashCloseOnce(1200));
  if (!mainWindow.webContents.isLoading()) scheduleSplashCloseOnce(1200);

  // Filet de sécurité si aucun signal n'arrive.
  setTimeout(closeSplash, 8000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  closeSplash();
  if (process.platform !== 'darwin') app.quit();
});

// ---------- IPC: Étudiants ----------

/** Colonnes triables : liste blanche, le nom de colonne n'est jamais
 *  concaténé dans la requête sans contrôle. */
const STUDENT_SORTS = {
  matricule: 's.matricule COLLATE NOCASE',
  nom: 's.nom COLLATE NOCASE, s.prenom COLLATE NOCASE',
  prenom: 's.prenom COLLATE NOCASE, s.nom COLLATE NOCASE',
  classe: "COALESCE(s.classe, '') COLLATE NOCASE",
  date_naissance: `${dateIsoExpr('s.date_naissance')} IS NULL ASC, ${dateIsoExpr('s.date_naissance')}`,
  date_inscription: `${dateIsoExpr('s.date_inscription')} IS NULL ASC, ${dateIsoExpr('s.date_inscription')}`,
  telephone_parent: "COALESCE(s.telephone_parent, '') COLLATE NOCASE"
};

ipcMain.handle('students:list', (event, params) => {
  const p = params || {};
  const search = (p.search || '').trim();
  const classe = (p.classe || '').trim();
  const matiereId = p.matiere_id ? parseInt(p.matiere_id, 10) : null;
  const teacherId = p.teacher_id ? parseInt(p.teacher_id, 10) : null;
  const nom = (p.nom || '').trim();
  const prenom = (p.prenom || '').trim();
  const dateField = p.date_field === 'date_naissance' ? 'date_naissance' : 'date_inscription';
  const dateFrom = displayDateToIso(p.date_from);
  const dateTo = displayDateToIso(p.date_to);
  // (le tri est traité plus bas, via STUDENT_SORTS)
  const unpaidMatiereId = p.unpaid_matiere_id ? parseInt(p.unpaid_matiere_id, 10) : null;
  const unpaidAnnee = p.unpaid_annee ? parseInt(p.unpaid_annee, 10) : null;
  const unpaidMois = p.unpaid_mois ? parseInt(p.unpaid_mois, 10) : null;

  // Filtre d'état : « payé / impayé » pour une matière et un mois donnés.
  const statutMatiere = p.paiement_matiere ? parseInt(p.paiement_matiere, 10) : null;
  const statutMois = p.paiement_mois ? parseInt(p.paiement_mois, 10) : null;
  const statutAnnee = p.paiement_annee ? parseInt(p.paiement_annee, 10) : null;
  const statut = p.statut === 'paye' || p.statut === 'impaye' ? p.statut : '';

  let sql = 'SELECT DISTINCT s.* FROM students s';
  const joins = [];
  const conditions = [];
  const values = [];

  if (matiereId || teacherId || unpaidMatiereId) {
    joins.push('LEFT JOIN student_matieres sm ON sm.student_id = s.id');
  }
  if (matiereId) {
    conditions.push('sm.matiere_id = ?');
    values.push(matiereId);
  }
  if (teacherId) {
    conditions.push('sm.teacher_id = ?');
    values.push(teacherId);
  }
  if (unpaidMatiereId && unpaidAnnee && unpaidMois) {
    //Étudiants inscrits à la matière ET sans ligne payée pour ce mois.
    conditions.push(
      'EXISTS (SELECT 1 FROM student_matieres x WHERE x.student_id = s.id AND x.matiere_id = ?) ' +
        'AND NOT EXISTS (SELECT 1 FROM paiements py WHERE py.student_id = s.id AND py.matiere_id = ? AND py.annee = ? AND py.mois = ? AND py.paye = 1)'
    );
    values.push(unpaidMatiereId, unpaidMatiereId, unpaidAnnee, unpaidMois);
  }

  if (statut && statutMatiere && statutMois && statutAnnee) {
    // Un élève correspond s'il a au moins un professeur de cette matière dont
    // le paiement du mois est dans l'état demandé.
    const cible = statut === 'paye' ? 1 : 0;
    conditions.push(
      `EXISTS (SELECT 1 FROM student_matieres x
               LEFT JOIN paiements py
                 ON py.student_id = x.student_id AND py.matiere_id = x.matiere_id
                AND py.teacher_id IS x.teacher_id AND py.annee = ? AND py.mois = ?
               WHERE x.student_id = s.id AND x.matiere_id = ?
                 AND COALESCE(py.paye, 0) = ?)`
    );
    values.push(statutAnnee, statutMois, statutMatiere, cible);
  }

  if (search !== '') {
    const like = `%${search}%`;
    conditions.push(
      '(s.nom LIKE ? OR s.prenom LIKE ? OR s.matricule LIKE ? OR s.date_naissance LIKE ? OR s.date_inscription LIKE ? OR s.classe LIKE ? OR s.telephone LIKE ? OR s.telephone_parent LIKE ? OR s.adresse LIKE ?)'
    );
    values.push(like, like, like, like, like, like, like, like, like);
  }
  if (nom !== '') {
    conditions.push('s.nom LIKE ?');
    values.push(`%${nom}%`);
  }
  if (prenom !== '') {
    conditions.push('s.prenom LIKE ?');
    values.push(`%${prenom}%`);
  }
  if (classe !== '') {
    conditions.push('s.classe = ?');
    values.push(classe);
  }

  const isoCol = dateIsoExpr(`s.${dateField}`);
  if (dateFrom) {
    conditions.push(`${isoCol} >= ?`);
    values.push(dateFrom);
  }
  if (dateTo) {
    conditions.push(`${isoCol} <= ?`);
    values.push(dateTo);
  }

  if (joins.length) sql += ' ' + joins.join(' ');
  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');

  // Tri par colonne cliquable. La date est convertie en aaaa-mm-jj, sinon
  // jj/mm/aaaa ne se trie pas dans le bon ordre.
  const sortKey = Object.prototype.hasOwnProperty.call(STUDENT_SORTS, p.sort) ? p.sort : 'nom';
  const dir = p.dir === 'desc' ? 'DESC' : 'ASC';
  sql += ` ORDER BY ${STUDENT_SORTS[sortKey]} ${dir}`;

  return query(sql, values);
});

ipcMain.handle('students:classes', () =>
  query("SELECT DISTINCT classe FROM students WHERE classe IS NOT NULL AND TRIM(classe) <> '' ORDER BY classe COLLATE NOCASE ASC").map(
    (r) => r.classe
  )
);

ipcMain.handle('students:get', (event, id) => {
  const rows = query('SELECT * FROM students WHERE id = ?', [id]);
  return rows[0] || null;
});

ipcMain.handle('students:add', (event, student) => {
  try {
    const dateInscription = student.date_inscription || formatTodayDDMMYYYY();
    const year = yearFromDisplayDate(dateInscription);
    const matricule = getNextMatricule(year);

    let photoFileName = null;
    if (student.photoTempPath) {
      photoFileName = copyPhotoToStore(student.photoTempPath, matricule);
    }

    db.run(
      `INSERT INTO students (matricule, nom, prenom, date_naissance, classe, telephone, telephone_parent, adresse, photo, date_inscription)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        matricule,
        student.nom,
        student.prenom,
        student.date_naissance || null,
        student.classe || null,
        student.telephone || null,
        student.telephone_parent || null,
        student.adresse || null,
        photoFileName,
        dateInscription
      ]
    );
    const studentId = getLastInsertId();
    saveDbToDisk();
    return { success: true, matricule, id: studentId };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

function getNextMatricule(year) {
  const prefix = String(year);
  const rows = query('SELECT matricule FROM students WHERE matricule LIKE ?', [prefix + '%']);
  let maxSeq = 0;
  rows.forEach((r) => {
    const suffix = String(r.matricule).slice(prefix.length);
    const num = parseInt(suffix, 10);
    if (!isNaN(num) && num > maxSeq) maxSeq = num;
  });
  const next = maxSeq + 1;
  return prefix + String(next).padStart(4, '0');
}

ipcMain.handle('students:previewMatricule', (event, year) => getNextMatricule(year || new Date().getFullYear()));

ipcMain.handle('students:update', (event, student) => {
  try {
    let photoFileName = student.existingPhoto || null;
    if (student.removePhoto) {
      photoFileName = null;
      deletePhotoFiles(student.matricule);
    } else if (student.photoTempPath) {
      photoFileName = copyPhotoToStore(student.photoTempPath, student.matricule);
    }

    db.run(
      `UPDATE students SET matricule=?, nom=?, prenom=?, date_naissance=?, classe=?, telephone=?, telephone_parent=?, adresse=?, photo=?, date_inscription=?
       WHERE id=?`,
      [
        student.matricule,
        student.nom,
        student.prenom,
        student.date_naissance || null,
        student.classe || null,
        student.telephone || null,
        student.telephone_parent || null,
        student.adresse || null,
        photoFileName,
        student.date_inscription || null,
        student.id
      ]
    );
    saveDbToDisk();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('students:delete', (event, id) => {
  try {
    // Supprime aussi les paiements pour ne pas laisser de lignes orphelines.
    db.run('DELETE FROM paiements WHERE student_id = ?', [id]);
    db.run('DELETE FROM student_matieres WHERE student_id = ?', [id]);
    const row = query('SELECT matricule, photo FROM students WHERE id = ?', [id])[0];
    db.run('DELETE FROM students WHERE id = ?', [id]);
    if (row && row.photo) deletePhotoFiles(row.matricule);
    saveDbToDisk();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('students:count', () => query('SELECT COUNT(*) as total FROM students')[0].total);

// Liste des cours suivis par chaque élève, pour afficher les puces dans la table.
ipcMain.handle('students:matieresMap', () => {
  const rows = query(
    `SELECT sm.student_id, m.nom, t.nom AS teacher_nom, t.prenom AS teacher_prenom
     FROM student_matieres sm
     JOIN matieres m ON m.id = sm.matiere_id
     LEFT JOIN teachers t ON t.id = sm.teacher_id
     ORDER BY m.nom COLLATE NOCASE ASC, t.nom COLLATE NOCASE ASC`
  );
  const map = {};
  rows.forEach((r) => {
    if (!map[r.student_id]) map[r.student_id] = [];
    const prof = teacherFullName({ nom: r.teacher_nom, prenom: r.teacher_prenom });
    // Un même élève peut suivre la matière avec deux professeurs : on le dit.
    map[r.student_id].push(prof ? `${cleanMatiereName(r.nom)} · ${prof}` : cleanMatiereName(r.nom));
  });
  return map;
});

// ---------- Photos ----------

function deletePhotoFiles(matricule) {
  const safeMatricule = String(matricule || '').replace(/[^a-zA-Z0-9_-]/g, '_');
  try {
    fs.readdirSync(photosDir)
      .filter((f) => f.startsWith(`${safeMatricule}.`))
      .forEach((f) => fs.unlinkSync(path.join(photosDir, f)));
  } catch (err) {
    // dossier photos illisible ou vide — sans conséquence
  }
}

function copyPhotoToStore(tempPath, matricule) {
  const ext = (path.extname(tempPath) || '.jpg').toLowerCase();
  const safeMatricule = String(matricule).replace(/[^a-zA-Z0-9_-]/g, '_');

  // Supprime toute ancienne photo de cet étudiant (utile si l'extension change,
  // ex: ancienne photo .png remplacée par une .jpg) pour éviter les doublons orphelins.
  deletePhotoFiles(safeMatricule);

  const fileName = `${safeMatricule}${ext}`;
  fs.copyFileSync(tempPath, path.join(photosDir, fileName));
  return fileName;
}

ipcMain.handle('dialog:selectPhoto', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Choisir une photo',
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp'] }]
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

ipcMain.handle('photos:getDir', () => photosDir);

/**
 * Associe automatiquement des photos à des élèves : les fichiers du dossier
 * doivent porter le matricule comme nom (ex. 20260001.jpg).
 * Pratique pour réimporter un lot de photos après un changement de PC.
 */
function importPhotosFromDir(dir) {
  let files = [];
  try {
    files = fs.readdirSync(dir);
  } catch (err) {
    return { success: false, error: `Dossier illisible : ${err.message}` };
  }

  const extensions = /\.(jpe?g|png|webp)$/i;
  const sameDir = path.resolve(dir) === path.resolve(photosDir);
  let imported = 0;
  const ignored = [];

  // Deux façons de retrouver l'élève : par matricule (20260001.jpg) ou par
  // nom complet (Karim Benali.jpg) — utile juste après un import Excel, quand
  // les photos portent des noms de personnes et non de matricules.
  const parMatricule = new Map();
  const parNom = new Map();
  query('SELECT id, matricule, nom, prenom FROM students').forEach((s) => {
    parMatricule.set(String(s.matricule).toLowerCase(), s);
    const cle = `${String(s.nom || '')} ${String(s.prenom || '')}`
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
    // Un homonyme ne doit pas écraser le premier trouvé.
    if (cle && !parNom.has(cle)) parNom.set(cle, s);
  });

  files.filter((f) => extensions.test(f)).forEach((file) => {
    const base = path
      .basename(file, path.extname(file))
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();

    const student = parMatricule.get(base) || parNom.get(base);
    if (!student) {
      ignored.push(file);
      return;
    }
    const stored = sameDir ? file : copyPhotoToStore(path.join(dir, file), student.matricule);
    db.run('UPDATE students SET photo = ? WHERE id = ?', [stored, student.id]);
    imported += 1;
  });

  if (imported > 0) saveDbToDisk();
  return { success: true, imported, ignored };
}

ipcMain.handle('students:importPhotos', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Dossier des photos à importer',
    properties: ['openDirectory'],
    buttonLabel: 'Importer'
  });
  if (result.canceled || result.filePaths.length === 0) return { success: false, canceled: true };
  return importPhotosFromDir(result.filePaths[0]);
});

ipcMain.handle('print:pdf', async (event, suggestedName) => {
  try {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Enregistrer en PDF',
      defaultPath: suggestedName || 'document.pdf',
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    });
    if (result.canceled || !result.filePath) return { success: false, canceled: true };

    const pdfBuffer = await mainWindow.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
      margins: { marginType: 'none' }
    });
    fs.writeFileSync(result.filePath, pdfBuffer);
    return { success: true, filePath: result.filePath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ---------- Matières ----------

// Nettoie un nom de matière des caractères invisibles (espace zéro-largeur,
// BOM, espace insécable, etc.) que SQLite TRIM() ne détecte pas — pour
// éviter d'afficher une étiquette vide dans la liste ou le graphique.
function cleanMatiereName(nom) {
  const cleaned = String(nom || '').replace(/[\u200B-\u200D\uFEFF\u00A0\s]+/g, ' ').trim();
  return cleaned || 'Sans nom';
}

const MATIERES_SELECT = `
  SELECT m.id, m.nom, m.description, m.prix_mensuel,
         COUNT(DISTINCT sm.id) as student_count,
         COUNT(DISTINCT mt.id) as teacher_count
  FROM matieres m
  LEFT JOIN student_matieres sm ON sm.matiere_id = m.id
  LEFT JOIN matiere_teachers mt ON mt.matiere_id = m.id
  WHERE TRIM(m.nom) <> ''
  GROUP BY m.id
  ORDER BY m.nom COLLATE NOCASE ASC
`;

function normalizeMatiere(row) {
  return {
    ...row,
    nom: cleanMatiereName(row.nom),
    description: row.description || '',
    prix_mensuel: Number(row.prix_mensuel) || 0
  };
}

ipcMain.handle('matieres:list', () => query(MATIERES_SELECT).map(normalizeMatiere));
ipcMain.handle('matieres:stats', () => query(MATIERES_SELECT).map(normalizeMatiere));

ipcMain.handle('matieres:add', (event, payload) => {
  try {
    const data = typeof payload === 'string' ? { nom: payload } : payload || {};
    const trimmed = (data.nom || '').trim();
    if (!trimmed) return { success: false, error: 'Nom requis' };
    db.run('INSERT INTO matieres (nom, description, prix_mensuel) VALUES (?, ?, ?)', [
      trimmed,
      (data.description || '').trim() || null,
      Math.max(0, parseInt(data.prix_mensuel, 10) || 0)
    ]);
    const id = getLastInsertId();
    saveDbToDisk();
    return { success: true, id };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('matieres:update', (event, payload) => {
  try {
    const id = payload && payload.id;
    const nom = ((payload && payload.nom) || '').trim();
    if (!id) return { success: false, error: 'ID manquant' };
    if (!nom) return { success: false, error: 'Nom requis' };
    db.run('UPDATE matieres SET nom = ?, description = ?, prix_mensuel = ? WHERE id = ?', [
      nom,
      (payload.description || '').trim() || null,
      Math.max(0, parseInt(payload.prix_mensuel, 10) || 0),
      id
    ]);
    saveDbToDisk();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('matieres:delete', (event, id) => {
  try {
    db.run('DELETE FROM paiements WHERE matiere_id = ?', [id]);
    db.run('DELETE FROM student_matieres WHERE matiere_id = ?', [id]);
    db.run('DELETE FROM matiere_teachers WHERE matiere_id = ?', [id]);
    db.run('DELETE FROM matieres WHERE id = ?', [id]);
    saveDbToDisk();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ---------- Enseignants ----------

const TEACHERS_SELECT = `
  SELECT t.id, t.code, t.nom, t.prenom, t.telephone, t.email, t.specialite,
         COUNT(DISTINCT mt.matiere_id) as matiere_count,
         (SELECT COUNT(DISTINCT sm.student_id) FROM student_matieres sm WHERE sm.teacher_id = t.id) as student_count,
         COALESCE((SELECT SUM(p.montant) FROM paiements p
                    WHERE p.teacher_id = t.id AND p.paye = 1 AND p.annee = strftime('%Y','now')), 0) as revenus_annee
  FROM teachers t
  LEFT JOIN matiere_teachers mt ON mt.teacher_id = t.id
  GROUP BY t.id
  ORDER BY t.nom COLLATE NOCASE ASC, t.prenom COLLATE NOCASE ASC
`;

function teacherFullName(t) {
  return [t.prenom, t.nom].filter(Boolean).join(' ').trim() || t.nom || '';
}

function normalizeTeacher(row) {
  return {
    ...row,
    full_name: teacherFullName(row),
    specialite: row.specialite || '',
    revenus_annee: Number(row.revenus_annee) || 0
  };
}

ipcMain.handle('teachers:list', () => query(TEACHERS_SELECT).map(normalizeTeacher));

ipcMain.handle('teachers:get', (event, id) => {
  const row = query('SELECT * FROM teachers WHERE id = ?', [id])[0];
  return row ? normalizeTeacher(row) : null;
});

ipcMain.handle('teachers:nextCode', () => getNextTeacherCode());

ipcMain.handle('teachers:add', (event, teacher) => {
  try {
    const t = teacher || {};
    const nom = (t.nom || '').trim();
    const prenom = (t.prenom || '').trim();
    if (!nom && !prenom) return { success: false, error: 'Nom ou prénom requis' };
    const code = getNextTeacherCode();
    db.run(
      'INSERT INTO teachers (code, nom, prenom, telephone, email, specialite) VALUES (?, ?, ?, ?, ?, ?)',
      [
        code,
        nom,
        prenom || null,
        (t.telephone || '').trim() || null,
        (t.email || '').trim() || null,
        (t.specialite || '').trim() || null
      ]
    );
    const id = getLastInsertId();
    saveDbToDisk();
    return { success: true, id, code };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('teachers:update', (event, payload) => {
  try {
    const t = payload || {};
    const id = t.id;
    const nom = (t.nom || '').trim();
    const prenom = (t.prenom || '').trim();
    if (!id) return { success: false, error: 'ID manquant' };
    if (!nom && !prenom) return { success: false, error: 'Nom ou prénom requis' };
    db.run('UPDATE teachers SET nom = ?, prenom = ?, telephone = ?, email = ?, specialite = ? WHERE id = ?', [
      nom,
      prenom || null,
      (t.telephone || '').trim() || null,
      (t.email || '').trim() || null,
      (t.specialite || '').trim() || null,
      id
    ]);
    saveDbToDisk();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('teachers:delete', (event, id) => {
  try {
    // Un cours supprimé emporte ses inscriptions et ses paiements.
    db.run(
      'DELETE FROM paiements WHERE teacher_id = ? AND matiere_id IN (SELECT matiere_id FROM matiere_teachers WHERE teacher_id = ?)',
      [id, id]
    );
    db.run('DELETE FROM student_matieres WHERE teacher_id = ?', [id]);
    db.run('DELETE FROM matiere_teachers WHERE teacher_id = ?', [id]);
    db.run('DELETE FROM teachers WHERE id = ?', [id]);
    saveDbToDisk();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ============================================================
//              COURS = une matière enseignée par un enseignant
// ============================================================
// C'est l'unité d'inscription ET de paiement. Si deux enseignants dispensent la
// même matière, ce sont deux cours distincts : un élève peut suivre les deux,
// et les encaissements ne sont jamais confondus.

function normalizeCours(r) {
  return {
    ...r,
    matiere_nom: cleanMatiereName(r.matiere_nom),
    teacher_nom: cleanMatiereName(r.teacher_nom),
    teacher_full_name: teacherFullName({ nom: r.teacher_nom, prenom: r.teacher_prenom }),
    prix_mensuel: Number(r.prix_mensuel) || 0,
    student_count: Number(r.student_count) || 0
  };
}

const COURS_SELECT = `
  SELECT mt.id, mt.matiere_id, mt.teacher_id, mt.prix_mensuel,
         m.nom AS matiere_nom, m.prix_mensuel AS prix_matiere,
         t.nom AS teacher_nom, t.prenom AS teacher_prenom, t.code AS teacher_code,
         (SELECT COUNT(*) FROM student_matieres sm
          WHERE sm.matiere_id = mt.matiere_id AND sm.teacher_id = mt.teacher_id) AS student_count
  FROM matiere_teachers mt
  JOIN matieres m ON m.id = mt.matiere_id
  JOIN teachers t ON t.id = mt.teacher_id
`;

const COURS_ORDER = ' ORDER BY m.nom COLLATE NOCASE ASC, t.nom COLLATE NOCASE ASC';

ipcMain.handle('cours:list', () => query(COURS_SELECT + COURS_ORDER).map(normalizeCours));

ipcMain.handle('cours:listForTeacher', (event, teacherId) =>
  query(COURS_SELECT + ' WHERE mt.teacher_id = ?' + COURS_ORDER, [teacherId]).map(normalizeCours)
);

ipcMain.handle('cours:listForMatiere', (event, matiereId) =>
  query(COURS_SELECT + ' WHERE mt.matiere_id = ?' + COURS_ORDER, [matiereId]).map(normalizeCours)
);

ipcMain.handle('cours:info', (event, payload) => {
  const row = query(COURS_SELECT + ' WHERE mt.id = ?', [payload.id])[0];
  return row ? normalizeCours(row) : null;
});

ipcMain.handle('matiereTeachers:listAll', () => query(COURS_SELECT + COURS_ORDER).map(normalizeCours));

ipcMain.handle('matiereTeachers:listForMatiere', (event, matiereId) =>
  query(COURS_SELECT + ' WHERE mt.matiere_id = ?' + COURS_ORDER, [matiereId]).map(normalizeCours)
);

/** Crée le cours, ou met à jour son tarif si l'affectation existe déjà. */
ipcMain.handle('matiereTeachers:add', (event, payload) => {
  try {
    const matiereId = parseInt(payload.matiere_id, 10);
    const teacherId = parseInt(payload.teacher_id, 10);
    if (!matiereId || !teacherId) return { success: false, error: 'Matière ou enseignant manquant' };

    const existing = query('SELECT id FROM matiere_teachers WHERE matiere_id = ? AND teacher_id = ?', [
      matiereId,
      teacherId
    ])[0];

    // Tarif non saisi => on reprend le tarif par défaut de la matière.
    const m = query('SELECT prix_mensuel FROM matieres WHERE id = ?', [matiereId])[0];
    const prix =
      payload.prix_mensuel !== undefined && payload.prix_mensuel !== null && payload.prix_mensuel !== ''
        ? Math.max(0, parseInt(payload.prix_mensuel, 10) || 0)
        : m
          ? Number(m.prix_mensuel) || 0
          : 0;

    if (existing) {
      db.run('UPDATE matiere_teachers SET prix_mensuel = ? WHERE id = ?', [prix, existing.id]);
      saveDbToDisk();
      return { success: true, id: existing.id, updated: true };
    }

    db.run('INSERT INTO matiere_teachers (matiere_id, teacher_id, prix_mensuel) VALUES (?, ?, ?)', [
      matiereId,
      teacherId,
      prix
    ]);
    const id = getLastInsertId();
    saveDbToDisk();
    return { success: true, id };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

/** Tarif mensuel propre à ce cours (le même enseignant peut avoir des tarifs
 *  différents selon la matière). */
ipcMain.handle('cours:update', (event, payload) => {
  try {
    const prix = Math.max(0, parseInt(payload.prix_mensuel, 10) || 0);
    db.run('UPDATE matiere_teachers SET prix_mensuel = ? WHERE id = ?', [prix, payload.id]);
    saveDbToDisk();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

/**
 * Retirer un cours. S'il reste des élèves inscrits ou des paiements, l'interface
 * demande confirmation avant de supprimer (suppression en cascade).
 */
ipcMain.handle('matiereTeachers:remove', (event, payload) => {
  try {
    const matiereId = payload.matiere_id;
    const teacherId = payload.teacher_id;
    const nbEleves = query('SELECT COUNT(*) c FROM student_matieres WHERE matiere_id = ? AND teacher_id = ?', [
      matiereId,
      teacherId
    ])[0].c;
    const nbPaiements = query('SELECT COUNT(*) c FROM paiements WHERE matiere_id = ? AND teacher_id = ?', [
      matiereId,
      teacherId
    ])[0].c;

    if (!payload.force && (nbEleves > 0 || nbPaiements > 0)) {
      return { success: false, needsConfirm: true, eleves: Number(nbEleves), paiements: Number(nbPaiements) };
    }

    db.run('DELETE FROM paiements WHERE matiere_id = ? AND teacher_id = ?', [matiereId, teacherId]);
    db.run('DELETE FROM student_matieres WHERE matiere_id = ? AND teacher_id = ?', [matiereId, teacherId]);
    db.run('DELETE FROM matiere_teachers WHERE matiere_id = ? AND teacher_id = ?', [matiereId, teacherId]);
    saveDbToDisk();
    return { success: true, eleves_retires: Number(nbEleves) || 0, paiements_supprimes: Number(nbPaiements) || 0 };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ---------- Inscriptions élève -> cours ----------

ipcMain.handle('studentMatieres:listForStudent', (event, studentId) =>
  query(
    `SELECT sm.matiere_id, sm.teacher_id, sm.date_inscription,
            m.nom AS matiere_nom,
            t.nom AS teacher_nom, t.prenom AS teacher_prenom,
            COALESCE(mt.prix_mensuel, m.prix_mensuel, 0) AS prix_mensuel
     FROM student_matieres sm
     JOIN matieres m ON m.id = sm.matiere_id
     LEFT JOIN teachers t ON t.id = sm.teacher_id
     LEFT JOIN matiere_teachers mt ON mt.matiere_id = sm.matiere_id AND mt.teacher_id = sm.teacher_id
     WHERE sm.student_id = ?
     ORDER BY m.nom COLLATE NOCASE ASC, t.nom COLLATE NOCASE ASC`,
    [studentId]
  ).map((r) => ({
    ...r,
    matiere_nom: cleanMatiereName(r.matiere_nom),
    teacher_full_name: teacherFullName({ nom: r.teacher_nom, prenom: r.teacher_prenom }),
    prix_mensuel: Number(r.prix_mensuel) || 0
  }))
);

/** Élèves inscrits à une matière, éventuellement pour un enseignant donné. */
ipcMain.handle('studentMatieres:listForMatiere', (event, params) => {
  const matiereId = parseInt(params.matiere_id, 10);
  const teacherId = params.teacher_id ? parseInt(params.teacher_id, 10) : null;
  const where = teacherId ? 'AND sm.teacher_id = ?' : '';
  const values = teacherId ? [matiereId, teacherId] : [matiereId];
  return query(
    `SELECT s.id, s.matricule, s.nom, s.prenom, s.classe, s.telephone_parent, sm.teacher_id,
            t.nom AS teacher_nom, t.prenom AS teacher_prenom
     FROM student_matieres sm
     JOIN students s ON s.id = sm.student_id
     LEFT JOIN teachers t ON t.id = sm.teacher_id
     WHERE sm.matiere_id = ? ${where}
     ORDER BY t.nom COLLATE NOCASE ASC, s.nom COLLATE NOCASE ASC`,
    values
  ).map((r) => ({ ...r, teacher_full_name: teacherFullName({ nom: r.teacher_nom, prenom: r.teacher_prenom }) }));
});

/**
 * Inscrire un élève dans une matière avec un enseignant implique que cet
 * enseignant assure la matière : on alimente `matiere_teachers` pour que les
 * pages Enseignants / Matières et la matrice restent cohérentes.
 */
function linkTeacherToMatiere(matiereId, teacherId) {
  if (!matiereId || !teacherId) return;
  const exists = query('SELECT id FROM matiere_teachers WHERE matiere_id = ? AND teacher_id = ?', [
    matiereId,
    teacherId
  ])[0];
  if (exists) return;
  const m = query('SELECT prix_mensuel FROM matieres WHERE id = ?', [matiereId])[0];
  db.run('INSERT INTO matiere_teachers (matiere_id, teacher_id, prix_mensuel) VALUES (?, ?, ?)', [
    matiereId,
    teacherId,
    m ? Number(m.prix_mensuel) || 0 : 0
  ]);
}

ipcMain.handle('studentMatieres:setForStudent', (event, payload) => {
  try {
    const studentId = payload.student_id;
    // selections : [{ matiere_id, teacher_ids: [id, ...] }] — un élève peut
    // suivre la même matière avec plusieurs enseignants.
    const selections = payload.selections || [];
    const dateInscription = payload.date_inscription || null;

    db.run('DELETE FROM student_matieres WHERE student_id = ?', [studentId]);

    const stmt = db.prepare(
      'INSERT OR IGNORE INTO student_matieres (student_id, matiere_id, teacher_id, date_inscription) VALUES (?, ?, ?, ?)'
    );
    selections.forEach((sel) => {
      const ids = Array.isArray(sel.teacher_ids)
        ? sel.teacher_ids
        : sel.teacher_id
          ? [sel.teacher_id]
          : [];
      ids.forEach((tid) => {
        const teacherId = parseInt(tid, 10);
        if (!teacherId || !sel.matiere_id) return;
        stmt.run([studentId, sel.matiere_id, teacherId, dateInscription]);
        linkTeacherToMatiere(sel.matiere_id, teacherId);
      });
    });
    stmt.free();

    saveDbToDisk();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('studentMatieres:enroll', (event, payload) => {
  try {
    db.run(
      'INSERT OR IGNORE INTO student_matieres (student_id, matiere_id, teacher_id, date_inscription) VALUES (?, ?, ?, ?)',
      [
        payload.student_id,
        payload.matiere_id,
        payload.teacher_id || null,
        payload.date_inscription || formatTodayDDMMYYYY()
      ]
    );
    linkTeacherToMatiere(payload.matiere_id, payload.teacher_id);
    saveDbToDisk();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('studentMatieres:unenroll', (event, payload) => {
  try {
    db.run('DELETE FROM student_matieres WHERE student_id = ? AND matiere_id = ? AND teacher_id IS ?', [
      payload.student_id,
      payload.matiere_id,
      payload.teacher_id || null
    ]);
    saveDbToDisk();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ============================================================
//                        PAIEMENTS
// ============================================================
// Toujours rattachés à un cours (matière + enseignant) et à une année.

/** Tarif mensuel du cours, utilisé pour pré-remplir les cases. */
function coursPrice(matiereId, teacherId) {
  const row = query('SELECT prix_mensuel FROM matiere_teachers WHERE matiere_id = ? AND teacher_id = ?', [
    matiereId,
    teacherId
  ])[0];
  if (row) return Number(row.prix_mensuel) || 0;
  const m = query('SELECT prix_mensuel FROM matieres WHERE id = ?', [matiereId])[0];
  return m ? Number(m.prix_mensuel) || 0 : 0;
}

/** Grille : élèves inscrits à CE cours + état de chaque mois de l'année. */
ipcMain.handle('paiements:grid', (event, params) => {
  const p = params || {};
  const matiereId = p.matiere_id ? parseInt(p.matiere_id, 10) : null;
  const teacherId = p.teacher_id ? parseInt(p.teacher_id, 10) : null;
  const annee = p.annee ? parseInt(p.annee, 10) : new Date().getFullYear();
  if (!matiereId || !teacherId) return { cours: null, annee, students: [] };

  const cours = query(COURS_SELECT + ' WHERE mt.matiere_id = ? AND mt.teacher_id = ?', [matiereId, teacherId])[0];

  const students = query(
    `SELECT s.id, s.matricule, s.nom, s.prenom, s.classe, s.telephone_parent, s.date_inscription
     FROM student_matieres sm
     JOIN students s ON s.id = sm.student_id
     WHERE sm.matiere_id = ? AND sm.teacher_id = ?
     ORDER BY s.nom COLLATE NOCASE ASC, s.prenom COLLATE NOCASE ASC`,
    [matiereId, teacherId]
  );

  const payments = query(
    'SELECT student_id, mois, montant, paye, date_paiement FROM paiements WHERE matiere_id = ? AND teacher_id = ? AND annee = ?',
    [matiereId, teacherId, annee]
  );

  const byStudent = new Map();
  payments.forEach((row) => {
    if (!byStudent.has(row.student_id)) byStudent.set(row.student_id, {});
    byStudent.get(row.student_id)[row.mois] = row;
  });

  return {
    cours: cours ? normalizeCours(cours) : null,
    annee,
    students: students.map((s) => ({ ...s, payments: byStudent.get(s.id) || {} }))
  };
});

/** Enregistre l'état "payé / non payé" d'une case de la grille. */
ipcMain.handle('paiements:toggle', (event, payload) => {
  try {
    const studentId = parseInt(payload.student_id, 10);
    const matiereId = parseInt(payload.matiere_id, 10);
    const teacherId = parseInt(payload.teacher_id, 10);
    const annee = parseInt(payload.annee, 10);
    const mois = parseInt(payload.mois, 10);
    const paye = payload.paye ? 1 : 0;
    const datePaiement = paye ? payload.date_paiement || formatTodayDDMMYYYY() : null;

    const montant =
      payload.montant !== undefined && payload.montant !== null && payload.montant !== ''
        ? Math.max(0, parseInt(payload.montant, 10) || 0)
        : coursPrice(matiereId, teacherId);

    db.run(
      `INSERT INTO paiements (student_id, matiere_id, teacher_id, annee, mois, montant, paye, date_paiement, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(student_id, matiere_id, teacher_id, annee, mois)
       DO UPDATE SET paye = excluded.paye,
                     montant = excluded.montant,
                     date_paiement = excluded.date_paiement,
                     updated_at = datetime('now')`,
      [studentId, matiereId, teacherId, annee, mois, montant, paye, datePaiement]
    );
    saveDbToDisk();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

/** Coche / décoche toute la matière pour un mois donné (règlement groupé). */
ipcMain.handle('paiements:markAll', (event, payload) => {
  try {
    const matiereId = parseInt(payload.matiere_id, 10);
    const teacherId = parseInt(payload.teacher_id, 10);
    const annee = parseInt(payload.annee, 10);
    const mois = parseInt(payload.mois, 10);
    const paye = payload.paye ? 1 : 0;
    const datePaiement = paye ? payload.date_paiement || formatTodayDDMMYYYY() : null;
    const prix = coursPrice(matiereId, teacherId);

    const studentIds = query(
      'SELECT student_id FROM student_matieres WHERE matiere_id = ? AND teacher_id = ?',
      [matiereId, teacherId]
    ).map((r) => r.student_id);

    studentIds.forEach((sid) => {
      db.run(
        `INSERT INTO paiements (student_id, matiere_id, teacher_id, annee, mois, montant, paye, date_paiement, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
         ON CONFLICT(student_id, matiere_id, teacher_id, annee, mois)
         DO UPDATE SET paye = excluded.paye, date_paiement = excluded.date_paiement, updated_at = datetime('now')`,
        [sid, matiereId, teacherId, annee, mois, prix, paye, datePaiement]
      );
    });
    saveDbToDisk();
    return { success: true, count: studentIds.length };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

/** Totaux d'un cours sur une année. */
ipcMain.handle('paiements:stats', (event, params) => {
  const p = params || {};
  const matiereId = p.matiere_id ? parseInt(p.matiere_id, 10) : null;
  const teacherId = p.teacher_id ? parseInt(p.teacher_id, 10) : null;
  const annee = p.annee ? parseInt(p.annee, 10) : new Date().getFullYear();
  if (!matiereId || !teacherId) return null;

  const inscrits = query(
    'SELECT COUNT(*) c FROM student_matieres WHERE matiere_id = ? AND teacher_id = ?',
    [matiereId, teacherId]
  )[0].c;
  const prix = coursPrice(matiereId, teacherId);

  const rows = query(
    'SELECT mois, paye, montant FROM paiements WHERE matiere_id = ? AND teacher_id = ? AND annee = ?',
    [matiereId, teacherId, annee]
  );
  const parMois = Array.from({ length: 12 }, (_, i) => ({
    mois: i + 1,
    payes: 0,
    impayes: 0,
    montant: 0,
    attendu: inscrits * prix
  }));
  rows.forEach((r) => {
    const bucket = parMois[r.mois - 1];
    if (!bucket) return;
    if (r.paye) {
      bucket.payes += 1;
      bucket.montant += Number(r.montant) || 0;
    } else {
      bucket.impayes += 1;
    }
  });

  return {
    matiere_id: matiereId,
    teacher_id: teacherId,
    annee,
    prix_mensuel: prix,
    inscrits,
    par_mois: parMois,
    total_encaisse: parMois.reduce((s, b) => s + b.montant, 0),
    total_attendu: parMois.reduce((s, b) => s + b.attendu, 0)
  };
});

/** Élèves inscrits au cours qui n'ont pas payé un mois donné. */
ipcMain.handle('paiements:unpaid', (event, params) => {
  const p = params || {};
  const matiereId = p.matiere_id ? parseInt(p.matiere_id, 10) : null;
  const teacherId = p.teacher_id ? parseInt(p.teacher_id, 10) : null;
  const annee = p.annee ? parseInt(p.annee, 10) : new Date().getFullYear();
  const mois = p.mois ? parseInt(p.mois, 10) : null;
  if (!matiereId || !teacherId || !mois) return [];

  return query(
    `SELECT s.id, s.matricule, s.nom, s.prenom, s.classe, s.telephone_parent, py.montant, py.date_paiement
     FROM student_matieres sm
     JOIN students s ON s.id = sm.student_id
     LEFT JOIN paiements py
       ON py.student_id = s.id AND py.matiere_id = sm.matiere_id AND py.teacher_id = sm.teacher_id
      AND py.annee = ? AND py.mois = ?
     WHERE sm.matiere_id = ? AND sm.teacher_id = ? AND COALESCE(py.paye, 0) = 0
     ORDER BY s.nom COLLATE NOCASE ASC, s.prenom COLLATE NOCASE ASC`,
    [annee, mois, matiereId, teacherId]
  );
});

/** Relevé mensuel : par défaut toutes les matières, ou filtré sur un enseignant. */
ipcMain.handle('paiements:report', (event, params) => {
  const p = params || {};
  const annee = p.annee ? parseInt(p.annee, 10) : new Date().getFullYear();
  const mois = p.mois ? parseInt(p.mois, 10) : null;
  const teacherId = p.teacher_id ? parseInt(p.teacher_id, 10) : null;

  const rows = query(
    `SELECT m.id AS matiere_id, m.nom AS matiere_nom, m.prix_mensuel,
            t.id AS teacher_id, t.nom AS teacher_nom, t.prenom AS teacher_prenom,
            mt.prix_mensuel AS prix_cours,
            COUNT(DISTINCT sm.id) AS inscrits,
            SUM(CASE WHEN py.paye = 1 THEN 1 ELSE 0 END) AS payes,
            SUM(CASE WHEN py.paye = 1 THEN py.montant ELSE 0 END) AS montant
     FROM matiere_teachers mt
     JOIN matieres m ON m.id = mt.matiere_id
     JOIN teachers t ON t.id = mt.teacher_id
     LEFT JOIN student_matieres sm ON sm.matiere_id = mt.matiere_id AND sm.teacher_id = mt.teacher_id
     LEFT JOIN paiements py
       ON py.student_id = sm.student_id AND py.matiere_id = mt.matiere_id AND py.teacher_id = mt.teacher_id
      AND py.annee = ? AND py.mois = ?
     WHERE TRIM(m.nom) <> '' ${teacherId ? 'AND mt.teacher_id = ?' : ''}
     GROUP BY mt.id
     ORDER BY m.nom COLLATE NOCASE ASC, t.nom COLLATE NOCASE ASC`,
    teacherId ? [annee, mois, teacherId] : [annee, mois]
  );

  return rows.map((r) => ({
    ...r,
    matiere_nom: cleanMatiereName(r.matiere_nom),
    teacher_full_name: teacherFullName({ nom: r.teacher_nom, prenom: r.teacher_prenom }),
    prix_mensuel: Number(r.prix_cours) || 0,
    inscrits: Number(r.inscrits) || 0,
    payes: Number(r.payes) || 0,
    montant: Number(r.montant) || 0
  }));
});

// ============================================================
//                  TABLEAU DE BORD
// ============================================================

/** Montant mensuel attendu. teacherId = null => tous les cours. */
function expectedMonthlyRevenue(teacherId) {
  const where = teacherId ? 'WHERE mt.teacher_id = ?' : '';
  const row = query(
    `SELECT COALESCE(SUM(mt.prix_mensuel), 0) AS total
     FROM student_matieres sm
     JOIN matiere_teachers mt ON mt.matiere_id = sm.matiere_id AND mt.teacher_id = sm.teacher_id
     ${where}`,
    teacherId ? [teacherId] : []
  )[0];
  return Number(row.total) || 0;
}

/** Encaissements mois par mois. */
ipcMain.handle('stats:revenue', (event, params) => {
  const p = params || {};
  const annee = p.annee ? parseInt(p.annee, 10) : new Date().getFullYear();
  const teacherId = p.teacher_id ? parseInt(p.teacher_id, 10) : null;

  const parMois = Array.from({ length: 12 }, (_, i) => ({ mois: i + 1, montant: 0, payes: 0, attendu: 0 }));

  const rows = query(
    `SELECT mois, montant FROM paiements
     WHERE annee = ? AND paye = 1 ${teacherId ? 'AND teacher_id = ?' : ''}`,
    teacherId ? [annee, teacherId] : [annee]
  );
  rows.forEach((r) => {
    const bucket = parMois[r.mois - 1];
    if (!bucket) return;
    bucket.montant += Number(r.montant) || 0;
    bucket.payes += 1;
  });

  const attendu = expectedMonthlyRevenue(teacherId);
  parMois.forEach((b) => {
    b.attendu = attendu;
  });

  const maintenant = new Date();
  const moisCourant = maintenant.getFullYear() === annee ? maintenant.getMonth() + 1 : null;

  return {
    annee,
    teacher_id: teacherId,
    par_mois: parMois,
    total: parMois.reduce((s, b) => s + b.montant, 0),
    attendu_annuel: attendu * 12,
    mois_courant: moisCourant,
    attendu_mensuel: attendu
  };
});

/** Encaissements par matière, pour l'enseignant sélectionné. */
ipcMain.handle('stats:revenueParMatiere', (event, params) => {
  const p = params || {};
  const annee = p.annee ? parseInt(p.annee, 10) : new Date().getFullYear();
  const teacherId = p.teacher_id ? parseInt(p.teacher_id, 10) : null;

  return query(
    `SELECT mt.id AS cours_id, mt.matiere_id, m.nom AS matiere_nom, mt.prix_mensuel,
            (SELECT COUNT(*) FROM student_matieres sm
              WHERE sm.matiere_id = mt.matiere_id AND sm.teacher_id = mt.teacher_id) AS inscrits,
            COALESCE((SELECT SUM(py.montant) FROM paiements py
                       WHERE py.matiere_id = mt.matiere_id AND py.teacher_id = mt.teacher_id
                         AND py.annee = ? AND py.paye = 1), 0) AS montant
     FROM matiere_teachers mt
     JOIN matieres m ON m.id = mt.matiere_id
     WHERE TRIM(m.nom) <> '' ${teacherId ? 'AND mt.teacher_id = ?' : ''}
     ORDER BY montant DESC, m.nom COLLATE NOCASE ASC`,
    teacherId ? [annee, teacherId] : [annee]
  ).map((r) => ({
    ...r,
    matiere_nom: cleanMatiereName(r.matiere_nom),
    prix_mensuel: Number(r.prix_mensuel) || 0,
    montant: Number(r.montant) || 0,
    inscrits: Number(r.inscrits) || 0
  }));
});

/** Chiffres clés, pour un enseignant donné ou pour l'ensemble. */
ipcMain.handle('stats:globales', (event, params) => {
  const p = params || {};
  const maintenant = new Date();
  const annee = maintenant.getFullYear();
  const mois = maintenant.getMonth() + 1;
  const jour = maintenant.getDate();
  const joursMois = new Date(annee, mois, 0).getDate();
  const teacherId = p.teacher_id ? parseInt(p.teacher_id, 10) : null;

  const nb = (sql, values) => Number(query(sql, values || [])[0].c) || 0;
  const t = teacherId ? ' AND teacher_id = ?' : '';
  const tv = teacherId ? [teacherId] : [];

  // Inscriptions : un cours = une paire (matière, enseignant).
  const inscritsWhere = teacherId ? 'AND sm.teacher_id = ?' : '';
  const inscrits = nb(
    `SELECT COUNT(*) c FROM student_matieres sm WHERE 1 = 1 ${inscritsWhere}`,
    teacherId ? [teacherId] : []
  );
  const eleves = teacherId
    ? nb(
        `SELECT COUNT(DISTINCT sm.student_id) c FROM student_matieres sm WHERE 1 = 1 ${inscritsWhere}`,
        [teacherId]
      )
    : nb('SELECT COUNT(*) c FROM students');

  // Impayés : inscrits à un cours sans ligne payée pour le mois courant.
  const impayes = nb(
    `SELECT COUNT(*) c FROM student_matieres sm
     WHERE 1 = 1 ${inscritsWhere}
       AND NOT EXISTS (SELECT 1 FROM paiements p
                        WHERE p.student_id = sm.student_id AND p.matiere_id = sm.matiere_id
                          AND p.teacher_id IS sm.teacher_id AND p.annee = ? AND p.mois = ? AND p.paye = 1)`,
    teacherId ? [teacherId, annee, mois] : [annee, mois]
  );

  const encaissement = (m) =>
    nb(
      `SELECT COALESCE(SUM(montant), 0) c FROM paiements WHERE paye = 1 AND annee = ? AND mois = ?${t}`,
      teacherId ? [annee, m, teacherId] : [annee, m]
    );
  const encaisseAnnee = nb(
    `SELECT COALESCE(SUM(montant), 0) c FROM paiements WHERE paye = 1 AND annee = ?${t}`,
    teacherId ? [annee, teacherId] : [annee]
  );

  const attendu = expectedMonthlyRevenue(teacherId);
  // Le mois en cours n'est pas terminé : on compare l'encaissement à ce qui était
  // attendu à ce jour, pas au mois complet. Arrondi à la dizaine.
  const attenduMoisCeJour = mois > 0 && joursMois > 0 ? Math.round((attendu * jour) / joursMois / 10) * 10 : 0;
  const encaisseMois = mois > 0 ? encaissement(mois) : 0;
  const encaisseMoisPrec = mois > 1 ? encaissement(mois - 1) : 0;
  const encaisseMoisPrec2 = mois > 2 ? encaissement(mois - 2) : 0;

  // Comparaison du DERNIER mois COMPLET avec le précédent : comparer le mois en
  // cours à un mois complet afficherait toujours -100 % en début de mois.
  const variation = encaisseMoisPrec2 > 0 ? ((encaisseMoisPrec - encaisseMoisPrec2) / encaisseMoisPrec2) * 100 : null;
  const taux = (v, cible) => (cible > 0 ? Math.max(0, Math.min(1, v / cible)) : 0);

  return {
    annee,
    mois,
    jour,
    jours_mois: joursMois,
    teacher_id: teacherId,
    eleves,
    inscriptions: inscrits,
    matieres: teacherId
      ? nb('SELECT COUNT(DISTINCT matiere_id) c FROM matiere_teachers WHERE teacher_id = ?', [teacherId])
      : nb("SELECT COUNT(*) c FROM matieres WHERE TRIM(nom) <> ''"),
    enseignants: teacherId ? 1 : nb('SELECT COUNT(*) c FROM teachers'),
    impayes,
    attendu_mensuel: attendu,
    encaisse_mois: encaisseMois,
    attendu_mois_ce_jour: attenduMoisCeJour,
    manque_mois: Math.max(0, attenduMoisCeJour - encaisseMois),
    taux_mois: taux(encaisseMois, attenduMoisCeJour),
    encaisse_mois_precedent: encaisseMoisPrec,
    taux_mois_precedent: taux(encaisseMoisPrec, attendu),
    variation,
    encaisse_annee: encaisseAnnee,
    attendu_annee_ecoule: attendu * Math.max(0, mois - 1),
    manque_annee: Math.max(0, attendu * Math.max(0, mois - 1) - encaisseAnnee)
  };
});

// ---------- Élèves d'un enseignant ----------

ipcMain.handle('students:listForTeacher', (event, teacherId) =>
  query(
    `SELECT DISTINCT s.id, s.matricule, s.nom, s.prenom, s.classe, s.telephone_parent, m.nom AS matiere_nom
     FROM student_matieres sm
     JOIN students s ON s.id = sm.student_id
     JOIN matieres m ON m.id = sm.matiere_id
     WHERE sm.teacher_id = ?
     ORDER BY m.nom COLLATE NOCASE ASC, s.nom COLLATE NOCASE ASC`,
    [teacherId]
  ).map((r) => ({ ...r, matiere_nom: cleanMatiereName(r.matiere_nom) }))
);

/** Fiche complète d'un enseignant : identité + cours + volumes + revenus. */
ipcMain.handle('teachers:detail', (event, id) => {
  const teacher = query('SELECT * FROM teachers WHERE id = ?', [id])[0];
  if (!teacher) return null;

  const cours = query(
    COURS_SELECT + ' WHERE mt.teacher_id = ?' + COURS_ORDER,
    [id]
  ).map(normalizeCours);

  const annee = new Date().getFullYear();
  const revenus = query(
    `SELECT COALESCE(SUM(p.montant), 0) AS total
     FROM paiements p
     WHERE p.paye = 1 AND p.annee = ? AND p.teacher_id = ?`,
    [annee, id]
  )[0].total;

  const eleves = query('SELECT COUNT(DISTINCT student_id) c FROM student_matieres WHERE teacher_id = ?', [id])[0]
    .c;

  return {
    ...normalizeTeacher(teacher),
    cours,
    matieres: cours,
    nb_eleves: Number(eleves) || 0,
    encaissement_annee: Number(revenus) || 0
  };
});

// ---------- Années de travail ----------

function getParam(cle, defaut) {
  const r = query('SELECT valeur FROM parametres WHERE cle = ?', [cle])[0];
  return r && r.valeur !== null ? r.valeur : defaut;
}

function setParam(cle, valeur) {
  db.run('INSERT INTO parametres (cle, valeur) VALUES (?, ?) ON CONFLICT(cle) DO UPDATE SET valeur = excluded.valeur', [
    cle,
    String(valeur)
  ]);
}

/**
 * Passage d'année automatique.
 *
 * Les inscriptions d'un élève dans un cours ne portent pas d'année : un élève
 * reste inscrit d'une année sur l'autre tant qu'on ne le désinscrit pas. Les
 * PAIEMENTS, eux, sont cloisonnés par année. Concrètement, quand janvier
 * arrive : rien à migrer, l'année N+1 démarre simplement avec des grilles
 * vides — et l'application bascule d'elle-même sur la nouvelle année.
 */
ipcMain.handle('annee:initiale', () => {
  const anneeCourante = new Date().getFullYear();
  const stockee = parseInt(getParam('annee_active', String(anneeCourante)), 10) || anneeCourante;
  const nouvelleAnnee = anneeCourante > stockee;
  if (nouvelleAnnee) setParam('annee_active', anneeCourante);

  const annees = query(
    `SELECT DISTINCT annee FROM paiements
     UNION SELECT ? UNION SELECT ?
     ORDER BY annee ASC`,
    [anneeCourante, anneeCourante + 1]
  ).map((r) => Number(r.annee));

  const coursActifs = query('SELECT COUNT(*) c FROM matiere_teachers')[0].c;
  // Élèves reconduits = tous ceux qui restent inscrits à au moins un cours.
  const elevesReconducts = query('SELECT COUNT(DISTINCT student_id) c FROM student_matieres')[0].c;

  return {
    annee_active: nouvelleAnnee ? anneeCourante : stockee,
    annee_precedente: stockee,
    nouvelle_annee: nouvelleAnnee,
    annees_disponibles: annees.length ? annees : [anneeCourante],
    cours_actifs: Number(coursActifs) || 0,
    eleves_reconducts: Number(elevesReconducts) || 0
  };
});

ipcMain.handle('annee:definir', (event, annee) => {
  setParam('annee_active', annee);
  saveDbToDisk();
  return { success: true, annee_active: parseInt(annee, 10) };
});

/**
 * État de paiement des élèves d'une matière pour un mois donné, professeur par
 * professeur. Alimente la colonne « Statut » de la liste et permet d'ouvrir la
 * grille annuelle d'un élève en un clic.
 */
ipcMain.handle('paiements:etatEleves', (event, params) => {
  const p = params || {};
  const matiereId = p.matiere_id ? parseInt(p.matiere_id, 10) : null;
  const annee = p.annee ? parseInt(p.annee, 10) : new Date().getFullYear();
  const mois = p.mois ? parseInt(p.mois, 10) : null;
  if (!matiereId || !mois) return {};

  const rows = query(
    `SELECT sm.student_id, sm.teacher_id, t.nom AS teacher_nom, t.prenom AS teacher_prenom,
            COALESCE(py.paye, 0) AS paye, py.montant, py.date_paiement
     FROM student_matieres sm
     JOIN students s ON s.id = sm.student_id
     LEFT JOIN teachers t ON t.id = sm.teacher_id
     LEFT JOIN paiements py
       ON py.student_id = sm.student_id AND py.matiere_id = sm.matiere_id
      AND py.teacher_id IS sm.teacher_id AND py.annee = ? AND py.mois = ?
     WHERE sm.matiere_id = ?
     ORDER BY s.nom COLLATE NOCASE ASC, s.prenom COLLATE NOCASE ASC`,
    [annee, mois, matiereId]
  );

  const map = {};
  rows.forEach((r) => {
    if (!map[r.student_id]) map[r.student_id] = [];
    map[r.student_id].push({
      teacher_id: r.teacher_id,
      teacher_nom: teacherFullName({ nom: r.teacher_nom, prenom: r.teacher_prenom }) || 'Sans professeur',
      paye: !!r.paye,
      montant: Number(r.montant) || 0,
      date_paiement: r.date_paiement || ''
    });
  });
  return map;
});

/**
 * Règles métier d'une année d'abonnement.
 *
 * Un mois est dans l'un de quatre états, et pas seulement « payé / impayé » :
 *
 *   - hors-periode : antérieur à l'inscription de l'élève à CE cours. On ne
 *     facture jamais une période où l'élève n'était pas inscrit — sinon un
 *     élève arrivé en mars se voit réclamer janvier et février.
 *   - a-venir      : pas encore échu (mois en cours non terminé, ou année
 *     future). Ce n'est pas un impayé : c'est une dette qui n'existe pas
 *     encore, et la compter en ferait un faux débit.
 *   - paye / impaye: dus, réglés ou non.
 */
function moisStatut(annee, mois, anneeInsc, moisInsc, anneeCourante, moisCourant, paye) {
  if (annee < anneeInsc) return 'hors-periode';
  if (annee > anneeCourante) return 'avenir';
  if (annee === anneeInsc && mois < moisInsc) return 'hors-periode';
  if (annee === anneeCourante && mois > moisCourant) return 'avenir';
  return paye ? 'paye' : 'impaye';
}

/** Grille annuelle d'UN élève pour un cours (une matière + un professeur). */
ipcMain.handle('paiements:grilleEleve', (event, params) => {
  const p = params || {};
  const studentId = parseInt(p.student_id, 10);
  const matiereId = parseInt(p.matiere_id, 10);
  const teacherId = parseInt(p.teacher_id, 10);
  const anneeDemandee = p.annee ? parseInt(p.annee, 10) : null;
  if (!studentId || !matiereId || !teacherId) return null;

  const etudiant = query(
    'SELECT id, matricule, nom, prenom, classe, date_inscription FROM students WHERE id = ?',
    [studentId]
  )[0];
  if (!etudiant) return null;

  const inscription = query(
    'SELECT date_inscription FROM student_matieres WHERE student_id = ? AND matiere_id = ? AND teacher_id = ?',
    [studentId, matiereId, teacherId]
  )[0];
  if (!inscription) return null; // l'élève ne suit pas ce cours

  const cours = query(COURS_SELECT + ' WHERE mt.matiere_id = ? AND mt.teacher_id = ?', [matiereId, teacherId])[0];
  const prix = cours ? Number(cours.prix_mensuel) || 0 : 0;

  const maintenant = new Date();
  const anneeCourante = maintenant.getFullYear();
  const moisCourant = maintenant.getMonth() + 1;

  const dateInsc = inscription.date_inscription || formatTodayDDMMYYYY();
  const anneeInsc = parseInt(yearFromDisplayDate(dateInsc), 10) || anneeCourante;
  const moisInsc = parseInt(String(dateInsc).split('/')[1], 10) || 1;

  // Tous les paiements de ce cours pour cet élève, toutes années confondues :
  // le bilan de chaque année en découle sans requête supplémentaire.
  const lignes = query(
    'SELECT annee, mois, montant, paye, date_paiement FROM paiements WHERE student_id = ? AND matiere_id = ? AND teacher_id = ?',
    [studentId, matiereId, teacherId]
  );
  const parAnnee = {};
  lignes.forEach((r) => {
    if (!parAnnee[r.annee]) parAnnee[r.annee] = {};
    parAnnee[r.annee][r.mois] = r;
  });

  /** Bilan d'une année : ce qui était dû, ce qui est réglé, ce qui reste. */
  function bilan(annee) {
    const cells = parAnnee[annee] || {};
    let dus = 0;
    let payes = 0;
    let montantPaye = 0;
    let montantDu = 0;
    for (let m = 1; m <= 12; m += 1) {
      const l = cells[m];
      const statut = moisStatut(annee, m, anneeInsc, moisInsc, anneeCourante, moisCourant, l && l.paye);
      if (statut === 'impaye' || statut === 'paye') dus += 1;
      if (statut === 'paye') {
        payes += 1;
        montantPaye += Number(l.montant) || 0;
      } else if (statut === 'impaye') {
        montantDu += l ? Number(l.montant) || 0 : prix;
      }
    }
    return {
      annee,
      mois_du: dus,
      mois_payes: payes,
      montant_paye: montantPaye,
      montant_du: montantDu,
      echu: annee < anneeCourante,
      complet: dus > 0 && payes === dus,
      a_venir: annee > anneeCourante
    };
  }

  // Années proposées : depuis l'inscription jusqu'à l'année suivante, plus
  // celles qui portent déjà des paiements.
  const annees = new Set([anneeInsc, anneeCourante, anneeCourante + 1]);
  Object.keys(parAnnee).forEach((a) => {
    const n = parseInt(a, 10);
    if (n >= anneeInsc) annees.add(n);
  });
  const anneesTriees = Array.from(annees).sort((a, b) => a - b);

  // Une année antérieure à l'inscription n'existe pas : on retombe sur la
  // première année réellement ouverte plutôt que sur l'année courante, sinon
  // demander 2025 pour un élève inscrit en 2026 afficherait 2026 en silence.
  let annee = anneeCourante;
  if (anneeDemandee) {
    if (anneesTriees.includes(anneeDemandee)) annee = anneeDemandee;
    else if (anneeDemandee < anneesTriees[0]) annee = anneesTriees[0];
  }
  const cells = parAnnee[annee] || {};

  return {
    etudiant,
    cours: cours ? normalizeCours(cours) : null,
    annee,
    annee_courante: anneeCourante,
    mois_courant: moisCourant,
    annee_inscription: anneeInsc,
    mois_inscription: moisInsc,
    date_inscription_cours: dateInsc,
    prix,
    // Bilan de chaque année, pour l'affichage « 2024 · soldée ».
    bilans: anneesTriees.map(bilan),
    mois: Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const l = cells[m];
      const paye = !!(l && l.paye);
      return {
        mois: m,
        paye,
        montant: l ? Number(l.montant) || 0 : prix,
        date_paiement: l ? l.date_paiement || '' : '',
        statut: moisStatut(annee, m, anneeInsc, moisInsc, anneeCourante, moisCourant, paye)
      };
    })
  };
});

/** Cours suivis par un élève — première étape de la fiche élève. */
ipcMain.handle('paiements:coursEleve', (event, studentId) => {
  const rows = query(
    `SELECT sm.matiere_id, sm.teacher_id, sm.date_inscription,
            m.nom AS matiere_nom, t.nom AS teacher_nom, t.prenom AS teacher_prenom,
            COALESCE(mt.prix_mensuel, m.prix_mensuel, 0) AS prix_mensuel
     FROM student_matieres sm
     JOIN matieres m ON m.id = sm.matiere_id
     LEFT JOIN teachers t ON t.id = sm.teacher_id
     LEFT JOIN matiere_teachers mt ON mt.matiere_id = sm.matiere_id AND mt.teacher_id = sm.teacher_id
     WHERE sm.student_id = ?
     ORDER BY m.nom COLLATE NOCASE ASC, t.nom COLLATE NOCASE ASC`,
    [studentId]
  );

  // Pour chaque cours, le nombre de mois impayés de l'année courante : sert à
  // repérer d'un coup d'œil les cours en retard.
  const anneeCourante = new Date().getFullYear();
  const moisCourant = new Date().getMonth() + 1;

  return rows.map((r) => {
    const impayes = query(
      `SELECT COUNT(*) c FROM paiements
       WHERE student_id = ? AND matiere_id = ? AND teacher_id IS ? AND annee = ? AND mois <= ? AND paye = 0`,
      [studentId, r.matiere_id, r.teacher_id, anneeCourante, moisCourant]
    )[0].c;
    return {
      ...r,
      matiere_nom: cleanMatiereName(r.matiere_nom),
      teacher_full_name: teacherFullName({ nom: r.teacher_nom, prenom: r.teacher_prenom }) || 'Sans professeur',
      prix_mensuel: Number(r.prix_mensuel) || 0,
      annee_impayes: Number(impayes) || 0
    };
  });
});
ipcMain.handle('excel:template', async () => {
  try {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Enregistrer le modèle Excel',
      defaultPath: 'modele-import-eleves-el-kawther.xlsx',
      filters: [{ name: 'Classeur Excel', extensions: ['xlsx'] }]
    });
    if (result.canceled || !result.filePath) return { success: false, canceled: true };

    const buffer = await buildTemplate();
    fs.writeFileSync(result.filePath, Buffer.from(buffer));
    return { success: true, filePath: result.filePath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('excel:export', async () => {
  try {
    const eleves = query(
      `SELECT matricule, nom, prenom, date_naissance, classe, date_inscription,
              telephone, telephone_parent, adresse
       FROM students
       ORDER BY nom COLLATE NOCASE ASC, prenom COLLATE NOCASE ASC`
    );
    const cours = query(
      `SELECT sm.student_id, m.nom AS matiere_nom, t.nom AS teacher_nom
       FROM student_matieres sm
       JOIN matieres m ON m.id = sm.matiere_id
       LEFT JOIN teachers t ON t.id = sm.teacher_id
       ORDER BY m.nom COLLATE NOCASE ASC`
    );
    const parEleve = new Map();
    cours.forEach((c) => {
      if (!parEleve.has(c.student_id)) parEleve.set(c.student_id, []);
      parEleve.get(c.student_id).push(c);
    });
    const donnees = eleves.map((e) => ({ ...e, cours: parEleve.get(e.id) || [] }));

    const horodatage = new Date().toISOString().slice(0, 10);
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Exporter les élèves',
      defaultPath: `eleves-el-kawther-${horodatage}.xlsx`,
      filters: [{ name: 'Classeur Excel', extensions: ['xlsx'] }]
    });
    if (result.canceled || !result.filePath) return { success: false, canceled: true };

    const buffer = await buildExport(donnees);
    fs.writeFileSync(result.filePath, Buffer.from(buffer));
    return { success: true, filePath: result.filePath, nb: donnees.length };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

/** Lit un classeur et renvoie l'aperçu : rien n'est écrit avant validation. */
ipcMain.handle('excel:importPreview', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Choisir le fichier Excel à importer',
      properties: ['openFile'],
      filters: [{ name: 'Classeur Excel', extensions: ['xlsx'] }]
    });
    if (result.canceled || result.filePaths.length === 0) return { success: false, canceled: true };

    const referentiel = {
      matieres: query("SELECT id, nom FROM matieres WHERE TRIM(nom) <> '' ORDER BY nom COLLATE NOCASE"),
      enseignants: query('SELECT id, code, nom, prenom FROM teachers').map((t) => ({
        ...t,
        full_name: teacherFullName(t)
      }))
    };

    const apercu = await parseImport(fs.readFileSync(result.filePaths[0]), referentiel);
    if (apercu.erreur) return { success: false, error: apercu.erreur };
    return { success: true, fichier: path.basename(result.filePaths[0]), ...apercu };
  } catch (err) {
    return { success: false, error: `Lecture impossible : ${err.message}` };
  }
});

/** Écrit réellement les élèves après validation de l'aperçu. */
ipcMain.handle('excel:importConfirm', async (event, lignes) => {
  try {
    const liste = Array.isArray(lignes) ? lignes : [];
    const crees = [];
    const echecs = [];

    for (const l of liste) {
      try {
        const res = await insertStudentFromImport(l);
        if (res.success) crees.push(res);
        else echecs.push({ ligne: l.ligne, nom: l.nom, prenom: l.prenom, erreur: res.error });
      } catch (err) {
        echecs.push({ ligne: l.ligne, nom: l.nom, prenom: l.prenom, erreur: err.message });
      }
    }

    saveDbToDisk();
    return { success: true, crees, echecs };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

/** Création d'un élève + de ses cours depuis une ligne de tableau. */
async function insertStudentFromImport(l) {
  const student = await (async () => {
    const dateInscription = l.date_inscription || formatTodayDDMMYYYY();
    const year = yearFromDisplayDate(dateInscription);
    const matricule = getNextMatricule(year);
    const photoFileName = l.photo ? String(l.photo).trim() : null;

    db.run(
      `INSERT INTO students (matricule, nom, prenom, date_naissance, classe, telephone, telephone_parent, adresse, photo, date_inscription)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        matricule,
        l.nom,
        l.prenom,
        l.date_naissance || null,
        l.classe || null,
        l.telephone || null,
        l.telephone_parent || null,
        l.adresse || null,
        photoFileName,
        dateInscription
      ]
    );
    return { id: getLastInsertId(), matricule, dateInscription };
  })();

  // Cours cochés dans le fichier.
  if (l.cours && l.cours.length) {
    const stmt = db.prepare(
      'INSERT OR IGNORE INTO student_matieres (student_id, matiere_id, teacher_id, date_inscription) VALUES (?, ?, ?, ?)'
    );
    l.cours.forEach((c) => stmt.run([student.id, c.matiere_id, c.teacher_id || null, student.dateInscription]));
    stmt.free();
    l.cours.forEach((c) => linkTeacherToMatiere(c.matiere_id, c.teacher_id));
  }

  return { success: true, id: student.id, matricule: student.matricule, nom: l.nom, prenom: l.prenom };
}

/**
 * Attend que la fenêtre PRINCIPALE existe et ait fini de charger.
 *
 * Indispensable depuis l'écran de démarrage : `getAllWindows()[0]` renvoie
 * désormais le splash, qui a déjà fini de charger — s'accrocher à son
 * événement `did-finish-load` ne déclencherait jamais rien.
 */
function waitForMainWindowReady(timeoutMs) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const splashFerme = !splashWindow || splashWindow.isDestroyed();
      if (
        mainWindow &&
        !mainWindow.isDestroyed() &&
        !mainWindow.webContents.isLoading() &&
        splashFerme
      ) {
        return resolve(mainWindow);
      }
      if (Date.now() - start > (timeoutMs || 30000)) {
        return reject(new Error('La fenêtre principale ne s\'est pas chargée.'));
      }
      return setTimeout(tick, 150);
    };
    tick();
  });
}

// Utilisé par demo.js et par les scripts de test.
module.exports = { importPhotosFromDir, waitForMainWindowReady, getMainWindow: () => mainWindow };
