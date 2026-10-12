/**
 * Test du modèle Excel : génération, export, relecture.
 *   npx electron excel-test.js
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const ExcelJS = require('exceljs');
const { app, BrowserWindow } = require('electron');

const tmpUserData = path.join(os.tmpdir(), 'gestion-excel-test-' + Date.now());
app.setPath('userData', tmpUserData);

require('./main.js');
const { waitForMainWindowReady } = require('./main.js');

app.whenReady().then(async () => {
  const echecs = [];
  const ck = (l, c, d) => {
    if (!c) echecs.push(l + (d !== undefined ? ' -> ' + JSON.stringify(d) : ''));
  };

  try {
        const win = await waitForMainWindowReady(30000);

    // On passe par l'API du renderer pour disposer du même référentiel
    // que l'import réel. La base de test est vide : on la remplit d'abord.
    const refs = await win.webContents.executeJavaScript(`(async () => {
      const api = window.api;
      const m = await api.addMatiere({ nom: 'Mathématiques', prix_mensuel: 2500 });
      const m2 = await api.addMatiere({ nom: 'Physique', prix_mensuel: 2000 });
      const t = await api.addTeacher({ prenom: 'Karim', nom: 'Benali' });
      await api.addMatiereTeacher({ matiere_id: m.id, teacher_id: t.id, prix_mensuel: 2500 });
      return {
        matieres: await api.listMatieres(),
        enseignants: await api.listTeachers()
      };
    })()`);
    ck('référentiel de test non vide', refs.matieres.length === 2 && refs.enseignants.length === 1, refs);

    // 1) Modèle
    const { buildTemplate, buildExport, parseImport } = require('./excel');
    const bufTemplate = await buildTemplate();
    ck('modèle non vide', Buffer.isBuffer(bufTemplate) && bufTemplate.length > 5000, bufTemplate.length);

    // Le modèle doit être relisible et contenir les colonnes attendues.
    const wbT = new ExcelJS.Workbook();
    await wbT.xlsx.load(bufTemplate);
    ck('modèle : feuille Élèves', !!wbT.getWorksheet('Élèves'), wbT.worksheets.map((w) => w.name));
    ck('modèle : feuille mode d\'emploi', !!wbT.getWorksheet("Mode d'emploi"));
    const entete = wbT.getWorksheet('Élèves').getRow(4).values;
    ck(
      'modèle : en-tête sans colonne ID',
      !entete.some((v) => /matricule/i.test(String(v || ''))),
      entete.filter(Boolean)
    );
    ck('modèle : bandeau El Kawther', String(wbT.getWorksheet('Élèves').getCell('A1').value || '').includes('EL KAWTHER'), wbT.getWorksheet('Élèves').getCell('A1').value);

    // 2) Feuille remplie à partir du modèle
    const m = refs.matieres[0];
    const p = refs.enseignants[0];
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(bufTemplate);
    const ws = wb.getWorksheet('Élèves');
    const colonnes = {};
    ws.getRow(4).eachCell((cell, c) => { colonnes[String(cell.value).replace(' *', '').trim()] = c; });

    const ecrire = (ligne, data) => {
      Object.entries(data).forEach(([k, v]) => {
        const c = colonnes[k];
        if (c) ws.getCell(ligne, c).value = v;
      });
    };
    ecrire(6, {
      Nom: 'Benali', Prénom: 'Karim', 'Date de naissance': '12/05/2008', Classe: '1ère Année',
      "Date d'inscription": '15/09/2026', Téléphone: '0555123456', 'Téléphone parent': '0666112233',
      Adresse: 'Sid Cheikh, Saida',
      'Matières (et enseignants)': `${m.nom} / ${p.prenom} ${p.nom}`,
      'Photo (nom du fichier)': 'karim benali.jpg'
    });
    // Ligne en erreur : matière inexistante.
    ecrire(7, { Nom: 'Zerrouki', Prénom: 'Lina', 'Matières (etCancer)': '', 'Matières (et enseignants)': 'Matterinexistante / BIDON' });
    // Ligne sans prénom : invalide.
    ecrire(8, { Nom: 'SansPrenom' });

    const bufRempli = await wb.xlsx.writeBuffer();
    const apercu = await parseImport(Buffer.from(bufRempli), {
      matieres: refs.matieres,
      enseignants: refs.enseignants.map((t) => ({ ...t, full_name: [t.prenom, t.nom].filter(Boolean).join(' ') }))
    });
    ck('lecture : pas d\'erreur globale', !apercu.erreur, apercu.erreur);
    ck('lecture : 3 lignes de données (hors exemple)', apercu.total === 3, apercu.total);
    ck('lecture : 1 ligne valide', apercu.valides === 1, apercu.valides);
    ck('lecture : 2 lignes en erreur', apercu.enErreur === 2, apercu.enErreur);

    // On cible la ligne réellement écrite (ligne 6), pas la ligne d'exemple
    // du modèle qui porte les mêmes noms.
    const bonne = apercu.lignes.find((l) => !l.exemple && l.nom === 'Benali');
    ck('nom lu', bonne && bonne.nom === 'Benali');
    ck('prénom lu', bonne && bonne.prenom === 'Karim');
    ck('date de naissance normalisée', bonne && bonne.date_naissance === '12/05/2008', bonne && bonne.date_naissance);
    ck('cours reconnu', bonne && bonne.cours.length === 1 && bonne.cours[0].matiere_id === m.id, bonne && bonne.cours);
    ck('enseignant du cours reconnu', bonne && bonne.cours[0].teacher_id === p.id, bonne && bonne.cours[0]);
    ck('photo lue', bonne && bonne.photo === 'karim benali.jpg', bonne && bonne.photo);

    const mauvaise = apercu.lignes.find((l) => l.nom === 'Zerrouki');
    ck('matière inconnue signalée', mauvaise && mauvaise.erreurs.some((e) => /Matière inconnue/.test(e)), mauvaise && mauvaise.erreurs);
    const sansPrenom = apercu.lignes.find((l) => l.nom === 'SansPrenom');
    ck('prénom manquant signalé', sansPrenom && sansPrenom.erreurs.some((e) => /Prénom manquant/.test(e)), sansPrenom && sansPrenom.erreurs);

    // La ligne d'exemple du modèle ne doit pas être proposée à l'import.
    ck('ligne d\'exemple détectée', apercu.lignes.filter((l) => l.exemple).length === 1, apercu.lignes.filter((l) => l.exemple).length);
    ck('ligne d\'exemple exclue du total', !apercu.lignes.some((l) => l.exemple && l.nom === 'Benali' && !l.exemple));

    // 3) Export
    const bufferExport = await buildExport([
      {
        matricule: '20260001', nom: 'Benali', prenom: 'Karim', date_naissance: '12/05/2008',
        classe: '1ère Année', date_inscription: '15/09/2026', telephone: '', telephone_parent: '',
        adresse: '', cours: [{ matiere_nom: m.nom, teacher_nom: p.nom }]
      }
    ]);
    ck('export non vide', Buffer.isBuffer(bufferExport) && bufferExport.length > 5000, bufferExport.length);
    const wbE = new ExcelJS.Workbook();
    await wbE.xlsx.load(bufferExport);
    const wsE = wbE.getWorksheet('Élèves');
    ck('export : bandeau', String(wsE.getCell('A1').value || '').includes('EL KAWTHER'));
    const ligne5 = wsE.getRow(5).values;
    ck('export : matricule présent', ligne5.some((v) => v === '20260001'), ligne5.filter(Boolean));
    ck('export : cours formaté', ligne5.some((v) => String(v).includes(m.nom) && String(v).includes('/')), ligne5.filter(Boolean));
    ck('export : total', String(wsE.getCell(7, 1).value || '').includes('1 élève'), wsE.getCell(7, 1).value);
  } catch (e) {
    echecs.push('EXCEPTION : ' + e.message + ' @ ' + String(e.stack || '').split('\n')[1]);
  }

  if (echecs.length) {
    console.error(`${echecs.length} ÉCHEC(S) :`);
    echecs.forEach((x) => console.error('  - ' + x));
    app.exit(1);
  } else {
    console.log('OK — modèle Excel validé.');
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

