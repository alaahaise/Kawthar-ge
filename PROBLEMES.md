# Diagnostic — student-apporg (état du 23 septembre)

Référence mesurée en lançant l'application (`npx electron baseline.js`) :

```
pages        : accueil, inscription, etudiants, cartes, matieres
navigation   : accueil, inscription, etudiants, cartes, matieres
tableaux     : 2
entêtes triables   : 0
canvas graphiques  : 0
filtres (select)   : 1
boutons Excel      : 0
mention dollar     : OUI
bouton réinitialiser : absent
erreurs console    : aucune
```

Le code démarre proprement, sans erreur. Les manques sont fonctionnels, pas des pannes.

---

## 1. Le modèle de données bloque la moitié des demandes

C'est la cause racine. Tant que ceci n'est pas corrigé, rien du reste ne peut
être construit correctement.

| Problème | Conséquence |
|---|---|
| `student_matieres` a `UNIQUE(student_id, matiere_id)` | Un élève **ne peut pas** suivre la même matière avec deux professeurs. Or c'est précisément la demande : « si deux enseignants teachent la même matière, l'élève choisit le prof A, le prof B, ou les deux ». |
| Aucune table `paiements` | Les abonnements mensuels n'existent pas. Aucune grille, aucun impayé, aucun chiffre d'affaires. |
| `matiere_teachers` sans `prix_mensuel` | Un cours = matière + prof, mais sans prix propre. Chaque prof doit pouvoir avoir son tarif. |
| `teachers` : seulement `nom` + `telephone` | Demande « ID, prénom, nom pour les enseignants » non satisfaite. Pas de code, pas d'email, pas de spécialité. |
| `matieres` : seulement `nom` | Ni tarif par défaut, ni programme. |
| Aucune table `parametres` | Impossible de mémoriser l'année de travail (passage d'année automatique). |

## 2. Manques côté serveur (main.js)

- `students:list` ne gère que `search` et `classe`. Pas de filtre par nom,
  prénom, matière, enseignant ni plage de dates. **Aucun tri.**
- Pas de `students:classes`, ni de liste d'élèves par enseignant.
- Aucune requête de cours, de paiement, ni de statistiques de revenus.
- `students:update` ne sait pas retirer une photo : supprimer un élève laisse
  son fichier photo orphelin sur le disque.
- `teachers:delete` et `matiereTeachers:remove` font
  `UPDATE student_matieres SET teacher_id = NULL` : les élèves sont détachés
  silencieusement, sans prévenir l'administrateur.

## 3. Manques côté interface (src/)

- **Pas de page « Enseignants ».** Enseignants et matières sont mélangés sur
  une seule page — la demande est explicite : les séparer.
- **Pas de page « Paiements ».** Ni grille élève × 12 mois, ni suivi des
  impayés, ni relevé imprimable.
- **Aucun graphique** (0 canvas). Le tableau de bord est une liste de nombres.
  La demande : bar chart + pie chart (répartition par matière ou par prof).
- **Aucune colonne triable** (0 `th.sortable`).
- **Aucun import/export Excel**, aucun modèle.
- **Pas d'import en lot des photos** (par matricule ou par nom).
- **Pas d'écran de chargement** au lancement.
- Un symbole **dollar** est présent : il faut le dinar algérien.
- Page Étudiants : **un seul** filtre.

## 4. Défauts de code

- `escapeHtml()` (renderer.js) **n'échappe pas l'apostrophe `'`**. Tout
  attribut HTML entre apostrophes casse sur un nom comme « Lyes' ». C'est aussi
  une faille d'injection.
- `$$()` renvoie une `NodeList` : `.map()` et `.filter()` échouent dessus.

---

## Ordre de traitement proposé

1. Schéma + migrations (cours, prix par prof, paiements, année de travail)
2. Serveur : filtres/tri des élèves, cours, paiements, statistiques
3. Pages Enseignants et Matières séparées
4. Page Paiements (grille annuelle, impayés, relevé)
5. Tableau de bord (Chart.js : bar + pie, sélecteur professeur)
6. Tri par clic sur en-tête, filtre d'état payé/impayé
7. Excel (modèle, import avec aperçu, export)
8. Photos en lot, écran de chargement, dinar algérien
9. Données de démonstration

Chaque étape est un commit : rien n'est perdu si une étape casse.