#!/bin/bash

# Скрипт для настройки Nginx reverse proxy для MinIO Console
# Запускать на VPS от root: sudo bash setup_minio_nginx.sh

set -e

echo "🔒 Настройка Nginx для MinIO Console"
echo "====================================="

# Проверка root
if [ "$EUID" -ne 0 ]; then
    echo "❌ Запустите скрипт с правами root: sudo bash setup_minio_nginx.sh"
    exit 1
fi

# Запрос домена
echo ""
echo "Для MinIO Console рекомендуется использовать поддомен,"
echo "например: minio.example.com или s3.example.com"
echo ""
read -p "Введите домен для MinIO Console: " MINIO_DOMAIN

if [ -z "$MINIO_DOMAIN" ]; then
    echo "❌ Домен не может быть пустым"
    exit 1
fi

echo ""
echo "📋 Будет создана конфигурация для: $MINIO_DOMAIN"
echo ""
read -p "Продолжить? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Отменено."
    exit 1
fi

# Создание конфигурации Nginx
echo ""
echo "1️⃣ Создание конфигурации Nginx..."

cat > /etc/nginx/sites-available/minio << NGINX
# MinIO Console - только для авторизованных пользователей
server {
    listen 80;
    server_name $MINIO_DOMAIN;

    # Увеличиваем размер для загрузки шаблонов
    client_max_body_size 100M;

    location / {
        proxy_pass http://127.0.0.1:9001;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;

        # WebSocket support для MinIO Console
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";

        # Таймауты
        proxy_connect_timeout 300;
        proxy_send_timeout 300;
        proxy_read_timeout 300;
        send_timeout 300;
    }
}

# MinIO API
server {
    listen 80;
    server_name api.$MINIO_DOMAIN;

    client_max_body_size 100M;

    location / {
        proxy_pass http://127.0.0.1:9000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;

        proxy_connect_timeout 300;
        proxy_send_timeout 300;
        proxy_read_timeout 300;
        send_timeout 300;
    }
}
NGINX

# Активация конфигурации
echo "2️⃣ Активация конфигурации..."
ln -sf /etc/nginx/sites-available/minio /etc/nginx/sites-enabled/

# Проверка конфигурации
echo "3️⃣ Проверка конфигурации Nginx..."
nginx -t

if [ $? -ne 0 ]; then
    echo "❌ Ошибка в конфигурации Nginx"
    exit 1
fi

# Перезапуск Nginx
echo "4️⃣ Перезапуск Nginx..."
systemctl restart nginx

echo ""
echo "✅ Nginx настроен для MinIO Console"
echo ""
echo "===================================="
echo "📋 Следующие шаги:"
echo "===================================="
echo ""
echo "1️⃣ Настройте DNS записи:"
echo "   A-запись: $MINIO_DOMAIN → IP этого сервера"
echo "   A-запись: api.$MINIO_DOMAIN → IP этого сервера"
echo ""
echo "2️⃣ Установите SSL сертификат (ОБЯЗАТЕЛЬНО для безопасности!):"
echo "   sudo certbot --nginx -d $MINIO_DOMAIN -d api.$MINIO_DOMAIN"
echo ""
echo "3️⃣ После установки SSL откройте в браузере:"
echo "   https://$MINIO_DOMAIN"
echo ""
echo "4️⃣ Войдите с учетными данными из .env файла"
echo ""
echo "⚠️  ВАЖНО:"
echo "   - Обязательно смените пароль MinIO!"
echo "   - Не используйте без SSL в production!"
echo "   - Рассмотрите использование базовой аутентификации nginx"
echo ""
echo "📝 Для добавления базовой аутентификации nginx:"
echo "   sudo apt install apache2-utils"
echo "   sudo htpasswd -c /etc/nginx/.htpasswd admin"
echo "   # Добавьте в location блок:"
echo "   #   auth_basic \"MinIO Console\";"
echo "   #   auth_basic_user_file /etc/nginx/.htpasswd;"
echo ""
