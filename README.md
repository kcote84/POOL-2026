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
- Parties jouées (**PJ**) et moyenne de points du pool par partie (**MOY**) fournis par Marqueur. PJ correspond au cumul des matchs des sélections, pas au nombre de journées. Sur téléphone, ces valeurs sont visibles sous chaque participant sans défilement horizontal. Les catégories joueurs/gardiens/équipes peuvent être comparées dans « Répartition des points ».
- Liens des formations extraits du classement, jamais inventés. Orthographe des pseudonymes conservée depuis le titre des liens Marqueur. Les prénoms et noms abrégés fournis par les participants apparaissent sous les personnages.
- Sept formations de 24 sélections à la validation initiale : joueurs, gardiens et équipes. Statistiques disponibles, choix de repêchage et statut lorsqu’il est indiqué.
- Recherche par nom ou équipe, tri par points, moyenne ou matchs joués. Les totaux de chaque colonne sont extraits de Marqueur ; ils restent ceux de la catégorie complète pendant une recherche. Un sommaire présente PJ, moyenne et points par catégorie. « Ma maison » mémorise une formation favorite dans ce navigateur, sans compte.
- Points de chaque sélection extraits de la colonne **TOT** ; totaux de chaque catégorie et sommaire conservés. Aucun calcul à partir des simples points de la LNH. Les points du pool sont la première colonne numérique sur téléphone.
- Navigation clavier, onglets avec flèches, lien d’évitement, prise en compte des mouvements réduits, polices locales et ornements SVG originaux. Portraits des personnages en avatars circulaires, avec un petit blason ; sources dans `public/avatars/SOURCES.md`.

Personnages et participants : Sir Jorah → Martin C., Podrick Payne → Martin L, Lord Baelish → Jean-Pascal, Ned Stark → Steve, Sandor Cleagan → Alexandre, Greyworm → Kev, Bronn → Gabriel. À la demande du groupe, **Ned Stark garde son nom mais utilise le portrait d’Arya Stark**. Cette présentation est définie dans `src/participants.ts` et ne modifie pas les données Marqueur.

L’ouverture présente une illustration de Drogon, avec un souffle de feu et des braises animés par canvas. Elle dure environ 4,6 secondes après le chargement de l’image, une seule fois par session, sans son. Le bouton « Entrer dans le royaume » et Échap permettent de passer l’introduction. Elle est désactivée automatiquement avec les mouvements réduits ; le site charge ses données en parallèle. Une erreur d’image ou un chargement trop lent ferme l’introduction. « Revoir le dragon » se trouve en pied de page. L’illustration générée, son prompt et ses détails sont documentés dans `public/DRAGON.md`.

## Correction des points des Panthers — 30 septembre 2026

La capture publique de Marqueur de 09:55 UTC présentait pour Florida dans la formation de Sir Jorah : **PJ = 1, V = 1, VP = 1, TOT = 4**. Le site reprenait ce TOT. La capture de 21:01 UTC et l’instantané public consulté lors de l’enquête indiquent **PJ = 1, V = 0, VP = 1, TOT = 2**. Le barème et le lien de formation utilisent toujours le paramètre `p=257924`. L’écart constaté provenait donc de l’ancienne donnée source, qui comptait la même partie dans deux types de victoires.

L’extracteur refuse désormais une ligne de gardien ou d’équipe dont les victoires/défaites détaillées dépassent les parties jouées, ainsi qu’un paramètre de formation différent du lien du classement. Le dernier résultat valide est conservé lors du rejet. Il ne divise jamais les points par deux et ne remplace pas les totaux calculés par Marqueur. Des tests distincts utilisent la capture corrigée et l’ancienne capture incohérente ; aucune fixture n’est publiée comme résultat actuel. La date de récupération et les avertissements sont désormais placés en haut des pages.

Les pages publiques ont été testées par HTTP depuis Node sans cookies ni connexion le **30 septembre 2026**. Aucune API officielle n’est utilisée. Leur disponibilité et leur format peuvent évoluer.

Le tableau `standing_01.php` indique **TOTAL**, sans date identifiable. La section « Batailles du jour » et son lien ont été retirés : aucun résultat quotidien fiable ne pouvait être affiché. Les anciens liens vers `/batailles` redirigent vers le classement. L’extracteur conserve sa validation stricte des dates pour la compatibilité des instantanés existants.

## Synchronisation et cache

Vérification du 5 octobre 2026 à 5 h 57 (Québec) : le site publié affichait encore le relevé du 4 octobre à 11 h 22. Une lecture publique du classement et des sept formations Marqueur confirme les totaux suivants : Sir Jorah 59, Lord Baelish 56, Greyworm 52, Sandor Cleagan 50, Bronn 48, Ned Stark 42 et Podrick Payne 39. Les sommes des sélections, les catégories et les totaux concordent ; l’écart observé provient de la date du relevé publié, sans erreur de calcul reproduite. Les valeurs de cette vérification sont historiques, jamais utilisées comme données de production.

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

## Publication sur GitHub Pages

Adresse : **https://kcote84.github.io/POOL-2026/**.

La configuration Pages doit utiliser **GitHub Actions**, et non publier les sources de `main` directement. Le workflow `.github/workflows/pages.yml` installe les dépendances, vérifie les extracteurs, récupère les résultats dans Node côté serveur, compile Vite avec le préfixe `/POOL-2026/`, puis publie uniquement `dist`.

Les formations utilisent des liens tels que `/POOL-2026/#/formation/1252751` : l’actualisation d’une page de formation fonctionne sans règle de réécriture côté hébergeur. Les polices, ornements et fichiers JSON utilisent tous le préfixe du dépôt. Aucun navigateur ne contacte directement Marqueur.

La récupération est planifiée chaque jour à **5 h, heure du Québec** (`America/Toronto`, changement d’heure inclus), avec une tentative de secours à **6 h**. Le secours ne consulte pas Marqueur si un relevé validé depuis 5 h existe déjà. Les publications sur push et les lancements manuels forcent une récupération. GitHub peut retarder les tâches ; l’horodatage affiché reste celui de la récupération réellement réussie. La fraîcheur est recalculée côté navigateur : après 7 h, un relevé antérieur à 5 h ce jour-là est signalé comme ancien. Avant cette échéance, le relevé du matin précédent reste acceptable. Le bouton « Actualiser l’affichage » relit uniquement les fichiers publiés. Vérifier l’onglet **Actions → Publier le royaume** pour les journaux et pour lancer manuellement un cycle. GitHub peut désactiver les tâches planifiées d’un dépôt public après une longue période d’inactivité ; les réactiver dans Actions si nécessaire.

Une récupération échouée conserve et publie le dernier cache, puis marque le workflow en échec. Le résumé Actions indique le résultat et la date réelle. Les notifications d’échec dépendent des préférences de notification GitHub du compte ; aucun courriel externe n’est configuré.

Le dernier cache valide est conservé entre les tâches. Si le cache du runner a disparu, le workflow tente aussi de restaurer l’instantané déjà publié. Un échec Marqueur conserve les sept formations et leur date ; sans résultat valide, le site affiche explicitement l’indisponibilité. Les fichiers dans `public/data` sont générés à la publication et exclus des sources Git.

Pour compiler ce mode localement :

```sh
npm run sync:pages
npm run build:pages
npx vite preview --mode pages
```

Ouvrir `http://localhost:4173/POOL-2026/`. Ces commandes utilisent le cache réel ; les fixtures restent réservées aux tests.

## Autre hébergement avec un serveur Node

Sur un hébergeur avec **Node.js 22.12+**, installer aussi les dépendances de développement (TypeScript et `tsx` sont utilisés), puis :

```sh
npm ci
npm run build
npm start
```

Le serveur sert alors l’interface compilée et l’API sur le même port. Prévoir un domaine, HTTPS via l’hébergeur/proxy, un processus Node permanent et un volume persistant pour `CACHE_FILE`. Tester les pages Marqueur depuis l’hébergeur choisi avant publication ; certains réseaux peuvent être refusés. Si une protection bloque la récupération, ne pas la contourner : conserver le cache ou afficher l’indisponibilité.

Ce mode partage son cache au sein d’**un seul processus serveur**. Pour plusieurs instances, prévoir un cache central et une tâche de synchronisation unique avant de les multiplier.

## Historique et explication du pointage

« Historique du classement » conserve le dernier relevé validé de chaque journée à Montréal, avec les rangs, points et variations entre relevés. Le suivi commence au premier instantané disponible : aucune journée passée n’est inventée. Il garde jusqu’à 400 journées de la même saison et repart à la saison suivante. Une variation négative peut représenter une correction de Marqueur.

L’historique fait partie du même instantané atomique que les formations. Il persiste dans `.cache/marqueur.json`, est exporté vers `public/data/history.json` et peut être restauré depuis l’instantané publié si le cache du runner a été évincé. Les anciens instantanés sont migrés à partir de leur date réelle de récupération. Une panne ne remplace ni les scores ni l’historique validés.

« Comprendre les points et le barème » explique TOT, PJ, MOY, les types de victoires et les bonus. Ses exemples affichent les statistiques et points des formations récupérées, avec un lien vers chaque source. Les coefficients non accessibles publiquement ne sont pas inventés ; les paramètres officiels restent administrés sur Marqueur.

Le workflow vérifie aussi les parcours Playwright et l’accessibilité sur un push ou une publication manuelle. Les cycles planifiés conservent les contrôles de données et la compilation, sans réinstaller Chromium à chaque récupération.
