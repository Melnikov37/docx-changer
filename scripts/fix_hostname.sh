#!/bin/bash

# Скрипт восстановления домена и SSL после установки
# Запускать на VPS от root: sudo bash fix_hostname.sh

set -e

echo "🔧 Восстановление домена и SSL"
echo "==============================="

# Проверка root
if [ "$EUID" -ne 0 ]; then
    echo "❌ Запустите скрипт с правами root: sudo bash fix_hostname.sh"
    exit 1
fi

# Запрос домена
echo ""
echo "Введите ваш домен (например: docxfiller.ru или www.docxfiller.ru)"
read -p "Домен: " DOMAIN

if [ -z "$DOMAIN" ]; then
    echo "❌ Домен не может быть пустым"
    exit 1
fi

# Убираем www. если есть для основного домена
MAIN_DOMAIN="${DOMAIN#www.}"

echo ""
echo "📋 Будет настроен домен: $MAIN_DOMAIN и www.$MAIN_DOMAIN"
echo ""

# Проверяем SSL сертификаты
echo "🔍 Проверка SSL сертификатов..."
SSL_CERT_PATH="/etc/letsencrypt/live/$MAIN_DOMAIN/fullchain.pem"
SSL_KEY_PATH="/etc/letsencrypt/live/$MAIN_DOMAIN/privkey.pem"

HAS_SSL=false
if [ -f "$SSL_CERT_PATH" ] && [ -f "$SSL_KEY_PATH" ]; then
    echo "✅ SSL сертификаты найдены"
    HAS_SSL=true
else
    echo "⚠️  SSL сертификаты не найдены"
fi

# Создаем новую конфигурацию Nginx
echo ""
echo "1️⃣ Создание конфигурации Nginx..."

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
    # Конфигурация без SSL (только HTTP)
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
    echo "✅ Создана конфигурация без SSL (только HTTP)"
fi

# Активация конфигурации
echo ""
echo "2️⃣ Активация конфигурации..."
ln -sf /etc/nginx/sites-available/docxapp /etc/nginx/sites-enabled/

# Удаляем дефолтный конфиг если есть
rm -f /etc/nginx/sites-enabled/default

# Проверка конфигурации
echo ""
echo "3️⃣ Проверка конфигурации Nginx..."
nginx -t

if [ $? -ne 0 ]; then
    echo "❌ Ошибка в конфигурации Nginx"
    exit 1
fi

# Перезапуск Nginx
echo ""
echo "4️⃣ Перезапуск Nginx..."
systemctl restart nginx

# Проверка статуса
sleep 2
systemctl status nginx --no-pager | head -10

# Если нет SSL, предлагаем установить
if [ "$HAS_SSL" = false ]; then
    echo ""
    echo "⚠️  SSL сертификат не установлен!"
    echo ""
    read -p "Хотите установить SSL сертификат сейчас? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo ""
        echo "📦 Установка Certbot..."
        apt update
        apt install -y certbot python3-certbot-nginx

        echo ""
        echo "🔐 Получение SSL сертификата..."
        certbot --nginx -d $MAIN_DOMAIN -d www.$MAIN_DOMAIN --non-interactive --agree-tos --register-unsafely-without-email || {
            echo ""
            echo "⚠️  Автоматическая установка не удалась."
            echo "Попробуйте вручную:"
            echo "  certbot --nginx -d $MAIN_DOMAIN -d www.$MAIN_DOMAIN"
        }

        echo ""
        echo "✅ SSL сертификат установлен!"

        # Перезапускаем nginx еще раз
        systemctl restart nginx
    fi
fi

echo ""
echo "==============================="
echo "✅ Восстановление завершено!"
echo "==============================="
echo ""
echo "🌐 Ваш сайт доступен по адресу:"
if [ "$HAS_SSL" = true ]; then
    echo "   https://$MAIN_DOMAIN"
    echo "   https://www.$MAIN_DOMAIN"
else
    echo "   http://$MAIN_DOMAIN"
    echo "   http://www.$MAIN_DOMAIN"
fi
echo ""

# Проверка доступности
echo "🔍 Проверка доступности..."
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8000/ || echo "000")

if [ "$RESPONSE" = "200" ]; then
    echo "✅ Приложение работает! (HTTP $RESPONSE)"
else
    echo "⚠️  Приложение возвращает код: $RESPONSE"
    echo ""
    echo "Проверьте статус приложения:"
    echo "  sudo systemctl status docxapp"
    echo "  sudo journalctl -u docxapp -n 50"
fi

echo ""
echo "📝 Полезные команды:"
echo "  sudo systemctl status nginx       # Статус Nginx"
echo "  sudo systemctl status docxapp     # Статус приложения"
echo "  sudo certbot renew --dry-run      # Проверка обновления SSL"
echo ""
