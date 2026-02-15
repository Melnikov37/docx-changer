#!/bin/bash

# Удаленный деплой для GitHub Actions
# Использование:
#   ./deploy/remote.sh <host> <user> [--key-file <path>]
# Переменные окружения:
#   SSH_KEY - содержимое приватного ключа (для GitHub Actions)
#   SSH_HOST - хост для подключения
#   SSH_USER - пользователь для подключения

set -e

HOST="${SSH_HOST:-$1}"
USER="${SSH_USER:-${2:-root}}"
KEY_FILE=""

# Парсинг аргументов
shift 2 2>/dev/null || true
while [[ $# -gt 0 ]]; do
    case $1 in
        --key-file)
            KEY_FILE="$2"
            shift 2
            ;;
        --help)
            echo "Usage: $0 <host> <user> [--key-file <path>]"
            echo ""
            echo "Arguments:"
            echo "  host              SSH host (or use SSH_HOST env)"
            echo "  user              SSH user (or use SSH_USER env)"
            echo ""
            echo "Options:"
            echo "  --key-file PATH   Path to SSH private key"
            echo ""
            echo "Environment variables:"
            echo "  SSH_KEY           SSH private key content (for CI/CD)"
            echo "  SSH_HOST          SSH host"
            echo "  SSH_USER          SSH user"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

if [ -z "$HOST" ]; then
    echo "Error: HOST is required"
    echo "Use: $0 <host> <user> or set SSH_HOST environment variable"
    exit 1
fi

echo "🚀 Remote deployment to $HOST"
echo "=============================="

# Настройка SSH ключа из переменной окружения (для GitHub Actions)
if [ -n "$SSH_KEY" ]; then
    echo "Setting up SSH key from environment..."
    mkdir -p ~/.ssh
    echo "$SSH_KEY" > ~/.ssh/deploy_key
    chmod 600 ~/.ssh/deploy_key
    KEY_FILE=~/.ssh/deploy_key
fi

# Формируем SSH команду
SSH_CMD="ssh -o StrictHostKeyChecking=no"
if [ -n "$KEY_FILE" ]; then
    SSH_CMD="$SSH_CMD -i $KEY_FILE"
fi

echo "Connecting to $USER@$HOST..."
echo ""

# Выполняем обновление на удаленном сервере
$SSH_CMD $USER@$HOST << 'ENDSSH'
set -e

echo "📥 Updating on server..."
cd /home/docxapp/docx-template-filler || exit 1

# Обновление кода
echo "1️⃣ Pulling latest code..."
su - docxapp -c "cd docx-template-filler && git fetch origin && git reset --hard origin/main"

# Обновление зависимостей
echo "2️⃣ Installing dependencies..."
su - docxapp -c "cd docx-template-filler && source venv/bin/activate && pip install -r requirements.txt --quiet && deactivate"

# Проверка MinIO
echo "3️⃣ Checking MinIO..."
su - docxapp -c "
    cd docx-template-filler
    if [ -f docker-compose.minio.yml ]; then
        docker compose -f docker-compose.minio.yml up -d 2>/dev/null || true
    fi
"

# Перезапуск
echo "4️⃣ Restarting application..."
systemctl restart docxapp

sleep 2

# Проверка
echo ""
echo "5️⃣ Checking status..."
systemctl status docxapp --no-pager | head -5

RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8000/ || echo "000")
if [ "$RESPONSE" = "200" ]; then
    echo ""
    echo "✅ Application is running (HTTP $RESPONSE)"
else
    echo ""
    echo "⚠️  Application status: HTTP $RESPONSE"
    exit 1
fi

ENDSSH

echo ""
echo "=============================="
echo "✅ Deployment complete!"
echo "=============================="

# Очистка временного ключа
if [ -f ~/.ssh/deploy_key ]; then
    rm -f ~/.ssh/deploy_key
fi

exit 0
