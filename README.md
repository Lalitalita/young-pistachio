# Cyber Parcours

Atelier interactif pour la journée portes ouvertes de **Coda Avignon** (12 décembre 2026) :
les visiteurs scannent un QR code, suivent un parcours cyber sur leur téléphone, et un grand écran affiche tout en direct.

> **État : étape 3.** Phase 0 + **Phase 1 jouable** (« Ton mot de passe tient combien de temps ? »). Les phases 2 à 4 sont encore des gabarits (étapes suivantes).

Tout se build dans Docker : **aucune installation de Node ou Python sur le PC**.

## Prérequis

Linux avec `git`, `docker` et `docker compose` (v2).

## Installation

```bash
git clone <URL-du-dépôt> cyber-parcours && cd cyber-parcours
cp .env.example .env
```

Édite `.env` (mot de passe admin, IP du PC, Wi-Fi, mot de passe Pi-hole…), puis :

```bash
docker compose up -d --build
```

Ouvre ensuite :

| Page | URL |
|---|---|
| Parcours mobile | `http://<IP-du-PC>/` |
| Grand écran | `http://<IP-du-PC>/screen` |
| Admin | `http://<IP-du-PC>/admin` |
| Pi-hole | `http://<IP-du-PC>:8081/admin` |
| Santé / IP vue par l'app | `http://<IP-du-PC>/api/health` · `/api/whoami` |

> Si le port 53 est déjà pris (systemd-resolved sur Ubuntu/Debian), Pi-hole ne démarrera pas :
> `sudo mkdir -p /etc/systemd/resolved.conf.d && printf '[Resolve]\nDNSStubListener=no\n' | sudo tee /etc/systemd/resolved.conf.d/nostub.conf && sudo systemctl restart systemd-resolved`
> (Le réglage réseau complet de la box est détaillé à l'étape 7 du projet.)

## Utilisation (étape 1)

- **Admin** (`/admin`, mot de passe = `ADMIN_PASSWORD` du `.env`) : progression *libre* ou *guidée* (« Ouvrir l'étape suivante » pour tout le monde), activer/réordonner les phases et régler leurs paramètres, choisir l'affichage du grand écran (rotation auto / phase fixe / veille), visiteurs en direct (renommer, masquer), QR codes à imprimer (Wi-Fi + parcours), contenus et charte (nom de l'école, couleurs, logo, formations, date/lieu, « atelier suivant »), **mode démo** (bots), export CSV anonyme, **reset de fin de journée**.
- **Grand écran** (`/screen`) : passe tout seul en veille (animation + QR) après inactivité ; compteur de visiteurs ; s'adapte à toute taille de fenêtre.
- **QR du parcours** : par défaut avec l'**IP** du PC (marche même si le DNS privé du téléphone contourne Pi-hole) ; case dans l'admin pour utiliser `parcours.cyber`.
- **Textes éditables** : `content/texts.json` (textes, souvent en deux versions *curieux* / *expert*), `content/glossary.json` (infobulles), `content/branding.json` (charte, formations, JPO). Onglet **Textes** de l'admin : tout se modifie en direct (visible tout de suite sur les téléphones), avec « Rétablir » par texte. Ce qui est modifié est stocké en base et prend le dessus sur les fichiers.
- Dans un texte, `[[dns|DNS]]` rend le mot cliquable (définition du glossaire). On peut ajouter ses propres termes dans l'admin.
- Chaque visiteur choisit **Curieux** (explication simple) ou **Expert** (termes techniques) ; le choix est mémorisé sur son téléphone.
- **Opt-in** de l'accueil : case « j'accepte de voir mes propres requêtes réseau », comptée de façon anonyme sur l'écran ; sans accord, la phase 2 utilisera des données simulées.

## Phase 1 : « Ton mot de passe tient combien de temps ? »

- Chaque visiteur reçoit une **fiche personnage fictive** (prénom, nom, date de naissance, ville, animal, club, copain/copine) et invente un mot de passe pour la protéger.
- **⚠️ Choix assumé, différent du cahier des charges initial** : contrairement à l'idée de départ (« le mot de passe ne quitte jamais le téléphone »), le mot de passe **est envoyé au serveur et conservé** (par défaut 1h, réglable 5–240 min dans l'admin, phase 1 → Réglages → « Conservation »), pour permettre de retrouver le résultat d'un visiteur qui revient. **Le texte affiché au visiteur le dit explicitement** et lui demande de ne jamais utiliser un vrai mot de passe. Purge automatique (tâche de fond, toutes les 90 s) ; jamais affiché sur le grand écran ; jamais dans l'export CSV (qui reste anonyme).
- L'**analyse de robustesse tourne entièrement sur le téléphone** (algorithme [zxcvbn-ts](https://github.com/zxcvbn-ts/zxcvbn) + dictionnaires FR, chargés en tâche de fond pendant la phase 0, plus une couche « maison » : infos de la fiche, dates sous toutes leurs formes, années 1950→aujourd'hui, suites clavier AZERTY/QWERTY, leet speak, répétitions, schéma « Majuscule+mot+année+! », mots courants). Trois profils d'attaquant (en ligne limité, hors ligne hash rapide, ferme de GPU) donnent des ordres de grandeur pédagogiques.
- Admin → **support visiteur** : `GET /api/admin/phase1/lookup?q=<pseudo>` retrouve les derniers résultats (dont le mot de passe) d'un pseudo, tant qu'ils ne sont pas purgés.
- Grand écran : thermomètre géant avec la cible, records du jour, top des pièges, flux en direct (pseudo + score + pièges, jamais le mot de passe).

## Commandes

Avec le script `./cyber.sh` (ou `make <commande>`), et leurs équivalents Docker bruts :

| Action | Script | Docker brut |
|---|---|---|
| Démarrer / rebuild | `./cyber.sh up` | `docker compose up -d --build` |
| **Mise à jour** | `./cyber.sh update` | `git pull && docker compose up -d --build` |
| Logs | `./cyber.sh logs [service]` | `docker compose logs -f app` |
| État | `./cyber.sh ps` | `docker compose ps` |
| Arrêt | `./cyber.sh down` | `docker compose down` |
| Reset fin de journée | `./cyber.sh reset` | `docker compose exec -T app sh -c 'rm -f /data/cyber.db*' && docker compose restart app` |
| Mode kiosk grand écran | `./cyber.sh kiosk` | `chromium --kiosk http://localhost/screen` |
| Tests (dans Docker) | `./cyber.sh test` | — |

## Architecture

```
app (FastAPI + WebSocket + SQLite WAL, sert aussi le front buildé)
pihole        DNS uniquement (le DHCP reste sur la box 5G)
chaos-agent   pannes réelles contrôlées (réseau interne, étape 4)
demo-web / demo-db / demo-api   « mini-entreprise » de la phase 3
```

- `backend/` FastAPI · `frontend/` React + TypeScript + Vite · `content/` textes éditables.
- **Aucune dépendance CDN** : polices (Space Grotesk, DM Sans) et logo Coda sont embarqués.
- CSP stricte (`self`). Seule concession : `style-src-attr 'unsafe-inline'` (jauges animées) et `ws:` dans `connect-src` (vieux Safari).
- L'app tourne en réseau bridge avec port publié : l'IP source des téléphones est conservée (vérifie via `/api/whoami`).
- CI GitHub Actions : Vitest, pytest, build Docker.
