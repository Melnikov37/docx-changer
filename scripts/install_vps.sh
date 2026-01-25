#!/bin/bash

# Скрипт автоматической установки приложения на VPS
# Запускать от root: sudo bash install_vps.sh

set -e

echo "🚀 Установка DOCX Template Filler на VPS"
echo "=========================================="

# Проверка, что скрипт запущен от root
if [ "$EUID" -ne 0 ]; then
    echo "❌ Запустите скрипт с sudo: sudo bash install_vps.sh"
    exit 1
fi

# Обновление системы
echo "📦 Обновление системы..."
apt update && apt upgrade -y

# Установка необходимых пакетов
echo "📦 Установка пакетов..."
apt install -y \
    python3 \
    python3-pip \
    python3-venv \
    nginx \
    certbot \
    python3-certbot-nginx \
    git \
    curl

# Создание пользователя для приложения
echo "👤 Создание пользователя docxapp..."
if ! id -u docxapp > /dev/null 2>&1; then
    adduser --disabled-password --gecos "" docxapp
    usermod -aG sudo docxapp
    echo "docxapp ALL=(ALL) NOPASSWD: /bin/systemctl restart docxapp, /bin/systemctl status docxapp, /bin/systemctl stop docxapp, /bin/systemctl start docxapp" >> /etc/sudoers
fi

# Переключение на пользователя docxapp
echo "📥 Клонирование репозитория..."
su - docxapp << 'EOF'
    # Запрос URL репозитория
    read -p "Введите URL вашего Git репозитория: " GIT_REPO

    # Клонирование
    git clone "$GIT_REPO" docx-template-filler
    cd docx-template-filler

    # Создание виртуального окружения
    python3 -m venv venv
    source venv/bin/activate

    # Установка зависимостей
    pip install --upgrade pip
    pip install -r requirements.txt
    pip install gunicorn

    # Создание необходимых директорий
    mkdir -p uploads output docx_templates examples

    echo "✅ Приложение установлено в ~/docx-template-filler"
EOF

# Создание директории для логов
echo "📝 Настройка логов..."
mkdir -p /var/log/docxapp
chown docxapp:www-data /var/log/docxapp

# Копирование systemd сервиса
echo "⚙️  Настройка systemd сервиса..."
cat > /etc/systemd/system/docxapp.service << 'SYSTEMD'
[Unit]
Description=DOCX Template Filler Web Application
After=network.target

[Service]
Type=notify
User=docxapp
Group=www-data
WorkingDirectory=/home/docxapp/docx-template-filler
Environment="PATH=/home/docxapp/docx-template-filler/venv/bin"
ExecStart=/home/docxapp/docx-template-filler/venv/bin/gunicorn --bind 127.0.0.1:8000 --workers 2 --timeout 120 app:app
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
SYSTEMD

# Запуск сервиса
systemctl daemon-reload
systemctl enable docxapp
systemctl start docxapp

# Проверка статуса
sleep 2
systemctl status docxapp --no-pager

# Настройка Nginx
echo "🌐 Настройка Nginx..."
read -p "Введите ваш домен (например, example.com): " DOMAIN

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

# Активация конфигурации
ln -sf /etc/nginx/sites-available/docxapp /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx

echo ""
echo "=========================================="
echo "✅ Установка завершена!"
echo "=========================================="
echo ""
echo "📋 Следующие шаги:"
echo ""
echo "1. Настройте DNS для вашего домена $DOMAIN"
echo "   Добавьте A-запись, указывающую на IP этого сервера"
echo ""
echo "2. Установите SSL сертификат:"
echo "   sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN"
echo ""
echo "3. Проверьте работу приложения:"
echo "   curl http://localhost:8000/health"
echo ""
echo "4. Откройте в браузере:"
echo "   http://$DOMAIN"
echo ""
echo "📝 Полезные команды:"
echo "   sudo systemctl status docxapp   # Статус"
echo "   sudo systemctl restart docxapp  # Перезапуск"
echo "   sudo journalctl -u docxapp -f   # Логи"
echo ""
