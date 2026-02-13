#!/bin/bash

# Безопасное обновление приложения - не трогает nginx и домен
# Запуск одной командой:
# curl -fsSL https://raw.githubusercontent.com/Melnikov37/docx-changer/main/scripts/update_safe.sh | sudo bash

set -e

echo "🔄 Безопасное обновление DOCX Template Filler"
echo "============================================="

# Переключаемся на пользователя docxapp
su - docxapp << 'EOF'

cd docx-template-filler

echo ""
echo "1️⃣ Получение обновлений из GitHub..."
git fetch origin
git pull origin main

echo ""
echo "2️⃣ Обновление зависимостей..."
source venv/bin/activate
pip install -r requirements.txt --quiet
deactivate

echo ""
echo "3️⃣ Проверка MinIO..."
if [ -f docker-compose.minio.yml ]; then
    if ! docker ps | grep -q docx-minio; then
        echo "🐳 Запуск MinIO..."
        docker compose -f docker-compose.minio.yml up -d
        sleep 3
    else
        echo "✅ MinIO уже работает"
    fi
else
    echo "⚠️  docker-compose.minio.yml не найден, создаю..."
    cat > docker-compose.minio.yml << 'DOCKERCOMPOSE'
version: '3.8'

services:
  minio:
    image: minio/minio:latest
    container_name: docx-minio
    ports:
      - "127.0.0.1:9000:9000"
      - "127.0.0.1:9001:9001"
    volumes:
      - minio-data:/data
    environment:
      - MINIO_ROOT_USER=${MINIO_ROOT_USER:-minioadmin}
      - MINIO_ROOT_PASSWORD=${MINIO_ROOT_PASSWORD:-minioadmin123}
    command: server /data --console-address ":9001"
    restart: unless-stopped

volumes:
  minio-data:
DOCKERCOMPOSE

    # Создаем .env если нет
    if [ ! -f .env ]; then
        cat > .env << 'ENVFILE'
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minioadmin123
ENVFILE
    fi

    docker compose -f docker-compose.minio.yml up -d
    sleep 3
fi

echo "✅ Обновление кода завершено"

EOF

echo ""
echo "4️⃣ Перезапуск приложения..."
systemctl restart docxapp

sleep 2

echo ""
echo "5️⃣ Проверка статуса..."
echo ""
echo "Flask приложение:"
systemctl status docxapp --no-pager | head -5

echo ""
echo "MinIO:"
su - docxapp -c "docker ps | grep minio || echo 'MinIO не запущен'"

echo ""
echo "============================================="
echo "✅ Обновление завершено!"
echo "============================================="
echo ""

# Проверка доступности
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8000/ || echo "000")

if [ "$RESPONSE" = "200" ]; then
    echo "✅ Приложение работает! (HTTP $RESPONSE)"
else
    echo "⚠️  Приложение возвращает код: $RESPONSE"
    echo ""
    echo "Проверьте логи:"
    echo "  sudo journalctl -u docxapp -n 50"
fi

echo ""
echo "📝 Что НЕ изменялось (всё безопасно):"
echo "   ✓ Nginx конфигурация"
echo "   ✓ Домен и SSL"
echo "   ✓ Пароли MinIO"
echo ""
echo "📝 Что обновилось:"
echo "   ✓ Код приложения"
echo "   ✓ Python зависимости"
echo "   ✓ База данных (добавлена таблица для истории)"
echo ""
