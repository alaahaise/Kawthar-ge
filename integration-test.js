/**
 * Test d'intégration des nouvelles fonctionnalités (matières, enseignants,
 * filtres, paiements).
 *
 * Utilise un dossier userData jetable pour ne jamais toucher la vraie base :
 *   npx electron integration-test.js
 */
const path = require('path');
const os = require('os');
const fs = require('fs');
const { app, BrowserWindow } = require('electron');

const tmpUserData = path.join(os.tmpdir(), 'gestion-etudiants-test-' + Date.now());
app.setPath('userData', tmpUserData);

require('./main.js');
const { waitForMainWindowReady } = require('./main.js');

async function rendererTest() {
  const problems = [];
  const checks = [];
  const check = (label, cond, detail) => {
    checks.push(`${cond ? 'OK  ' : 'FAIL'} ${label}${detail !== undefined ? ' -> ' + JSON.stringify(detail) : ''}`);
    if (!cond) problems.push(label + (detail !== undefined ? ' -> ' + JSON.stringify(detail) : ''));
  };

  const api = window.api;

  // ---------- Matières ----------
  const m1 = await api.addMatiere({ nom: 'Mathématiques', prix_mensuel: 2000, description: 'Algèbre' });
  const m2 = await api.addMatiere({ nom: 'Physique', prix_mensuel: 1500, description: 'Mécanique' });
  check('création matière 1', m1.success, m1.error);
  check('création matière 2', m2.success, m2.error);

  const dup = await api.addMatiere({ nom: 'Mathématiques' });
  check('matière en double refusée', dup.success === false, dup.error);

  const upMat = await api.updateMatiere({ id: m1.id, nom: 'Mathématiques', prix_mensuel: 2500, description: 'Algèbre + Analyse' });
  check('modification matière', upMat.success, upMat.error);
  const matieres = await api.listMatieres();
  check('prix mis à jour', matieres.find((m) => m.id === m1.id).prix_mensuel === 2500, matieres.find((m) => m.id === m1.id));

  // ---------- Enseignants ----------
  const t1 = await api.addTeacher({ prenom: 'Karim', nom: 'Benali', telephone: '0555123456', specialite: 'Maths' });
  const t2 = await api.addTeacher({ prenom: 'Samir', nom: 'Ait Ahmed' });
  check('création enseignant 1 (code auto)', t1.success && t1.code === 'ENS0001', t1);
  check('création enseignant 2 (code auto)', t2.success && t2.code === 'ENS0002', t2);

  const teachers = await api.listTeachers();
  check('prénom stocké', teachers.find((t) => t.id === t1.id).prenom === 'Karim', teachers.find((t) => t.id === t1.id));
  check('nom complet calculé', teachers.find((t) => t.id === t1.id).full_name === 'Karim Benali', teachers.find((t) => t.id === t1.id).full_name);

  const upT = await api.updateTeacher({ id: t1.id, prenom: 'Karim', nom: 'Benali', telephone: '0555999999' });
  check('modification enseignant', upT.success, upT.error);

  // ---------- Affectations ----------
  const aff1 = await api.addMatiereTeacher({ matiere_id: m1.id, teacher_id: t1.id });
  const aff2 = await api.addMatiereTeacher({ matiere_id: m2.id, teacher_id: t2.id });
  check('affectation 1', aff1.success, aff1.error);
  check('affectation 2', aff2.success, aff2.error);
  // Réaffecter le même prof à la même matière met à jour le tarif au lieu
  // d'échouer : c'est voulu, ça évite de créer un doublon de cours.
  const affDup = await api.addMatiereTeacher({ matiere_id: m1.id, teacher_id: t1.id, prix_mensuel: 2750 });
  check('réaffectation = mise à jour du tarif', affDup.success && affDup.updated === true, affDup);
  const coursApresMaj = await api.listCours();
  check('pas de doublon de cours', coursApresMaj.length === 2, coursApresMaj.length);
  check('tarif du cours mis à jour', coursApresMaj.find((c) => c.teacher_id === t1.id).prix_mensuel === 2750, coursApresMaj.find((c) => c.teacher_id === t1.id));
  // On remet le tarif de départ pour la suite du test.
  await api.addMatiereTeacher({ matiere_id: m1.id, teacher_id: t1.id, prix_mensuel: 2500 });

  const pairs = await api.listMatiereTeachers();
  check('liste des affectations', pairs.length === 2, pairs.length);
  check(
    'affectation porte le nom complet',
    pairs.some((p) => p.teacher_full_name === 'Karim Benali'),
    pairs.map((p) => p.teacher_full_name)
  );

  // ---------- Étudiants ----------
  const s1 = await api.addStudent({
    nom: 'Bouzid', prenom: 'Amine', date_naissance: '12/05/2008',
    date_inscription: '15/09/2025', classe: '1ère Année', telephone_parent: '0666112233'
  });
  const s2 = await api.addStudent({
    nom: 'Cherif', prenom: 'Yanis', date_naissance: '01/01/2009',
    date_inscription: '05/10/2025', classe: '2ème Année'
  });
  const s3 = await api.addStudent({
    nom: 'Ali', prenom: 'Nora', date_naissance: '20/11/2008',
    date_inscription: '20/12/2024', classe: '1ère Année'
  });
  check('création étudiant 1', s1.success, s1.error);
  check('matricule auto 2025', s1.matricule === '20250001', s1.matricule);
  check('matricule auto 2025 (2e)', s2.matricule === '20250002', s2.matricule);
  check('matricule auto 2024 (année différente)', s3.matricule === '20240001', s3.matricule);

  await api.setStudentMatieres({
    student_id: s1.id,
    selections: [{ matiere_id: m1.id, teacher_id: t1.id }, { matiere_id: m2.id, teacher_id: t2.id }],
    date_inscription: '15/09/2025'
  });
  await api.setStudentMatieres({
    student_id: s2.id,
    selections: [{ matiere_id: m1.id, teacher_id: t1.id }],
    date_inscription: '05/10/2025'
  });
  await api.setStudentMatieres({
    student_id: s3.id,
    selections: [{ matiere_id: m2.id, teacher_id: t2.id }],
    date_inscription: '20/12/2024'
  });

  const inscritsM1 = await api.listStudentsForMatiere({ matiere_id: m1.id });
  check('2 inscrits en Maths', inscritsM1.length === 2, inscritsM1.map((s) => s.matricule));
  check('enseignant remonté sur l\'inscrit', inscritsM1.every((s) => s.teacher_nom === 'Benali'), inscritsM1.map((s) => s.teacher_nom));

  // Inscrire un élève dans une matière doit aussi prouver que l'enseignant
  // assure cette matière (pages Matières / Enseignants et matrice).
  const pairsAfterEnrol = await api.listMatiereTeachers();
  check(
    'l\'affectation enseignant/matière est créée par l\'inscription',
    pairsAfterEnrol.some((p) => p.matiere_id === m1.id && p.teacher_id === t1.id),
    pairsAfterEnrol.map((p) => `${p.matiere_nom}/${p.teacher_full_name}`)
  );
  const teacherDetail = await api.teacherDetail(t1.id);
  check('fiche enseignant : cours déduits des inscriptions', teacherDetail.cours.length === 1, teacherDetail.cours.map((c) => c.matiere_nom));
  check('fiche enseignant : nom complet', teacherDetail.full_name === 'Karim Benali', teacherDetail.full_name);

  const teacherStudents = await api.listStudentsForTeacher(t1.id);
  check('élèves de l\'enseignant', teacherStudents.length === 2, teacherStudents.length);

  const map = await api.studentMatieresMap();
  check('carte matières/étudiants', (map[s1.id] || []).length === 2, map[s1.id]);

  // ---------- Filtres ----------
  const byNom = await api.listStudents({ nom: 'cher' });
  check('filtre par nom (insensible à la casse)', byNom.length === 1 && byNom[0].matricule === '20250002', byNom.map((s) => s.matricule));

  const byPrenom = await api.listStudents({ prenom: 'Nora' });
  check('filtre par prénom', byPrenom.length === 1 && byPrenom[0].nom === 'Ali', byPrenom.map((s) => s.nom));

  const byMatiere = await api.listStudents({ matiere_id: m1.id });
  check('filtre par matière', byMatiere.length === 2, byMatiere.map((s) => s.matricule));

  const byClasse = await api.listStudents({ classe: '1ère Année' });
  check('filtre par classe', byClasse.length === 2, byClasse.map((s) => s.matricule));

  // Plage de dates sur date d'inscription : 01/01/2025 -> 30/11/2025
  const byDate = await api.listStudents({ date_field: 'date_inscription', date_from: '01/01/2025', date_to: '30/11/2025' });
  check('filtre plage de dates (chronologique)', byDate.length === 2, byDate.map((s) => s.matricule));

  // Le piège : en triant du texte jj/mm/aaaa, "15/09/2025" < "20/12/2024" serait faux.
  const byDateDesc = await api.listStudents({ date_field: 'date_inscription', date_from: '01/01/2024', sort: 'nom' });
  check(
    'tri chronologique correct malgré le format texte',
    byDateDesc.map((s) => s.date_inscription)[0] === '20/12/2024',
    byDateDesc.map((s) => s.date_inscription)
  );

  const byNaissance = await api.listStudents({ date_field: 'date_naissance', date_from: '01/01/2009', date_to: '31/12/2009' });
  check('filtre sur date de naissance', byNaissance.length === 1 && byNaissance[0].matricule === '20250002', byNaissance.map((s) => s.matricule));

  const recherche = await api.listStudents({ search: '0666' });
  check('recherche sur téléphone parent', recherche.length === 1 && recherche[0].matricule === '20250001', recherche.map((s) => s.matricule));

// ---------- Paiements (rattachés au cours : matière + enseignant) ----------
  // Dans ce test, m1 est enseignée par t1 et m2 par t2 : tous les paiements
  // sur m1 doivent donc porter teacher_id = t1.id.
  const COURS = { matiere_id: m1.id, teacher_id: t1.id };

  // Amine (s1) paie le mois de mars en Maths chez t1.
  await api.togglePayment({ student_id: s1.id, ...COURS, annee: 2026, mois: 3, paye: true });
  // Le montant doit reprendre le tarif DU COURS (2500), pas 0.
  let grid = await api.paymentsGrid({ ...COURS, annee: 2026 });
  const amine = grid.students.find((s) => s.id === s1.id);
  check('montant pré-rempli avec le tarif du cours', amine.payments[3].montant === 2500, amine.payments[3]);

  // Montant personnalisé.
  await api.togglePayment({ student_id: s1.id, ...COURS, annee: 2026, mois: 4, paye: true, montant: 2000 });
  grid = await api.paymentsGrid({ ...COURS, annee: 2026 });
  const amine2 = grid.students.find((s) => s.id === s1.id);
  check('montant personnalisé conservé', amine2.payments[4].montant === 2000, amine2.payments[4]);
  check('date de paiement enregistrée', !!amine2.payments[4].date_paiement, amine2.payments[4].date_paiement);

  // Décocher.
  await api.togglePayment({ student_id: s1.id, ...COURS, annee: 2026, mois: 4, paye: false });
  grid = await api.paymentsGrid({ ...COURS, annee: 2026 });
  check('décocher un paiement', !grid.students.find((s) => s.id === s1.id).payments[4].paye);

  // Grille = seulement les inscrits de CE cours.
  check('grille limitée aux inscrits du cours', grid.students.length === 2, grid.students.length);

  // Statistiques du cours.
  const stats = await api.paymentsStats({ ...COURS, annee: 2026 });
  check('stats : inscrits', stats.inscrits === 2, stats.inscrits);
  check('stats : 1 payée en mars', stats.par_mois[2].payes === 1, stats.par_mois[2]);
  check('stats : encaissé = 2500', stats.total_encaisse === 2500, stats.total_encaisse);
  check('stats : attendu = 2 x 12 x 2500', stats.total_attendu === 2 * 12 * 2500, stats.total_attendu);

  // Impayés d'un mois.
  const impayes = await api.unpaidStudents({ ...COURS, annee: 2026, mois: 3 });
  check('1 impayé en mars', impayes.length === 1 && impayes[0].matricule === '20250002', impayes.map((s) => s.matricule));

  // Filtre "impayés" sur la liste des étudiants.
  const filtreImpayes = await api.listStudents({
    matiere_id: m1.id,
    unpaid_matiere_id: m1.id,
    unpaid_annee: 2026,
    unpaid_mois: 3
  });
  check('liste filtrée sur impayés', filtreImpayes.length === 1 && filtreImpayes[0].matricule === '20250002', filtreImpayes.map((s) => s.matricule));

  // Règlement groupé du mois de mai pour tout le cours.
  const all = await api.markAllPayments({ ...COURS, annee: 2026, mois: 5, paye: true });
  check('règlement groupé : 2 étudiants', all.success && all.count === 2, all);
  grid = await api.paymentsGrid({ ...COURS, annee: 2026 });
  check('tous payés en mai', grid.students.every((s) => s.payments[5] && s.payments[5].paye));

  // Relevé mensuel global.
  const report = await api.paymentsReport({ annee: 2026, mois: 5 });
  const mathsRow = report.find((r) => r.matiere_id === m1.id);
  check('relevé : 2 payés en mai', mathsRow.payes === 2, mathsRow);
  check('relevé : encaissement 5000', mathsRow.montant === 5000, mathsRow.montant);
  check('relevé : nom de l\'enseignant', mathsRow.teacher_full_name === 'Karim Benali', mathsRow.teacher_full_name);

  // Le même paiement ne doit pas apparaître chez un autre enseignant.
  const chezT2 = await api.paymentsGrid({ matiere_id: m2.id, teacher_id: t2.id, annee: 2026 });
  check(
    'le cours de t2 est indépendant',
    chezT2.students.every((s) => !Object.keys(s.payments).length),
    chezT2.students.map((s) => s.payments)
  );

  // ---------- Tableau de bord ----------
  // Ces contrôles s'exécutent AVANT les suppressions en cascade ci-dessous :
  // 3 élèves, inscrits dans m1 (2500) et m2 (1500).
  const PRIX_M1 = 2500;
  const PRIX_M2 = 1500;
  const attenduMensuel = PRIX_M1 * 2 + PRIX_M2 * 2; // s1 et s2 en m1, s1 et s3 en m2
  // Paiements marqués "payés" à cet instant : mars pour s1 (2500) et le
  // règlement groupé de mai pour les 2 inscrits de m1 (2500 x 2). Le paiement
  // d'avril a été décoché juste avant et ne compte donc pas.
  const totalAttendu = PRIX_M1 + PRIX_M1 * 2;

  const revenue = await api.statsRevenue({ annee: 2026 });
  check('revenus : 12 mois', revenue.par_mois.length === 12, revenue.par_mois.length);
  check('revenus : montant cumulé', revenue.total === totalAttendu, revenue.total);
  check('revenus : attendu mensuel', revenue.attendu_mensuel === attenduMensuel, revenue.attendu_mensuel);

  const parMat = await api.statsRevenueParMatiere({ annee: 2026 });
  check('revenus par matière : 2 matières', parMat.length === 2, parMat.map((r) => r.matiere_nom));

  const glob = await api.statsGlobales();
  check('dashboard : 3 élèves', glob.eleves === 3, glob.eleves);
  check('dashboard : 2 matières', glob.matieres === 2, glob.matieres);
  check('dashboard : 2 enseignants', glob.enseignants === 2, glob.enseignants);
  check('dashboard : montant attendu à ce jour arrondi', Number.isInteger(glob.attendu_mois_ce_jour), glob.attendu_mois_ce_jour);

  // ---------- Nettoyage en cascade ----------
  await api.deleteStudent(s2.id);
  grid = await api.paymentsGrid({ ...COURS, annee: 2026 });
  check('suppression étudiant : grille à jour', grid.students.length === 1, grid.students.length);

  await api.deleteMatiere(m2.id);
  const matieresApres = await api.listMatieres();
  check('suppression matière', matieresApres.length === 1, matieresApres.map((m) => m.nom));
  const coursApres = await api.listCours();
  check('suppression matière : cours purgés', coursApres.length === 1, coursApres.length);
  const restants = await api.listStudentsForMatiere(m2.id);
  check('inscriptions purgées avec la matière', restants.length === 0, restants.length);
  const reportApres = await api.paymentsReport({ annee: 2026, mois: 3 });
  check('paiements purgés avec la matière', !reportApres.some((r) => r.matiere_id === m2.id), reportApres.map((r) => r.matiere_id));

  return { problems, checks };
}

app.whenReady().then(async () => {
  try {
        const win = await waitForMainWindowReady(30000);
    if (!win) {
      console.error('ÉCHEC : aucune fenêtre créée.');
      app.exit(1);
      return;
    }
    const result = await win.webContents.executeJavaScript(`(${rendererTest.toString()})()`);
    result.checks.forEach((c) => console.log('  ' + c));
    console.log('');
    if (result.problems.length) {
      console.error(`${result.problems.length} ÉCHEC(S) :`);
      result.problems.forEach((p) => console.error('  - ' + p));
      app.exit(1);
    } else {
      console.log(`OK — ${result.checks.length} vérifications passées.`);
      app.exit(0);
    }
  } catch (err) {
    console.error('ÉCHEC :', err.stack || err.message);
    app.exit(1);
  }
});

app.on('will-quit', () => {
  try {
    fs.rmSync(tmpUserData, { recursive: true, force: true });
  } catch (err) {
    /* le dossier de test peut rester, sans conséquence */
  }
});


