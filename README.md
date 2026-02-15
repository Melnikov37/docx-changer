# DOCX Template Filler

> Web application for filling DOCX templates using Jinja2 syntax

[![Python](https://img.shields.io/badge/Python-3.9+-blue.svg)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/Flask-3.0.0-green.svg)](https://flask.palletsprojects.com/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## Overview

DOCX Template Filler is a Flask-based web application that automatically generates filled Word documents from templates. It supports both dynamic form-based input and manual JSON data entry.

### Key Features

- **Dynamic Form Generation**: Upload a template and get an auto-generated web form
- **JSON Mode**: Advanced manual data input for complex scenarios
- **Template Management**: Save and reuse templates
- **User Authentication**: Multi-user support with Flask-Login
- **S3 Storage**: MinIO-based object storage for files
- **History Tracking**: Keep track of all generated documents
- **Docker Ready**: Production deployment with Docker Compose and Nginx

## Quick Start

### Local Development

```bash
# Clone repository
cd /Users/m.melnikov/projects/docx-changer

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your settings

# Run application
python app.py
```

Application will be available at: `http://localhost:5000`

### Docker Deployment

```bash
# Configure environment
cp .env.example .env
# Edit .env with production values

# Start services
docker-compose up -d

# Check status
docker-compose ps
```

Application will be available at: `http://localhost` (or your domain)

## How It Works

### 1. Create DOCX Template

Open Microsoft Word and create a document with Jinja2 tags:

```
Contract for: {{name}}
Date: {{date}}
Company: {{company}}

{% for item in items %}
- {{item.name}}: {{item.price}} USD
{% endfor %}

{% if has_discount %}
Discount: {{discount}}%
{% endif %}
```

### 2. Upload and Fill

- Upload your DOCX template
- Application automatically extracts all variables
- Fill the generated form or provide JSON data
- Click "Generate Document"
- Download your filled document

## Documentation

### For Developers

- **[CLAUDE.md](CLAUDE.md)** - Complete developer guide for Claude AI agent
  - Project architecture
  - Database schema
  - API endpoints
  - Development workflow
  - Troubleshooting guide

- **[docs/QUICKSTART.md](docs/QUICKSTART.md)** - Quick start guide
- **[docs/FEATURES.md](docs/FEATURES.md)** - Feature documentation
- **[docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md)** - Project roadmap
- **[docs/CHANGELOG.md](docs/CHANGELOG.md)** - Version history

### For Deployment

- **[docs/deployment/DEPLOYMENT.md](docs/deployment/DEPLOYMENT.md)** - General deployment guide
- **[docs/deployment/DEPLOYMENT_RUSSIA.md](docs/deployment/DEPLOYMENT_RUSSIA.md)** - Russia-specific deployment
- **[docs/deployment/QUICK_DEPLOY.md](docs/deployment/QUICK_DEPLOY.md)** - Quick deployment reference

### For Users (Russian)

- **[docs/guides/БЫСТРЫЙ_СТАРТ_РФ.md](docs/guides/БЫСТРЫЙ_СТАРТ_РФ.md)** - Быстрый старт
- **[docs/guides/ИНСТРУКЦИЯ_ДЛЯ_НОВИЧКОВ.md](docs/guides/ИНСТРУКЦИЯ_ДЛЯ_НОВИЧКОВ.md)** - Инструкция для новичков
- **[docs/guides/НАСТРОЙКА_ДОМЕНА_И_SSL.md](docs/guides/НАСТРОЙКА_ДОМЕНА_И_SSL.md)** - Настройка домена и SSL
- **[docs/guides/ОБНОВЛЕНИЕ_НА_VPS.md](docs/guides/ОБНОВЛЕНИЕ_НА_VPS.md)** - Обновление на VPS

## Project Structure

```
docx-changer/
├── app.py                  # Main Flask application
├── models.py               # User authentication models
├── db.py                   # Database operations
├── s3_client.py            # S3/MinIO storage client
├── requirements.txt        # Python dependencies
├── Dockerfile              # Docker image
├── docker-compose.yml      # Multi-container setup
│
├── templates/              # HTML templates
├── static/                 # CSS, JS, images
├── docx_templates/         # Example DOCX templates
├── examples/               # Example JSON data
├── scripts/                # Deployment scripts
├── docs/                   # Documentation
│   ├── deployment/        # Deployment guides
│   └── guides/            # User guides (Russian)
│
├── uploads/                # Temporary uploads (gitignored)
├── output/                 # Generated files (gitignored)
└── data/                   # SQLite database (gitignored)
```

## Technology Stack

- **Backend**: Python 3.9+, Flask 3.0, Flask-Login
- **Template Engine**: docxtpl (Jinja2-based)
- **Database**: SQLite 3
- **Storage**: MinIO (S3-compatible)
- **Production**: Gunicorn, Nginx, Docker Compose

## Examples

Example templates and data are provided in:
- `docx_templates/example.docx` - Sample template
- `examples/example_data.json` - Sample JSON data

## Security

- File upload validation (max 10MB, .docx only)
- Path traversal protection
- Zip bomb protection
- Password hashing with werkzeug
- User-specific data access control
- Production credential validation

## Requirements

- Python 3.9+
- Docker & Docker Compose (for production)
- Modern web browser

## Support

- **Issues**: [GitHub Issues](https://github.com/Melnikov37/docx-changer/issues)
- **Documentation**: See `docs/` directory
- **Developer Guide**: See `CLAUDE.md`

## License

[Specify license]

## Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/your-feature`
3. Commit changes: `git commit -m 'Add some feature'`
4. Push to branch: `git push origin feature/your-feature`
5. Open Pull Request

## Author

Maintained by Melnikov37

---

**For AI Agents**: See [CLAUDE.md](CLAUDE.md) for comprehensive project documentation and development guidelines.
