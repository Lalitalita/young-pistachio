# Cyber Parcours

Atelier interactif pour la journée portes ouvertes de **Coda Avignon** (12 décembre 2026) :
les visiteurs scannent un QR code, suivent un parcours cyber sur leur téléphone, et un grand écran affiche tout en direct.

> **État : étape 0 (squelette).** Les 3 pages s'ouvrent et se connectent au serveur ; le parcours arrive aux étapes suivantes.

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
