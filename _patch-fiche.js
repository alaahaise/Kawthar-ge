const fs = require('fs');

const NL = String.fromCharCode(10);

// Remplace l'ancien openGrilleEleve (grille simple 12 mois) par le parcours
// complet eleve -> cours -> mois.
const lines = fs.readFileSync('src/renderer.js', 'utf8').split(/\r?\n/);

const debut = lines.findIndex((l) => l.includes('async function openGrilleEleve'));
let i = debut;
while (i > 0 && !lines[i].includes("Grille annuelle d'un élève")) i -= 1;
const debutBloc = i - 1; // ligne de separation "  // ====..."

const fin = lines.findIndex((l) => l.includes("btn-close-grille-eleve-2').addEventListener"));

if (debut < 0 || fin < 0 || fin <= debut) {
  console.error('bornes introuvables', debutBloc, debut, fin);
  process.exit(1);
}

const remplacement = fs.readFileSync('_fiche.js', 'utf8').replace(new RegExp(NL + '$'), '').split(NL);

// Le nouveau bloc contient deja les deux fermetures btn-close-grille-eleve :
// on saute donc le gestionnaire btn-close-grille-eleve-2 (3 lignes).
const out = lines
  .slice(0, debutBloc)
  .concat(remplacement)
  .concat(lines.slice(fin + 3));

fs.writeFileSync('src/renderer.js', out.join(NL), 'utf8');
fs.unlinkSync('_fiche.js');
console.log('remplace ' + (fin - debutBloc) + ' lignes par ' + remplacement.length + ' lignes');