# DOCX Template Filler - Developer Guide

## Project Overview

**DOCX Template Filler** is a Flask-based web application that generates filled DOCX documents from templates using Jinja2 syntax. The application provides both dynamic form-based and JSON-based approaches for filling templates.

**Repository**: https://github.com/Melnikov37/docx-changer

### Key Features

- **Dynamic Forms**: Automatically parses DOCX templates and generates web forms
- **JSON Mode**: Manual JSON input for advanced use cases
- **Template Management**: Upload, store, and reuse templates
- **User Authentication**: Flask-Login based user system
- **S3 Storage**: MinIO-based object storage for templates and generated documents
- **History Tracking**: SQLite database for tracking generated documents
- **Docker Deployment**: Production-ready Docker Compose configuration with Nginx

---

## Technology Stack

### Backend
- **Python 3.9+**
- **Flask 3.0.0**: Web framework
- **Flask-Login 0.6.3**: User authentication
- **docxtpl 0.18.0**: Jinja2-based DOCX template rendering
- **python-docx 1.1.1+**: DOCX document manipulation
- **gunicorn 21.2.0**: WSGI HTTP server for production

### Storage
- **SQLite 3**: Metadata and user management
- **MinIO**: S3-compatible object storage for files
- **boto3 1.34.0**: S3 client library

### Frontend
- **Vanilla JavaScript**: Dynamic forms and file upload
- **HTML5 + CSS3**: Responsive UI

### Infrastructure
- **Docker & Docker Compose**: Containerization
- **Nginx**: Reverse proxy and SSL termination

---

## Project Structure

```
docx-changer/
├── app.py                      # Main Flask application
├── models.py                   # User model for Flask-Login
├── db.py                       # SQLite database operations
├── s3_client.py                # MinIO/S3 client wrapper
├── requirements.txt            # Python dependencies
├── Dockerfile                  # Docker image definition
├── docker-compose.yml          # Multi-container orchestration
├── .env.example                # Environment variables template
├── .gitignore                  # Git ignore rules
│
├── templates/                  # Jinja2 HTML templates
│   ├── index.html             # Main page
│   ├── login.html             # Login page
│   ├── register.html          # Registration page
│   ├── my_templates.html      # User templates list
│   └── history.html           # Generation history
│
├── static/                     # Static assets
│   ├── css/
│   │   └── style.css          # Application styles
│   ├── js/
│   │   └── app.js             # Client-side logic
│   └── favicon.svg            # Application icon
│
├── docx_templates/             # Example DOCX templates
│   ├── example.docx
│   └── ...
│
├── examples/                   # Example JSON data files
│   ├── example_data.json
│   └── ...
│
├── scripts/                    # Deployment and maintenance scripts
│   ├── deploy/                # Deployment scripts
│   ├── install/               # Installation scripts
│   ├── minio/                 # MinIO setup scripts
│   ├── fix/                   # Fix scripts
│   └── utils/                 # Utility scripts
│
├── docs/                       # Documentation (created)
│   ├── deployment/            # Deployment guides
│   ├── guides/                # User guides (Russian)
│   ├── QUICKSTART.md
│   ├── FEATURES.md
│   ├── PROJECT_STATUS.md
│   └── CHANGELOG.md
│
├── nginx/                      # Nginx configuration
│   └── nginx.conf
│
├── ssl/                        # SSL certificates (gitignored)
│
├── uploads/                    # Temporary file uploads (gitignored)
├── output/                     # Generated documents (gitignored)
├── data/                       # SQLite database (gitignored in .env)
└── venv/                       # Python virtual environment (gitignored)
```

---

## Database Schema

### Tables

#### `users`
```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT 1
);
```

#### `templates`
```sql
CREATE TABLE templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    s3_key TEXT NOT NULL UNIQUE,
    description TEXT,
    variables TEXT,                -- JSON string of extracted variables
    user_id INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### `generated_documents`
```sql
CREATE TABLE generated_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_name TEXT NOT NULL,
    output_filename TEXT NOT NULL,
    s3_key TEXT NOT NULL UNIQUE,
    json_data TEXT,                -- JSON string of filled data
    file_size INTEGER,
    user_id INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## API Endpoints

### Public Routes

#### `GET /`
Main page - template upload and document generation

#### `GET /login`
User login page

#### `POST /login`
Authenticate user with username and password

#### `GET /register`
User registration page

#### `POST /register`
Create new user account

#### `GET /logout`
Logout current user

#### `GET /health`
Health check endpoint for monitoring
- Returns: `{"status": "ok"}`

### Protected Routes (Require Authentication)

#### `POST /upload`
Upload DOCX template
- **Request**: `multipart/form-data` with `file` field
- **Response**:
  ```json
  {
    "success": true,
    "filename": "template.docx",
    "variables": ["name", "date", "items"]
  }
  ```

#### `POST /generate`
Generate filled document from template
- **Request**:
  ```json
  {
    "template": "template.docx",
    "data": {
      "name": "John Doe",
      "date": "2026-02-16"
    }
  }
  ```
- **Response**: DOCX file download

#### `GET /my-templates`
List user's saved templates

#### `GET /history`
List user's generated documents history

#### `DELETE /template/<int:template_id>`
Delete saved template

#### `DELETE /document/<int:doc_id>`
Delete generated document from history

---

## Environment Configuration

### Required Environment Variables

Create `.env` file from `.env.example`:

```bash
# Flask secret key (generate with: python3 -c "import secrets; print(secrets.token_hex(32))")
SECRET_KEY=your-secret-key-here

# MinIO credentials
MINIO_ROOT_USER=your-minio-user
MINIO_ROOT_PASSWORD=your-strong-password

# Optional: S3 configuration
S3_ENDPOINT=minio:9000
S3_BUCKET=templates
FLASK_ENV=production

# Optional: SSL certificates
SSL_CERT_PATH=./ssl/certificate.crt
SSL_KEY_PATH=./ssl/private.key
```

### Security Notes

- **NEVER** commit `.env` to git
- Use strong passwords for production MinIO
- Generate unique `SECRET_KEY` for each deployment
- The application validates against weak default credentials in production

---

## Local Development

### Prerequisites

- Python 3.9+
- pip
- virtualenv (recommended)

### Setup

1. **Clone the repository**
   ```bash
   cd /Users/m.melnikov/projects/docx-changer
   ```

2. **Create virtual environment**
   ```bash
   python3 -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your values
   ```

5. **Initialize database**
   ```bash
   python3 -c "import db; db.init_db(); db.migrate_db()"
   ```

6. **Run development server**
   ```bash
   python app.py
   ```

   Application will be available at `http://localhost:5000`

### Development Workflow

- Application runs in debug mode when `FLASK_ENV=development`
- Temporary files in `uploads/` and `output/` are auto-cleaned
- SQLite database is created in `data/templates.db` by default
- Use MinIO locally or set S3 credentials for remote storage

---

## Production Deployment

### Docker Compose Deployment (Recommended)

1. **Prepare environment**
   ```bash
   cd /Users/m.melnikov/projects/docx-changer
   cp .env.example .env
   # Edit .env with production values
   ```

2. **Generate SSL certificates** (if needed)
   ```bash
   # Self-signed (for testing)
   ./scripts/install_ssl_manual.sh

   # Or use Let's Encrypt
   ./scripts/setup_domain_ssl.sh yourdomain.com
   ```

3. **Start services**
   ```bash
   docker-compose up -d
   ```

4. **Check logs**
   ```bash
   docker-compose logs -f web
   ```

### Services Architecture

```
[Internet]
    ↓ (80/443)
[Nginx Reverse Proxy]
    ↓ (5000)
[Flask App (Gunicorn)]
    ↓ (9000)
[MinIO S3 Storage]
```

- **Nginx**: Handles SSL, static files, reverse proxy
- **Flask**: Application logic, template processing
- **MinIO**: Object storage for DOCX files

### Health Checks

All services include health checks:
- **Nginx**: `curl http://localhost:80/health`
- **Flask**: `curl http://localhost:5000/health`
- **MinIO**: `mc ready local`

---

## Security Features

### Input Validation

1. **File Upload Security**
   - Max file size: 10 MB
   - Allowed extensions: `.docx` only
   - Path traversal protection via `secure_filename()`
   - Zip bomb protection (checks uncompressed size)

2. **User Authentication**
   - Password hashing with `werkzeug.security`
   - Flask-Login session management
   - CSRF protection via Flask secret key

3. **S3 Security**
   - Validates credentials strength in production
   - Rejects common weak passwords
   - Connection timeouts and retries configured

### Data Access Control

- Users can only access their own templates and documents
- Database queries include `user_id` checks
- S3 keys are UUID-based to prevent guessing

---

## Common Tasks for Claude Agent

### 1. Adding New Features

When asked to add features:
- Read `app.py` to understand current routes
- Check `templates/` for HTML structure
- Update `static/js/app.js` for client-side logic
- Add database migrations in `db.py` if needed

### 2. Fixing Bugs

When investigating bugs:
- Check application logs: `docker-compose logs -f web`
- Review Flask error messages in browser
- Test locally first before deploying

### 3. Updating Dependencies

When updating packages:
- Update `requirements.txt`
- Test in virtual environment first
- Rebuild Docker image: `docker-compose build web`
- Restart: `docker-compose up -d`

### 4. Database Migrations

When modifying database schema:
- Update table definitions in `db.py`
- Add migration logic to `migrate_db()` function
- Test migration with existing data

### 5. Deployment Scripts

Available scripts in `scripts/`:
- `setup_env.sh`: Initial environment setup
- `quick_deploy.sh`: Quick deployment
- `update_vps.sh`: Safe production update
- `install_ssl_*.sh`: SSL certificate installation

### 6. Working with Templates

When creating DOCX templates:
- Use Jinja2 syntax: `{{ variable }}`, `{% for %}`, `{% if %}`
- Place examples in `docx_templates/`
- Create matching JSON in `examples/`

---

## Troubleshooting

### Issue: "Invalid JSON" Error

**Solution**: Check JSON syntax in browser console
- All strings must use double quotes
- No trailing commas
- Validate with online JSON validator

### Issue: Variables Not Replaced

**Solution**:
- Check exact name match (case-sensitive)
- Ensure Jinja2 syntax: `{{name}}` not `{name}`
- Verify variable exists in JSON data

### Issue: MinIO Connection Failed

**Solution**:
- Check MinIO is running: `docker-compose ps minio`
- Verify credentials in `.env`
- Check S3_ENDPOINT setting

### Issue: Database Locked

**Solution**:
- SQLite doesn't support high concurrency
- Restart application: `docker-compose restart web`
- Consider PostgreSQL for high-load scenarios

---

## Testing

### Manual Testing

1. **Upload Template**
   - Go to http://localhost:5000
   - Upload `docx_templates/example.docx`
   - Verify variables are extracted

2. **Generate Document**
   - Fill form or paste JSON
   - Click "Generate"
   - Download and verify output

3. **Test Authentication**
   - Register new user
   - Login/logout
   - Verify templates are user-specific

### Automated Testing

Test files are available:
- `test_parser.py`: Template parsing tests
- `test_converted.py`: Document conversion tests

Run tests:
```bash
pytest test_*.py
```

---

## Git Workflow

### Before Making Changes

```bash
# Create new branch
git checkout -b feature/your-feature-name

# Sync with latest main
git pull origin main
```

### After Making Changes

```bash
# Stage changes
git add <files>

# Commit with descriptive message
git commit -m "feat: add new feature"

# Push to remote
git push -u origin feature/your-feature-name
```

### Important Git Rules

- **NEVER use `git push --force`**
- **NEVER merge main into working branch automatically**
- If errors occur during git operations, **STOP and report**
- Batch git commands when possible: `git add . && git commit && git push`

---

## Documentation

### User Documentation (Russian)

Located in `docs/guides/`:
- `БЫСТРЫЙ_СТАРТ_РФ.md`: Quick start guide
- `ИНСТРУКЦИЯ_ДЛЯ_НОВИЧКОВ.md`: Beginner's guide
- `ВАШИ_ДОКУМЕНТЫ.md`: Your documents guide
- `НАСТРОЙКА_ДОМЕНА_И_SSL.md`: Domain and SSL setup
- `ОБНОВЛЕНИЕ_НА_VPS.md`: VPS update guide
- `УСТАНОВКА_SSL_ВРУЧНУЮ.md`: Manual SSL installation

### Deployment Documentation

Located in `docs/deployment/`:
- `DEPLOYMENT.md`: General deployment guide
- `DEPLOYMENT_RUSSIA.md`: Russia-specific deployment
- `DEPLOY_SUMMARY.md`: Deployment summary
- `QUICK_DEPLOY.md`: Quick deployment guide

### Project Documentation

Located in `docs/`:
- `QUICKSTART.md`: Quick start for developers
- `FEATURES.md`: Feature list
- `PROJECT_STATUS.md`: Project status and roadmap
- `CHANGELOG.md`: Version history

---

## Contact & Support

- **GitHub Issues**: https://github.com/Melnikov37/docx-changer/issues
- **Repository**: https://github.com/Melnikov37/docx-changer

---

## License

[Specify license here]

---

## Notes for Claude Agent

When working on this project:

1. **Always read files before modifying** - never propose changes to code you haven't seen
2. **Preserve Russian comments** - all comments in code should remain in Russian
3. **Follow Python style** - tabs for indentation, max 130 chars per line
4. **Security first** - validate all inputs, use secure_filename(), check file sizes
5. **Test locally first** - always test in development before production
6. **Check git status** - ensure working tree is clean before major changes
7. **Document changes** - update CHANGELOG.md for significant changes
8. **Respect .gitignore** - never commit .env, venv/, uploads/, output/
9. **Ask before destructive operations** - git force push, database wipes, etc.
10. **Keep it simple** - avoid over-engineering, only add what's requested
