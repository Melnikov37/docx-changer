#!/bin/bash

# Скрипт обновления приложения для GitHub Actions и ручного запуска
# Использование:
#   ./deploy/update.sh [--skip-restart] [--skip-minio]
# Переменные окружения:
#   SKIP_RESTART=true - не перезапускать сервис
#   SKIP_MINIO=true - не проверять MinIO

set -e

SKIP_RESTART=${SKIP_RESTART:-false}
SKIP_MINIO=${SKIP_MINIO:-false}

# Парсинг аргументов
while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-restart)
            SKIP_RESTART=true
            shift
            ;;
        --skip-minio)
            SKIP_MINIO=true
            shift
            ;;
        --help)
            echo "Usage: $0 [--skip-restart] [--skip-minio]"
            echo ""
            echo "Options:"
            echo "  --skip-restart    Don't restart application service"
            echo "  --skip-minio      Don't check/start MinIO"
            echo "  --help            Show this help"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

echo "🔄 Updating DOCX Template Filler"
echo "================================"

# Определяем рабочую директорию
if [ -d "/home/docxapp/docx-template-filler" ]; then
    WORK_DIR="/home/docxapp/docx-template-filler"
    USER="docxapp"
else
    WORK_DIR="$(pwd)"
    USER=$(whoami)
fi

echo "Working directory: $WORK_DIR"
echo "User: $USER"

# Функция для выполнения от имени правильного пользователя
run_as_user() {
    if [ "$USER" = "docxapp" ] || [ "$(whoami)" = "docxapp" ]; then
        bash -c "$1"
    else
        su - docxapp -c "cd $WORK_DIR && $1"
    fi
}

echo ""
echo "1️⃣ Updating code from git..."
run_as_user "git fetch origin && git reset --hard origin/main"

echo ""
echo "2️⃣ Installing dependencies..."
run_as_user "source venv/bin/activate && pip install -r requirements.txt --quiet && deactivate"

if [ "$SKIP_MINIO" != "true" ]; then
    echo ""
    echo "3️⃣ Checking MinIO..."
    run_as_user "
        if [ -f docker-compose.minio.yml ]; then
            if ! docker ps | grep -q docx-minio; then
                echo 'Starting MinIO...'
                docker compose -f docker-compose.minio.yml up -d
                sleep 3
            else
                echo 'MinIO already running'
            fi
        fi
    "
fi

if [ "$SKIP_RESTART" != "true" ]; then
    echo ""
    echo "4️⃣ Restarting application..."
    if command -v systemctl &> /dev/null; then
        systemctl restart docxapp 2>/dev/null || echo "Warning: Could not restart service"
    else
        echo "systemctl not available, skipping restart"
    fi
fi

echo ""
echo "================================"
echo "✅ Update complete!"
echo "================================"

# Проверка работоспособности
if command -v curl &> /dev/null; then
    echo ""
    echo "Checking application..."
    sleep 2
    RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8000/ 2>/dev/null || echo "000")

    if [ "$RESPONSE" = "200" ]; then
        echo "✅ Application is running (HTTP $RESPONSE)"
    else
        echo "⚠️  Application status: HTTP $RESPONSE"
    fi
fi

exit 0
