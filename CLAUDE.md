# CLAUDE.md : documentation du projet « Cyber Parcours »

Atelier interactif pour la journée portes ouvertes de **Coda Avignon** (samedi 12 décembre 2026, 14h–17h).
Le visiteur scanne un QR code, suit un parcours cyber sur son téléphone ; un grand écran affiche tout en direct ; l'animateur pilote depuis `/admin`.

- Dépôt : https://github.com/Lalitalita/young-pistachio.git (clone : `git clone https://github.com/Lalitalita/young-pistachio.git cyber-parcours`)
- Branches de travail : `claude/exciting-faraday-kyyhol` (courante), `claude/cyber-parcours-workshop-b5qnnh` (historique).
- Suivi d'avancement et prompt d'origine : `moment.md`. Installation et exploitation : `README.md`.
- Langue : **français** partout (textes, commits, commentaires). Tutoiement des visiteurs.

## Règles de collaboration (voulues par le propriétaire)
- Travailler **étape par étape** (0 → 7), un commit par étape ; à la fin de chaque étape : résumer, dire **exactement quoi tester** (téléphone, écran, admin), puis **attendre le retour**.
- Réponses brèves, langage simple. Toujours donner l'URL de clone ci-dessus quand une commande `git clone` est nécessaire.
- Le PC du propriétaire n'a ni Node ni Python : tout passe par Docker (`docker compose up -d --build`).
- Ne pas créer de PR sans demande explicite.

## Décisions importantes (à ne pas défaire sans en parler)
1. **Le mot de passe de la phase 1 est envoyé au serveur et conservé** (1 h par défaut, 5–240 min, purge toutes les 90 s). Le texte affiché au visiteur (`p1.warning_text`) le dit et déconseille un vrai mot de passe : **ne pas retirer cet avertissement**. Jamais dans l'export CSV.
2. Palmarès des mots de passe les plus faibles sur le grand écran (demandé par le propriétaire) : score < 60, **en clair, sans pseudo**, dédoublonné, visiteurs masqués exclus, désactivable (`show_weak_passwords`), annoncé aux visiteurs.
3. **Aucune dépendance CDN** (polices, icônes, dictionnaires en local). HTTP simple, pas de cookie `Secure`.
4. **Jamais le socket Docker dans l'app** : seulement `docker-proxy` (filtré) ↔ `chaos-agent` (allowlist, stop/start).
5. Le grand écran n'a pas de `ContentProvider` : ses composants ne doivent pas appeler `useContent()` (mode curieux fixe).
6. Pas de bouton imbriqué dans un bouton : dans un `<button>`, utiliser `plain()` (texte brut) et non `Rich`/`T` (les mots du glossaire sont des boutons).

## Architecture
```
docker-compose.yml
 ├─ app           FastAPI + WebSocket + SQLite (WAL), sert aussi le front buildé (un seul process uvicorn)
 ├─ pihole        DNS uniquement (le DHCP reste sur la box 5G)
 ├─ chaos-agent   stop/start des conteneurs de démo (réseau interne, jeton)
 ├─ docker-proxy  tecnativa/docker-socket-proxy (CONTAINERS+POST+START+STOP uniquement)
 └─ demo-web (nginx) → demo-api → demo-db (Postgres), conteneurs nommés cp-demo-*
```
Réseaux : `front` (app, pihole), `demo` (app + démo), `internal` (app ↔ chaos-agent, sans Internet), `dockerapi` (chaos-agent ↔ docker-proxy).
L'app est en bridge avec port publié : l'IP source des téléphones est conservée (vérifier `/api/whoami`).

### Backend (`backend/app/`)
| Fichier | Rôle |
|---|---|
| `main.py` | App FastAPI, CSP stricte (`self`), front statique, lifespan (Hub + bots) |
| `hub.py` | **État temps réel en mémoire** : visiteurs, WebSockets (visiteur/écran/admin), diffusion groupée (~120 ms) de `public_state()`, boucle de supervision, reset de fin de journée |
| `state.py` | État serveur-autoritaire de l'événement (mode libre/guidé, ordre/activation des phases, paramètres), persisté en base |
| `phases.py` | **Manifeste des phases** : titre, schéma de paramètres (génère les formulaires admin) |
| `schema.py` | Validation/valeurs par défaut des schémas de paramètres |
| `api.py` / `admin.py` | Routes publiques / admin (cookie signé, rate limiting, Pydantic) |
| `security.py` | Cookies HMAC, rate limiter, IP cliente |
| `db.py` | SQLite WAL : tables `kv`, `visitors`, `scores` |
| `content.py` | Textes/glossaire/charte JSON + surcharges admin en base |
| `characters.py`, `pseudos.py`, `qr.py`, `bots.py` | Fiches fictives, pseudos, QR SVG, bots de démo |
| `phase1.py` | Stockage des mots de passe, records, pièges, palmarès des plus faibles, support (`lookup`) |
| `phase3.py` | Incidents individuels (sessions en mémoire, score serveur, stats) |
| `supervision.py` | Sondes (HTTP/TCP/ICMP), vrai ping du Pi avec repli TCP, événements |
| `boss.py` | Panne « boss » : idle → voting → recovering, file d'attente, délai, vote |
| `chaos.py` | Client du chaos-agent (appels bloquants, lancés en thread) |

### Frontend (`frontend/src/`)
- Routes `/` (mobile), `/screen`, `/admin`, chargées paresseusement (`pages/`).
- **Phases = plugins** : `phases/<id>/{Mobile,Screen}.tsx`, déclarés dans `phases/registry.ts` (préchargement en tâche de fond).
- `lib/` : `useSocket` (reconnexion avec backoff, resync), `useEvent`, `content.tsx` (textes, glossaire, mode curieux/expert), `richtext.ts` (`[[terme|libellé]]`, `{variable}`, `plain()`), `phaseLogic.ts` (que montre l'écran ; la panne majeure prend la main), `theme.ts`.
- `admin/` : onglets Pilotage, Visiteurs, Panne en prod, QR codes, Contenu, Textes, Outils.
- Grand écran : tout est dimensionné avec `--u = min(1vw, 1.7778vh)` pour ne **jamais déborder**, quel que soit le ratio.
- Mobile : barre d'action collée en bas (`.stickybar`), `interactive-widget=resizes-content` dans le viewport (clavier).

### Contenu éditable (`content/`)
`texts.json` (textes, souvent `{curious, expert}`), `glossary.json`, `branding.json` (charte, formations, JPO), `characters.json`, `pseudos.json`, `incidents.json` (7 incidents + vote boss). Surchargeables en direct depuis l'admin (onglet Textes) ; stockées en base.

## Les phases
- **p0 Accueil** : pseudo aléatoire, vie privée, opt-in « voir mes requêtes » (pour la phase 2).
- **p1 Mot de passe** : fiche fictive → mot de passe → analyse **sur le téléphone** (`frontend/src/phases/p1/`) : zxcvbn-ts + dictionnaires FR + règles maison (fiche, dates, années, AZERTY/QWERTY, leet, répétitions, schéma Maj+mot+année, mots courants **entiers** ; noms courts de la fiche ignorés s'ils sont enfouis dans un autre mot). Phrases de passe (≥ 3 mots sans piège) : **7 776^n** essais (4 mots ≈ 2 j, 5 mots ≈ 45 ans à 10¹⁰ essais/s). 3 profils d'attaquant : en ligne (100/h), hors ligne hash rapide (10¹⁰/s), ferme de GPU (10¹²/s). « Hors ligne » = modèle d'attaque (base volée), pas le lieu du calcul. Écran : thermomètre, records, palmarès des plus faibles, pièges, flux.
- **p2 « Ton téléphone parle à qui ? »** : *gabarit* (étape 5 : Pi-hole v6).
- **p3 « Panne en prod ! »** : 7 incidents (indices −12 pts, mauvaise réponse −15, lenteur jusqu'à −25 ; min 10), salle de contrôle, boss (vraie panne via chaos-agent, vote, redémarrage auto ; réglable en panne simulée), détection débranchement du Pi.
- **p4 Escape game** : *gabarit* (étape 6). **end** : écran de fin (étape 6).

## Sécurité
Admin : cookie signé SameSite=Strict, rate limiting, Pydantic. CSP `self` (exceptions : `style-src-attr 'unsafe-inline'`, `ws:`). Visiteur : cookie HttpOnly signé, pseudo aléatoire, aucune donnée réelle. `chaos-agent` : jeton partagé, allowlist `demo-web/api/db`, stop/start seulement, rate limit, délai par service, chien de garde (relance auto après 3 min).

## Développer / tester
```bash
cd backend && pip install -r requirements-dev.txt && pytest -q      # 83 tests
cd chaos-agent && python -m pytest -q                                # 6 tests
cd frontend && npm ci && npm test && npm run build                   # 118 tests Vitest
./cyber.sh test    # idem dans Docker, sans rien installer
```
Lancer en local sans Docker : `DATA_DIR=/tmp/cp STATIC_DIR=frontend/dist CONTENT_DIR=content ADMIN_PASSWORD=pw SECRET_KEY=k PROBES_ENABLED=0 uvicorn app.main:app --port 8765` (depuis `backend/`). `PROBES_ENABLED=0` coupe les sondes réseau (tests/dev).
Variables `.env` : voir `.env.example` (ADMIN_PASSWORD, SECRET_KEY, PC_IP, PARCOURS_HOST, HTTP_PORT, WIFI_*, PIHOLE_*, PI_IP, CHAOS_TOKEN).
Commandes d'exploitation : `./cyber.sh {up|update|logs|ps|down|reset|kiosk|test}`. CI : `.github/workflows/ci.yml` (Vitest, pytest, chaos-agent, build Docker).

## Reste à faire
- **Étape 5** Phase 2 : API Pi-hole v6 (`sid`, `/api/queries`, `/api/dns/blocking`), regroupement par entreprise/catégorie, bulles animées (stats globales anonymes, jamais IP ↔ domaine), bascule avant/après, purge 15 min, mode simulé, détection « aucune requête vue » (DNS privé / iCloud Private Relay).
- **Étape 6** Phase 4 (escape game : phishing, logs, mini-CTF sur `demo-web`) + écran de fin (récap, badge, formations, « atelier suivant »).
- **Étape 7** README complet (config box 5G, DNS primaire = secondaire = PC, désactiver le DNS proxy, enregistrement `parcours.cyber`), checklist du jour J, test de charge 60 bots.
