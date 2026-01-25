#!/bin/bash

# Скрипт настройки домена и SSL сертификата
# Запускать на VPS: bash setup_domain_ssl.sh

set -e

echo "🌐 Настройка домена и SSL сертификата"
echo "======================================"

# Проверка root
if [ "$EUID" -ne 0 ]; then
    echo "❌ Запустите скрипт с правами root: sudo bash setup_domain_ssl.sh"
    exit 1
fi

# Запрос домена
echo ""
read -p "Введите ваш домен (например: example.com): " DOMAIN

if [ -z "$DOMAIN" ]; then
    echo "❌ Домен не может быть пустым"
    exit 1
fi

echo ""
echo "📋 Будет настроено:"
echo "   - Домен: $DOMAIN"
echo "   - С www: www.$DOMAIN"
echo ""
read -p "Продолжить? (y/N): " -n 1 -r
echo

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Отменено."
    exit 1
fi

# Проверка DNS
echo ""
echo "1️⃣ Проверка DNS записей..."
CURRENT_IP=$(curl -s ifconfig.me)
DOMAIN_IP=$(dig +short $DOMAIN | tail -1)

echo "   IP сервера: $CURRENT_IP"
echo "   IP домена:  $DOMAIN_IP"

if [ "$CURRENT_IP" != "$DOMAIN_IP" ]; then
    echo ""
    echo "⚠️  ВНИМАНИЕ! DNS еще не настроен или не обновился."
    echo ""
    echo "Убедитесь что в DNS есть A-запись:"
    echo "   Имя: @"
    echo "   Тип: A"
    echo "   Значение: $CURRENT_IP"
    echo "   TTL: 3600"
    echo ""
    read -p "DNS настроен, продолжить? (y/N): " -n 1 -r
    echo

    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Отменено. Настройте DNS и запустите скрипт снова."
        exit 1
    fi
fi

# Обновление конфигурации Nginx
echo ""
echo "2️⃣ Обновление конфигурации Nginx..."

cat > /etc/nginx/sites-available/docxapp << NGINX
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;
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

# Проверка конфигурации
nginx -t

if [ $? -ne 0 ]; then
    echo "❌ Ошибка в конфигурации Nginx"
    exit 1
fi

# Перезапуск Nginx
systemctl reload nginx

echo "✅ Nginx обновлен для домена $DOMAIN"

# Запрос email для Let's Encrypt
echo ""
read -p "Введите email для уведомлений Let's Encrypt: " EMAIL

if [ -z "$EMAIL" ]; then
    echo "❌ Email не может быть пустым"
    exit 1
fi

# Установка SSL сертификата
echo ""
echo "3️⃣ Установка SSL сертификата..."
echo "   Это займет 30-60 секунд..."
echo ""

certbot --nginx -d $DOMAIN -d www.$DOMAIN \
    --non-interactive \
    --agree-tos \
    --email $EMAIL \
    --redirect

if [ $? -eq 0 ]; then
    echo ""
    echo "======================================"
    echo "✅ Домен и SSL настроены успешно!"
    echo "======================================"
    echo ""
    echo "🌐 Ваше приложение доступно по адресу:"
    echo "   https://$DOMAIN"
    echo "   https://www.$DOMAIN"
    echo ""
    echo "🔒 SSL сертификат установлен и будет обновляться автоматически"
    echo ""
    echo "📝 Конфигурация Nginx:"
    echo "   /etc/nginx/sites-available/docxapp"
    echo ""
    echo "🔄 Сертификат обновится автоматически через certbot timer"
    systemctl status certbot.timer --no-pager | head -5
else
    echo ""
    echo "❌ Ошибка при установке SSL сертификата"
    echo ""
    echo "Возможные причины:"
    echo "1. DNS еще не обновился (подождите 30-60 минут)"
    echo "2. Домен недоступен из интернета"
    echo "3. Порты 80 и 443 закрыты в firewall"
    echo ""
    echo "Проверьте DNS командой:"
    echo "   dig +short $DOMAIN"
    echo ""
    echo "Попробуйте запустить скрипт снова через 30-60 минут"
    exit 1
fi
