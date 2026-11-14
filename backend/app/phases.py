"""Manifestes des phases (côté serveur) : id, titre, schéma de paramètres.

Les composants mobile/écran correspondants sont déclarés dans frontend/src/phases/registry.ts.
Pour ajouter une phase : un manifeste ici + un dossier côté front.
"""
from typing import Any

PHASES: list[dict[str, Any]] = [
    {"id": "p0", "title": "Accueil", "tagline": "Choisis ton pseudo et c'est parti.",
     "fixed": True, "schema": []},
    {"id": "p1", "title": "Ton mot de passe tient combien de temps ?",
     "tagline": "Protège un personnage fictif contre les pirates.",
     "schema": [
         {"key": "target_years", "label": "Objectif : durée à tenir (années)", "type": "number",
          "default": 10, "min": 1, "max": 1_000_000_000, "int": True,
          "help": "Affiché sur le grand écran comme cible à battre."},
         {"key": "data_retention_min", "label": "Conservation des mots de passe soumis (minutes)",
          "type": "number", "default": 60, "min": 5, "max": 240, "int": True,
          "help": "Purge automatique. Les mots de passe ne sont jamais affichés en public, seulement dans l'admin."},
     ]},
    {"id": "p2", "title": "Ton téléphone parle à qui ?",
     "tagline": "Découvre qui reçoit tes requêtes en coulisses.",
     "schema": [
         {"key": "blocking", "label": "Blocage Pi-hole activé (mode « après »)", "type": "boolean", "default": False},
         {"key": "force_simulated", "label": "Forcer le mode simulé", "type": "boolean", "default": False},
     ]},
    {"id": "p3", "title": "Panne en prod !",
     "tagline": "Diagnostique la panne avant qu'il ne soit trop tard.",
     "schema": [
         {"key": "boss_enabled", "label": "Autoriser le moment « boss » (vraie panne)", "type": "boolean", "default": True},
         {"key": "boss_cooldown_s", "label": "Délai minimum entre deux pannes (s)", "type": "number",
          "default": 120, "min": 10, "max": 3600, "int": True},
         {"key": "boss_vote_s", "label": "Durée du vote pendant la panne (s)", "type": "number",
          "default": 40, "min": 15, "max": 180, "int": True},
         {"key": "boss_real", "label": "Vraie panne (coupe un conteneur de démo)", "type": "boolean", "default": True,
          "help": "Décoché : panne simulée à l'écran seulement (utile pour répéter sans Docker)."},
     ]},
    {"id": "p4", "title": "Escape game cyber", "tagline": "Phishing, logs, mini-CTF : va plus loin !",
     "optional": True,
     "schema": [
         {"key": "mode", "label": "Enchaînement des niveaux", "type": "select", "default": "choice",
          "options": [{"value": "choice", "label": "Au choix"}, {"value": "chain", "label": "Enchaînés"}]},
     ]},
]
BY_ID = {p["id"]: p for p in PHASES}
IDS = [p["id"] for p in PHASES]
