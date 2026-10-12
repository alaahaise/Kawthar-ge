/**
 * Test du passage d'année automatique et du filtre d'état payé / impayé.
 *   npx electron annee-test.js
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { app } = require('electron');

const tmpUserData = path.join(os.tmpdir(), 'gestion-annee-test-' + Date.now());
app.setPath('userData', tmpUserData);

const { waitForMainWindowReady } = require('./main.js');

app.whenReady().then(async () => {
  const p = [];
  const ck = (l, c, d) => {
    if (!c) p.push(l + (d !== undefined ? ' -> ' + JSON.stringify(d) : ''));
  };

  try {
    const win = await waitForMainWindowReady(30000);
    const r = (code) => win.webContents.executeJavaScript(`(${code.toString()})()`);

    const A = new Date().getFullYear();
    const S = new Date().getFullYear() + 1;

    await r(async function seed() {
      const api = window.api;
      const m = await api.addMatiere({ nom: 'Mathématiques', prix_mensuel: 2000 });
      const t1 = await api.addTeacher({ prenom: 'Karim', nom: 'Benali' });
      const t2 = await api.addTeacher({ prenom: 'Rachid', nom: 'Meziane' });
      await api.addMatiereTeacher({ matiere_id: m.id, teacher_id: t1.id, prix_mensuel: 2000 });
      await api.addMatiereTeacher({ matiere_id: m.id, teacher_id: t2.id, prix_mensuel: 3000 });
      const s1 = await api.addStudent({ nom: 'Bouzid', prenom: 'Amine', date_inscription: '15/09/2026', classe: '1ère Année' });
      const s2 = await api.addStudent({ nom: 'Cherif', prenom: 'Yanis', date_inscription: '05/10/2026', classe: '2ème Année' });
      // Amine suit les maths chez Karim ET chez Rachid.
      await api.setStudentMatieres({
        student_id: s1.id,
        selections: [{ matiere_id: m.id, teacher_ids: [t1.id, t2.id] }],
        date_inscription: '15/09/2026'
      });
      await api.setStudentMatieres({
        student_id: s2.id,
        selections: [{ matiere_id: m.id, teacher_ids: [t1.id] }],
        date_inscription: '05/10/2026'
      });
      // Amine a payé chez Karim en mars, pas chez Rachid.
      await api.togglePayment({ student_id: s1.id, matiere_id: m.id, teacher_id: t1.id, annee: 2026, mois: 3, paye: true });
    });

    // ---- Année de travail ----
    const info = await r(async function annee() {
      return window.api.anneeInitiale();
    });
    ck('année active = année courante', info.annee_active === A, info.annee_active);
    ck('pas de bascule la 1re fois', info.nouvelle_annee === false, info.nouvelle_annee);
    ck('années disponibles incluent N et N+1', info.annees_disponibles.includes(A) && info.annees_disponibles.includes(S), info.annees_disponibles);
    ck('les années sont triées', info.annees_disponibles.every((y, i, a) => i === 0 || a[i - 1] < y), info.annees_disponibles);
    ck('année avec données incluse', info.annees_disponibles.includes(2026), info.annees_disponibles);
    ck('2 cours actifs', info.cours_actifs === 2, info.cours_actifs);
    ck('2 élèves reconduits', info.eleves_reconducts === 2, info.eleves_reconducts);

    // mémorisation de l'année choisie
    await r(async function setAnnee() {
      await window.api.definirAnnee(2027);
      return 1;
    });
    const relu = await r(async function relire() {
      return window.api.anneeInitiale();
    });
    ck('année choisie mémorisée', relu.annee_active === 2027, relu.annee_active);

    // ---- Nouvelle année : rien à migrer, les grilles repartent vides ----
    const gridS = await r(async function gridNext() {
      const api = window.api;
      const t = (await api.listTeachers()).find((x) => x.nom === 'Benali');
      const m = (await api.listMatieres())[0];
      const g = await api.paymentsGrid({ matiere_id: m.id, teacher_id: t.id, annee: 2027 });
      const el = (await api.listStudents({ matiere_id: m.id }))[0];
      return { students: g.students.length, payes: g.students.filter((s) => Object.keys(s.payments).length).length, elevesLignes: el.matricule };
    });
    ck('année suivante : mêmes élèves inscrits', gridS.students === 2, gridS.students);
    ck('année suivante : aucun paiement reconduit', gridS.payes === 0, gridS.payes);

    // ---- Filtre d'état payé / impayé ----
    const etat = await r(async function etat() {
      const api = window.api;
      const t1 = (await api.listTeachers()).find((x) => x.nom === 'Benali');
      const t2 = (await api.listTeachers()).find((x) => x.nom === 'Meziane');
      const m = (await api.listMatieres())[0];
      const s = {};
      s.map = await api.paiementsEtatEleves({ matiere_id: m.id, annee: 2026, mois: 3 });
      const amine = Object.entries(s.map).find(([, v]) => v.length === 2);
      s.payes = await api.listStudents({
        paiement_matiere: m.id, paiement_mois: 3, paiement_annee: 2026, statut: 'paye'
      });
      s.impayes = await api.listStudents({
        paiement_matiere: m.id, paiement_mois: 3, paiement_annee: 2026, statut: 'impaye'
      });
      s.noms = (await api.listStudents()).map((x) => x.nom);
      s.t2 = t2.id;
      s.t1 = t1.id;
      return s;
    });
    // Amine est payé chez Karim et impayé chez Rachid => présent dans les deux listes.
    ck('état : deux professeurs pour Amine', etat.map[Object.keys(etat.map)[0]].length === 2, etat.map);
    ck('filtre "payés" : Amine présent (il a payé chez Karim)', etat.payes.some((x) => x.nom === 'Bouzid'), etat.payes.map((x) => x.nom));
    ck('filtre "payés" : Yanis absent', !etat.payes.some((x) => x.nom === 'Cherif'), etat.payes.map((x) => x.nom));
    ck('filtre "impayés" : Yanis présent', etat.impayes.some((x) => x.nom === 'Cherif'), etat.impayes.map((x) => x.nom));
    ck('filtre "impayés" : Amine présent (impayé chez Rachid)', etat.impayes.some((x) => x.nom === 'Bouzid'), etat.impayes.map((x) => x.nom));

    // ---- Grille annuelle d'un élève ----
    const grille = await r(async function grille() {
      const api = window.api;
      const t1 = (await api.listTeachers()).find((x) => x.nom === 'Benali');
      const m = (await api.listMatieres())[0];
      const amine = (await api.listStudents()).find((x) => x.nom === 'Bouzid');
      const g = await api.paiementsGrilleEleve({
        student_id: amine.id, matiere_id: m.id, teacher_id: t1.id, annee: 2026
      });
      return { mois: g.mois.length, mars: g.mois[2].paye, montant: g.mois[2].montant, prix: g.prix, prof: g.cours.teacher_full_name, nom: g.etudiant.nom };
    });
    ck('grille élève : 12 mois', grille.mois === 12, grille.mois);
    ck('grille élève : mars payé', grille.mars === true);
    ck('grille élève : montant = tarif du prof', grille.montant === 2000, grille.montant);
    ck('grille élève : professeur correct', grille.prof === 'Karim Benali', grille.prof);
    ck('grille élève : bon élève', grille.nom === 'Bouzid', grille.nom);

    // La grille d'un élève non inscrit à ce cours est refusée.
    const refus = await r(async function refus() {
      const api = window.api;
      const t2 = (await api.listTeachers()).find((x) => x.nom === 'Meziane');
      const m = (await api.listMatieres())[0];
      const yanis = (await api.listStudents()).find((x) => x.nom === 'Cherif');
      return await api.paiementsGrilleEleve({
        student_id: yanis.id, matiere_id: m.id, teacher_id: t2.id, annee: 2026
      });
    });
    ck('grille élève refusée si non inscrit', refus === null, refus);

  } catch (e) {
    p.push('EXCEPTION : ' + e.message + ' @ ' + String(e.stack || '').split('\n')[1]);
  }

  if (p.length) {
    console.error(`${p.length} ÉCHEC(S) :`);
    p.forEach((x) => console.error('  - ' + x));
    app.exit(1);
  } else {
    console.log('OK — années et état de paiement validés.');
    app.exit(0);
  }
});

app.on('will-quit', () => {
  try {
    fs.rmSync(tmpUserData, { recursive: true, force: true });
  } catch (err) {
    /* sans conséquence */
  }
});