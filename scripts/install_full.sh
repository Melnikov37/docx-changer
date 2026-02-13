#!/bin/bash

# Полная установка DOCX Template Filler на VPS с нуля
# Запускать от root: bash install_full.sh

set -e

echo "🚀 Установка DOCX Template Filler на VPS"
echo "=========================================="

# Проверка root
if [ "$EUID" -ne 0 ]; then
    echo "❌ Запустите скрипт с правами root: sudo bash install_full.sh"
    exit 1
fi

# 1. Исправление DNS (если не работает)
echo ""
echo "1️⃣ Проверка и исправление DNS..."
if ! ping -c 1 github.com &>/dev/null; then
    echo "⚠️  DNS не работает, исправляю..."
    echo "nameserver 8.8.8.8" > /etc/resolv.conf
    echo "nameserver 1.1.1.1" >> /etc/resolv.conf
    sleep 1

    if ping -c 1 github.com &>/dev/null; then
        echo "✅ DNS исправлен"
    else
        echo "❌ DNS всё ещё не работает. Проверьте настройки сети."
        exit 1
    fi
else
    echo "✅ DNS работает"
fi

# 2. Обновление системы
echo ""
echo "2️⃣ Обновление системы..."
apt update -qq

# 3. Установка необходимых пакетов
echo ""
echo "3️⃣ Установка пакетов..."
apt install -y python3 python3-pip python3-venv nginx git certbot python3-certbot-nginx curl

# 3.5. Установка Docker и Docker Compose
echo ""
echo "3️⃣.5️⃣ Установка Docker..."
if ! command -v docker &> /dev/null; then
    # Удаление старых версий
    apt remove -y docker docker-engine docker.io containerd runc 2>/dev/null || true

    # Установка зависимостей
    apt install -y ca-certificates gnupg lsb-release

    # Добавление GPG ключа Docker
    mkdir -p /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg

    # Добавление репозитория Docker
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

    # Установка Docker
    apt update
    apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

    # Запуск Docker
    systemctl enable docker
    systemctl start docker

    echo "✅ Docker установлен: $(docker --version)"
else
    echo "✅ Docker уже установлен: $(docker --version)"
fi

# 4. Создание пользователя docxapp (если не существует)
echo ""
echo "4️⃣ Создание пользователя..."
if ! id docxapp &>/dev/null; then
    adduser --disabled-password --gecos "" docxapp
    usermod -aG sudo docxapp
    usermod -aG docker docxapp
    echo "docxapp ALL=(ALL) NOPASSWD: /bin/systemctl restart docxapp, /bin/systemctl status docxapp, /bin/systemctl stop docxapp, /bin/systemctl start docxapp" >> /etc/sudoers
    echo "✅ Пользователь docxapp создан"
else
    usermod -aG docker docxapp
    echo "✅ Пользователь docxapp уже существует"
fi

# 5. Клонирование репозитория
echo ""
echo "5️⃣ Клонирование репозитория..."
su - docxapp << 'EOF'

if [ -d "docx-template-filler" ]; then
    echo "⚠️  Директория уже существует, обновляю..."
    cd docx-template-filler
    git pull origin main || echo "⚠️  Не удалось обновить через git"
else
    echo "📥 Клонирование из GitHub..."
    git clone https://github.com/Melnikov37/docx-changer.git docx-template-filler
    cd docx-template-filler
fi

# Создание виртуального окружения
echo "📦 Создание виртуального окружения..."
python3 -m venv venv
source venv/bin/activate

# Установка зависимостей
echo "📦 Установка зависимостей..."
pip install --upgrade pip
pip install -r requirements.txt

# Создание необходимых директорий
mkdir -p uploads output docx_templates examples

# Создание .env файла для MinIO
if [ ! -f .env ]; then
    echo "🔐 Создание .env файла..."
    cat > .env << 'ENVFILE'
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minioadmin123
ENVFILE
    chmod 600 .env
    echo "✅ .env файл создан"
fi

echo "✅ Приложение установлено в ~/docx-template-filler"

EOF

# 5.5. Запуск MinIO в Docker
echo ""
echo "5️⃣.5️⃣ Запуск MinIO..."
su - docxapp << 'EOF'

cd docx-template-filler

# Создаем docker-compose только для MinIO (основное приложение работает через systemd)
cat > docker-compose.minio.yml << 'DOCKERCOMPOSE'
version: '3.8'

services:
  minio:
    image: minio/minio:latest
    container_name: docx-minio
    ports:
      - "127.0.0.1:9000:9000"      # API (только localhost)
      - "127.0.0.1:9001:9001"      # Console (только localhost)
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

# Запускаем MinIO
echo "🚀 Запуск MinIO контейнера..."
docker compose -f docker-compose.minio.yml up -d

# Ждем запуска
sleep 5

# Проверка статуса
if docker ps | grep -q docx-minio; then
    echo "✅ MinIO запущен и работает"
else
    echo "⚠️  MinIO может быть не запущен. Проверьте: docker ps"
fi

EOF

# 6. Создание systemd сервиса
echo ""
echo "6️⃣ Настройка systemd сервиса..."
cat > /etc/systemd/system/docxapp.service << 'SYSTEMD'
[Unit]
Description=DOCX Template Filler
After=network.target docker.service
Requires=docker.service

[Service]
Type=notify
User=docxapp
Group=www-data
WorkingDirectory=/home/docxapp/docx-template-filler
Environment="PATH=/home/docxapp/docx-template-filler/venv/bin"
Environment="S3_ENDPOINT=localhost:9000"
Environment="S3_ACCESS_KEY=minioadmin"
Environment="S3_SECRET_KEY=minioadmin123"
Environment="S3_BUCKET=templates"
ExecStart=/home/docxapp/docx-template-filler/venv/bin/gunicorn --bind 127.0.0.1:8000 --workers 2 --timeout 120 app:app
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
SYSTEMD

systemctl daemon-reload
systemctl enable docxapp
systemctl restart docxapp

echo "✅ Сервис настроен и запущен"

# 7. Настройка Nginx
echo ""
echo "7️⃣ Настройка Nginx..."

# Удаляем дефолтный конфиг
rm -f /etc/nginx/sites-enabled/default

# Создаем конфиг для приложения
cat > /etc/nginx/sites-available/docxapp << 'NGINX'
server {
    listen 80;
    server_name _;
    client_max_body_size 10M;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /static {
        alias /home/docxapp/docx-template-filler/static;
        expires 30d;
    }
}
NGINX

# Активируем конфиг
ln -sf /etc/nginx/sites-available/docxapp /etc/nginx/sites-enabled/

# Проверяем конфиг
nginx -t

# Перезапускаем Nginx
systemctl restart nginx

echo "✅ Nginx настроен"

# 8. Проверка статуса
echo ""
echo "=========================================="
echo "✅ Установка завершена!"
echo "=========================================="
echo ""

sleep 2

echo "📊 Статус сервисов:"
echo ""
systemctl status docxapp --no-pager -l | head -10
echo ""
systemctl status nginx --no-pager | head -5

echo ""
echo "🔍 Проверка работы приложения:"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/ || echo "000")

if [ "$RESPONSE" = "200" ]; then
    echo "✅ Приложение работает! (HTTP $RESPONSE)"
else
    echo "⚠️  Приложение возвращает код: $RESPONSE"
    echo "Проверьте логи: journalctl -u docxapp -n 20"
fi

echo ""
echo "🌐 Приложение доступно по адресу:"
echo "   http://85.239.39.232"
echo ""
echo "📝 Полезные команды:"
echo "   systemctl status docxapp   # Статус приложения"
echo "   systemctl restart docxapp  # Перезапуск приложения"
echo "   journalctl -u docxapp -f   # Логи в реальном времени"
echo "   nginx -t                   # Проверка конфигурации Nginx"
echo ""
