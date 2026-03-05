#!/bin/bash
# Nocturn C2 — Deploy script (Citadel / Debian)
# Usage: sudo bash deploy.sh
set -e

DOMAIN="nocturn.roadmvn.com"
PROJECT="/opt/Nocturn"

echo "🌑 Nocturn Deploy — $DOMAIN"
echo "================================"

# 1. Dépendances système
echo "[1/6] Installation des dépendances système..."
apt-get update -q
apt-get install -y -q nginx certbot python3-certbot-nginx mingw-w64 nodejs npm python3-pip

# 2. Dépendances Python
echo "[2/6] Installation des dépendances Python..."
pip3 install -r $PROJECT/server/requirements.txt --break-system-packages --ignore-installed

# 3. Build frontend React
echo "[3/6] Build du frontend React..."
cd $PROJECT/frontend
npm install --silent
npm run build

# 4. Permissions
chown -R debian:debian $PROJECT

# 5. Systemd service
echo "[4/6] Configuration du service systemd..."
cp $PROJECT/deploy/nocturn.service /etc/systemd/system/nocturn.service
systemctl daemon-reload
systemctl enable nocturn
systemctl restart nocturn
sleep 2
systemctl is-active --quiet nocturn && echo "  ✓ Service démarré" || echo "  ✗ Erreur service (check: journalctl -u nocturn)"

# 6. Nginx (sans SSL d'abord)
echo "[5/6] Configuration Nginx..."
# Config temporaire sans SSL pour certbot
cat > /etc/nginx/sites-available/nocturn << 'EOF'
server {
    listen 80;
    server_name nocturn.roadmvn.com;
    root /opt/Nocturn/frontend/dist;
    index index.html;
    location / { try_files $uri $uri/ /index.html; }
    location /api/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
EOF

ln -sf /etc/nginx/sites-available/nocturn /etc/nginx/sites-enabled/nocturn
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
echo "  ✓ Nginx configuré"

# 7. SSL Let's Encrypt
echo "[6/6] Certificat SSL Let's Encrypt..."
echo "  IMPORTANT : Le DNS $DOMAIN doit pointer vers cette machine !"
read -p "  Lancer certbot maintenant ? [y/N] " yn
if [[ "$yn" == "y" || "$yn" == "Y" ]]; then
    certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email admin@roadmvn.com
    # Remplace la config nginx par celle avec SSL
    cp $PROJECT/deploy/nginx.conf /etc/nginx/sites-available/nocturn
    nginx -t && systemctl reload nginx
    echo "  ✓ SSL activé"
else
    echo "  → Lance manuellement : certbot --nginx -d $DOMAIN"
fi

echo ""
echo "================================"
echo "✅ Deploy terminé !"
echo "   URL : https://$DOMAIN"
echo "   Login : admin / Nocturn2026!"
echo "   Port agents : 1234 (ouvrir dans le firewall)"
echo "   Logs : journalctl -u nocturn -f"
echo "================================"
