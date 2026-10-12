/**
 * Verifie :
 *  - le filtre impayé cumulatif (tous mois) et son périmètre en cascade ;
 *  - le congé / retour d'un élève, son historique et la réinitialisation.
 *   npx electron impaye-test.js
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { app } = require('electron');

const tmpUserData = path.join(os.tmpdir(), 'gestion-impaye-test-' + Date.now());
app.setPath('userData', tmpUserData);

const { waitForMainWindowReady } = require('./main.js');

app.whenReady().then(async () => {
  const p = [];
  const ck = (l, c, d) => {
    if (!c) p.push(l + (d !== undefined ? ' -> ' + JSON.stringify(d) : ''));
  };

  try {
    const win = await waitForMainWindowReady(30000);
    // Les fonctions envoyées au renderer sont sérialisées : elles n'ont aucune
// closure. Les valeurs dont elles ont besoin sont donc passées en argument.
const r = (code, arg) => win.webContents.executeJavaScript(`(${code.toString()})(${JSON.stringify(arg === undefined ? null : arg)})`);
    const A = new Date().getFullYear();
    const MOIS_COURANT = new Date().getMonth() + 1;

    const seed = await r(async function seed(args) {
      const moisCourant = args.moisCourant;
      const A = args.annee;
      const api = window.api;
      const m = await api.addMatiere({ nom: 'Mathématiques', prix_mensuel: 2000 });
      const t1 = await api.addTeacher({ prenom: 'Karim', nom: 'Benali' });
      const t2 = await api.addTeacher({ prenom: 'Rachid', nom: 'Meziane' });
      await api.addMatiereTeacher({ matiere_id: m.id, teacher_id: t1.id, prix_mensuel: 2000 });
      await api.addMatiereTeacher({ matiere_id: m.id, teacher_id: t2.id, prix_mensuel: 3000 });

      const a = await api.addStudent({ nom: 'Bouzid', prenom: 'Amine', date_inscription: '15/01/2026', classe: '1ere' });
      const b = await api.addStudent({ nom: 'Cherif', prenom: 'Yanis', date_inscription: '05/01/2026', classe: '2eme' });

      // Amine suit les maths chez Karim ET Rachid ; Yanis seulement chez Karim.
      await api.setStudentMatieres({
        student_id: a.id,
        selections: [{ matiere_id: m.id, teacher_ids: [t1.id, t2.id] }],
        date_inscription: '15/01/2026'
      });
      await api.setStudentMatieres({
        student_id: b.id,
        selections: [{ matiere_id: m.id, teacher_ids: [t1.id] }],
        date_inscription: '05/01/2026'
      });

      // Amine est a jour chez Karim, rien chez Rachid.
      const MOIS_COURANT = moisCourant;
      for (let mois = 1; mois <= MOIS_COURANT; mois += 1) {
        await api.togglePayment({ student_id: a.id, matiere_id: m.id, teacher_id: t1.id, annee: A, mois, paye: true });
      }
      return { m: m.id, t1: t1.id, t2: t2.id, a: a.id, b: b.id };
    }, { moisCourant: MOIS_COURANT, annee: A });


    // ---- 1. Impayés : tous les mois ----
    const tousMois = await r(async function q(moisCourant) {
      const api = window.api;
      const l = async (o) => (await api.listStudents(Object.assign({ paiement_annee: 2026 }, o))).map((x) => x.nom);
      const MOIS_COURANT = moisCourant;
      return {
        sansPerimetre: await l({ statut: 'impaye' }),
        karim: await l({ statut: 'impaye', paiement_teacher: 1 }),
        rachid: await l({ statut: 'impaye', paiement_teacher: 2 }),
        payes: await l({ statut: 'paye', paiement_teacher: 1 }),
        moisPrecis: await l({ statut: 'impaye', paiement_mois: MOIS_COURANT, paiement_teacher: 1 })
      };
    }, MOIS_COURANT);

    ck('impayés sans mois : les deux élèves sortent', tousMois.sansPerimetre.length === 2, tousMois.sansPerimetre);
    ck('impayés chez Karim : Amine est à jour, absent', !tousMois.karim.includes('Bouzid'), tousMois.karim);
    ck('impayés chez Karim : Yanis présent', tousMois.karim.includes('Cherif'), tousMois.karim);
    ck('impayés chez Rachid : Amine présent', tousMois.rachid.includes('Bouzid'), tousMois.rachid);
    ck('impayés chez Rachid : Yanis absent (il ne suit pas ce cours)', !tousMois.rachid.includes('Cherif'), tousMois.rachid);
    ck('payés chez Karim : Amine présent', tousMois.payes.includes('Bouzid'), tousMois.payes);
    ck('payés chez Karim : Yanis absent', !tousMois.payes.includes('Cherif'), tousMois.payes);
    // Sur le mois courant, Yanis n'a rien réglé chez Karim : il doit sortir.
    ck(
      'mois précis impayé chez Karim : seul Yanis',
      tousMois.moisPrecis.length === 1 && tousMois.moisPrecis[0] === 'Cherif',
      tousMois.moisPrecis
    );

    // ---- 2. Élève en congé ----
    const cycle = await r(async function cycle() {
      const api = window.api;
      const actifs = () => api.listStudents({ actif: 1 });
      const tous = () => api.listStudents({ actif: 0 });
      const parts = () => api.listStudents({ actif: 2 });

      const avant = (await actifs()).length;
      await api.basculerEleveActif({ student_id: 1, actif: 0, motif: 'Déménagement' });
      const apres = (await actifs()).length;
      const listePartis = (await parts()).map((x) => x.nom);
      const tousCount = (await tous()).length;

      // L'historique doit avoir conservé le paiement passé.
      const detail = await api.getStudent(1);
      const paiements = await api.paiementsGrilleEleve({
        student_id: 1, matiere_id: 1, teacher_id: 1, annee: 2026
      });

      await api.basculerEleveActif({ student_id: 1, actif: 1 });
      const revenu = (await actifs()).length;
      const h = await api.historiqueEleve(1);

      const reset = await api.reinitialiserEleve({ student_id: 1, annee: 2026, scope: 'annee' });
      const apresReset = await api.paiementsGrilleEleve({
        student_id: 1, matiere_id: 1, teacher_id: 1, annee: 2026
      });

      return {
        avant, apres, revenu, listePartis, tousCount,
        actifApresSortie: detail.actif,
        motif: detail.motif_sortie,
        paiementsConserves: paiements ? paiements.mois.filter((m) => m.paye).length : 0,
        evenements: h.evenements.map((e) => e.evenement),
        resetSupprimees: reset.supprimees,
        payesApresReset: apresReset ? apresReset.mois.filter((m) => m.paye).length : -1
      };
    });

    ck('congé : un élève actif disparaît', cycle.avant === 2 && cycle.apres === 1, cycle);
    ck('congé : il apparaît dans « partis uniquement »', cycle.listePartis.includes('Bouzid'), cycle.listePartis);
    ck('congé : « tous » reste complet', cycle.tousCount === 2, cycle.tousCount);
    ck('congé : le motif est mémorisé', cycle.motif === 'Déménagement', cycle.motif);
    ck('congé : les paiements passés sont conservés', cycle.paiementsConserves > 0, cycle.paiementsConserves);
    ck('retour : il redevient actif', cycle.revenu === 2, cycle.revenu);
    ck('historique : departure et retour journalisés', cycle.evenements.includes('depart') && cycle.evenements.includes('retour'), cycle.evenements);
    ck('réinitialisation : des paiements supprimés', cycle.resetSupprimees > 0, cycle.resetSupprimees);
    ck('réinitialisation : plus aucun mois payé', cycle.payesApresReset === 0, cycle.payesApresReset);
  } catch (e) {
    p.push('EXCEPTION : ' + e.message + ' @ ' + String(e.stack || '').split('\n')[1]);
  }

  if (p.length) {
    console.error(`${p.length} ÉCHEC(S) :`);
    p.forEach((x) => console.error('  - ' + x));
    app.exit(1);
  } else {
    console.log('OK — impayés cumulatifs, congé / retour / réinitialisation validés.');
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