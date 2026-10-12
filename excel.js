/**
 * Import / export Excel (xlsx) via ExcelJS.
 *
 * - buildTemplate()  : modèle vierge, mis en page, avec l'en-tête El Kawther
 * - buildExport()    : liste des élèves avec leurs cours
 * - parseImport()    : lecture + validation d'un fichier rempli
 *
 * Les matricules ne figurent PAS dans le modèle : ils sont générés par
 * l'application à l'import, comme à l'inscription manuelle.
 */
const ExcelJS = require('exceljs');

// Identité de l'établissement — reprise de la carte d'élève.
const ETABLISSEMENT = {
  nom: 'ÉTABLISSEMENT EL KAWTHER',
  sousTitre: 'Éducation et Formation',
  adresse: 'Sid Cheikh, Saida',
  telephone: '+213 771 411 418',
  email: 'etablissement.elkawther@gmail.com'
};

// Palette alignée sur la carte et l'interface.
const MAROON = 'FF8A1518';
const MAROON2 = 'FF4A0C10';
const NAVY = 'FF26313F';
const BLUE = 'FF2F6FED';
const LIGNE = 'FFE3E8F0';

const COLONNES = [
  { key: 'nom', header: 'Nom', width: 24, requis: true },
  { key: 'prenom', header: 'Prénom', width: 24, requis: true },
  { key: 'date_naissance', header: 'Date de naissance', width: 18, exemple: 'jj/mm/aaaa' },
  { key: 'classe', header: 'Classe', width: 16, exemple: '1ère Année' },
  { key: 'date_inscription', header: "Date d'inscription", width: 20, exemple: 'jj/mm/aaaa (vide = aujourd\'hui)' },
  { key: 'telephone', header: 'Téléphone', width: 17 },
  { key: 'telephone_parent', header: 'Téléphone parent', width: 18 },
  { key: 'adresse', header: 'Adresse', width: 30 },
  {
    key: 'cours',
    header: 'Matières (et enseignants)',
    width: 52,
    exemple: 'Mathématiques / Karim Benali ; Physique / Samir Ait Ahmed'
  },
  { key: 'photo', header: 'Photo (nom du fichier)', width: 24, exemple: '20260001.jpg (facultatif)' }
];

/** Bandeau d'en-tête commun au modèle et à l'export. */
function paintBanner(ws, nbColonnes) {
  ws.mergeCells(1, 1, 1, nbColonnes);
  const t1 = ws.getCell(1, 1);
  t1.value = ETABLISSEMENT.nom;
  t1.font = { name: 'Segoe UI', size: 20, bold: true, color: { argb: 'FFFFFFFF' } };
  t1.alignment = { horizontal: 'center', vertical: 'middle' };
  t1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: MAROON2 } };
  ws.getRow(1).height = 34;

  ws.mergeCells(2, 1, 2, nbColonnes);
  const t2 = ws.getCell(2, 1);
  t2.value = `${ETABLISSEMENT.sousTitre}  —  ${ETABLISSEMENT.adresse}  —  ${ETABLISSEMENT.telephone}`;
  t2.font = { name: 'Segoe UI', size: 10, color: { argb: 'FFFFFFFF' } };
  t2.alignment = { horizontal: 'center', vertical: 'middle' };
  t2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: MAROON } };
  ws.getRow(2).height = 20;

  ws.mergeCells(3, 1, 3, nbColonnes);
  const t3 = ws.getCell(3, 1);
  t3.value = '';
  ws.getRow(3).height = 8;
}

/** Ligne d'en-tête du tableau. */
function paintHeader(ws, colonnes, ligne) {
  colonnes.forEach((col, i) => {
    const cell = ws.getCell(ligne, i + 1);
    cell.value = col.requis ? `${col.header} *` : col.header;
    cell.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: NAVY } },
      left: { style: 'thin', color: { argb: NAVY } },
      bottom: { style: 'thin', color: { argb: NAVY } },
      right: { style: 'thin', color: { argb: NAVY } }
    };
  });
  ws.getRow(ligne).height = 26;
  ws.columns = colonnes.map((c) => ({ width: c.width }));
}

/** Modèle vierge à remplir. */
async function buildTemplate() {
  const wb = new ExcelJS.Workbook();
  wb.creator = ETABLISSEMENT.nom;
  wb.created = new Date();
  const ws = wb.addWorksheet('Élèves', {
    views: [{ state: 'frozen', ySplit: 4 }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 }
  });

  paintBanner(ws, COLONNES.length);
  paintHeader(ws, COLONNES, 4);

  // Une ligne d'exemple grisée : montre le format attendu sans être importée.
  // Elle est marquée explicitement (colonne Adresse) plutôt que devinée sur les
  // noms — devinerfreeze l'import dès qu'un vrai élève s'appelle Benali.
  const exemple = {
    nom: 'Benali',
    prenom: 'Karim',
    date_naissance: '12/05/2008',
    classe: '1ère Année',
    date_inscription: '15/09/2026',
    telephone: '0555123456',
    telephone_parent: '0666112233',
    adresse: "LIGNE D'EXEMPLE — À SUPPRIMER AVANT D'IMPORTER",
    cours: 'Mathématiques / Karim Benali ; Français / Leila Haddad',
    photo: ''
  };
  COLONNES.forEach((col, i) => {
    const cell = ws.getCell(5, i + 1);
    cell.value = exemple[col.key] || '';
    cell.font = { name: 'Segoe UI', size: 11, italic: true, color: { argb: 'FF9AA5B4' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7F9FD' } };
  });

  ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: COLONNES.length } };

  // Feuille de mode d'emploi.
  const guide = wb.addWorksheet('Mode d\'emploi');
  guide.columns = [{ width: 26 }, { width: 86 }];
  guide.getCell('A1').value = ETABLISSEMENT.nom;
  guide.getCell('A1').font = { size: 16, bold: true, color: { argb: MAROON2 } };
  guide.getCell('A2').value = `${ETABLISSEMENT.sousTitre} — ${ETABLISSEMENT.adresse}`;
  guide.getCell('A2').font = { size: 10, color: { argb: 'FF6B7688' } };

  const consignes = [
    ['', ''],
    ['Comment faire', ''],
    ['1', 'Ouvrez la feuille « Élèves » et remplissez une ligne par élève, à partir de la ligne 5.'],
    ['2', 'Supprimez la ligne d\'exemple grisée avant d\'importer.'],
    ['3', 'Seuls le Nom et le Prénom sont obligatoires (marqués *).'],
    ['4', 'Le matricule est généré automatiquement à l\'import : ne le saisissez pas.'],
    ['5', 'Les dates s\'écrivent jj/mm/aaaa (par exemple 12/05/2008).'],
    ['6', 'Matières : plusieurs cours se séparent par un point-virgule « ; ».'],
    ['', 'Un cours s\'écrit « Matière / Enseignant » (le nom de l\'enseignant est facultatif).'],
    ['7', 'Le nom de la matière et celui de l\'enseignant doivent déjà exister dans le logiciel.'],
    ['', 'Saisir un nom inconnu signale la ligne en rouge à l\'import, sans bloquer les autres.'],
    ['8', 'Date d\'inscription laissée vide : la date du jour est utilisée.'],
    ['', ''],
    ['Photos', ''],
    ['9', 'Colonne « Photo » : indiquez le nom du fichier image, par exemple 20260001.jpg.'],
    ['10', 'Dans le logiciel, bouton « Importer des photos » : choisissez le dossier.'],
    ['', 'Les photos sont rattachées automatiquement, par matricule ou par « Nom Prenom ».'],
    ['', ''],
    ['Bon à savoir', ''],
    ['Classe', 'À saisir librement (1ère Année, 2ème Année, 3ème Année…).'],
    ['Téléphone', 'Format libre, espaces autorisés.']
  ];
  let ligne = 4;
  consignes.forEach(([a, b]) => {
    guide.getCell(ligne, 1).value = a;
    guide.getCell(ligne, 2).value = b;
    if (a && !b) {
      guide.getCell(ligne, 1).font = { bold: true, color: { argb: MAROON } };
      guide.getCell(ligne, 1).font = { size: 12, bold: true, color: { argb: MAROON } };
    }
    ligne += 1;
  });

  return wb.xlsx.writeBuffer();
}

/** Export de la liste des élèves. */
async function buildExport(eleves, options) {
  const opts = options || {};
  const avecCours = opts.cours !== false;
  const colonnes = avecCours
    ? [
        { key: 'matricule', header: 'Matricule', width: 14 },
        ...COLONNES.filter((c) => c.key !== 'cours'),
        { key: 'cours', header: 'Matières (et enseignants)', width: 52 }
      ]
    : [{ key: 'matricule', header: 'Matricule', width: 14 }, ...COLONNES];

  const wb = new ExcelJS.Workbook();
  wb.creator = ETABLISSEMENT.nom;
  const ws = wb.addWorksheet('Élèves', {
    views: [{ state: 'frozen', ySplit: 4 }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5 } }
  });

  paintBanner(ws, colonnes.length);
  paintHeader(ws, colonnes, 4);

  eleves.forEach((e, i) => {
    const ligne = 5 + i;
    colonnes.forEach((col, j) => {
      const cell = ws.getCell(ligne, j + 1);
      if (col.key === 'cours') {
        cell.value = (e.cours || []).map((c) => `${c.matiere_nom} / ${c.teacher_nom}`).join(' ; ');
      } else {
        cell.value = e[col.key] || '';
      }
      cell.font = { name: 'Segoe UI', size: 11 };
      cell.alignment = { vertical: 'middle', wrapText: col.key === 'cours' };
      cell.border = {
        top: { style: 'hair', color: { argb: LIGNE } },
        left: { style: 'hair', color: { argb: LIGNE } },
        bottom: { style: 'hair', color: { argb: LIGNE } },
        right: { style: 'hair', color: { argb: LIGNE } }
      };
      if (i % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FBFF' } };
      }
    });
  });

  ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: colonnes.length } };

  // Totaux en pied de tableau.
  const ligneTotal = 5 + eleves.length + 1;
  ws.mergeCells(ligneTotal, 1, ligneTotal, 3);
  const t = ws.getCell(ligneTotal, 1);
  t.value = `Total : ${eleves.length} élève(s)`;
  t.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
  t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: MAROON2 } };
  t.alignment = { horizontal: 'right', vertical: 'middle' };
  ws.getRow(ligneTotal).height = 20;

  return wb.xlsx.writeBuffer();
}

/** minuscules, sans accent ni ponctuation — pour comparer deux libellés. */
function normalize(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** "12/05/2008" ou un Date Excel -> "jj/mm/aaaa". */
function toDisplayDate(v) {
  if (v === null || v === undefined || v === '') return '';
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    const dd = String(v.getDate()).padStart(2, '0');
    const mm = String(v.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}/${v.getFullYear()}`;
  }
  const s = String(v).trim();
  const m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (m) return `${m[1].padStart(2, '0')}/${m[2].padStart(2, '0')}/${m[3]}`;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  return s;
}

/**
 * Lit un fichier rempli et renvoie un aperçu prêt à importer.
 * Aucune écriture en base : l'import ne se fait qu'après validation.
 */
async function parseImport(buffer, referentiel) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);

  const ws = wb.getWorksheet('Élèves') || wb.worksheets[0];
  if (!ws) return { erreur: 'Le fichier ne contient aucune feuille.' };

  // La ligne d'en-tête est repérée par le nom de colonne, ce qui rend le
  // modèle robuste si l'utilisateur insère des lignes au-dessus.
  let ligneEntete = 0;
  let mapColonnes = {};
  ws.eachRow((row, n) => {
    if (ligneEntete) return;
    const valeurs = [];
    row.eachCell({ includeEmpty: false }, (cell, c) => valeurs.push([c, cell.value]));
    const trouve = valeurs.filter(([, v]) => COLONNES.some((col) => normalize(typeof v === 'string' ? v : '') === normalize(col.header)));
    if (trouve.length >= 3) {
      ligneEntete = n;
      trouve.forEach(([c, v]) => {
        const cible = COLONNES.find((col) => normalize(String(v)) === normalize(col.header));
        if (cible) mapColonnes[cible.key] = c;
      });
    }
  });

  if (!ligneEntete || !mapColonnes.nom || !mapColonnes.prenom) {
    return {
      erreur:
        "En-tête de colonnes introuvable. Utilisez le modèle fourni " +
        '(colonne « Nom » et « Prénom » attendues).'
    };
  }

  const matieresIndex = new Map();
  referentiel.matieres.forEach((m) => matieresIndex.set(normalize(m.nom), m));
  const profsIndex = new Map();
  referentiel.enseignants.forEach((t) => {
    profsIndex.set(normalize(t.full_name), t);
    profsIndex.set(normalize(t.nom), t);
    if (t.code) profsIndex.set(normalize(t.code), t);
  });

  const lignes = [];
  for (let n = ligneEntete + 1; n <= ws.rowCount; n += 1) {
    const row = ws.getRow(n);
    const lire = (key) => {
      const c = mapColonnes[key];
      if (!c) return '';
      const v = row.getCell(c).value;
      return v === null || v === undefined ? '' : String(v).trim();
    };

    const nom = lire('nom');
    const prenom = lire('prenom');
    if (!nom && !prenom) continue; // ligne vide : ignorée

    const erreurs = [];

    // Ligne marquée "exemple" dans le modèle : signalée, jamais importée.
    const estExemple = /exemple/i.test(lire('adresse'));

    if (!nom) erreurs.push('Nom manquant');
    if (!prenom) erreurs.push('Prénom manquant');

    const dateNaissance = toDisplayDate(lire('date_naissance'));
    const dateInscription = toDisplayDate(lire('date_inscription'));
    if (dateNaissance && !/^\d{2}\/\d{2}\/\d{4}$/.test(dateNaissance)) erreurs.push('Date de naissance illisible');
    if (dateInscription && !/^\d{2}\/\d{2}\/\d{4}$/.test(dateInscription)) erreurs.push("Date d'inscription illisible");

    // Cours : "Matière / Enseignant ; Matière / Enseignant"
    const cours = [];
    String(lire('cours'))
      .split(/[;\n]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((brut) => {
        const parties = brut.split(/\s+\/\s+|\s+-\s+|\s+—\s+/);
        const nomMatiere = normalize(parties[0]);
        const nomProf = normalize(parties[1] || '');
        if (!nomMatiere) return;
        const matiere = matieresIndex.get(nomMatiere);
        if (!matiere) {
          erreurs.push(`Matière inconnue : ${parties[0].trim()}`);
          return;
        }
        let prof = null;
        if (nomProf) {
          prof = profsIndex.get(nomProf) || null;
          if (!prof) erreurs.push(`Enseignant inconnu : ${parties[1].trim()}`);
        }
        cours.push({ matiere_id: matiere.id, matiere_nom: matiere.nom, teacher_id: prof ? prof.id : null, teacher_nom: prof ? prof.full_name : null });
      });

    lignes.push({
      ligne: n,
      exemple: estExemple,
      nom,
      prenom,
      date_naissance: dateNaissance,
      classe: lire('classe'),
      date_inscription: dateInscription,
      telephone: lire('telephone'),
      telephone_parent: lire('telephone_parent'),
      adresse: lire('adresse'),
      photo: lire('photo'),
      cours,
      erreurs
    });
  }

  return {
    ligneEntete,
    lignes,
    total: lignes.filter((l) => !l.exemple).length,
    valides: lignes.filter((l) => !l.exemple && l.erreurs.length === 0).length,
    enErreur: lignes.filter((l) => !l.exemple && l.erreurs.length > 0).length
  };
}

module.exports = { buildTemplate, buildExport, parseImport, ETABLISSEMENT };