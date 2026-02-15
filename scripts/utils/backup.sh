#!/bin/bash

# Скрипт резервного копирования
# Использование: ./backup.sh

set -e

BACKUP_DIR="/home/docxapp/backups"
APP_DIR="/home/docxapp/docx-template-filler"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/backup_$DATE.tar.gz"

echo "💾 Создание резервной копии..."

# Создание директории для бэкапов
mkdir -p "$BACKUP_DIR"

# Архивирование важных файлов
tar -czf "$BACKUP_FILE" \
    -C "$APP_DIR" \
    --exclude='venv' \
    --exclude='__pycache__' \
    --exclude='*.pyc' \
    --exclude='uploads/*' \
    --exclude='output/*' \
    .

# Размер бэкапа
SIZE=$(du -h "$BACKUP_FILE" | cut -f1)

echo "✅ Резервная копия создана: $BACKUP_FILE ($SIZE)"

# Удаление старых бэкапов (старше 30 дней)
find "$BACKUP_DIR" -name "backup_*.tar.gz" -mtime +30 -delete

echo "🗑️  Старые бэкапы удалены"
echo "📦 Список бэкапов:"
ls -lh "$BACKUP_DIR"
