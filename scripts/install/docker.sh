#!/bin/bash

# Скрипт установки Docker и Docker Compose на VPS
# Запускать от root: sudo bash install_docker.sh

set -e

echo "🐳 Установка Docker и Docker Compose"
echo "====================================="

# Проверка root
if [ "$EUID" -ne 0 ]; then
    echo "❌ Запустите скрипт с правами root: sudo bash install_docker.sh"
    exit 1
fi

# Удаление старых версий Docker
echo "🗑️  Удаление старых версий Docker..."
apt remove -y docker docker-engine docker.io containerd runc 2>/dev/null || true

# Установка зависимостей
echo "📦 Установка зависимостей..."
apt update
apt install -y \
    ca-certificates \
    curl \
    gnupg \
    lsb-release

# Добавление GPG ключа Docker
echo "🔑 Добавление GPG ключа Docker..."
mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Добавление репозитория Docker
echo "📋 Добавление репозитория Docker..."
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

# Установка Docker
echo "🐳 Установка Docker..."
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Добавление пользователя docxapp в группу docker
if id -u docxapp > /dev/null 2>&1; then
    echo "👤 Добавление пользователя docxapp в группу docker..."
    usermod -aG docker docxapp
fi

# Запуск Docker
systemctl enable docker
systemctl start docker

# Проверка установки
echo ""
echo "✅ Проверка установки Docker:"
docker --version
docker compose version

echo ""
echo "====================================="
echo "✅ Docker установлен успешно!"
echo "====================================="
echo ""
echo "📝 Примечание: Для применения изменений группы пользователь docxapp"
echo "   должен выйти и войти снова, или выполните:"
echo "   su - docxapp"
echo ""
