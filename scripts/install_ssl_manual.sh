#!/bin/bash

# Скрипт установки SSL сертификата (для Timeweb или любого другого)
# Запускать на VPS: bash install_ssl_manual.sh
#
# ПЕРЕД ЗАПУСКОМ:
# 1. Загрузите файлы на сервер:
#    scp private.key root@85.239.39.232:/tmp/
#    scp certificate.crt root@85.239.39.232:/tmp/
#    scp ca_bundle.crt root@85.239.39.232:/tmp/ (опционально)
# 2. Запустите скрипт

set -e

echo "🔐 Установка SSL сертификата"
echo "============================="

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

# Проверка файлов
echo "1️⃣ Проверка наличия файлов сертификата..."

CERT_FILES_OK=true

if [ ! -f "/tmp/private.key" ]; then
    echo "❌ Файл /tmp/private.key не найден"
    CERT_FILES_OK=false
fi

if [ ! -f "/tmp/certificate.crt" ]; then
    echo "❌ Файл /tmp/certificate.crt не найден"
    CERT_FILES_OK=false
fi

if [ "$CERT_FILES_OK" = false ]; then
    echo ""
    echo "Загрузите файлы на сервер:"
    echo "  scp private.key root@IP:/tmp/"
    echo "  scp certificate.crt root@IP:/tmp/"
    echo "  scp ca_bundle.crt root@IP:/tmp/  (опционально)"
    echo ""
    exit 1
fi

echo "✅ Файлы найдены"

# Создание директории для SSL
echo ""
echo "2️⃣ Создание директории для сертификатов..."
SSL_DIR="/etc/nginx/ssl"
mkdir -p $SSL_DIR
echo "✅ Директория создана: $SSL_DIR"

# Копирование файлов
echo ""
echo "3️⃣ Копирование сертификатов..."

cp /tmp/private.key $SSL_DIR/$DOMAIN.key
cp /tmp/certificate.crt $SSL_DIR/$DOMAIN.crt

# Если есть цепочка сертификатов, объединяем
if [ -f "/tmp/ca_bundle.crt" ]; then
    echo "   Найден ca_bundle.crt, создаю fullchain..."
    cat /tmp/certificate.crt /tmp/ca_bundle.crt > $SSL_DIR/$DOMAIN-fullchain.crt
    CERT_FILE="$SSL_DIR/$DOMAIN-fullchain.crt"
else
    echo "   ca_bundle.crt не найден, используем только certificate.crt"
    CERT_FILE="$SSL_DIR/$DOMAIN.crt"
fi

echo "✅ Сертификаты скопированы"

# Установка прав
echo ""
echo "4️⃣ Установка прав доступа..."
chmod 600 $SSL_DIR/$DOMAIN.key
chmod 644 $SSL_DIR/$DOMAIN*.crt
echo "✅ Права установлены (ключ: 600, сертификаты: 644)"

# Создание конфигурации Nginx
echo ""
echo "5️⃣ Создание конфигурации Nginx..."

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
    ssl_certificate_key $SSL_DIR/$DOMAIN.key;

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
echo "6️⃣ Проверка конфигурации Nginx..."
nginx -t

if [ $? -ne 0 ]; then
    echo "❌ Ошибка в конфигурации Nginx"
    echo "Проверьте файл: /etc/nginx/sites-available/docxapp"
    exit 1
fi

echo "✅ Конфигурация валидна"

# Перезапуск Nginx
echo ""
echo "7️⃣ Перезапуск Nginx..."
systemctl reload nginx

if [ $? -ne 0 ]; then
    echo "❌ Ошибка при перезапуске Nginx"
    echo "Проверьте логи: tail -f /var/log/nginx/error.log"
    exit 1
fi

echo "✅ Nginx перезапущен"

# Удаление временных файлов
echo ""
echo "8️⃣ Удаление временных файлов..."
rm -f /tmp/private.key /tmp/certificate.crt /tmp/ca_bundle.crt
echo "✅ Временные файлы удалены"

# Проверка работы HTTPS
echo ""
echo "9️⃣ Проверка работы HTTPS..."
sleep 2

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://$DOMAIN/ --insecure || echo "000")

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
echo "✅ SSL сертификат успешно установлен!"
echo "======================================"
echo ""
echo "🌐 Ваше приложение доступно по адресу:"
echo "   https://$DOMAIN"
echo "   https://www.$DOMAIN"
echo ""
echo "🔒 HTTP автоматически перенаправляется на HTTPS"
echo ""
echo "📝 Файлы сертификата:"
echo "   Сертификат: $CERT_FILE"
echo "   Ключ: $SSL_DIR/$DOMAIN.key"
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
