/**
 * Génère des données de démonstration.
 *
 *   npx electron demo.js            -> démarre l'app sur une base de démo
 *                                         (.demo-data dans le projet), les données
 *                                         réelles ne sont PAS touchées.
 *   npx electron demo.js --reset    -> vide la base de démo avant de la remplir.
 *   npx electron demo.js --real     -> ATTENTION : injecte les données de démo
 *                                         dans la VRAIE base (%APPDATA%).
 */
const path = require('path');
const fs = require('fs');
const zlib = require('zlib');
const { app, BrowserWindow } = require('electron');

const useRealDb = process.argv.includes('--real');
const doReset = process.argv.includes('--reset');

const DEMO_DIR = path.join(__dirname, '.demo-data');
if (!useRealDb) {
  app.setPath('userData', DEMO_DIR);
  fs.rmSync(DEMO_DIR, { recursive: true, force: true });
}

const { importPhotosFromDir, waitForMainWindowReady } = require('./main.js');

if (doReset && !useRealDb) {
  console.log('Base de démonstration réinitialisée.');
}

// ---------- Photos de démonstration (PNG générés à la volée) ----------
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

/** Avatar carré : fond pastel + disque plus sombre (pas de dépendance externe). */
function makeAvatar(size, bg, fg) {
  const stride = size * 3 + 1;
  const raw = Buffer.alloc(stride * size);
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.34;
  for (let y = 0; y < size; y += 1) {
    raw[y * stride] = 0; // filtre PNG "None"
    for (let x = 0; x < size; x += 1) {
      const c = Math.hypot(x - cx, y - cy) < r ? fg : bg;
      const o = y * stride + 1 + x * 3;
      raw[o] = c[0];
      raw[o + 1] = c[1];
      raw[o + 2] = c[2];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // 8 bits par canal
  ihdr[9] = 2; // couleur vraie (RGB)
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0))
  ]);
}

const PHOTO_PALETTE = [
  [[214, 234, 254], [37, 99, 235]],
  [[220, 252, 231], [22, 163, 74]],
  [[254, 243, 199], [217, 119, 6]],
  [[252, 231, 243], [219, 39, 119]],
  [[237, 233, 254], [124, 58, 237]],
  [[255, 237, 213], [234, 88, 12]],
  [[224, 242, 254], [14, 116, 144]],
  [[220, 252, 252], [13, 148, 136]]
];

// ---------- Jeu de données ----------
const MATIERES = [
  ['Mathématiques', 2500, 'Algèbre, fonctions, dérivées et intégrales'],
  ['Physique', 2000, 'Mécanique, électricité et optique'],
  ['Chimie', 1800, 'Atomes, réactions chimiques et solutions'],
  ['Français', 1500, 'Grammaire, conjugaison et rédaction'],
  ['Anglais', 1500, 'Expression orale et écrite'],
  ['Histoire-Géographie', 1200, 'Histoire du XXe siècle et géographie'],
  ['Informatique', 2200, 'Algorithmique et bureautique'],
  ['EPS', 1000, 'Sport collectif et athlétisme']
];

const ENSEIGNANTS = [
  ['Karim', 'Benali', '0555123456', 'Mathématiques'],
  ['Samir', 'Ait Ahmed', '0661778899', 'Physique'],
  ['Yasmine', 'Kaci', '0770334455', 'Chimie'],
  ['Leila', 'Haddad', '0551998877', 'Français'],
  ['Omar', 'Belkacem', '0699442211', 'Anglais'],
  ['Nadia', 'Bouzid', '0661223344', 'Histoire-Géographie'],
  ['Rachid', 'Meziane', '0775667788', 'Informatique'],
  ['Sofia', 'Slimani', '0559001122', 'EPS']
];

const PRENOMS_M = ['Amine', 'Yacine', 'Yanis', 'Sofiane', 'Mehdi', 'Rachid', 'Bilal', 'Omar', 'Adem',
  'Mustapha', 'Djamel', 'Hamza', 'Nabil', 'Farid', 'Ayoub', 'Redouane', 'Lyes', 'Zakaria', 'Sid Ahmed', 'Chouaib'];
const PRENOMS_F = ['Meriem', 'Amel', 'Nora', 'Yasmine', 'Lina', 'Sarah', 'Imene', 'Nadia', 'Sofia',
  'Kenza', 'Assia', 'Hanane', 'Wassila', 'Bouchra', 'Dihya', 'Rania', 'Chahinez', 'Meriem', 'Djamila', 'Ikram'];
const NOMS = ['Benali', 'Cherif', 'Meziane', 'Kaci', 'Bouzid', 'Larbi', 'Benaissa', 'Hadjadj', 'Zerrouki',
  'Belkacem', 'Amrani', 'Chaabane', 'Djebbar', 'Ferhat', 'Gacem', 'Hamidi', 'Idir', 'Khelifi', 'Lounes',
  'Mansouri', 'Nadir', 'Ouali', 'Rabhi', 'Saadi', 'Taleb', 'Yahiaoui', 'Aissaoui', 'Boutaleb', 'Dahmani'];
const CLASSES = ['1ère Année', '2ème Année', '3ème Année'];
const VILLAGES = ['Sid Cheikh', 'Saida', 'Aïn El Hadjar', 'Oued Zlabia', 'Sidi Brahim', 'Mostefa'];

/**
 * Remplit la base via window.api.
 * ATTENTION : cette fonction est sérialisée puis exécutée dans le renderer,
 * elle ne doit donc référencer AUCUNE variable du processus principal —
 * toutes les données sont passées en paramètre `d`.
 */
async function seedInRenderer(d) {
  function mulberry32(seed) {
    return function rnd() {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const api = window.api;
  const rnd = mulberry32(20261011);
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const int = (min, max) => min + Math.floor(rnd() * (max - min + 1));
  const pad = (n) => String(n).padStart(2, '0');

  // ---- Matières ----
  const matieres = [];
  for (const m of d.matieres) {
    const res = await api.addMatiere({ nom: m[0], prix_mensuel: m[1], description: m[2] });
    if (!res.success) throw new Error('Matiere "' + m[0] + '" : ' + res.error);
    matieres.push({ id: res.id, nom: m[0], prix: m[1] });
  }

  // ---- Enseignants ----
  const teachers = [];
  for (const e of d.enseignants) {
    const res = await api.addTeacher({ prenom: e[0], nom: e[1], telephone: e[2], specialite: e[3] });
    if (!res.success) throw new Error('Enseignant ' + e[1] + ' : ' + res.error);
    teachers.push({ id: res.id, code: res.code, nom: e[1], prenom: e[0] });
  }

  // Chaque matière est confiée à son enseignant AVANT toute inscription : c'est
  // l'ordre naturel (on pourvoit la matière, puis on y inscrit des élèves), et
  // c'est ce qui renseigne la table matiere_teachers.
  for (let i = 0; i < matieres.length; i += 1) {
    await api.addMatiereTeacher({ matiere_id: matieres[i].id, teacher_id: teachers[i].id });
  }

  // Une matière peut avoir plusieurs enseignants : Histoire-Géographie est
  // partagée entre Nadia Bouzid et Leila Haddad (latin /-géo au collège).
  const leila = teachers.find((t) => t.nom === 'Haddad');
  const hg = matieres[5]; // Histoire-Géographie (indice 5 de d.matieres)
  await api.addMatiereTeacher({ matiere_id: hg.id, teacher_id: leila.id, prix_mensuel: 1400 });

  // Une matière peut avoir plusieurs enseignants, avec un tarif différent :
  // Rachid Meziane donne les maths (indice 0) en plus de l'informatique.
  const rachid = teachers.find((t) => t.nom === 'Meziane');
  const extraMaths = matieres[0];
  await api.addMatiereTeacher({ matiere_id: extraMaths.id, teacher_id: rachid.id, prix_mensuel: 3000 });

  const allCoursApi = await api.listCours();
  const tousLesProfsDe = (matiere) => allCoursApi.filter((c) => c.matiere_id === matiere.id);

  // ---- Élèves ----
  const eleves = [];
  const photos = [];
  for (let i = 0; i < d.nbEleves; i += 1) {
    const garcon = rnd() < 0.5;
    const prenom = garcon ? pick(d.prenomsM) : pick(d.prenomsF);
    const nom = pick(d.noms);
    const classe = pick(d.classes);

    const naissance = `${pad(int(1, 28))}/${pad(int(1, 12))}/${int(2007, 2010)}`;

    // Répartis sur trois années scolaires => des matricules variés.
    const anneeInscription = pick([2024, 2025, 2025, 2026]);
    const moisInscription = anneeInscription === 2026 ? int(1, 3) : int(9, 12);
    const inscription = `${pad(int(1, 28))}/${pad(moisInscription)}/${anneeInscription}`;

    const res = await api.addStudent({
      nom,
      prenom,
      date_naissance: naissance,
      date_inscription: inscription,
      classe,
      telephone: `0${pick(['55', '66', '77'])}${int(1000000, 9999999)}`,
      telephone_parent: `0${pick(['55', '66', '77'])}${int(1000000, 9999999)}`,
      adresse: `${pick(d.villages)}, Saida`
    });
    if (!res.success) throw new Error('Eleve ' + nom + ' : ' + res.error);

    eleves.push({ id: res.id, matricule: res.matricule, annee: anneeInscription, moisInscription });
    photos.push({ matricule: res.matricule, index: i % d.palette.length });

    // 2 à 4 cours par élève. Un cours = une matière + un enseignant.
    // Certains élèves suivent les MÊMES maths avec deux professeurs : c'est
    // précisément le cas de figure que l'application doit gérer.
    const choisies = [];
    while (choisies.length < int(2, 4)) {
      const m = pick(matieres);
      if (!choisies.includes(m)) choisies.push(m);
    }
    const selections = choisies.map((m) => {
      const parDefaut = teachers[matieres.indexOf(m)];
      // 30 % des élèves prennent aussi un deuxième prof sur cette matière.
      const profs = rnd() < 0.3 ? tousLesProfsDe(m).filter((p) => p.teacher_id !== parDefaut.id) : [];
      return { matiere_id: m.id, teacher_ids: [parDefaut.id].concat(profs.map((p) => p.teacher_id)) };
    });
    await api.setStudentMatieres({
      student_id: res.id,
      selections,
      date_inscription: inscription
    });

    // On mémorise les cours réellement suivis pour préparer les paiements.
    const suivis = [];
    selections.forEach((s) => {
      s.teacher_ids.forEach((tid) => {
        const c = allCoursApi.find((x) => x.matiere_id === s.matiere_id && x.teacher_id === tid);
        if (c) suivis.push({ cours_id: c.id, matiere_id: c.matiere_id, teacher_id: tid, prix: c.prix_mensuel });
      });
    });
    eleves[eleves.length - 1].cours = suivis;
  }

// ---- Paiements ----
  // Chaque cours est facturé séparément, au tarif DU PROF qui l'enseigne.
  // On ne facture que les mois postérieurs à l'inscription, et jusqu'au mois
  // précédent le mois en cours (le mois courant est encore en recouvrement,
  // c'est justement ce que le tableau de bord doit montrer).
  //
  // Les élèves « soldés » font exception : ils règlent TOUS leurs mois dus,
  // mois courant compris. Sans eux, le filtre « Payés seulement » — qui ne
  // montre que les élèves ne devant rien — serait toujours vide.
  const indexesSortie = [2, 7, 13, 21];
  const soldes = new Set();
  for (let i = 0; i < eleves.length && soldes.size < 8; i += 1) {
    if (!indexesSortie.includes(i)) soldes.add(i);
  }

  let nbPaiements = 0;
  for (let i = 0; i < eleves.length; i += 1) {
    const eleve = eleves[i];
    const debut = eleve.annee === d.anneeCourante ? eleve.moisInscription : 1;
    const solde = soldes.has(i);
    const dernierMois = solde ? d.moisCourant : d.moisCourant - 1;
    for (const c of eleve.cours) {
      for (let mois = debut; mois <= Math.max(debut - 1, dernierMois); mois += 1) {
        if (!solde && rnd() > 0.75) continue;
        const montant = rnd() < 0.12 ? Math.round((c.prix * int(50, 100)) / 100 / 50) * 50 : c.prix;
        await api.togglePayment({
          student_id: eleve.id,
          matiere_id: c.matiere_id,
          teacher_id: c.teacher_id,
          annee: d.anneeCourante,
          mois,
          paye: true,
          montant
        });
        nbPaiements += 1;
      }
    }
  }

  // ---- Congés et retours ----
  // Quelques élèves quittent l'établissement : ils doivent disparaître des
  // listes actives et des grilles de paiement, tout en conservant l'historique
  // de leurs paiements. L'un d'eux revient ensuite, ce qui exerce le cycle
  // complet congé -> historique -> retour.
  const motifsSortie = ['Déménagement', 'Fin de scolarité', 'Raisons familiales'];
  const sortis = [];
  for (let k = 0; k < indexesSortie.length; k += 1) {
    const eleve = eleves[indexesSortie[k]];
    if (!eleve) continue;
    await api.basculerEleveActif({
      student_id: eleve.id,
      actif: 0,
      motif: motifsSortie[k % motifsSortie.length]
    });
    sortis.push(eleve.id);
  }
  // Le dernier reprend sa scolarité : son historique porte alors un départ ET
  // un retour, ce qui permet de vérifier la réactivation.
  let retours = 0;
  const revenu = sortis.pop();
  if (revenu) {
    await api.basculerEleveActif({ student_id: revenu, actif: 1, motif: 'Réinscription' });
    retours = 1;
  }

  return {
    matieres: matieres.length,
    enseignants: teachers.length,
    cours: allCoursApi.length,
    eleves: eleves.length,
    paiements: nbPaiements,
    sortis: sortis.length,
    retours,
    solde: soldes.size,
    photos
  };
}

// ---------- Lancement ----------
app.whenReady().then(async () => {
  try {
    // Fenêtre PRINCIPALE : l'écran de démarrage est aussi une BrowserWindow,
    // et il est déjà chargé quand cette fonction s'exécute.
    const win = await waitForMainWindowReady(30000);

    console.log('Génération des données de démonstration...');
    const startedAt = Date.now();
    // Écritures groupées : sans cela le remplissage réécrit le fichier .db à
    // chaque paiement et prend plusieurs dizaines de secondes.
    await win.webContents.executeJavaScript(`(async () => { await window.api.dbBeginBatch(); return 1; })()`);
    const now = new Date();
    const payload = {
      matieres: MATIERES,
      enseignants: ENSEIGNANTS,
      prenomsM: PRENOMS_M,
      prenomsF: PRENOMS_F,
      noms: NOMS,
      classes: CLASSES,
      villages: VILLAGES,
      palette: PHOTO_PALETTE,
      nbEleves: 42,
      moisCourant: now.getMonth() + 1,
      anneeCourante: now.getFullYear()
    };
    const result = await win.webContents.executeJavaScript(
      `(${seedInRenderer.toString()})(${JSON.stringify(payload)})`
    );
    // Fin du lot : une seule écriture du fichier pour tout le remplissage.
    const fin = await win.webContents.executeJavaScript(`(async () => await window.api.dbEndBatch())()`);

    // Photos : générées dans un dossier temporaire puis associées aux élèves
    // via le même chemin que l'import manuel (le nom du fichier = le matricule).
    const seedDir = path.join(app.getPath('userData'), 'seed-photos');
    fs.rmSync(seedDir, { recursive: true, force: true });
    fs.mkdirSync(seedDir, { recursive: true });
    result.photos.forEach(({ matricule, index }) => {
      const [bg, fg] = PHOTO_PALETTE[index];
      fs.writeFileSync(path.join(seedDir, `${matricule}.png`), makeAvatar(220, bg, fg));
    });
    const imported = importPhotosFromDir(seedDir);
    fs.rmSync(seedDir, { recursive: true, force: true });

    console.log('');
    console.log(`  Matières     : ${result.matieres}`);
    console.log(`  Enseignants  : ${result.enseignants}`);
    console.log(`  Élèves       : ${result.eleves}`);
    console.log(`  Paiements    : ${result.paiements}`);
    console.log(`  Photos       : ${imported.imported} associée(s)`);
    console.log(`  Congés       : ${result.sortis} sorti(s), ${result.retours} revenu(s)`);
    console.log(`  Soldés       : ${result.solde} élève(s) à jour`);
    console.log(`  Durée        : ${Math.round((Date.now() - startedAt) / 1000)} s`);
    console.log('');
    console.log(useRealDb
      ? "ATTENTION : ces données ont été ajoutées à la VRAIE base (%APPDATA%)."
      : `Base de démo : ${DEMO_DIR}`);
    console.log('');

    win.webContents.reload();
  } catch (err) {
    // Un lot laissé ouvert ferait perdre toutes les écritures différées.
    try {
      await win.webContents.executeJavaScript(`(async () => await window.api.dbEndBatch())()`);
    } catch (e) {
      /* la fenêtre est peut-être déjà fermée */
    }
    console.error('ÉCHEC du remplissage :', err.message);
  }
});
