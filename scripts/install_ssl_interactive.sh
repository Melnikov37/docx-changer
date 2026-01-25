#!/bin/bash

# Интерактивная установка SSL сертификата
# Запускать на VPS: bash install_ssl_interactive.sh
#
# Скрипт запросит содержимое сертификата и ключа
# Просто скопируйте их из панели Timeweb и вставьте в терминал

set -e

echo "🔐 Интерактивная установка SSL сертификата"
echo "==========================================="
echo ""

# Проверка root
if [ "$EUID" -ne 0 ]; then
    echo "❌ Запустите скрипт с правами root: sudo bash install_ssl_interactive.sh"
    exit 1
fi

# Запрос домена
echo "Шаг 1: Введите ваш домен"
echo "------------------------"
read -p "Домен (например: docxfiller.ru): " DOMAIN

if [ -z "$DOMAIN" ]; then
    echo "❌ Домен не может быть пустым"
    exit 1
fi

echo ""
echo "✅ Домен: $DOMAIN"
echo ""

# Создание директории для SSL
SSL_DIR="/etc/nginx/ssl"
mkdir -p $SSL_DIR

# Запрос сертификата
echo "Шаг 2: Вставьте содержимое сертификата (CRT)"
echo "----------------------------------------------"
echo "Откройте панель Timeweb → SSL-сертификаты → ваш сертификат"
echo "Скопируйте ПОЛНОСТЬЮ содержимое поля 'Certificate (CRT)'"
echo "Вставьте ниже и нажмите Ctrl+D на новой строке для завершения:"
echo ""

# Читаем сертификат построчно до EOF (Ctrl+D)
CERT_CONTENT=$(cat)

if [ -z "$CERT_CONTENT" ]; then
    echo "❌ Сертификат не может быть пустым"
    exit 1
fi

# Проверка что это похоже на сертификат
if ! echo "$CERT_CONTENT" | grep -q "BEGIN CERTIFICATE"; then
    echo "⚠️  ВНИМАНИЕ: Содержимое не похоже на сертификат"
    echo "Убедитесь что скопировали текст от -----BEGIN CERTIFICATE----- до -----END CERTIFICATE-----"
    read -p "Продолжить? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Отменено."
        exit 1
    fi
fi

# Сохраняем сертификат
echo "$CERT_CONTENT" > $SSL_DIR/$DOMAIN.crt
echo ""
echo "✅ Сертификат сохранен в $SSL_DIR/$DOMAIN.crt"
echo ""

# Запрос приватного ключа
echo "Шаг 3: Вставьте содержимое приватного ключа (Private KEY)"
echo "----------------------------------------------------------"
echo "В панели Timeweb скопируйте ПОЛНОСТЬЮ содержимое поля 'Private KEY'"
echo "Вставьте ниже и нажмите Ctrl+D на новой строке для завершения:"
echo ""

# Читаем ключ построчно до EOF (Ctrl+D)
KEY_CONTENT=$(cat)

if [ -z "$KEY_CONTENT" ]; then
    echo "❌ Приватный ключ не может быть пустым"
    exit 1
fi

# Проверка что это похоже на ключ
if ! echo "$KEY_CONTENT" | grep -q "BEGIN.*PRIVATE KEY"; then
    echo "⚠️  ВНИМАНИЕ: Содержимое не похоже на приватный ключ"
    echo "Убедитесь что скопировали текст от -----BEGIN ... PRIVATE KEY----- до -----END ... PRIVATE KEY-----"
    read -p "Продолжить? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Отменено."
        exit 1
    fi
fi

# Сохраняем ключ
echo "$KEY_CONTENT" > $SSL_DIR/$DOMAIN.key
echo ""
echo "✅ Приватный ключ сохранен в $SSL_DIR/$DOMAIN.key"
echo ""

# Установка прав
chmod 600 $SSL_DIR/$DOMAIN.key
chmod 644 $SSL_DIR/$DOMAIN.crt

echo "✅ Права доступа установлены"
echo ""

# Создание конфигурации Nginx
echo "Шаг 4: Настройка Nginx"
echo "-----------------------"

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
    ssl_certificate $SSL_DIR/$DOMAIN.crt;
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

echo "✅ Конфигурация Nginx создана"
echo ""

# Проверка конфигурации
echo "Шаг 5: Проверка конфигурации Nginx"
echo "------------------------------------"
nginx -t

if [ $? -ne 0 ]; then
    echo "❌ Ошибка в конфигурации Nginx"
    echo "Проверьте файлы:"
    echo "  - $SSL_DIR/$DOMAIN.crt"
    echo "  - $SSL_DIR/$DOMAIN.key"
    echo "  - /etc/nginx/sites-available/docxapp"
    exit 1
fi

echo "✅ Конфигурация валидна"
echo ""

# Перезапуск Nginx
echo "Шаг 6: Перезапуск Nginx"
echo "------------------------"
systemctl reload nginx

if [ $? -ne 0 ]; then
    echo "❌ Ошибка при перезапуске Nginx"
    echo "Проверьте логи: tail -f /var/log/nginx/error.log"
    exit 1
fi

echo "✅ Nginx перезапущен"
echo ""

# Удаление временных файлов
rm -f /tmp/private.key /tmp/certificate.crt /tmp/ca_bundle.crt /tmp/*.pem 2>/dev/null || true

# Проверка работы HTTPS
echo "Шаг 7: Проверка работы HTTPS"
echo "-----------------------------"
sleep 2

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://$DOMAIN/ --insecure 2>/dev/null || echo "000")

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ HTTPS работает! (HTTP $HTTP_CODE)"
elif [ "$HTTP_CODE" = "301" ] || [ "$HTTP_CODE" = "302" ]; then
    echo "✅ HTTPS работает с редиректом (HTTP $HTTP_CODE)"
else
    echo "⚠️  HTTPS возвращает код: $HTTP_CODE"
    echo "Возможно, нужно подождать несколько минут пока DNS обновится"
fi

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
echo "   Сертификат: $SSL_DIR/$DOMAIN.crt"
echo "   Ключ: $SSL_DIR/$DOMAIN.key (права: 600)"
echo ""
echo "🔍 Проверьте в браузере: https://$DOMAIN"
echo ""
echo "📊 Статус сервисов:"
systemctl status nginx --no-pager -l | head -5
echo ""
systemctl status docxapp --no-pager -l | head -5
echo ""
echo "🎉 Готово! Откройте браузер и проверьте зеленый замочек 🔒"
echo ""
