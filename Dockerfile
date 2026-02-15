FROM python:3.9-slim

LABEL maintainer="your-email@example.com"
LABEL description="DOCX Template Filler - Web application for filling DOCX templates"

WORKDIR /app

# Установка системных зависимостей
RUN apt-get update && apt-get install -y \
    libxml2-dev \
    libxslt-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Копирование requirements и установка Python зависимостей
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt && \
    pip install --no-cache-dir gunicorn==21.2.0

# Копирование кода приложения
COPY . .

# Создание необходимых директорий
RUN mkdir -p uploads output docx_templates examples static/css static/js templates data

# Установка прав
RUN chmod -R 755 /app

# Экспонирование порта
EXPOSE 5000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:5000/health')" || exit 1

# Запуск приложения
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "2", "--timeout", "120", "--access-logfile", "-", "--error-logfile", "-", "app:app"]
