#!/bin/bash

# Скрипт первичной настройки .env на VPS
# Запускать на сервере: ./scripts/setup_env.sh

set -e

ENV_FILE=".env"

echo "🔧 DOCX Template Filler - Environment Setup"
echo "============================================"

# Проверяем существование .env
if [ -f "$ENV_FILE" ]; then
    echo "⚠️  .env already exists!"
    read -p "Overwrite? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Cancelled."
        exit 0
    fi
fi

# Генерация SECRET_KEY
echo ""
echo "Generating secure SECRET_KEY..."
SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_hex(32))")

# Запрашиваем MinIO credentials
echo ""
read -p "MinIO username (default: minioadmin): " MINIO_USER
MINIO_USER=${MINIO_USER:-minioadmin}

read -s -p "MinIO password (default: minioadmin): " MINIO_PASS
echo ""
MINIO_PASS=${MINIO_PASS:-minioadmin}

# SSL сертификаты
echo ""
echo "SSL Certificate configuration:"
echo "  1) Use files in ./ssl/ directory (default)"
echo "  2) Use Let's Encrypt (/etc/letsencrypt/live/...)"
echo "  3) Custom paths"
read -p "Choose option [1]: " SSL_OPTION
SSL_OPTION=${SSL_OPTION:-1}

case $SSL_OPTION in
    2)
        read -p "Domain name (e.g., docxfiller.ru): " DOMAIN
        SSL_CERT="/etc/letsencrypt/live/$DOMAIN/fullchain.pem"
        SSL_KEY="/etc/letsencrypt/live/$DOMAIN/privkey.pem"
        ;;
    3)
        read -p "Path to certificate (.crt): " SSL_CERT
        read -p "Path to private key (.key): " SSL_KEY
        ;;
    *)
        SSL_CERT="./ssl/certificate.crt"
        SSL_KEY="./ssl/private.key"
        echo "Put your certificate.crt and private.key in ./ssl/ directory"
        ;;
esac

# Создаем .env
cat > "$ENV_FILE" << EOF
# DOCX Template Filler - Environment Configuration
# Generated on $(date)
# WARNING: Keep this file secret!

# Flask secret key (auto-generated)
SECRET_KEY=$SECRET_KEY

# MinIO credentials
MINIO_ROOT_USER=$MINIO_USER
MINIO_ROOT_PASSWORD=$MINIO_PASS

# S3/MinIO settings
S3_ENDPOINT=minio:9000
S3_BUCKET=templates

# Flask environment
FLASK_ENV=production

# SSL certificates
SSL_CERT_PATH=$SSL_CERT
SSL_KEY_PATH=$SSL_KEY
EOF

# Устанавливаем права
chmod 600 "$ENV_FILE"

echo ""
echo "============================================"
echo "✅ .env created successfully!"
echo "============================================"
echo ""
echo "File permissions: $(stat -c %a "$ENV_FILE" 2>/dev/null || stat -f %Lp "$ENV_FILE")"
echo ""
echo "Next steps:"
echo "  1. Review .env file if needed"
echo "  2. Run: docker compose up -d"
echo ""
