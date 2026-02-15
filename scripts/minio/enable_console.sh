#!/bin/bash

# Скрипт для открытия доступа к MinIO Console
# Запускать на VPS от root: sudo bash enable_minio_console.sh

set -e

echo "🔓 Открытие доступа к MinIO Console"
echo "===================================="

# Проверка root
if [ "$EUID" -ne 0 ]; then
    echo "❌ Запустите скрипт с правами root: sudo bash enable_minio_console.sh"
    exit 1
fi

echo ""
echo "⚠️  ВНИМАНИЕ!"
echo "Вы собираетесь открыть доступ к MinIO Console из интернета."
echo ""
echo "Рекомендации по безопасности:"
echo "1. Обязательно измените пароль MinIO (по умолчанию minioadmin/minioadmin123)"
echo "2. Рассмотрите использование nginx с SSL для MinIO Console"
echo "3. Используйте сложный пароль (минимум 16 символов)"
echo ""

read -p "Продолжить? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Отменено."
    exit 1
fi

# Переключаемся на пользователя docxapp для работы с docker
echo ""
echo "1️⃣ Обновление конфигурации MinIO..."
su - docxapp << 'EOF'

cd docx-template-filler

# Создаем новую конфигурацию с открытыми портами
cat > docker-compose.minio.yml << 'DOCKERCOMPOSE'
version: '3.8'

services:
  minio:
    image: minio/minio:latest
    container_name: docx-minio
    ports:
      - "9000:9000"      # API
      - "9001:9001"      # Console (открыт для всех)
    volumes:
      - minio-data:/data
    environment:
      - MINIO_ROOT_USER=${MINIO_ROOT_USER:-minioadmin}
      - MINIO_ROOT_PASSWORD=${MINIO_ROOT_PASSWORD:-minioadmin123}
    command: server /data --console-address ":9001"
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "mc", "ready", "local"]
      interval: 30s
      timeout: 20s
      retries: 3

volumes:
  minio-data:
DOCKERCOMPOSE

echo "✅ Конфигурация обновлена"

# Перезапускаем MinIO
echo "🔄 Перезапуск MinIO..."
docker compose -f docker-compose.minio.yml down
docker compose -f docker-compose.minio.yml up -d

sleep 3

# Проверка
if docker ps | grep -q docx-minio; then
    echo "✅ MinIO перезапущен с открытым портом 9001"
else
    echo "❌ Ошибка при перезапуске MinIO"
    exit 1
fi

EOF

# Открываем порт в файрволе
echo ""
echo "2️⃣ Настройка файрвола..."

# Проверяем, установлен ли ufw
if command -v ufw &> /dev/null; then
    # Разрешаем порт 9001
    ufw allow 9001/tcp comment 'MinIO Console'

    # Показываем статус
    echo "✅ Порт 9001 открыт в файрволе"
    ufw status | grep 9001 || echo "ufw не активен"
else
    echo "⚠️  ufw не установлен. Порт может быть заблокирован файрволом."
    echo "   Установите ufw или настройте ваш файрвол вручную:"
    echo "   sudo apt install ufw"
    echo "   sudo ufw allow 9001/tcp"
fi

# Получаем IP адрес сервера
SERVER_IP=$(hostname -I | awk '{print $1}')

echo ""
echo "===================================="
echo "✅ MinIO Console доступен!"
echo "===================================="
echo ""
echo "🌐 Откройте в браузере:"
echo "   http://$SERVER_IP:9001"
echo ""
echo "🔑 Учетные данные по умолчанию:"
echo "   Логин: minioadmin"
echo "   Пароль: minioadmin123"
echo ""
echo "⚠️  ВАЖНО! Немедленно смените пароль!"
echo ""
echo "📝 Как изменить пароль MinIO:"
echo ""
echo "1. Остановите MinIO:"
echo "   su - docxapp"
echo "   cd docx-template-filler"
echo "   docker compose -f docker-compose.minio.yml down"
echo ""
echo "2. Отредактируйте .env файл:"
echo "   nano .env"
echo "   # Измените MINIO_ROOT_USER и MINIO_ROOT_PASSWORD"
echo ""
echo "3. Обновите systemd сервис:"
echo "   sudo nano /etc/systemd/system/docxapp.service"
echo "   # Измените S3_ACCESS_KEY и S3_SECRET_KEY"
echo ""
echo "4. Перезапустите сервисы:"
echo "   docker compose -f docker-compose.minio.yml up -d"
echo "   exit"
echo "   sudo systemctl daemon-reload"
echo "   sudo systemctl restart docxapp"
echo ""
echo "🔒 Для дополнительной безопасности рассмотрите:"
echo "   - Настройку nginx reverse proxy с SSL"
echo "   - Ограничение доступа по IP"
echo "   - Использование VPN"
echo ""
