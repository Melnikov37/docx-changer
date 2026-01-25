#!/bin/bash

# Установка SSL сертификата от Timeweb
# Запускать на VPS: bash install_timeweb_ssl.sh

set -e

echo "🔐 Установка SSL сертификата от Timeweb"
echo "========================================"

# Проверка root
if [ "$EUID" -ne 0 ]; then
    echo "❌ Запустите скрипт с правами root"
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
echo "📥 Скачали файлы SSL сертификата из панели Timeweb?"
echo ""
echo "Вам нужны 3 файла:"
echo "  1. Сертификат (certificate.crt)"
echo "  2. Приватный ключ (private.key)"
echo "  3. Цепочка сертификатов (ca_bundle.crt)"
echo ""
read -p "Файлы готовы? (y/N): " -n 1 -r
echo

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "Скачайте файлы SSL из панели Timeweb:"
    echo "1. Зайдите: https://timeweb.cloud"
    echo "2. Услуги → SSL-сертификаты"
    echo "3. Выберите ваш сертификат"
    echo "4. Скачайте все файлы"
    echo ""
    echo "После этого загрузите их на сервер:"
    echo "  scp certificate.crt root@85.239.39.232:/tmp/"
    echo "  scp private.key root@85.239.39.232:/tmp/"
    echo "  scp ca_bundle.crt root@85.239.39.232:/tmp/"
    echo ""
    exit 0
fi

# Создание директории для сертификатов
SSL_DIR="/etc/nginx/ssl"
mkdir -p $SSL_DIR

# Проверка файлов
echo ""
echo "📂 Проверка файлов..."

if [ ! -f "/tmp/certificate.crt" ]; then
    echo "❌ Файл /tmp/certificate.crt не найден"
    echo "Загрузите файл: scp certificate.crt root@85.239.39.232:/tmp/"
    exit 1
fi

if [ ! -f "/tmp/private.key" ]; then
    echo "❌ Файл /tmp/private.key не найден"
    echo "Загрузите файл: scp private.key root@85.239.39.232:/tmp/"
    exit 1
fi

# Копирование файлов
echo "📋 Копирование сертификатов..."
cp /tmp/certificate.crt $SSL_DIR/$DOMAIN.crt
cp /tmp/private.key $SSL_DIR/$DOMAIN.key

# Если есть цепочка сертификатов, объединяем
if [ -f "/tmp/ca_bundle.crt" ]; then
    cat /tmp/certificate.crt /tmp/ca_bundle.crt > $SSL_DIR/$DOMAIN-fullchain.crt
    CERT_FILE="$SSL_DIR/$DOMAIN-fullchain.crt"
else
    CERT_FILE="$SSL_DIR/$DOMAIN.crt"
fi

# Установка прав
chmod 600 $SSL_DIR/$DOMAIN.key
chmod 644 $CERT_FILE

echo "✅ Сертификаты скопированы"

# Обновление конфигурации Nginx
echo ""
echo "🔧 Обновление конфигурации Nginx..."

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

    # SSL сертификат
    ssl_certificate $CERT_FILE;
    ssl_certificate_key $SSL_DIR/$DOMAIN.key;

    # SSL настройки
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Размер загружаемых файлов
    client_max_body_size 10M;

    # Прокси к приложению
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Статические файлы
    location /static {
        alias /home/docxapp/docx-template-filler/static;
        expires 30d;
    }
}
NGINX

# Проверка конфигурации
echo ""
echo "🔍 Проверка конфигурации Nginx..."
nginx -t

if [ $? -ne 0 ]; then
    echo "❌ Ошибка в конфигурации Nginx"
    exit 1
fi

# Перезапуск Nginx
echo ""
echo "🔄 Перезапуск Nginx..."
systemctl reload nginx

echo ""
echo "======================================"
echo "✅ SSL сертификат установлен!"
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
