#!/bin/bash

# Скрипт настройки Nginx для SSL
# Запускать на VPS: bash install_ssl_manual.sh
#
# ВАЖНО: Сертификаты должны быть уже установлены в /etc/nginx/ssl/

set -e

echo "🔐 Настройка Nginx для SSL"
echo "==========================="

# Проверка root
if [ "$EUID" -ne 0 ]; then
    echo "❌ Запустите скрипт с правами root: sudo bash install_ssl_manual.sh"
    exit 1
fi

# Запрос домена
echo ""
read -p "Введите ваш домен (например: docxfiller.ru): " DOMAIN

if [ -z "$DOMAIN" ]; then
    echo "❌ Домен не может быть пустым"
    exit 1
fi

echo ""
echo "📋 Будет настроено:"
echo "   - Домен: $DOMAIN"
echo "   - С www: www.$DOMAIN"
echo "   - HTTP → HTTPS редирект"
echo ""

# Определяем путь к сертификату (fullchain имеет приоритет)
SSL_DIR="/etc/nginx/ssl"
if [ -f "$SSL_DIR/$DOMAIN-fullchain.crt" ]; then
    CERT_FILE="$SSL_DIR/$DOMAIN-fullchain.crt"
elif [ -f "$SSL_DIR/$DOMAIN.crt" ]; then
    CERT_FILE="$SSL_DIR/$DOMAIN.crt"
else
    echo "⚠️  Сертификат не найден в $SSL_DIR/"
    echo "Ожидаемые файлы:"
    echo "  - $SSL_DIR/$DOMAIN.crt или"
    echo "  - $SSL_DIR/$DOMAIN-fullchain.crt"
fi

KEY_FILE="$SSL_DIR/$DOMAIN.key"
if [ ! -f "$KEY_FILE" ]; then
    echo "⚠️  Приватный ключ не найден: $KEY_FILE"
fi

echo ""
echo "1️⃣ Создание конфигурации Nginx..."

cat > /etc/nginx/sites-available/docxapp << NGINX
# HTTP - редирект на HTTPS
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;

    location / {
        return 301 https://\$host\$request_uri;
    }
}

# HTTPS
server {
    listen 443 ssl http2;
    server_name $DOMAIN www.$DOMAIN;

    # SSL сертификаты
    ssl_certificate $CERT_FILE;
    ssl_certificate_key $KEY_FILE;

    # SSL настройки (современные и безопасные)
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Заголовки безопасности
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    # Размер загружаемых файлов
    client_max_body_size 10M;

    # Прокси к приложению
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Forwarded-Host \$host;
        proxy_set_header X-Forwarded-Port \$server_port;
    }

    # Статические файлы
    location /static {
        alias /home/docxapp/docx-template-filler/static;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
NGINX

echo "✅ Конфигурация создана: /etc/nginx/sites-available/docxapp"

# Проверка конфигурации Nginx
echo ""
echo "2️⃣ Проверка конфигурации Nginx..."
nginx -t

if [ $? -ne 0 ]; then
    echo "❌ Ошибка в конфигурации Nginx"
    echo "Проверьте файл: /etc/nginx/sites-available/docxapp"
    exit 1
fi

echo "✅ Конфигурация валидна"

# Перезапуск Nginx
echo ""
echo "3️⃣ Перезапуск Nginx..."
systemctl reload nginx

if [ $? -ne 0 ]; then
    echo "❌ Ошибка при перезапуске Nginx"
    echo "Проверьте логи: tail -f /var/log/nginx/error.log"
    exit 1
fi

echo "✅ Nginx перезапущен"

# Удаление временных файлов
echo ""
echo "4️⃣ Удаление временных файлов..."
rm -f /tmp/private.key /tmp/certificate.crt /tmp/ca_bundle.crt /tmp/*.pem 2>/dev/null || true
echo "✅ Временные файлы удалены"

# Проверка работы HTTPS
echo ""
echo "5️⃣ Проверка работы HTTPS..."
sleep 2

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://$DOMAIN/ --insecure 2>/dev/null || echo "000")

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ HTTPS работает! (HTTP $HTTP_CODE)"
elif [ "$HTTP_CODE" = "301" ] || [ "$HTTP_CODE" = "302" ]; then
    echo "✅ HTTPS работает с редиректом (HTTP $HTTP_CODE)"
else
    echo "⚠️  HTTPS возвращает код: $HTTP_CODE"
    echo "Проверьте вручную: curl -I https://$DOMAIN/"
fi

# Итоговая информация
echo ""
echo "======================================"
echo "✅ Nginx настроен для SSL!"
echo "======================================"
echo ""
echo "🌐 Ваше приложение доступно по адресу:"
echo "   https://$DOMAIN"
echo "   https://www.$DOMAIN"
echo ""
echo "🔒 HTTP автоматически перенаправляется на HTTPS"
echo ""
echo "📝 Используемые файлы:"
echo "   Сертификат: $CERT_FILE"
echo "   Ключ: $KEY_FILE"
echo ""
echo "🔍 Проверка SSL:"
echo "   curl -I https://$DOMAIN"
echo "   openssl s_client -connect $DOMAIN:443 -servername $DOMAIN"
echo ""
echo "📊 Статус сервисов:"
systemctl status nginx --no-pager -l | head -5
echo ""
systemctl status docxapp --no-pager -l | head -5
echo ""
echo "🎉 Готово! Откройте в браузере: https://$DOMAIN"
echo ""
