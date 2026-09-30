# La course au Trône de fer

Site de consultation du pool **Keven2026**, identifiant Marqueur **219062**. Interface React/Vite en TypeScript et HTML/CSS, serveur Node/Express en TypeScript. Aucun compte utilisateur.

## Démarrage sur cet ordinateur

Node.js est déjà installé. Depuis le dossier `G:\Mon disque\PROG\POOL`, lancer :

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\lancer.ps1
```

Ouvrir **http://localhost:5173**. Garder le terminal ouvert ; `Ctrl+C` arrête le site.

Le lanceur copie les sources dans `%LOCALAPPDATA%\Keven2026-site` et y installe les dépendances. Cette disposition évite les erreurs de `node_modules` sur le disque virtuel Google Drive. Les sources à modifier restent dans `G:\Mon disque\PROG\POOL` ; relancer le script après les modifications pour les recopier. Le cache persiste dans le dossier local entre les démarrages. Les ports utilisés sont 5173 pour Vite et 3001 pour le serveur.

Dans un dossier situé sur un disque local classique, le démarrage habituel fonctionne :

```sh
npm ci
npm run dev
```

## Ce qui fonctionne avec Marqueur

- Classement cumulatif des sept participants, points du pool, ordre et écart fourni par Marqueur ; meneur et éventuelles égalités mis en valeur.
- Liens des formations extraits du classement, jamais inventés. Orthographe des pseudonymes conservée depuis le titre des liens Marqueur, sans affichage des noms civils.
- Sept formations de 24 sélections à la validation initiale : joueurs, gardiens et équipes. Statistiques disponibles, choix de repêchage et statut lorsqu’il est indiqué.
- Points de chaque sélection extraits de la colonne **TOT** ; totaux de chaque catégorie et sommaire conservés. Aucun calcul à partir des simples points de la LNH. Les points du pool sont la première colonne numérique sur téléphone.
- Navigation clavier, onglets avec flèches, lien d’évitement, prise en compte des mouvements réduits, polices locales et ornements SVG originaux. Aucune image officielle de la série.

Les pages publiques ont été testées par HTTP depuis Node sans cookies ni connexion le **30 septembre 2026**. Aucune API officielle n’est utilisée. Leur disponibilité et leur format peuvent évoluer.

Le tableau `standing_01.php` a été récupéré, mais son sous-titre indique **TOTAL**, sans date identifiable. **Les batailles du jour restent indisponibles**, avec une explication visible. L’extracteur exige une date calendaire explicite correspondant au jour courant à Montréal avant de publier ces résultats. Aucune donnée n’est présentée comme étant en direct.

## Synchronisation et cache

Copier `.env.example` vers `.env` pour changer la configuration. Le lanceur copie aussi ce fichier dans le dossier local.

| Paramètre | Valeur par défaut | Effet |
| --- | --- | --- |
| `SYNC_INTERVAL_MINUTES` | 15 | Intervalle partagé ; minimum 5 minutes |
| `STALE_AFTER_MINUTES` | 45 | Délai avant l’avertissement « Données anciennes » |
| `REQUEST_TIMEOUT_SECONDS` | 15 | Limite d’attente par requête Marqueur |
| `PORT` | 3001 | Port du serveur |
| `CACHE_FILE` | `.cache/marqueur.json` | Cache persistant |

Chaque cycle effectue une requête de classement, sept requêtes de formation en séquence, puis une requête quotidienne. Les visiteurs lisent le même cache mémoire ; les demandes concurrentes sont regroupées et le bouton « Vérifier les nouvelles » respecte l’intervalle partagé. Un redémarrage recharge le cache et respecte aussi le délai depuis sa dernière récupération réussie.

Le classement et les sept formations sont publiés **ensemble**, après validation : sept identités uniques, colonnes reconnues, liens restreints à Marqueur et à ce pool, saison et participant correspondants, ordre, écarts et totaux par catégorie cohérents. Une cellule vide inattendue est refusée ; le tiret utilisé par Marqueur représente zéro. Une incohérence transitoire entre le classement et une formation reporte la mise à jour au cycle suivant.

Une panne, une redirection vers une connexion, une protection d’accès, un changement de format ou un échec d’écriture ne remplace pas le cache valide. L’enregistrement utilise un fichier temporaire puis un renommage. Le dernier résultat reste disponible avec son horodatage et l’erreur. Sans cache valide, le site affiche un état indisponible ; il n’invente pas de résultats. Un résultat quotidien validé précédemment reste conservé si sa récupération ultérieure échoue, avec sa date et un avertissement.

Les captures dans `tests/fixtures` sont des **données de test datées**, distinctes du cache et jamais servies par l’application.

## Vérifications

Dans le dossier local d’exécution, ou dans une copie locale du projet :

```sh
npm test
npx playwright install chromium
npm run test:ui
npm run build
```

Les tests couvrent l’extraction des tableaux réels capturés, les sept totaux, les points spécifiques des gardiens, les liens inattendus, les dates quotidiennes, les pannes et délais HTTP, la conservation/relecture du cache, les appels concurrents, les états indisponibles et anciens, la navigation et l’absence de débordement à 320, 390, 768 et 1440 pixels. Les contrôles d’accessibilité automatisés complètent les captures vérifiées visuellement. Les captures de tests sont enregistrées dans `test-results` du dossier local.

## Mise en ligne ultérieure

Sur un hébergeur avec **Node.js 22.12+**, installer aussi les dépendances de développement (TypeScript et `tsx` sont utilisés), puis :

```sh
npm ci
npm run build
npm start
```

Le serveur sert alors l’interface compilée et l’API sur le même port. Prévoir un domaine, HTTPS via l’hébergeur/proxy, un processus Node permanent et un volume persistant pour `CACHE_FILE`. Tester les pages Marqueur depuis l’hébergeur choisi avant publication ; certains réseaux peuvent être refusés. Si une protection bloque la récupération, ne pas la contourner : conserver le cache ou afficher l’indisponibilité.

Cette version partage son cache au sein d’**un seul processus serveur**. Pour plusieurs instances, prévoir un cache central et une tâche de synchronisation unique avant de les multiplier. Aucun déploiement public n’a été effectué.
