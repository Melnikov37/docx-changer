#!/bin/bash

# Мастер-скрипт для исправления всех проблем после install_full.sh
# Запускать на VPS от root одной командой:
# curl -fsSL https://raw.githubusercontent.com/Melnikov37/docx-changer/main/scripts/fix_all.sh | sudo bash

set -e

echo "🔧 Исправление конфигурации после установки"
echo "============================================"

# Проверка root
if [ "$EUID" -ne 0 ]; then
    echo "❌ Запустите скрипт с правами root"
    exit 1
fi

# Запрос домена
echo ""
echo "Введите ваш домен (например: docxfiller.ru)"
echo "Можно с www или без www"
read -p "Домен: " DOMAIN

if [ -z "$DOMAIN" ]; then
    echo "❌ Домен не может быть пустым"
    exit 1
fi

# Убираем www. если есть
MAIN_DOMAIN="${DOMAIN#www.}"

echo ""
echo "📋 Настройка домена: $MAIN_DOMAIN"
echo ""

# 1. Проверка MinIO
echo "1️⃣ Проверка MinIO..."
su - docxapp << 'EOF'
cd docx-template-filler

# Проверяем запущен ли MinIO
if docker ps | grep -q docx-minio; then
    echo "✅ MinIO уже работает"
else
    echo "🚀 Запуск MinIO..."
    if [ -f docker-compose.minio.yml ]; then
        docker compose -f docker-compose.minio.yml up -d
        sleep 3
        echo "✅ MinIO запущен"
    else
        echo "⚠️  Файл docker-compose.minio.yml не найден"
    fi
fi
EOF

# 2. Проверка SSL сертификатов
echo ""
echo "2️⃣ Проверка SSL сертификатов..."
SSL_CERT_PATH="/etc/letsencrypt/live/$MAIN_DOMAIN/fullchain.pem"
SSL_KEY_PATH="/etc/letsencrypt/live/$MAIN_DOMAIN/privkey.pem"

HAS_SSL=false
if [ -f "$SSL_CERT_PATH" ] && [ -f "$SSL_KEY_PATH" ]; then
    echo "✅ SSL сертификаты найдены"
    HAS_SSL=true
else
    echo "⚠️  SSL сертификаты не найдены"
fi

# 3. Создание конфигурации Nginx
echo ""
echo "3️⃣ Создание конфигурации Nginx..."

if [ "$HAS_SSL" = true ]; then
    # Конфигурация с SSL
    cat > /etc/nginx/sites-available/docxapp << NGINX
# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name $MAIN_DOMAIN www.$MAIN_DOMAIN;

    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    location / {
        return 301 https://\$host\$request_uri;
    }
}

# HTTPS server
server {
    listen 443 ssl http2;
    server_name $MAIN_DOMAIN www.$MAIN_DOMAIN;

    # SSL Configuration
    ssl_certificate $SSL_CERT_PATH;
    ssl_certificate_key $SSL_KEY_PATH;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # File upload size
    client_max_body_size 10M;

    # Proxy to Flask app
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_redirect off;
    }

    # Static files
    location /static {
        alias /home/docxapp/docx-template-filler/static;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
NGINX
    echo "✅ Создана конфигурация с SSL"
else
    # Конфигурация без SSL
    cat > /etc/nginx/sites-available/docxapp << NGINX
server {
    listen 80;
    server_name $MAIN_DOMAIN www.$MAIN_DOMAIN;
    client_max_body_size 10M;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /static {
        alias /home/docxapp/docx-template-filler/static;
        expires 30d;
    }
}
NGINX
    echo "✅ Создана конфигурация без SSL"
fi

# 4. Активация конфигурации
echo ""
echo "4️⃣ Активация конфигурации..."
rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/docxapp /etc/nginx/sites-enabled/

# 5. Проверка и перезапуск Nginx
echo ""
echo "5️⃣ Проверка конфигурации Nginx..."
nginx -t

if [ $? -ne 0 ]; then
    echo "❌ Ошибка в конфигурации Nginx"
    exit 1
fi

echo ""
echo "6️⃣ Перезапуск сервисов..."
systemctl restart nginx
systemctl restart docxapp

sleep 3

# 7. Проверка статуса
echo ""
echo "7️⃣ Проверка статуса сервисов..."
echo ""
echo "Nginx:"
systemctl status nginx --no-pager | head -5
echo ""
echo "Flask приложение:"
systemctl status docxapp --no-pager | head -5
echo ""
echo "MinIO:"
su - docxapp -c "docker ps | grep minio"

# 8. Если нет SSL, предлагаем установить
if [ "$HAS_SSL" = false ]; then
    echo ""
    echo "============================================"
    echo "⚠️  SSL сертификат не установлен!"
    echo "============================================"
    echo ""
    read -p "Установить SSL сертификат сейчас? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo ""
        echo "📦 Установка Certbot..."
        apt update -qq
        apt install -y certbot python3-certbot-nginx

        echo ""
        echo "🔐 Получение SSL сертификата..."
        echo "   Домен: $MAIN_DOMAIN"
        echo "   С www: www.$MAIN_DOMAIN"
        echo ""

        certbot --nginx -d $MAIN_DOMAIN -d www.$MAIN_DOMAIN --non-interactive --agree-tos --email admin@$MAIN_DOMAIN || {
            echo ""
            echo "⚠️  Автоматическая установка не удалась."
            echo ""
            echo "Попробуйте вручную:"
            echo "  certbot --nginx -d $MAIN_DOMAIN -d www.$MAIN_DOMAIN"
            echo ""
            echo "Убедитесь что:"
            echo "  1. DNS записи настроены правильно"
            echo "  2. Домен доступен из интернета"
            echo "  3. Порт 80 открыт"
        }

        # Перезапускаем nginx
        systemctl restart nginx
        echo ""
        echo "✅ SSL сертификат установлен!"
    fi
fi

echo ""
echo "============================================"
echo "✅ Все исправлено!"
echo "============================================"
echo ""
echo "🌐 Ваш сайт доступен по адресу:"
if [ "$HAS_SSL" = true ] || [ "$REPLY" = "y" ] || [ "$REPLY" = "Y" ]; then
    echo "   https://$MAIN_DOMAIN"
    echo "   https://www.$MAIN_DOMAIN"
else
    echo "   http://$MAIN_DOMAIN"
    echo "   http://www.$MAIN_DOMAIN"
fi
echo ""

# Проверка доступности
echo "🔍 Проверка доступности приложения..."
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
echo "📝 Статус сервисов:"
echo "   Nginx:     $(systemctl is-active nginx)"
echo "   Flask:     $(systemctl is-active docxapp)"
echo "   Docker:    $(systemctl is-active docker)"
echo ""
echo "📋 Полезные команды:"
echo "   sudo systemctl status docxapp     # Статус приложения"
echo "   sudo journalctl -u docxapp -f     # Логи в реальном времени"
echo "   docker ps                         # Список контейнеров"
echo "   sudo certbot renew --dry-run      # Проверка обновления SSL"
echo ""
