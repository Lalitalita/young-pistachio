# Où on en est — Cyber Parcours

Pour reprendre le travail chez toi avec Claude Code (même branche `claude/cyber-parcours-workshop-b5qnnh`,
ou en continuation de cette conversation si tu la retrouves). Lis ce fichier en entier avant de redémarrer :
il contient le récap, les décisions prises en cours de route, et le prompt original tout en bas pour
redonner tout le contexte à Claude si besoin.

## Commandes pour reprendre

```bash
cd ~/github/cyber-parcours   # ou où tu l'as cloné
git pull
docker compose up -d --build
```

- Mobile : `http://<IP-du-PC>/`
- Écran : `http://<IP-du-PC>/screen`
- Admin : `http://<IP-du-PC>/admin` (mot de passe = `ADMIN_PASSWORD` du `.env`)

## Ce qui est fait (commits, dans l'ordre)

1. **`f0aba0d` — Étape 0 : squelette.** `docker compose` (app, pihole, chaos-agent squelette,
   demo-web/db/api), Dockerfile multi-stage (front buildé par Node, servi par l'image Python),
   `.env.example`, `cyber.sh` / `Makefile`, CI GitHub Actions (Vitest, pytest, build Docker),
   logo Coda et couleurs de la charte (jaune `#ddf849`, violet `#6425f5`/`#4b00eb`, fond
   `#0a0a1f`) extraits de coda.school et embarqués en local.

2. **`3952ab0` — Étape 1 : socle.** FastAPI + WebSocket (un seul process uvicorn, SQLite WAL),
   sessions visiteur par cookie signé, pseudos aléatoires accordés en genre, état de l'événement
   serveur-autoritaire (mode libre/guidé, ordre et activation des phases, paramètres par phase
   générés depuis un schéma), hub de diffusion WebSocket (visiteur/écran/admin) avec
   resynchronisation automatique à la connexion, admin protégé (rate limiting, CSRF via
   SameSite), grand écran avec veille animée + QR codes (Wi-Fi + parcours), générateur de QR
   SVG côté serveur, bots de démo, contenus/charte modifiables, logo personnalisable, export CSV
   anonyme, reset de fin de journée.

3. **`654b999` — Corrections suite à tes retours.** Un visiteur peut revenir en arrière
   (« Étape précédente », « Recommencer », jamais de saut en avant) ; l'admin peut replacer
   n'importe quel visiteur (ou tout le monde) sur n'importe quelle étape ; refonte du CSS du
   grand écran avec une unité `--u = min(1vw, 1.7778vh)` pour que **rien ne déborde jamais**,
   quel que soit le ratio de l'écran (vérifié sur 8 tailles, 16:9 à portrait).

4. **`196b247` — Étape 2 : Phase 0 + contenus.** Accueil (pseudo, encart vie privée, case
   opt-in « voir mes propres requêtes »), tous les textes dans `content/texts.json` (version
   *curieuse* et *expert*) et `content/glossary.json` (infobulles), surchargeables en direct
   depuis l'onglet admin **Textes** (visible immédiatement sur les téléphones, sans recharger).
   Bascule Curieux/Expert mémorisée par appareil. Préchargement des phases suivantes en tâche
   de fond pendant l'intro.

5. **`28c2758` — Étape 3 : Phase 1 jouable** (« Ton mot de passe tient combien de temps ? »).
   Fiche personnage fictive persistée par visiteur (`backend/app/characters.py`,
   `content/characters.json`). Analyse de robustesse **100% côté téléphone**
   (`frontend/src/phases/p1/` : zxcvbn-ts + dictionnaires FR chargés en tâche de fond, plus une
   couche « maison » testée unitairement : infos de la fiche, dates sous toutes leurs formes,
   années 1950→aujourd'hui, suites clavier AZERTY/QWERTY, leet speak, répétitions, schéma
   « Majuscule+mot+année+! », mots courants). Trois profils d'attaquant (en ligne limité, hors
   ligne hash rapide, ferme de GPU). Grand écran : thermomètre géant avec la cible, record du
   jour, top des pièges, flux en direct (jamais le mot de passe).

   **⚠️ Décision prise en cours de route, qui s'écarte du prompt original ci-dessous** : le
   mot de passe du personnage **est envoyé au serveur et conservé** (1h par défaut, réglable
   5–240 min dans l'admin → Phase 1 → Réglages), au lieu de ne jamais quitter le téléphone.
   Objectif : pouvoir retrouver le résultat d'un visiteur qui revient (`GET
   /api/admin/phase1/lookup?q=<pseudo>`, utilisable tant que ce n'est pas purgé). Purge
   automatique toutes les 90 s. Jamais affiché sur le grand écran, jamais dans l'export CSV
   (qui reste anonyme). **Le texte affiché au visiteur (phase 1, encart « ⚠️ Important ») le dit
   explicitement et déconseille d'utiliser un vrai mot de passe** — c'est la condition posée
   avant d'implémenter ce changement, à ne pas retirer si tu modifies ces textes.

### État des tests (au dernier commit)
- Backend : 60 tests pytest (`cd backend && pytest -q`, ou `./cyber.sh test`).
- Front : 91 tests Vitest (`cd frontend && npm test`).
- Build front vérifié, CI GitHub Actions en place (pas pu être exécutée dans cet environnement
  cloud, faute de démon Docker — à vérifier chez toi que les 3 jobs passent bien).

## Ce qu'il reste à faire (reprend l'ordre du prompt original)

- **Étape 4 — Phase 3 : « Panne en prod ! »** Mini-entreprise de démo (déjà dans le compose :
  `demo-web`, `demo-db`, `demo-api`, à étoffer), tableau de supervision sur le grand écran, le
  Raspberry Pi comme « serveur physique » avec un vrai ping (repli TCP si ICMP filtré),
  incidents individuels tirés au hasard sur chaque téléphone, moment « boss » (vraie panne,
  file d'attente + cooldown, vote), **`chaos-agent`** à compléter (allowlist stricte,
  stop/start uniquement, jeton partagé, rate limiting — le squelette existe déjà dans
  `chaos-agent/`, réseau interne sans port publié). Rappel sécurité : jamais le socket Docker
  dans l'app web.

- **Étape 5 — Phase 2 : « Ton téléphone parle à qui ? »** API Pi-hole v6 (session `sid`,
  `/api/queries`, `/api/dns/blocking`), regroupement des requêtes par entreprise/catégorie,
  grand écran avec bulles animées (stats globales anonymes uniquement, jamais IP ↔ domaine),
  bascule avant/après blocage dans l'admin, purge auto après 15 min, mode simulé si Pi-hole
  injoignable, détection « aucune requête vue » avec la consigne DNS privé/relais iCloud.

- **Étape 6 — Phase 4 (escape game, optionnelle) + écran de fin.** Trois niveaux (phishing,
  logs d'authentification, mini-CTF sur `demo-web`), chrono, indices payants, classement.
  Écran de fin : récap, score, badge, formations (déjà dans `content/branding.json`), « Atelier
  suivant ».

- **Étape 7 — Finitions.** README complet avec la configuration réseau détaillée (IP fixe/
  réservation DHCP sur la box, DNS primaire = secondaire = IP du PC, désactiver le DNS proxy de
  la box, enregistrement Pi-hole `parcours.cyber`), checklist du jour J, test de charge à 60
  bots (le mode démo existe déjà, pousser `count` à 60 et observer).

- **Transverse, à garder en tête sur toutes les phases restantes** : plus de réglages
  d'admin par jeu (le formulaire se génère automatiquement depuis le schéma Python de chaque
  phase dans `backend/app/phases.py` — c'est le point le plus rapide à étoffer, tu l'avais
  demandé il y a deux étapes).

## Repères dans le code

- `backend/app/phases.py` : manifeste des phases (titre, schéma de réglages admin).
- `backend/app/hub.py` : état temps réel, diffusion WebSocket, `public_state()`.
- `frontend/src/phases/<id>/{Mobile,Screen}.tsx` : composants d'une phase (chargement
  paresseux, déclarés dans `frontend/src/phases/registry.ts`).
- `content/*.json` : textes, glossaire, personnages, charte — valeurs par défaut, surchargeables
  en base depuis l'admin.
- `docker-compose.yml`, `Dockerfile`, `cyber.sh` : infra, à ajuster surtout pour le Pi et
  Pi-hole aux étapes 4/5.

---

## Prompt original (donné au tout début du projet)

> # Projet « Cyber Parcours » : atelier interactif pour la JPO de Coda Avignon (12 décembre 2026)
>
> ## Mission
> Construis ce projet **dans un dépôt GitHub** (nom suggéré : `cyber-parcours`), phase par phase, avec des commits propres (un par étape, messages en français ou anglais cohérents). Le dépôt doit être **utilisable uniquement avec les commandes du README** : cloner, configurer `.env`, lancer, mettre à jour. Je ne dois jamais avoir à installer Node/Python à la main sur le PC : tout se build dans Docker.
>
> À chaque étape terminée : résume ce qui marche, dis-moi **exactement quoi tester** (téléphone, écran, admin), puis attends mon retour avant l'étape suivante.
>
> ## Contexte
> Je suis en Bachelor (admin sys/réseau, cybersécurité) et je tiens un atelier à la journée portes ouvertes de **Coda, campus d'Avignon**, le **samedi 12 décembre 2026, 14h-17h, 13 avenue de la Foire**. Public de tous niveaux (lycéens, parents, BTS). La dernière fois, une démo d'infra d'entreprise (AD, GLPI, Zabbix) a perdu une partie du public : cette fois, une expérience **interactive, ludique, immersive** (« déjà fini ?? »).
>
> Principe : le visiteur scanne un **QR code**, suit un **parcours guidé sur son téléphone** ; un **grand écran** affiche en direct stats, animations et classements ; j'ai un **panel admin**.
>
> ## Matériel et réseau (décisions prises)
> - Mon PC Linux (Docker + compose) héberge tout. Un switch, une box 5G, un Raspberry Pi, un grand écran branché sur le PC (résolution inconnue : l'écran doit **s'adapter** à toute taille, unités relatives `vw`/`clamp`, et rester testable sur une simple fenêtre de PC).
> - **Le Wi-Fi visiteurs est celui de la box 5G.** Le **DHCP reste sur la box**, qui distribue l'**IP du PC comme DNS primaire ET secondaire**. **Pi-hole (Docker, sur le PC) ne fait que le DNS.** La box sert aussi de sortie Internet.
> - Le Raspberry Pi est branché au switch comme « serveur physique » supervisé (vrai ping). Le débrancher n'affecte pas le Wi-Fi.
> - Documente dans le README (une seule option réseau, détaillée) : IP fixe / réservation DHCP du PC dans la box, DNS primaire = secondaire = PC, désactiver tout « DNS proxy » de la box (sinon Pi-hole voit l'IP de la box et non celle des téléphones), enregistrement DNS local Pi-hole (ex. `parcours.cyber` → IP du PC, avec l'IP en secours). Consigne visiteurs pour contourner le **DNS privé Android / iCloud Private Relay / DoH** (qui évitent Pi-hole) et détection « aucune requête vue de ton appareil ».
> - L'IP réelle des téléphones doit être conservée jusqu'à l'app (vérifier `network_mode: host` ou bridge avec IP source préservée).
>
> ## Stack
> - Back : **FastAPI + WebSocket** (un seul process uvicorn, hub en mémoire, canaux visiteur/écran/admin), **SQLite en WAL**.
> - Front : **React + TypeScript + Vite**, mobile-first, trois routes (`/`, `/screen`, `/admin`) avec chargement paresseux.
> - **Un seul `docker compose`** : `app` (sert aussi le front buildé, Dockerfile multi-stage), `pihole`, `chaos-agent`, services de démo (`demo-web` nginx, `demo-db`, `demo-api`).
> - **Aucune dépendance CDN** : polices, icônes, dictionnaires, tout en local. Doit marcher si la 5G rame.
> - Config via `.env` (mdp admin, IP du PC, SSID, mot de passe Wi-Fi, mdp Pi-hole, IP du Pi…) avec `.env.example` commenté.
> - Textes en **français**, tout le contenu éditable (`content/*.json` + surcharge depuis l'admin stockée en base).
> - Architecture : **phases en plugins** (manifeste : id, titre, schéma de paramètres, composant mobile, composant écran). L'admin génère ses formulaires depuis le schéma. État de l'événement serveur-autoritaire, rediffusé en WebSocket ; **reconnexion automatique avec backoff** ; resynchronisation à la reconnexion. Cible : 50+ visiteurs simultanés.
>
> ## Commandes obligatoires dans le README
> Fournis un petit `Makefile` ou script `./cyber.sh` ET les commandes docker brutes :
> - Installation : `git clone … && cd … && cp .env.example .env` (puis éditer) `&& docker compose up -d --build`
> - **Mise à jour** : `git pull && docker compose up -d --build`
> - Logs, arrêt, reset de fin de journée, lancement du mode kiosk du grand écran (Chromium plein écran sur `/screen`).
> - Une **CI GitHub Actions** qui lance les tests (Vitest pour l'algo, pytest pour le back) et vérifie le build.
>
> ## Les 3 interfaces
>
> ### 1. Parcours mobile (`/`)
> - Pas de compte. **Pseudo aléatoire fun** (ex. « Renard Quantique »), relançable ; session en cookie HttpOnly.
> - Barre de progression, transitions animées, gros boutons, lisible sur de vieux téléphones.
> - Chaque étape : toggle **« Mode curieux / Mode expert »** (explication simple par défaut ; termes techniques, commandes, chiffres en expert).
> - **Glossaire en infobulles** pour tous les mots techniques.
>
> ### 2. Grand écran (`/screen`)
> - Plein écran, animé, lisible de loin, **adaptatif**.
> - Suit la phase active choisie dans l'admin (ou rotation automatique).
> - **Mode veille / attract** sans activité : boucle animée + **QR code en grand** (et infos de la JPO).
> - Compteur de visiteurs de la journée.
>
> ### 3. Admin (`/admin`, protégé par mot de passe)
> - Mode de progression : **libre** ou **guidé** (j'ouvre les étapes pour tout le monde).
> - Activer / désactiver / réordonner les phases ; choisir l'affichage du grand écran.
> - Paramètres par phase (objectif en années du mot de passe, blocage Pi-hole on/off, déclencher une panne…).
> - Visiteurs connectés en direct et leur étape.
> - Modération : masquer / renommer un pseudo, vider un classement.
> - **Générer et imprimer les QR codes** : « connexion Wi-Fi » (`WIFI:T:WPA;S:...;P:...;;`) et « ouvrir le parcours ».
> - Reset complet de fin de journée ; export CSV de stats anonymes.
> - **Mode démo/test** : des bots simulent des visiteurs.
> - Paramètres de contenu : **nom de l'école, couleurs, logo, infos de formations, date/lieu de la JPO, et nom de l'atelier suivant (variable, défaut « Atelier suivant »)**.
>
> ## Identité visuelle
> Design moderne et sombre, « cyber » mais **lisible et accueillant** (pas de hacker cliché effrayant pour les parents). Aux couleurs de **Coda** : récupère le logo SVG officiel depuis le site de l'école (https://www.coda.school/, logo : `https://cdn.prod.website-files.com/66b3bf6a4399565cefde681e/66b3cb8622ba822b73af8540_logo.svg`) et **embarque-le en local** ; extrais les couleurs de la charte depuis la feuille de style du site (ou propose une palette proche si impossible, modifiable dans l'admin).
> Formations par défaut de l'écran de fin (modifiables) : **Bachelor Informatique** (Bac+3, spé. Systèmes & Réseaux ou Développement Full Stack) et **Master of Science Cybersécurité & Infrastructures Réseaux** (Bac+5).
>
> ## Les phases
>
> ### Phase 0 : Accueil
> Pseudo, explication en 2 lignes. **Aucune donnée perso collectée, on ne demande jamais de vrai mot de passe.** **Opt-in explicite** « j'accepte de voir mes propres requêtes réseau » (utilisé en phase 2).
>
> ### Phase 1 : « Ton mot de passe tient combien de temps ? » (phase phare, à soigner)
> - Chaque visiteur reçoit une **fiche personnage fictive** (faux profil de réseau social : prénom, nom, date de naissance, ville, animal, équipe de foot, prénom du copain/de la copine…) et crée un mot de passe pour ce personnage (introduction à l'OSINT).
> - **Défi** : résister **au moins X années** (X réglé dans l'admin, affiché sur le grand écran en **curseur/thermomètre géant** avec la cible).
> - En direct sur le téléphone : jauge animée, temps estimé, petite animation de « cassage ».
> - **Algorithme côté client uniquement** : base **zxcvbn-ts** avec dictionnaires FR, plus couche maison pénalisant fortement : infos de la fiche (prénom, nom, date de naissance sous toutes ses formes `12031998`, `1203`, `98`, `1998`, `12/03`…, ville, animal, équipe) ; années (1950 → année courante) et dates ; prénoms français courants, villes (Avignon, Marseille…), clubs de foot, nom de l'école ; suites clavier **AZERTY** (`azerty`, `aqwzsx`…) et QWERTY ; leet speak (`P@ssw0rd`, `M4rs3ille`) ; répétitions, séquences ; schéma `Majuscule + mot + année + !`.
> - Temps de cassage selon **3 profils d'attaquant** (en ligne limité, hors ligne hash rapide GPU, ferme de GPU), tous trois affichés en mode expert ; présentés comme des **ordres de grandeur pédagogiques**.
> - Chaque schéma détecté est **expliqué en langage simple** (« Ton mot de passe contient l'année de naissance de Léa → un hacker teste toutes les années de 1950 à 2026, ça lui prend 0,001 s. »).
> - **Le mot de passe ne quitte JAMAIS le téléphone**, ni en clair ni haché. Le serveur reçoit seulement : pseudo, temps estimé, score, longueur, liste des schémas détectés.
> - Dictionnaires chargés **en tâche de fond** pendant l'intro (chargement paresseux) pour ménager les vieux téléphones.
> - **Tests unitaires** (Vitest) nombreux : dates, leet, AZERTY, infos de la fiche, séquences, répétitions.
> - Grand écran : curseur géant + cible, **flux en direct** (pseudo + temps estimé + pièges, jamais le mot de passe), records (plus solide, meilleure progression), « top des pièges » (« 62 % ont utilisé une date »).
> - Fin de phase : message pédagogique en 3 lignes max (phrase de passe, gestionnaire de mots de passe, double authentification).
>
> ### Phase 2 : « Ton téléphone parle à qui ? »
> - **API Pi-hole v6** (session `sid`, `/api/queries`, `/api/dns/blocking`).
> - Capture **dès l'arrivée** (opt-in de l'accueil), pas d'attente de 30 s : quand le visiteur arrive en phase 2, ses données sont prêtes. Il voit **ses propres** requêtes (identifiées par IP), regroupées par **entreprise** (Google, Meta, TikTok, Amazon…) et **catégorie** (pub, analytics, réseaux sociaux…) via une liste locale domaine → entreprise/catégorie.
> - Grand écran : **uniquement stats globales anonymes**, bulles animées par entreprise, compteur trackers contactés/bloqués, top des domaines. **Jamais de lien appareil ↔ domaine, ni IP affichée.**
> - Admin : bascule **avant/après** (blocage Pi-hole on/off).
> - Données par appareil **en mémoire seulement**, purge auto après 15 min et totale au reset.
> - **Mode simulé** réaliste si Pi-hole est injoignable. Détection « aucune requête vue » avec consigne DNS privé.
>
> ### Phase 3 : « Panne en prod ! »
> - Mini-entreprise de démo dans le compose (nginx, BDD, API…). Grand écran : **tableau de supervision** maison « salle de contrôle » ; le Pi y apparaît comme serveur physique avec un **vrai ping** (avec repli TCP si ICMP indisponible).
> - **Incident simulé individuel** sur chaque téléphone : scénario tiré au hasard (web down, BDD down, DNS cassé, disque plein, câble débranché…), indices (logs, ping, erreur), diagnostic parmi 3, « réparation ». Score selon temps et nombre d'indices.
> - **Moment « boss »** : déclenché par l'admin ou par un visiteur via file d'attente + cooldown ; **vraie panne** coupant un conteneur, grand écran tout rouge, vote des visiteurs, redémarrage automatique.
> - **Sécurité** : **jamais** de socket Docker dans l'app web. Un service **`chaos-agent`** séparé : réseau interne uniquement (port non publié), jeton partagé, **allowlist stricte** des conteneurs de démo, actions **stop/start uniquement**, rate limiting, cooldown ; éventuellement derrière un `docker-socket-proxy` restreint.
> - Bonus : débrancher physiquement le Pi → détection et animation sur l'écran.
>
> ### Phase 4 : Escape game cyber (optionnel)
> Après la phase 3 : « Tu veux aller plus loin ? ». Non → écran de fin. Oui → 3 niveaux (au choix ou enchaînés), chrono, indices payants, classement sur le grand écran : **Facile** (faux mail de phishing : toucher expéditeur, lien, urgence, fautes…) ; **Moyen** (logs d'authentification : IP de l'attaquant et heure d'intrusion) ; **Difficile** (mini-CTF sur le site de démo : flag dans `robots.txt`, base64, commentaire HTML, cookie modifiable…).
>
> ### Écran de fin
> Récap fun de « ce que tu as appris », score total, badge, infos des formations (texte configurable), « Direction l'atelier suivant ! » (nom configurable dans l'admin).
>
> ## Exigences générales
> - Durée du parcours principal (phases 0 à 3) : **5 à 7 minutes**.
> - Fluide sur mobile, animations soignées mais légères.
> - Sécurité : admin protégé (cookie de session signé), rate limiting, validation Pydantic, **CSP stricte (`self`)**, **aucune donnée réelle stockée**. HTTP simple (pas de HTTPS, pas de cookie `Secure`).
> - Reconnexion automatique des WebSockets.
>
> ## Ordre de développement
> 0. Squelette : compose, `.env.example`, Dockerfile, CI, README minimal : `docker compose up` ouvre les 3 pages.
> 1. Socle : sessions/pseudos, WebSocket, états, admin (modes, ordre des phases, visiteurs live, modération), écran + veille + QR, générateur de QR, bots de démo, identité Coda.
> 2. Phase 0, contenus JSON, glossaire, toggle curieux/expert.
> 3. **Phase 1** (algo + tests + UI + écran).
> 4. **Phase 3** (démo d'entreprise, supervision, incidents, chaos-agent, boss, détection Pi).
> 5. **Phase 2** (Pi-hole v6, mapping, mode simulé, avant/après, purge).
> 6. **Phase 4** + écran de fin.
> 7. README complet (installation pas à pas, config réseau box + Pi-hole, kiosk, **checklist du jour J** : tests avant ouverture, que faire si la 5G tombe ou si Pi-hole plante), export CSV, reset, test de charge à 60 bots.
>
> Commence par l'étape 0, puis arrête-toi et dis-moi quoi tester.

**Note** : le prompt dit « le mot de passe ne quitte JAMAIS le téléphone » (phase 1) — c'est le
point qu'on a sciemment changé en cours de route (voir plus haut). Si tu reprends ce prompt tel
quel dans une nouvelle session sans ce fichier, rappelle bien cette décision, sinon Claude
risque de revenir au comportement d'origine.
