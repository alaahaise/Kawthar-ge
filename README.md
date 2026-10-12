<<<<<<< HEAD
# Gestion des Étudiants — v1 (Inscription, Recherche, Cartes)

Application de bureau (Electron + SQLite) pour gérer les étudiants.

## Fonctionnalités de cette version
- Inscription d'un étudiant : matricule, nom, prénom, date de naissance, lieu de
  naissance, classe, téléphone, adresse, photo.
- Liste des étudiants avec recherche en temps réel (nom, prénom, matricule ou
  date de naissance).
- Modification et suppression d'un étudiant.
- Génération et impression d'une carte étudiant (format carte de crédit,
  85.6 x 54 mm) avec photo, nom, matricule, date de naissance et classe.

## Installation

Prérequis : Node.js (v18 ou plus récent) installé sur votre machine.

```bash
cd student-app
npm install
npm start
```

Le premier `npm install` télécharge Electron (~100-150 Mo), cela peut prendre
quelques minutes selon votre connexion.

## Stockage des données

- Base de données SQLite (via sql.js, pas de compilation native nécessaire) :
  stockée dans le dossier de données utilisateur de l'application
  (ex. `%APPDATA%/gestion-etudiants/students.db` sous Windows).
- Photos des étudiants : copiées dans un sous-dossier `photos/` du même
  emplacement.
- Vos données sont donc conservées entre les mises à jour de l'application et
  ne sont pas perdues si vous modifiez les fichiers du projet.

## Structure du projet

```
student-app/
├── package.json
├── main.js          # Processus principal Electron + base de données + IPC
├── preload.js        # Pont sécurisé entre l'interface et le processus principal
└── src/
    ├── index.html     # Structure de l'interface (sidebar + vues)
    ├── style.css       # Style (inspiré de l'organisation sidebar demandée)
    └── renderer.js     # Logique de l'interface (formulaire, recherche, cartes)
```

## Prochaines étapes possibles (à voir ensemble)

- Export de la liste en Excel/PDF.
- Filtres avancés (par classe, par plage de dates).
- Code-barres ou QR code sur la carte étudiant.
- Sauvegarde/restauration de la base de données.
=======
# Kawthar-ge
>>>>>>> 77a98369f1645cc96e16ae1d79ba3bd761525b8a
