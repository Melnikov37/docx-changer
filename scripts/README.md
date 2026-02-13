# Скрипты развертывания

Набор скриптов для установки и развертывания DOCX Template Filler на VPS.

## Быстрый деплой (рекомендуется)

### 1. Первая установка на VPS

На сервере выполните:

```bash
sudo bash install_full.sh
```

Этот скрипт установит:
- Python 3, pip, venv
- Nginx
- Docker и Docker Compose
- Приложение из GitHub
- MinIO в Docker контейнере
- Systemd сервис

### 2. Обновление приложения одной командой

**На вашем Mac** (из директории проекта):

```bash
./scripts/quick_deploy.sh
```

Этот скрипт автоматически:
1. ✅ Получит последние изменения из GitHub (git pull)
2. ✅ Отправит код на VPS (git push)
3. ✅ Обновит зависимости на сервере
4. ✅ Проверит и запустит MinIO
5. ✅ Перезапустит приложение

## Описание скриптов

### Локальные (запускаются на Mac)

| Скрипт | Описание |
|--------|----------|
| `quick_deploy.sh` | **Рекомендуется!** Одна команда для полного деплоя |
| `deploy_to_vps.sh` | Деплой на VPS (используется в quick_deploy.sh) |

### Серверные (запускаются на VPS)

| Скрипт | Описание |
|--------|----------|
| `install_full.sh` | Полная установка с нуля (включая Docker и MinIO) |
| `install_docker.sh` | Установка только Docker и Docker Compose |
| `update_vps.sh` | Обновление приложения на сервере |
| `install_vps.sh` | Установка без Docker (legacy) |
| `setup_domain_ssl.sh` | Настройка домена и SSL сертификата |
| `backup.sh` | Резервное копирование данных |

## Переменные окружения

На VPS создается файл `.env` с настройками MinIO:

```env
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minioadmin123
```

**⚠️ Важно:** Измените пароль в production!

## Архитектура на VPS

```
┌─────────────────────────────────────────┐
│             VPS Сервер                   │
├─────────────────────────────────────────┤
│                                          │
│  ┌──────────┐         ┌──────────┐      │
│  │  Nginx   │────────▶│  Flask   │      │
│  │  :80/443 │         │  :8000   │      │
│  └──────────┘         └──────────┘      │
│                            │             │
│                            ▼             │
│                    ┌──────────────┐      │
│                    │    MinIO     │      │
│                    │  (Docker)    │      │
│                    │  :9000/:9001 │      │
│                    └──────────────┘      │
│                            │             │
│                            ▼             │
│                    ┌──────────────┐      │
│                    │  SQLite DB   │      │
│                    │  templates.db│      │
│                    └──────────────┘      │
└─────────────────────────────────────────┘
```

## Проверка статуса

На VPS:

```bash
# Статус Flask приложения
sudo systemctl status docxapp

# Статус MinIO контейнера
docker ps | grep minio

# Логи приложения
journalctl -u docxapp -f

# Логи MinIO
docker logs docx-minio -f
```

## Полезные команды

### Перезапуск сервисов

```bash
# Перезапуск Flask приложения
sudo systemctl restart docxapp

# Перезапуск MinIO
docker restart docx-minio

# Перезапуск Nginx
sudo systemctl restart nginx
```

### Просмотр логов

```bash
# Логи приложения (последние 50 строк)
journalctl -u docxapp -n 50

# Логи в реальном времени
journalctl -u docxapp -f

# Логи MinIO
docker logs docx-minio --tail 100 -f
```

### Резервное копирование

```bash
# Создание бэкапа шаблонов и БД
./scripts/backup.sh

# Бэкапы сохраняются в ~/backups/
```

## Troubleshooting

### MinIO не запускается

```bash
# Проверить статус контейнера
docker ps -a | grep minio

# Посмотреть логи
docker logs docx-minio

# Перезапустить
cd ~/docx-template-filler
docker compose -f docker-compose.minio.yml restart
```

### Приложение не может подключиться к MinIO

```bash
# Проверить что MinIO работает
curl http://localhost:9000/minio/health/live

# Проверить переменные окружения
sudo systemctl show docxapp | grep Environment

# Перезапустить оба сервиса
docker restart docx-minio
sudo systemctl restart docxapp
```

### Ошибка "Permission denied" при Docker

```bash
# Добавить пользователя в группу docker
sudo usermod -aG docker docxapp

# Переключиться на пользователя для применения
su - docxapp
```

## Миграция данных

### Экспорт шаблонов из старого сервера

```bash
# На старом сервере
cd ~/docx-template-filler
tar -czf templates-backup.tar.gz templates.db
docker run --rm -v minio-data:/data -v $(pwd):/backup alpine tar -czf /backup/minio-data.tar.gz /data
```

### Импорт на новый сервер

```bash
# На новом сервере
cd ~/docx-template-filler
tar -xzf templates-backup.tar.gz
docker run --rm -v minio-data:/data -v $(pwd):/backup alpine tar -xzf /backup/minio-data.tar.gz -C /
```

## Безопасность

### Рекомендации для production

1. **Измените пароли MinIO** в `.env`:
   ```env
   MINIO_ROOT_USER=admin
   MINIO_ROOT_PASSWORD=сложный_пароль_минимум_16_символов
   ```

2. **Обновите systemd сервис** с новыми паролями:
   ```bash
   sudo nano /etc/systemd/system/docxapp.service
   sudo systemctl daemon-reload
   sudo systemctl restart docxapp
   ```

3. **Настройте SSL для MinIO Console** (опционально):
   - MinIO Console доступен только на localhost:9001
   - Для удаленного доступа используйте SSH туннель:
     ```bash
     ssh -L 9001:localhost:9001 root@your-server-ip
     ```
   - Откройте в браузере: http://localhost:9001

4. **Настройте firewall**:
   ```bash
   # Разрешить только HTTP/HTTPS и SSH
   ufw allow 22/tcp
   ufw allow 80/tcp
   ufw allow 443/tcp
   ufw enable
   ```

## Поддержка

При проблемах проверьте:
1. Логи приложения: `journalctl -u docxapp -n 100`
2. Логи MinIO: `docker logs docx-minio`
3. Статус сервисов: `systemctl status docxapp nginx docker`
4. Доступность портов: `netstat -tlnp | grep -E '8000|9000|9001'`
