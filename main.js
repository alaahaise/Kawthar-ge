const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');

let mainWindow;
let SQL;
let db;

const userDataPath = app.getPath('userData');
const dbPath = path.join(userDataPath, 'students.db');
const photosDir = path.join(userDataPath, 'photos');

function ensureDirs() {
  if (!fs.existsSync(userDataPath)) fs.mkdirSync(userDataPath, { recursive: true });
  if (!fs.existsSync(photosDir)) fs.mkdirSync(photosDir, { recursive: true });
}

function saveDbToDisk() {
  const data = db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
}

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

function getLastInsertId() {
  const stmt = db.prepare('SELECT last_insert_rowid() as id');
  stmt.step();
  const row = stmt.getAsObject();
  stmt.free();
  return row.id;
}

async function initDatabase() {
  ensureDirs();
  SQL = await initSqlJs({
    // locate the wasm file that ships inside node_modules/sql.js/dist
    locateFile: (file) => path.join(__dirname, 'node_modules', 'sql.js', 'dist', file)
  });

  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

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

  // Migrations douces pour les bases créées avec un schéma précédent
  const softMigrations = [
    'ALTER TABLE students ADD COLUMN date_inscription TEXT',
    'ALTER TABLE students ADD COLUMN telephone_parent TEXT'
  ];
  softMigrations.forEach((sql) => {
    try {
      db.run(sql);
    } catch (err) {
      // la colonne existe déjà — rien à faire
    }
  });
  try {
    db.run('ALTER TABLE students DROP COLUMN lieu_naissance');
  } catch (err) {
    // colonne absente ou SQLite trop ancien pour DROP COLUMN — sans conséquence
  }

  // Nettoyage : supprime toute matière "fantôme" (nom vide/blanc) qui a pu être
  // créée avant l'ajout de la validation dans matieres:add, ou par une édition
  // manuelle de la base. Ces lignes s'affichaient comme une barre sans étiquette
  // dans le graphique du tableau de bord.
  try {
    const orphanStmt = db.prepare("SELECT id FROM matieres WHERE nom IS NULL OR TRIM(nom) = ''");
    const orphanIds = rowsFromQuery(orphanStmt).map((r) => r.id);
    orphanIds.forEach((id) => {
      db.run('DELETE FROM student_matieres WHERE matiere_id = ?', [id]);
      db.run('DELETE FROM matiere_teachers WHERE matiere_id = ?', [id]);
      db.run('DELETE FROM matieres WHERE id = ?', [id]);
    });
  } catch (err) {
    // table matieres absente au tout premier lancement — sans conséquence
  }

  saveDbToDisk();
}

function getNextMatricule(year) {
  const prefix = String(year);
  const stmt = db.prepare('SELECT matricule FROM students WHERE matricule LIKE ?');
  stmt.bind([prefix + '%']);
  let maxSeq = 0;
  while (stmt.step()) {
    const m = stmt.getAsObject().matricule;
    const suffix = String(m).slice(prefix.length);
    const num = parseInt(suffix, 10);
    if (!isNaN(num) && num > maxSeq) maxSeq = num;
  }
  stmt.free();
  const next = maxSeq + 1;
  return prefix + String(next).padStart(4, '0');
}

function rowsFromQuery(stmt) {
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

function createWindow() {
  Menu.setApplicationMenu(null);

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 780,
    minWidth: 980,
    minHeight: 640,
    backgroundColor: '#f2f5fb',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));
}
app.whenReady().then(async () => {
  await initDatabase();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ---------- IPC: students ----------

ipcMain.handle('students:list', (event, params) => {
  const search = (params && params.search) || '';
  const classe = (params && params.classe) || '';

  let query = 'SELECT * FROM students';
  const conditions = [];
  const values = [];

  if (search.trim() !== '') {
    conditions.push('(nom LIKE ? OR prenom LIKE ? OR matricule LIKE ? OR date_naissance LIKE ?)');
    const like = `%${search.trim()}%`;
    values.push(like, like, like, like);
  }
  if (classe.trim() !== '') {
    conditions.push('classe = ?');
    values.push(classe.trim());
  }
  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }
  query += ' ORDER BY nom COLLATE NOCASE ASC, prenom COLLATE NOCASE ASC';

  const stmt = db.prepare(query);
  stmt.bind(values);
  return rowsFromQuery(stmt);
});

ipcMain.handle('students:get', (event, id) => {
  const stmt = db.prepare('SELECT * FROM students WHERE id = ?');
  stmt.bind([id]);
  const rows = rowsFromQuery(stmt);
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

ipcMain.handle('students:previewMatricule', (event, year) => {
  const y = year || new Date().getFullYear();
  return getNextMatricule(y);
});

ipcMain.handle('students:update', (event, student) => {
  try {
    let photoFileName = student.existingPhoto || null;
    if (student.photoTempPath) {
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
    db.run('DELETE FROM student_matieres WHERE student_id = ?', [id]);
    db.run('DELETE FROM students WHERE id = ?', [id]);
    saveDbToDisk();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('students:count', () => {
  const stmt = db.prepare('SELECT COUNT(*) as total FROM students');
  const rows = rowsFromQuery(stmt);
  return rows[0].total;
});

function copyPhotoToStore(tempPath, matricule) {
  const ext = (path.extname(tempPath) || '.jpg').toLowerCase();
  const safeMatricule = String(matricule).replace(/[^a-zA-Z0-9_-]/g, '_');

  // Supprime toute ancienne photo de cet étudiant (utile si l'extension change,
  // ex: ancienne photo .png remplacée par une .jpg) pour éviter les doublons orphelins.
  try {
    fs.readdirSync(photosDir)
      .filter((f) => f.startsWith(`${safeMatricule}.`))
      .forEach((f) => fs.unlinkSync(path.join(photosDir, f)));
  } catch (err) {
    // dossier photos illisible ou vide — sans conséquence
  }

  const fileName = `${safeMatricule}${ext}`;
  const destPath = path.join(photosDir, fileName);
  fs.copyFileSync(tempPath, destPath);
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

ipcMain.handle('print:pdf', async (event, suggestedName) => {
  try {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Enregistrer en PDF',
      defaultPath: suggestedName || 'carte.pdf',
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

// ---------- IPC: matières ----------

// Nettoie un nom de matière des caractères invisibles (espace zéro-largeur,
// BOM, espace insécable, etc.) que SQLite TRIM() ne détecte pas — pour
// éviter d'afficher une étiquette vide dans la liste ou le graphique.
function cleanMatiereName(nom) {
  const cleaned = String(nom || '').replace(/[\u200B-\u200D\uFEFF\u00A0\s]+/g, ' ').trim();
  return cleaned || 'Sans nom';
}

ipcMain.handle('matieres:list', () => {
  const stmt = db.prepare(`
    SELECT m.id, m.nom, COUNT(sm.id) as student_count
    FROM matieres m
    LEFT JOIN student_matieres sm ON sm.matiere_id = m.id
    WHERE TRIM(m.nom) <> ''
    GROUP BY m.id
    ORDER BY m.nom COLLATE NOCASE ASC
  `);
  return rowsFromQuery(stmt).map((row) => ({ ...row, nom: cleanMatiereName(row.nom) }));
});

ipcMain.handle('matieres:stats', () => {
  const stmt = db.prepare(`
    SELECT m.id, m.nom, COUNT(sm.id) as student_count
    FROM matieres m
    LEFT JOIN student_matieres sm ON sm.matiere_id = m.id
    WHERE TRIM(m.nom) <> ''
    GROUP BY m.id
    ORDER BY m.nom COLLATE NOCASE ASC
  `);
  return rowsFromQuery(stmt).map((row) => ({ ...row, nom: cleanMatiereName(row.nom) }));
});
ipcMain.handle('matieres:add', (event, nom) => {
  try {
    const trimmed = (nom || '').trim();
    if (!trimmed) return { success: false, error: 'Nom requis' };
    db.run('INSERT INTO matieres (nom) VALUES (?)', [trimmed]);
    const id = getLastInsertId();
    saveDbToDisk();
    return { success: true, id };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('matieres:delete', (event, id) => {
  try {
    db.run('DELETE FROM student_matieres WHERE matiere_id = ?', [id]);
    db.run('DELETE FROM matiere_teachers WHERE matiere_id = ?', [id]);
    db.run('DELETE FROM matieres WHERE id = ?', [id]);
    saveDbToDisk();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ---------- IPC: enseignants ----------

ipcMain.handle('teachers:list', () => {
  const stmt = db.prepare('SELECT * FROM teachers ORDER BY nom COLLATE NOCASE ASC');
  return rowsFromQuery(stmt);
});

ipcMain.handle('teachers:add', (event, teacher) => {
  try {
    const nom = ((teacher && teacher.nom) || '').trim();
    if (!nom) return { success: false, error: 'Nom requis' };
    db.run('INSERT INTO teachers (nom, telephone) VALUES (?, ?)', [
      nom,
      (teacher && teacher.telephone && teacher.telephone.trim()) || null
    ]);
    const id = getLastInsertId();
    saveDbToDisk();
    return { success: true, id };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('teachers:update', (event, payload) => {
  try {
    const id = payload && payload.id;
    const nom = ((payload && payload.nom) || '').trim();
    if (!id) return { success: false, error: 'ID manquant' };
    if (!nom) return { success: false, error: 'Nom requis' };
    db.run('UPDATE teachers SET nom = ?, telephone = ? WHERE id = ?', [
      nom,
      (payload.telephone && payload.telephone.trim()) || null,
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
    db.run('DELETE FROM matiere_teachers WHERE teacher_id = ?', [id]);
    db.run('UPDATE student_matieres SET teacher_id = NULL WHERE teacher_id = ?', [id]);
    db.run('DELETE FROM teachers WHERE id = ?', [id]);
    saveDbToDisk();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ---------- IPC: affectations matière <-> enseignant ----------

ipcMain.handle('matiereTeachers:listAll', () => {
  const stmt = db.prepare(`
    SELECT mt.id, mt.matiere_id, mt.teacher_id, m.nom as matiere_nom, t.nom as teacher_nom
    FROM matiere_teachers mt
    JOIN matieres m ON m.id = mt.matiere_id
    JOIN teachers t ON t.id = mt.teacher_id
    ORDER BY m.nom COLLATE NOCASE ASC, t.nom COLLATE NOCASE ASC
  `);
  return rowsFromQuery(stmt);
});

ipcMain.handle('matiereTeachers:listForMatiere', (event, matiereId) => {
  const stmt = db.prepare(`
    SELECT t.id, t.nom
    FROM matiere_teachers mt
    JOIN teachers t ON t.id = mt.teacher_id
    WHERE mt.matiere_id = ?
    ORDER BY t.nom COLLATE NOCASE ASC
  `);
  stmt.bind([matiereId]);
  return rowsFromQuery(stmt);
});

ipcMain.handle('matiereTeachers:add', (event, payload) => {
  try {
    db.run('INSERT INTO matiere_teachers (matiere_id, teacher_id) VALUES (?, ?)', [
      payload.matiere_id,
      payload.teacher_id
    ]);
    saveDbToDisk();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('matiereTeachers:remove', (event, payload) => {
  try {
    db.run('DELETE FROM matiere_teachers WHERE matiere_id = ? AND teacher_id = ?', [
      payload.matiere_id,
      payload.teacher_id
    ]);
    db.run('UPDATE student_matieres SET teacher_id = NULL WHERE matiere_id = ? AND teacher_id = ?', [
      payload.matiere_id,
      payload.teacher_id
    ]);
    saveDbToDisk();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ---------- IPC: inscriptions étudiant <-> matière/enseignant ----------

ipcMain.handle('studentMatieres:listForStudent', (event, studentId) => {
  const stmt = db.prepare(`
    SELECT sm.matiere_id, sm.teacher_id, m.nom as matiere_nom, t.nom as teacher_nom
    FROM student_matieres sm
    JOIN matieres m ON m.id = sm.matiere_id
    LEFT JOIN teachers t ON t.id = sm.teacher_id
    WHERE sm.student_id = ?
  `);
  stmt.bind([studentId]);
  return rowsFromQuery(stmt);
});

ipcMain.handle('studentMatieres:setForStudent', (event, payload) => {
  try {
    const studentId = payload.student_id;
    const selections = payload.selections || [];
    const dateInscription = payload.date_inscription || null;

    db.run('DELETE FROM student_matieres WHERE student_id = ?', [studentId]);

    const stmt = db.prepare(
      'INSERT INTO student_matieres (student_id, matiere_id, teacher_id, date_inscription) VALUES (?, ?, ?, ?)'
    );
    selections.forEach((sel) => {
      stmt.run([studentId, sel.matiere_id, sel.teacher_id || null, dateInscription]);
    });
    stmt.free();

    saveDbToDisk();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});