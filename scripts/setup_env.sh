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
