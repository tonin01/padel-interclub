# Padel Interclub

PWA installable pour piloter les compositions, disponibilités, scores et trajets de l'équipe pendant le tournoi interclub (5 journées).

Architecture : PWA statique (GitHub Pages) + backend Google Apps Script + Google Sheets comme base de données. Synchronisation multi-appareils avec stratégie **cloud toujours gagnant**.

## A. Créer le Google Sheet + le backend

1. Va sur [sheets.new](https://sheets.new) et renomme le classeur, par exemple « Padel Interclub 2026 ».
2. Menu **Extensions → Apps Script**.
3. Supprime le contenu par défaut de `Code.gs` et colle-y l'intégralité du fichier [`apps-script/Code.gs`](apps-script/Code.gs) de ce repo.
4. Dans la barre d'outils de l'éditeur, sélectionne la fonction **`initializeSheets`** dans le menu déroulant puis clique sur **Exécuter** (▶). Autorise les permissions demandées (c'est ton propre script, sur ton propre Sheet).
   - Cette étape crée automatiquement les 5 onglets (`Joueurs`, `Journées`, `Rotations`, `Matchs`, `Disponibilités`) avec les bons en-têtes et les données de démarrage (9 joueurs, 5 journées).
5. **Déployer → Nouveau déploiement**.
   - Type : **Application Web**.
   - Exécuter en tant que : **Moi**.
   - Qui a accès : **Tout le monde**.
   - Clique sur **Déployer**, autorise à nouveau si demandé.
6. Copie l'URL qui se termine par `/exec` — c'est l'URL à coller dans l'app (écran Réglages).

> Pour mettre à jour le backend plus tard (nouvelle version de `Code.gs`), modifie le code puis **Déployer → Gérer les déploiements → ✏️ → Nouvelle version → Déployer**. L'URL `/exec` reste la même.

## B. Héberger l'app sur GitHub Pages

Depuis ce dossier (`~/padel-interclub`) :

```bash
git init
git add .
git commit -m "Initial commit — Padel Interclub PWA"
```

Puis sur [github.com/new](https://github.com/new), crée un repo (par exemple `padel-interclub`), **sans** README/gitignore (déjà présents ici). Ensuite :

```bash
git remote add origin https://github.com/<ton-compte>/padel-interclub.git
git branch -M main
git push -u origin main
```

Sur GitHub : **Settings → Pages → Source : Deploy from a branch → Branch : `main` / `(root)` → Save**.

L'app sera disponible après quelques minutes sur `https://<ton-compte>.github.io/padel-interclub/`.

## C. Connecter l'app au Google Sheet

1. Ouvre l'URL GitHub Pages sur ton mobile.
2. Choisis ton nom dans la fenêtre d'identification.
3. Va dans l'onglet **Réglages**, colle l'URL Apps Script `/exec` obtenue à l'étape A.6, puis **Enregistrer l'URL**.
4. **Synchroniser maintenant** pour vérifier que ça fonctionne (le point de statut passe au vert).
5. Ajoute l'app à l'écran d'accueil :
   - **iOS/Safari** : bouton Partager → *Sur l'écran d'accueil*.
   - **Android/Chrome** : menu ⋮ → *Ajouter à l'écran d'accueil*.
6. Répète les étapes 1 à 5 sur les appareils des autres joueurs de l'équipe (même URL Apps Script pour tout le monde).

## D. Renseigner les adresses des clubs

Pas besoin de retoucher au code : ouvre le Google Sheet, onglet **Journées**, et remplis la colonne **Club / Adresse** pour chaque journée. L'app la récupère automatiquement au pull suivant (rechargement de l'app, ou bouton *Synchroniser maintenant*).

## Notes

- **Contrainte de niveau** : la somme des niveaux des 4 joueurs d'une rotation est plafonnée à 900 ; le bouton d'enregistrement de la rotation est désactivé au-delà.
- **Hors-ligne** : les écritures faites sans réseau sont mises en file et envoyées automatiquement au retour de la connexion.
- **Conflits** : en cas de divergence entre deux appareils, la donnée du Google Sheet fait toujours foi lors d'une synchronisation.
- Le dossier `apps-script/` n'est pas déployé sur GitHub Pages, il sert uniquement de copie de référence du backend — c'est bien la copie collée dans l'éditeur Apps Script du Sheet qui s'exécute.
