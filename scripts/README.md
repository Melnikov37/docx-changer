# Скрипты развертывания и управления

Организованная структура скриптов для установки, деплоя и обслуживания DOCX Template Filler.

## 📁 Структура

```
scripts/
├── deploy/           # Деплой и обновление
│   ├── update.sh    # Локальное обновление на VPS
│   └── remote.sh    # Удаленный деплой (для GitHub Actions)
├── install/         # Первоначальная установка
│   ├── full.sh      # Полная установка (Python + Nginx + Docker + MinIO)
│   └── docker.sh    # Установка только Docker
├── fix/             # Исправление проблем
│   ├── all.sh       # Исправить всё (домен + SSL + MinIO)
│   └── hostname.sh  # Восстановить домен и SSL
├── minio/           # MinIO конфигурация
│   ├── enable_console.sh  # Открыть порт MinIO Console
│   └── setup_nginx.sh     # Настроить Nginx reverse proxy
└── utils/           # Утилиты
    └── backup.sh    # Создать бэкап данных
```

## 🚀 Быстрый старт

### Автоматический деплой (GitHub Actions)

**Настройте один раз:**

1. Добавьте Secrets в GitHub:
   - `SSH_PRIVATE_KEY` - приватный SSH ключ
   - `VPS_HOST` - IP сервера (85.239.39.232)
   - `VPS_USER` - пользователь (root)

2. Деплой происходит автоматически при push в `main`:
   ```bash
   git push origin main
   # GitHub Actions автоматически обновит VPS
   ```

См. [.github/workflows/README.md](../.github/workflows/README.md) для деталей.

### Ручной деплой

```bash
# На VPS - обновить приложение
./scripts/deploy/update.sh

# С Mac - удаленный деплой
./scripts/deploy/remote.sh 85.239.39.232 root
```

## 📖 Использование

### Деплой и обновление

#### Локальное обновление (на VPS)

```bash
ssh root@85.239.39.232
cd /home/docxapp/docx-template-filler

# Безопасное обновление
./scripts/deploy/update.sh

# С опциями
./scripts/deploy/update.sh --skip-restart  # Не перезапускать сервис
./scripts/deploy/update.sh --skip-minio    # Не проверять MinIO
```

#### Удаленный деплой (с Mac)

```bash
# С паролем/ключом из ~/.ssh
./scripts/deploy/remote.sh 85.239.39.232 root

# С указанием ключа
./scripts/deploy/remote.sh 85.239.39.232 root --key-file ~/.ssh/id_rsa

# Через переменные окружения (для CI/CD)
export SSH_HOST=85.239.39.232
export SSH_USER=root
export SSH_KEY="$(cat ~/.ssh/id_rsa)"
./scripts/deploy/remote.sh
```

### Установка

#### Первая установка на новый VPS

```bash
# Полная установка (Python + Nginx + Docker + MinIO + приложение)
curl -fsSL https://raw.githubusercontent.com/Melnikov37/docx-changer/main/scripts/install/full.sh | sudo bash
```

#### Установка только Docker

```bash
curl -fsSL https://raw.githubusercontent.com/Melnikov37/docx-changer/main/scripts/install/docker.sh | sudo bash
```

### Исправление проблем

#### Восстановить всё после сбоя

```bash
# Восстановит домен, SSL, MinIO
curl -fsSL https://raw.githubusercontent.com/Melnikov37/docx-changer/main/scripts/fix/all.sh | sudo bash
# Введите домен: docxfiller.ru
```

#### Восстановить только домен и SSL

```bash
curl -fsSL https://raw.githubusercontent.com/Melnikov37/docx-changer/main/scripts/fix/hostname.sh | sudo bash
```

### MinIO

#### Открыть доступ к MinIO Console из интернета

```bash
sudo ./scripts/minio/enable_console.sh
# Откроется http://your-ip:9001
```

#### Настроить Nginx reverse proxy для MinIO

```bash
sudo ./scripts/minio/setup_nginx.sh
# Введите домен: minio.docxfiller.ru
# Затем установите SSL: certbot --nginx -d minio.docxfiller.ru
```

### Утилиты

#### Создать бэкап

```bash
./scripts/utils/backup.sh
# Бэкапы сохраняются в ~/backups/
```

## 🔐 GitHub Actions Secrets

Для автоматического деплоя нужны:

| Secret | Где взять | Пример |
|--------|-----------|--------|
| `SSH_PRIVATE_KEY` | `cat ~/.ssh/id_rsa` | `-----BEGIN OPENSSH...` |
| `VPS_HOST` | IP вашего сервера | `85.239.39.232` |
| `VPS_USER` | SSH пользователь | `root` |

### Как создать SSH ключ:

```bash
# Генерация ключа
ssh-keygen -t ed25519 -C "github-actions" -f ~/.ssh/github_actions

# Добавление на VPS
ssh-copy-id -i ~/.ssh/github_actions.pub root@85.239.39.232

# Копирование приватного ключа для GitHub
cat ~/.ssh/github_actions
# Вставьте в GitHub → Settings → Secrets → SSH_PRIVATE_KEY
```

## 🎯 Workflows

### Deploy (`deploy.yml`)
- **Триггер:** Push в `main`
- **Действие:** Обновляет код на VPS
- **Ручной запуск:** Actions → Deploy to VPS → Run workflow

### Test (`test.yml`)
- **Триггер:** Push/PR
- **Действие:** Проверяет синтаксис Python, зависимости
- **Автоматически:** Да

### Backup (`backup.yml`)
- **Триггер:** Каждое воскресенье в 3:00 UTC
- **Действие:** Создает бэкапы БД и MinIO
- **Ручной запуск:** Actions → Scheduled Backup → Run workflow

## 📊 Мониторинг

### Проверка статуса после деплоя

```bash
# На VPS
sudo systemctl status docxapp
sudo systemctl status nginx
docker ps | grep minio

# Логи
sudo journalctl -u docxapp -n 50
sudo journalctl -u docxapp -f  # В реальном времени
```

### GitHub Actions статус

GitHub → Actions → выберите workflow → просмотр логов

## 🔧 Переменные окружения

Скрипты поддерживают переменные окружения:

```bash
# Для deploy/update.sh
SKIP_RESTART=true ./scripts/deploy/update.sh
SKIP_MINIO=true ./scripts/deploy/update.sh

# Для deploy/remote.sh
SSH_HOST=85.239.39.232 SSH_USER=root ./scripts/deploy/remote.sh
```

## 📝 Важные заметки

### Что НЕ перезаписывается

При обновлении через `deploy/update.sh` НЕ изменяется:
- ✅ Nginx конфигурация
- ✅ Домен и SSL сертификаты
- ✅ Пароли MinIO (.env файл)
- ✅ Существующие данные в MinIO
- ✅ База данных templates.db

### Безопасность

- Все скрипты используют `set -e` (останавливаются при ошибке)
- SSH ключи автоматически удаляются после использования
- Приватные ключи никогда не логируются
- MinIO credentials хранятся в .env (не в git)

## 🆘 Troubleshooting

### Деплой не работает

1. **Проверьте SSH доступ:**
   ```bash
   ssh root@85.239.39.232 "echo 'OK'"
   ```

2. **Проверьте GitHub Secrets:**
   - Settings → Secrets → все 3 секрета должны быть заполнены

3. **Проверьте логи на VPS:**
   ```bash
   sudo journalctl -u docxapp -n 100
   ```

### MinIO не запускается

```bash
# Проверка контейнера
docker ps -a | grep minio

# Логи
docker logs docx-minio

# Перезапуск
cd /home/docxapp/docx-template-filler
docker compose -f docker-compose.minio.yml restart
```

### Приложение не отвечает

```bash
# Проверка статуса
sudo systemctl status docxapp

# Перезапуск
sudo systemctl restart docxapp

# Логи
sudo journalctl -u docxapp -f
```

## 🔄 Миграция со старых скриптов

Старые скрипты (в корне scripts/) DEPRECATED:

| Старый | Новый | Статус |
|--------|-------|--------|
| `update_safe.sh` | `deploy/update.sh` | ✅ Используйте новый |
| `quick_deploy.sh` | `deploy/remote.sh` | ✅ Используйте новый |
| `deploy_to_vps.sh` | `deploy/remote.sh` | ✅ Используйте новый |
| `install_full.sh` | `install/full.sh` | ✅ Используйте новый |
| `fix_all.sh` | `fix/all.sh` | ✅ Используйте новый |

Старые скрипты будут удалены в следующей версии.

## 📚 Дополнительная документация

- [GitHub Actions README](../.github/workflows/README.md) - детали CI/CD
- [Deployment Guide](../DEPLOYMENT.md) - полное руководство по деплою
- [MinIO Setup](../docs/minio.md) - настройка MinIO

## 💡 Best Practices

1. **Всегда используйте GitHub Actions** для деплоя в production
2. **Тестируйте локально** перед push в main
3. **Проверяйте бэкапы** раз в месяц
4. **Мониторьте логи** после деплоя
5. **Обновляйте зависимости** регулярно

## 🎉 Примеры использования

### Сценарий 1: Обновление кода

```bash
# На Mac
git add .
git commit -m "Add new feature"
git push origin main

# GitHub Actions автоматически обновит VPS
# Проверьте: GitHub → Actions
```

### Сценарий 2: Ручное обновление

```bash
# На VPS
ssh root@85.239.39.232
cd /home/docxapp/docx-template-filler
./scripts/deploy/update.sh
```

### Сценарий 3: Восстановление после проблем

```bash
# Если сломался домен
curl -fsSL https://raw.githubusercontent.com/Melnikov37/docx-changer/main/scripts/fix/all.sh | sudo bash

# Если только код нужно обновить
./scripts/deploy/update.sh
```
