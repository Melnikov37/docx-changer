# UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Полностью перестроить оформление DOCX Template Filler — новый визуальный стиль (светлый, чистый), navbar с табами, отдельные страницы для шаблонов и истории вместо модалок.

**Architecture:** Bootstrap 5.3 с кастомизированными CSS-переменными. Navbar вынесен в base.html, каждый раздел (Генерация/Шаблоны/Справочники/История) — отдельная страница с Flask route. Модалки библиотеки и истории убираются из index.html, заменяясь полноценными страницами.

**Tech Stack:** Flask/Jinja2, Bootstrap 5.3, vanilla JS, CSS custom properties.

**Spec:** `docs/superpowers/specs/2026-03-29-ui-redesign-design.md`

---

## File Structure

### Modify:
- `static/css/style.css` — полная переработка стилей
- `templates/base.html` — добавить navbar с табами, блоки для контента
- `templates/index.html` — перестроить layout: убрать header с кнопками, убрать модалки библиотеки/истории, новый layout с шагами
- `templates/login.html` — обновить стили под новую палитру
- `templates/register.html` — обновить стили под новую палитру
- `templates/snippets.html` — наследовать от base.html, обновить стили
- `static/js/app.js` — адаптировать под новую HTML-структуру
- `app.py` — добавить routes для страниц шаблонов и истории

### Create:
- `templates/my_templates.html` — страница библиотеки шаблонов
- `templates/history.html` — страница истории документов
- `static/js/templates.js` — JS для страницы шаблонов
- `static/js/history.js` — JS для страницы истории

---

### Task 1: CSS — новая дизайн-система

**Files:**
- Modify: `static/css/style.css`

- [ ] **Step 1: Полностью переписать style.css**

Заменить содержимое `static/css/style.css` на новую дизайн-систему:

```css
/* ===== CSS Variables — дизайн-система ===== */
:root {
    --color-primary: #3b82f6;
    --color-primary-hover: #2563eb;
    --color-primary-light: #eff6ff;
    --color-primary-gradient: linear-gradient(135deg, #3b82f6, #6366f1);
    --color-success: #22c55e;
    --color-success-light: #f0fdf4;
    --color-success-border: #bbf7d0;
    --color-danger: #ef4444;
    --color-danger-light: #fef2f2;
    --color-warning: #f59e0b;
    --color-warning-light: #fffbeb;
    --color-text-primary: #0f172a;
    --color-text-secondary: #64748b;
    --color-text-muted: #94a3b8;
    --color-bg-page: #f8fafc;
    --color-bg-card: #ffffff;
    --color-bg-input: #f8fafc;
    --color-border: #e2e8f0;
    --color-border-light: #f1f5f9;
    --radius-sm: 6px;
    --radius-md: 8px;
    --radius-lg: 12px;
    --radius-xl: 16px;
    --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
    --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.07);
    --shadow-lg: 0 10px 25px -3px rgba(0, 0, 0, 0.1);
}

/* ===== Общие стили ===== */
body {
    background-color: var(--color-bg-page);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    font-size: 14px;
    color: var(--color-text-primary);
}

/* ===== Navbar ===== */
.app-navbar {
    background: var(--color-bg-card);
    border-bottom: 1px solid var(--color-border);
    height: 56px;
    position: sticky;
    top: 0;
    z-index: 1030;
}

.app-navbar .navbar-brand {
    display: flex;
    align-items: center;
    gap: 10px;
    font-weight: 700;
    font-size: 15px;
    color: var(--color-text-primary);
    letter-spacing: -0.3px;
    text-decoration: none;
}

.app-navbar .brand-icon {
    width: 32px;
    height: 32px;
    background: var(--color-primary-gradient);
    border-radius: var(--radius-md);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: 700;
    font-size: 14px;
}

.app-navbar .nav-tabs-custom {
    display: flex;
    gap: 2px;
    height: 56px;
    border: none;
    margin: 0;
    padding: 0;
    list-style: none;
}

.app-navbar .nav-tabs-custom .nav-link {
    display: flex;
    align-items: center;
    padding: 0 16px;
    color: var(--color-text-secondary);
    font-size: 13px;
    font-weight: 500;
    border: none;
    border-bottom: 2px solid transparent;
    border-radius: 0;
    background: none;
    transition: color 0.2s, border-color 0.2s;
    white-space: nowrap;
}

.app-navbar .nav-tabs-custom .nav-link:hover {
    color: var(--color-text-primary);
}

.app-navbar .nav-tabs-custom .nav-link.active {
    color: var(--color-primary);
    font-weight: 600;
    border-bottom-color: var(--color-primary);
    background: none;
}

.app-navbar .nav-right {
    display: flex;
    align-items: center;
    gap: 8px;
}

.app-navbar .btn-help {
    padding: 6px 12px;
    background: var(--color-border-light);
    border-radius: var(--radius-sm);
    font-size: 12px;
    color: var(--color-text-secondary);
    border: none;
    cursor: pointer;
    transition: background 0.2s;
}

.app-navbar .btn-help:hover {
    background: var(--color-border);
}

.user-avatar {
    width: 28px;
    height: 28px;
    background: linear-gradient(135deg, #e0e7ff, #c7d2fe);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 600;
    color: #4338ca;
}

/* ===== Контент страниц ===== */
.page-content {
    max-width: 640px;
    margin: 0 auto;
    padding: 32px 24px;
}

.page-content-wide {
    max-width: 960px;
    margin: 0 auto;
    padding: 32px 24px;
}

/* ===== Шаги (numbered steps) ===== */
.step-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 16px;
}

.step-badge {
    width: 28px;
    height: 28px;
    background: var(--color-primary-light);
    color: var(--color-primary);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    font-weight: 700;
    flex-shrink: 0;
}

.step-title {
    font-size: 15px;
    font-weight: 600;
    color: var(--color-text-primary);
    margin: 0;
}

/* ===== Drop zone ===== */
.drop-zone {
    background: var(--color-bg-card);
    border: 2px dashed #cbd5e1;
    border-radius: var(--radius-lg);
    padding: 40px 24px;
    text-align: center;
    transition: all 0.2s ease;
    cursor: pointer;
    position: relative;
}

.drop-zone:hover {
    border-color: var(--color-primary);
    background: var(--color-primary-light);
}

.drop-zone.drag-over {
    border-color: var(--color-primary);
    border-width: 3px;
    background: var(--color-primary-light);
    transform: scale(1.01);
}

.drop-zone-icon {
    font-size: 40px;
    color: var(--color-text-muted);
    margin-bottom: 8px;
}

.drop-zone-text {
    color: var(--color-text-secondary);
    font-size: 14px;
    margin-bottom: 12px;
}

.drop-zone .btn-select-file {
    display: inline-block;
    padding: 8px 20px;
    background: var(--color-border-light);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    font-size: 13px;
    color: var(--color-text-secondary);
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;
}

.drop-zone .btn-select-file:hover {
    background: var(--color-border);
}

/* ===== Информация о файле ===== */
.file-info {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    background: var(--color-success-light);
    border: 1px solid var(--color-success-border);
    border-radius: var(--radius-md);
}

.file-info .file-name {
    font-weight: 500;
    color: #166534;
    flex-grow: 1;
}

/* ===== Карточки ===== */
.app-card {
    background: var(--color-bg-card);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-sm);
    margin-bottom: 24px;
}

.app-card-body {
    padding: 24px;
}

.app-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 24px;
    border-bottom: 1px solid var(--color-border);
}

/* ===== Переключатель форма/JSON (pill toggle) ===== */
.pill-toggle {
    display: flex;
    background: var(--color-border-light);
    border-radius: var(--radius-md);
    padding: 2px;
    gap: 2px;
}

.pill-toggle .btn-check + .btn {
    padding: 6px 14px;
    font-size: 12px;
    color: var(--color-text-secondary);
    border: none;
    border-radius: var(--radius-sm);
    background: none;
    transition: all 0.2s;
}

.pill-toggle .btn-check:checked + .btn {
    background: var(--color-bg-card);
    color: var(--color-text-primary);
    font-weight: 500;
    box-shadow: var(--shadow-sm);
}

/* ===== Поля формы ===== */
.form-field {
    margin-bottom: 16px;
}

.form-field label {
    display: block;
    font-size: 13px;
    font-weight: 500;
    color: #334155;
    margin-bottom: 6px;
}

.form-field .form-control {
    padding: 10px 14px;
    background: var(--color-bg-input);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    font-size: 14px;
    transition: border-color 0.2s, box-shadow 0.2s;
}

.form-field .form-control:focus {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
    background: var(--color-bg-card);
}

/* ===== Snippet поле ===== */
.snippet-field {
    padding: 12px 14px;
    background: var(--color-success-light);
    border: 1px solid var(--color-success-border);
    border-radius: var(--radius-md);
    margin-bottom: 16px;
}

.snippet-field label {
    font-size: 13px;
    font-weight: 500;
    color: #166534;
    margin-bottom: 2px;
}

.snippet-field .snippet-hint {
    font-size: 11px;
    color: #15803d;
}

.snippet-field select {
    margin-top: 8px;
}

/* ===== Кнопки ===== */
.btn-generate {
    width: 100%;
    padding: 14px;
    background: var(--color-primary-gradient);
    border: none;
    border-radius: 10px;
    color: white;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 4px 14px rgba(59, 130, 246, 0.3);
    transition: transform 0.15s, box-shadow 0.15s;
}

.btn-generate:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 20px rgba(59, 130, 246, 0.4);
}

.btn-generate:active {
    transform: translateY(0);
}

.btn-generate:disabled {
    background: #94a3b8;
    box-shadow: none;
    cursor: not-allowed;
}

/* ===== Textarea JSON ===== */
#jsonData {
    font-size: 13px;
    font-family: 'SF Mono', 'Fira Code', 'Fira Mono', 'Roboto Mono', monospace;
    resize: vertical;
    min-height: 250px;
    padding: 14px;
    background: var(--color-bg-input);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
}

#jsonData:focus {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
    background: var(--color-bg-card);
}

/* ===== Toast notifications ===== */
.toast-container {
    position: fixed;
    top: 68px;
    right: 20px;
    z-index: 9999;
}

.toast {
    min-width: 300px;
    box-shadow: var(--shadow-lg);
    border-radius: var(--radius-md);
    animation: slideInRight 0.3s ease;
}

@keyframes slideInRight {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
}

.toast-success {
    border-left: 4px solid var(--color-success);
}

.toast-error {
    border-left: 4px solid var(--color-danger);
}

/* ===== Алерты ===== */
.alert {
    border-radius: var(--radius-md);
    animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
    from { opacity: 0; transform: translateY(-10px); }
    to { opacity: 1; transform: translateY(0); }
}

/* ===== Spinner в кнопке ===== */
.spinner-border-sm {
    width: 1rem;
    height: 1rem;
    border-width: 0.15em;
}

/* ===== Страницы авторизации ===== */
.auth-container {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-bg-page);
    padding: 2rem;
}

.auth-card {
    background: var(--color-bg-card);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-lg);
    padding: 2.5rem;
    width: 100%;
    max-width: 420px;
}

.auth-header {
    text-align: center;
    margin-bottom: 2rem;
}

.auth-brand {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    margin-bottom: 24px;
}

.auth-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--color-text-primary);
    margin-bottom: 0.5rem;
}

.auth-subtitle {
    color: var(--color-text-secondary);
    font-size: 0.95rem;
    margin-bottom: 0;
}

.auth-form .form-label {
    font-weight: 500;
    color: #334155;
    font-size: 13px;
}

.auth-form .form-control {
    padding: 10px 14px;
    border-radius: var(--radius-md);
    border: 1px solid var(--color-border);
    background: var(--color-bg-input);
    transition: border-color 0.2s, box-shadow 0.2s;
}

.auth-form .form-control:focus {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
}

.auth-form .btn-primary {
    background: var(--color-primary-gradient);
    border: none;
    padding: 12px;
    font-weight: 600;
    border-radius: var(--radius-md);
    transition: transform 0.15s, box-shadow 0.15s;
}

.auth-form .btn-primary:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 14px rgba(59, 130, 246, 0.4);
}

.auth-footer {
    text-align: center;
    margin-top: 1.5rem;
    padding-top: 1.5rem;
    border-top: 1px solid var(--color-border);
}

.auth-footer p {
    margin-bottom: 0;
    color: var(--color-text-secondary);
}

.auth-footer a {
    color: var(--color-primary);
    font-weight: 500;
    text-decoration: none;
}

.auth-footer a:hover {
    text-decoration: underline;
}

/* ===== Страница шаблонов и истории ===== */
.page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 24px;
}

.page-header h1 {
    font-size: 20px;
    font-weight: 700;
    color: var(--color-text-primary);
    margin: 0;
}

.items-table {
    width: 100%;
}

.items-table th {
    font-size: 12px;
    font-weight: 600;
    color: var(--color-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--color-border);
}

.items-table td {
    padding: 14px 16px;
    border-bottom: 1px solid var(--color-border-light);
    font-size: 14px;
    color: var(--color-text-primary);
    vertical-align: middle;
}

.items-table tr:last-child td {
    border-bottom: none;
}

.items-table tr:hover td {
    background: var(--color-bg-page);
}

.empty-state {
    text-align: center;
    padding: 48px 24px;
    color: var(--color-text-muted);
}

.empty-state-icon {
    font-size: 48px;
    margin-bottom: 12px;
}

.empty-state-text {
    font-size: 15px;
    margin-bottom: 4px;
}

.empty-state-hint {
    font-size: 13px;
}

/* ===== Модальные окна ===== */
.modal-content {
    border-radius: var(--radius-lg);
    border: none;
    box-shadow: var(--shadow-lg);
}

.modal-header {
    border-bottom: 1px solid var(--color-border);
    padding: 16px 24px;
}

.modal-body {
    padding: 24px;
}

.modal-footer {
    border-top: 1px solid var(--color-border);
    padding: 16px 24px;
}

/* ===== User dropdown ===== */
.dropdown-toggle::after {
    margin-left: 0.5rem;
}

.dropdown-menu {
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-lg);
    padding: 4px;
}

.dropdown-item {
    border-radius: var(--radius-sm);
    padding: 8px 12px;
    font-size: 13px;
}

.dropdown-item:hover {
    background: var(--color-bg-page);
}

/* ===== Модалка инструкции ===== */
#instructionModal .modal-dialog {
    max-width: 1000px;
}

#instructionModal .instruction-step {
    padding: 1.5rem;
    border-left: 4px solid var(--color-primary);
    background: var(--color-bg-page);
    border-radius: var(--radius-md);
}

#instructionModal code {
    background: var(--color-bg-card);
    padding: 0.2rem 0.4rem;
    border-radius: 4px;
    border: 1px solid var(--color-border);
    font-size: 0.95rem;
}

#instructionModal .accordion-button:not(.collapsed) {
    background-color: var(--color-primary-light);
    color: var(--color-primary);
}

/* ===== Scrollbar для textarea ===== */
#jsonData::-webkit-scrollbar {
    width: 8px;
}

#jsonData::-webkit-scrollbar-track {
    background: var(--color-border-light);
    border-radius: 8px;
}

#jsonData::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 8px;
}

#jsonData::-webkit-scrollbar-thumb:hover {
    background: var(--color-text-muted);
}

/* ===== Адаптивность ===== */
@media (max-width: 768px) {
    .page-content, .page-content-wide {
        padding: 20px 16px;
    }

    .app-navbar .nav-tabs-custom {
        display: none;
    }

    .navbar-collapse .nav-tabs-custom {
        display: flex;
        flex-direction: column;
        height: auto;
    }

    .navbar-collapse .nav-tabs-custom .nav-link {
        padding: 10px 16px;
        border-bottom: none;
        border-left: 2px solid transparent;
    }

    .navbar-collapse .nav-tabs-custom .nav-link.active {
        border-bottom: none;
        border-left-color: var(--color-primary);
    }

    .pill-toggle {
        width: 100%;
    }

    .pill-toggle .btn-check + .btn {
        flex: 1;
        text-align: center;
    }
}

/* ===== Предпросмотр кода ===== */
pre {
    margin-bottom: 0;
}

pre code {
    font-size: 0.85rem;
    color: var(--color-text-primary);
}
```

- [ ] **Step 2: Проверить что файл синтаксически корректен**

Run: `python3 -c "open('static/css/style.css').read(); print('CSS file OK')"`
Expected: `CSS file OK`

- [ ] **Step 3: Commit**

```bash
git add static/css/style.css
git commit -m "style: replace CSS with new design system (light clean theme)"
```

---

### Task 2: Base template — navbar с табами

**Files:**
- Modify: `templates/base.html`

- [ ] **Step 1: Переписать base.html с navbar**

Заменить содержимое `templates/base.html`:

```html
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{% block title %}DocFiller{% endblock %}</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="{{ url_for('static', filename='css/style.css') }}">
    <link rel="icon" type="image/svg+xml" href="{{ url_for('static', filename='favicon.svg') }}">
    {% block extra_css %}{% endblock %}
</head>
<body>
    {% block navbar %}
    {% if current_user.is_authenticated %}
    <nav class="app-navbar navbar navbar-expand-md">
        <div class="container-fluid px-4">
            <a class="navbar-brand" href="{{ url_for('index') }}">
                <div class="brand-icon">D</div>
                DocFiller
            </a>

            <button class="navbar-toggler border-0" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
                <span class="navbar-toggler-icon"></span>
            </button>

            <div class="collapse navbar-collapse" id="navbarNav">
                <ul class="nav-tabs-custom ms-4">
                    <li><a class="nav-link {% if request.endpoint == 'index' %}active{% endif %}" href="{{ url_for('index') }}">Генерация</a></li>
                    <li><a class="nav-link {% if request.endpoint == 'my_templates_page' %}active{% endif %}" href="{{ url_for('my_templates_page') }}">Шаблоны</a></li>
                    <li><a class="nav-link {% if request.endpoint == 'snippets_page' %}active{% endif %}" href="{{ url_for('snippets_page') }}">Справочники</a></li>
                    <li><a class="nav-link {% if request.endpoint == 'history_page' %}active{% endif %}" href="{{ url_for('history_page') }}">История</a></li>
                </ul>

                <div class="nav-right ms-auto">
                    <button type="button" class="btn-help" data-bs-toggle="modal" data-bs-target="#instructionModal">Справка</button>
                    <div class="dropdown">
                        <button class="btn btn-sm dropdown-toggle d-flex align-items-center gap-2 border-0" type="button" data-bs-toggle="dropdown">
                            <div class="user-avatar">{{ current_user.username[0]|upper }}</div>
                            <span style="font-size: 13px; color: var(--color-text-primary); font-weight: 500;">{{ current_user.username }}</span>
                        </button>
                        <ul class="dropdown-menu dropdown-menu-end">
                            <li><span class="dropdown-item-text text-muted" style="font-size: 12px;">{{ current_user.email }}</span></li>
                            <li><hr class="dropdown-divider"></li>
                            <li><a class="dropdown-item text-danger" href="{{ url_for('logout') }}">Выйти</a></li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    </nav>
    {% endif %}
    {% endblock %}

    {% block content %}{% endblock %}

    <!-- Модалка справки -->
    {% block help_modal %}{% endblock %}

    <!-- Toast контейнер -->
    <div class="toast-container"></div>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    {% block extra_js %}{% endblock %}
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add templates/base.html
git commit -m "feat: add navbar with tabs to base.html"
```

---

### Task 3: Главная страница — новый layout

**Files:**
- Modify: `templates/index.html`

- [ ] **Step 1: Полностью переписать index.html**

Новая структура: наследует base.html, layout с шагами, без модалок библиотеки и истории (они стали отдельными страницами). Модалки справки и сохранения шаблона остаются.

```html
{% extends "base.html" %}

{% block title %}Генерация — DocFiller{% endblock %}

{% block content %}
<div class="page-content">
    <!-- Шаг 1: Загрузка шаблона -->
    <div class="mb-4">
        <div class="step-header">
            <div class="step-badge">1</div>
            <h2 class="step-title">Загрузите шаблон</h2>
        </div>
        <div id="dropZone" class="drop-zone">
            <div class="drop-zone-content">
                <div class="drop-zone-icon">&#9729;</div>
                <p class="drop-zone-text">Перетащите .docx файл сюда</p>
                <button type="button" class="btn-select-file" id="selectFileBtn">Выбрать файл</button>
                <input type="file" id="fileInput" accept=".docx" hidden>
            </div>
            <div id="fileInfo" class="file-info" style="display: none;">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16" style="color: #166534; flex-shrink: 0;">
                    <path d="M5.5 7a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1h-5zM5 9.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5zm0 2a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 0 1h-2a.5.5 0 0 1-.5-.5z"/>
                    <path d="M9.5 0H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V4.5L9.5 0zm0 1v2A1.5 1.5 0 0 0 11 4.5h2V14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h5.5z"/>
                </svg>
                <span id="fileName" class="file-name"></span>
                <button type="button" class="btn btn-sm btn-outline-success" id="saveTemplateBtn" onclick="showSaveTemplateDialog()">Сохранить в библиотеку</button>
                <button type="button" class="btn btn-sm btn-link text-danger" onclick="clearFile()">Удалить</button>
            </div>
        </div>
    </div>

    <!-- Шаг 2: Заполнение данных -->
    <div class="mb-4" id="dataCard">
        <div class="step-header">
            <div class="step-badge">2</div>
            <h2 class="step-title">Заполните данные</h2>
            <div class="pill-toggle ms-auto">
                <input type="radio" class="btn-check" name="inputMode" id="modeForm" value="form" autocomplete="off" checked>
                <label class="btn" for="modeForm">Форма</label>
                <input type="radio" class="btn-check" name="inputMode" id="modeJson" value="json" autocomplete="off">
                <label class="btn" for="modeJson">JSON</label>
            </div>
        </div>
        <div class="app-card">
            <div class="app-card-body">
                <!-- Режим формы -->
                <div id="formMode" style="display: none;">
                    <div id="templateNotLoaded" class="alert alert-info">
                        Загрузите шаблон, чтобы увидеть поля для заполнения
                    </div>
                    <div id="dynamicForm"></div>
                </div>

                <!-- Режим JSON -->
                <div id="jsonMode">
                    <textarea id="jsonData" class="form-control font-monospace" rows="12" placeholder='Введите JSON данные, например:
{
  "name": "Иван Иванов",
  "date": "25.01.2026",
  "company": "ООО Пример",
  "items": [
    {"name": "Товар 1", "price": "1000"},
    {"name": "Товар 2", "price": "2000"}
  ]
}'></textarea>
                    <div id="jsonError" class="alert alert-danger mt-2" style="display: none;"></div>
                    <div id="jsonValid" class="alert alert-success mt-2" style="display: none;">
                        JSON валиден
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Кнопка генерации -->
    <button id="generateBtn" class="btn-generate" onclick="generateDocument()">
        <span id="btnText">Сгенерировать документ</span>
        <span id="btnSpinner" class="spinner-border spinner-border-sm ms-2" style="display: none;"></span>
    </button>

    <div id="resultAlert" class="mt-3" style="display: none;"></div>
</div>

<!-- Модальное окно сохранения шаблона -->
<div class="modal fade" id="saveTemplateModal" tabindex="-1">
    <div class="modal-dialog">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title">Сохранить шаблон в библиотеку</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
                <form id="saveTemplateForm">
                    <div class="form-field">
                        <label for="templateName">Название шаблона <span class="text-danger">*</span></label>
                        <input type="text" class="form-control" id="templateName" placeholder="Например: Договор аренды" required>
                    </div>
                    <div class="form-field">
                        <label for="templateDescription">Описание (необязательно)</label>
                        <textarea class="form-control" id="templateDescription" rows="3" placeholder="Краткое описание шаблона..."></textarea>
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Отмена</button>
                <button type="button" class="btn btn-success" id="confirmSaveTemplate">Сохранить</button>
            </div>
        </div>
    </div>
</div>

<!-- Модальное окно подтверждения удаления -->
<div class="modal fade" id="confirmDeleteModal" tabindex="-1">
    <div class="modal-dialog">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title">Подтверждение удаления</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
                <p id="deleteConfirmMessage">Вы уверены, что хотите удалить этот элемент?</p>
                <p class="text-muted small mb-0">Это действие нельзя отменить.</p>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Отмена</button>
                <button type="button" class="btn btn-danger" id="confirmDeleteBtn">Удалить</button>
            </div>
        </div>
    </div>
</div>
{% endblock %}

{% block help_modal %}
<!-- Модальное окно с инструкцией (сохраняется как есть, только стили обновлены через CSS) -->
<div class="modal fade" id="instructionModal" tabindex="-1" aria-labelledby="instructionModalLabel" aria-hidden="true">
    <div class="modal-dialog modal-xl modal-dialog-scrollable">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="instructionModalLabel">Как пользоваться</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
                <div class="alert alert-success">
                    <strong>Добро пожаловать!</strong> Эта инструкция поможет вам создать документ с автоматическим заполнением данных.
                </div>

                <div class="instruction-step mb-4">
                    <h3 class="text-primary">
                        <span class="badge bg-primary me-2">Шаг 1</span>
                        Подготовка документа в Microsoft Word
                    </h3>
                    <hr>
                    <div class="row">
                        <div class="col-lg-6">
                            <h5>Что делать:</h5>
                            <ol>
                                <li class="mb-2">Откройте <strong>Microsoft Word</strong></li>
                                <li class="mb-2">Создайте обычный документ (договор, заявление и т.д.)</li>
                                <li class="mb-2">Вместо данных, которые будут меняться, напишите <strong>метки</strong></li>
                            </ol>
                            {% raw %}<div class="alert alert-warning">
                                <strong>Важно!</strong> Метки должны быть в двойных фигурных скобках: <code>{{название}}</code>
                            </div>{% endraw %}
                        </div>
                        <div class="col-lg-6">
                            <h5>Пример:</h5>
                            <div class="bg-light p-3 rounded border">
                                <p><strong>Неправильно:</strong></p>
                                <p class="text-muted">Договор с Ивановым Иваном</p>
                                <hr>
                                <p><strong>Правильно:</strong></p>
                                {% raw %}<p>Договор с <code class="text-danger">{{Фамилия_Имя}}</code></p>
                                <p>Дата: <code class="text-danger">{{дата}}</code></p>
                                <p>Сумма: <code class="text-danger">{{сумма}}</code> руб.</p>{% endraw %}
                            </div>
                        </div>
                    </div>
                </div>

                <div class="instruction-step mb-4">
                    <h3 class="text-primary">
                        <span class="badge bg-primary me-2">Шаг 2</span>
                        Загрузите шаблон и заполните данные
                    </h3>
                    <hr>
                    <ol>
                        <li class="mb-2">Перетащите файл .docx на страницу или нажмите "Выбрать файл"</li>
                        <li class="mb-2">Заполните появившиеся поля своими данными</li>
                        <li class="mb-2">Нажмите "Сгенерировать документ"</li>
                        <li class="mb-2">Скачайте готовый файл</li>
                    </ol>
                </div>

                <div class="instruction-step mb-4">
                    <h3 class="text-primary">
                        <span class="badge bg-primary me-2">Синтаксис</span>
                        Теги в DOCX шаблоне
                    </h3>
                    <hr>
                    {% raw %}<div class="row">
                        <div class="col-md-6">
                            <h6>Простые переменные:</h6>
                            <pre class="bg-light p-2 rounded"><code>{{variable}}</code></pre>
                            <h6 class="mt-3">Списки:</h6>
                            <pre class="bg-light p-2 rounded"><code>{% for item in items %}
- {{item.name}}
{% endfor %}</code></pre>
                        </div>
                        <div class="col-md-6">
                            <h6>Условия:</h6>
                            <pre class="bg-light p-2 rounded"><code>{% if condition %}
Текст
{% endif %}</code></pre>
                            <h6 class="mt-3">Фрагменты:</h6>
                            <pre class="bg-light p-2 rounded"><code>{{SNIPPET:туроператор}}
{{SNIPPET:страховая}}</code></pre>
                        </div>
                    </div>{% endraw %}
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Закрыть</button>
            </div>
        </div>
    </div>
</div>
{% endblock %}

{% block extra_js %}
<script src="{{ url_for('static', filename='js/app.js') }}"></script>
{% endblock %}
```

- [ ] **Step 2: Проверить, что шаблон рендерится без ошибок**

Run: `python3 -c "from app import app; c = app.test_client(); print(c.get('/login').status_code)"`
Expected: `200`

- [ ] **Step 3: Commit**

```bash
git add templates/index.html
git commit -m "feat: redesign main page with step-based layout"
```

---

### Task 4: Страница шаблонов (вместо модалки)

**Files:**
- Create: `templates/my_templates.html`
- Create: `static/js/templates.js`
- Modify: `app.py` — добавить route `my_templates_page`

- [ ] **Step 1: Добавить route в app.py**

Добавить после route `index` (после строки `return render_template('index.html')`):

```python
@app.route('/my-templates')
@login_required
def my_templates_page():
    """Страница библиотеки шаблонов"""
    return render_template('my_templates.html')
```

- [ ] **Step 2: Создать templates/my_templates.html**

```html
{% extends "base.html" %}

{% block title %}Шаблоны — DocFiller{% endblock %}

{% block content %}
<div class="page-content-wide">
    <div class="page-header">
        <h1>Библиотека шаблонов</h1>
    </div>

    <div class="app-card">
        <div class="app-card-body p-0">
            <div id="templatesListContainer">
                <div class="text-center p-4">
                    <div class="spinner-border text-primary" role="status"></div>
                </div>
            </div>
        </div>
    </div>
</div>

<div class="modal fade" id="confirmDeleteModal" tabindex="-1">
    <div class="modal-dialog">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title">Подтверждение удаления</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
                <p id="deleteConfirmMessage">Вы уверены, что хотите удалить этот шаблон?</p>
                <p class="text-muted small mb-0">Это действие нельзя отменить.</p>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Отмена</button>
                <button type="button" class="btn btn-danger" id="confirmDeleteBtn">Удалить</button>
            </div>
        </div>
    </div>
</div>
{% endblock %}

{% block extra_js %}
<script src="{{ url_for('static', filename='js/templates.js') }}"></script>
{% endblock %}
```

- [ ] **Step 3: Создать static/js/templates.js**

```javascript
// Страница библиотеки шаблонов
document.addEventListener('DOMContentLoaded', function() {
    loadTemplates();
});

function loadTemplates() {
    fetch('/templates')
        .then(r => {
            if (r.status === 401) { window.location.href = '/login'; return; }
            return r.json();
        })
        .then(data => {
            if (!data) return;
            const container = document.getElementById('templatesListContainer');
            if (!data.success || !data.templates || data.templates.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-state-icon">&#128196;</div>
                        <p class="empty-state-text">Нет сохранённых шаблонов</p>
                        <p class="empty-state-hint">Загрузите шаблон на <a href="/">странице генерации</a> и сохраните в библиотеку</p>
                    </div>`;
                return;
            }
            let html = '<table class="items-table"><thead><tr>';
            html += '<th>Название</th><th>Файл</th><th>Описание</th><th>Дата</th><th></th>';
            html += '</tr></thead><tbody>';
            data.templates.forEach(t => {
                const date = t.created_at ? new Date(t.created_at).toLocaleDateString('ru-RU') : '';
                html += `<tr>
                    <td><strong>${escapeHtml(t.name)}</strong></td>
                    <td style="color: var(--color-text-secondary);">${escapeHtml(t.original_filename || '')}</td>
                    <td style="color: var(--color-text-secondary);">${escapeHtml(t.description || '')}</td>
                    <td style="color: var(--color-text-muted); white-space: nowrap;">${date}</td>
                    <td style="text-align: right; white-space: nowrap;">
                        <a href="/" class="btn btn-sm btn-outline-primary" onclick="sessionStorage.setItem('loadTemplateId','${t.id}')">Использовать</a>
                        <button class="btn btn-sm btn-outline-danger ms-1" onclick="confirmDeleteTemplate(${t.id}, '${escapeHtml(t.name)}')">Удалить</button>
                    </td>
                </tr>`;
            });
            html += '</tbody></table>';
            container.innerHTML = html;
        })
        .catch(err => {
            document.getElementById('templatesListContainer').innerHTML =
                '<div class="alert alert-danger m-3">Ошибка загрузки шаблонов</div>';
        });
}

function confirmDeleteTemplate(id, name) {
    document.getElementById('deleteConfirmMessage').textContent =
        'Удалить шаблон "' + name + '"?';
    const btn = document.getElementById('confirmDeleteBtn');
    btn.onclick = function() {
        fetch('/templates/' + id, { method: 'DELETE' })
            .then(r => r.json())
            .then(data => {
                bootstrap.Modal.getInstance(document.getElementById('confirmDeleteModal')).hide();
                if (data.success) { loadTemplates(); }
            });
    };
    new bootstrap.Modal(document.getElementById('confirmDeleteModal')).show();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
```

- [ ] **Step 4: Проверить что route работает**

Run: `python3 -c "from app import app; c = app.test_client(); print(c.get('/my-templates', follow_redirects=True).status_code)"`
Expected: `200`

- [ ] **Step 5: Commit**

```bash
git add app.py templates/my_templates.html static/js/templates.js
git commit -m "feat: add standalone templates page (replaces modal)"
```

---

### Task 5: Страница истории (вместо модалки)

**Files:**
- Create: `templates/history.html`
- Create: `static/js/history.js`
- Modify: `app.py` — добавить route `history_page`

- [ ] **Step 1: Добавить route в app.py**

Добавить после route `my_templates_page`:

```python
@app.route('/history-page')
@login_required
def history_page():
    """Страница истории сгенерированных документов"""
    return render_template('history.html')
```

Примечание: URL `/history-page` чтобы не конфликтовать с существующим API route `GET /history` который возвращает JSON.

- [ ] **Step 2: Создать templates/history.html**

```html
{% extends "base.html" %}

{% block title %}История — DocFiller{% endblock %}

{% block content %}
<div class="page-content-wide">
    <div class="page-header">
        <h1>История документов</h1>
    </div>

    <div class="app-card">
        <div class="app-card-body p-0">
            <div id="historyListContainer">
                <div class="text-center p-4">
                    <div class="spinner-border text-primary" role="status"></div>
                </div>
            </div>
        </div>
    </div>
</div>

<div class="modal fade" id="confirmDeleteModal" tabindex="-1">
    <div class="modal-dialog">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title">Подтверждение удаления</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
                <p id="deleteConfirmMessage">Вы уверены, что хотите удалить этот документ?</p>
                <p class="text-muted small mb-0">Это действие нельзя отменить.</p>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Отмена</button>
                <button type="button" class="btn btn-danger" id="confirmDeleteBtn">Удалить</button>
            </div>
        </div>
    </div>
</div>
{% endblock %}

{% block extra_js %}
<script src="{{ url_for('static', filename='js/history.js') }}"></script>
{% endblock %}
```

- [ ] **Step 3: Создать static/js/history.js**

```javascript
// Страница истории документов
document.addEventListener('DOMContentLoaded', function() {
    loadHistory();
});

function loadHistory() {
    fetch('/history')
        .then(r => {
            if (r.status === 401) { window.location.href = '/login'; return; }
            return r.json();
        })
        .then(data => {
            if (!data) return;
            const container = document.getElementById('historyListContainer');
            if (!data.success || !data.documents || data.documents.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-state-icon">&#128203;</div>
                        <p class="empty-state-text">Нет сгенерированных документов</p>
                        <p class="empty-state-hint">Сгенерируйте документ на <a href="/">странице генерации</a></p>
                    </div>`;
                return;
            }
            let html = '<table class="items-table"><thead><tr>';
            html += '<th>Файл</th><th>Шаблон</th><th>Размер</th><th>Дата</th><th></th>';
            html += '</tr></thead><tbody>';
            data.documents.forEach(doc => {
                const date = doc.created_at ? new Date(doc.created_at).toLocaleDateString('ru-RU') : '';
                const size = doc.file_size ? formatFileSize(doc.file_size) : '';
                html += `<tr>
                    <td><strong>${escapeHtml(doc.output_filename)}</strong></td>
                    <td style="color: var(--color-text-secondary);">${escapeHtml(doc.template_name || '')}</td>
                    <td style="color: var(--color-text-muted);">${size}</td>
                    <td style="color: var(--color-text-muted); white-space: nowrap;">${date}</td>
                    <td style="text-align: right; white-space: nowrap;">
                        <a href="/history/${doc.id}/download" class="btn btn-sm btn-outline-primary">Скачать</a>
                        <button class="btn btn-sm btn-outline-danger ms-1" onclick="confirmDeleteDoc(${doc.id}, '${escapeHtml(doc.output_filename)}')">Удалить</button>
                    </td>
                </tr>`;
            });
            html += '</tbody></table>';
            container.innerHTML = html;
        })
        .catch(err => {
            document.getElementById('historyListContainer').innerHTML =
                '<div class="alert alert-danger m-3">Ошибка загрузки истории</div>';
        });
}

function confirmDeleteDoc(id, name) {
    document.getElementById('deleteConfirmMessage').textContent =
        'Удалить документ "' + name + '"?';
    const btn = document.getElementById('confirmDeleteBtn');
    btn.onclick = function() {
        fetch('/history/' + id, { method: 'DELETE' })
            .then(r => r.json())
            .then(data => {
                bootstrap.Modal.getInstance(document.getElementById('confirmDeleteModal')).hide();
                if (data.success) { loadHistory(); }
            });
    };
    new bootstrap.Modal(document.getElementById('confirmDeleteModal')).show();
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' Б';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' КБ';
    return (bytes / (1024 * 1024)).toFixed(1) + ' МБ';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
```

- [ ] **Step 4: Обновить navbar в base.html — url для истории**

В `templates/base.html` заменить URL истории:

Найти: `href="{{ url_for('history_page') }}"`

Этот url_for уже ссылается на route `history_page` который мы создали в Step 1. Проверить что route зарегистрирован корректно.

Run: `python3 -c "from app import app; c = app.test_client(); print(c.get('/history-page', follow_redirects=True).status_code)"`
Expected: `200`

- [ ] **Step 5: Commit**

```bash
git add app.py templates/history.html static/js/history.js
git commit -m "feat: add standalone history page (replaces modal)"
```

---

### Task 6: Обновить страницы авторизации

**Files:**
- Modify: `templates/login.html`
- Modify: `templates/register.html`

- [ ] **Step 1: Обновить login.html**

Заменить содержимое `templates/login.html`:

```html
{% extends "base.html" %}

{% block title %}Вход — DocFiller{% endblock %}

{% block navbar %}{% endblock %}

{% block content %}
<div class="auth-container">
    <div class="auth-card">
        <div class="auth-header">
            <div class="auth-brand">
                <div class="brand-icon" style="width:36px;height:36px;background:var(--color-primary-gradient);border-radius:var(--radius-md);display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:16px;">D</div>
                <span style="font-weight:700;font-size:18px;color:var(--color-text-primary);">DocFiller</span>
            </div>
            <h1 class="auth-title">Вход в аккаунт</h1>
            <p class="auth-subtitle">Введите свои данные для входа</p>
        </div>

        {% with messages = get_flashed_messages(with_categories=true) %}
            {% if messages %}
                {% for category, message in messages %}
                    <div class="alert alert-{{ category }} alert-dismissible fade show" role="alert">
                        {{ message }}
                        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
                    </div>
                {% endfor %}
            {% endif %}
        {% endwith %}

        <form method="POST" class="auth-form">
            <div class="form-field">
                <label for="username">Имя пользователя</label>
                <input type="text" class="form-control" id="username" name="username"
                       placeholder="Введите имя пользователя" required autofocus>
            </div>
            <div class="form-field">
                <label for="password">Пароль</label>
                <input type="password" class="form-control" id="password" name="password"
                       placeholder="Введите пароль" required>
            </div>
            <div class="d-grid mt-3">
                <button type="submit" class="btn btn-primary btn-lg">Войти</button>
            </div>
        </form>

        <div class="auth-footer">
            <p>Нет аккаунта? <a href="{{ url_for('register') }}">Зарегистрироваться</a></p>
        </div>
    </div>
</div>

<script>
document.querySelector('.auth-form').addEventListener('submit', function(e) {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    if (username.length < 3) {
        e.preventDefault();
        showValidationError('username', 'Имя пользователя должно быть минимум 3 символа');
        return false;
    }
    if (password.length < 6) {
        e.preventDefault();
        showValidationError('password', 'Пароль должен быть минимум 6 символов');
        return false;
    }
});

function showValidationError(fieldId, message) {
    const field = document.getElementById(fieldId);
    field.classList.add('is-invalid');
    const oldFeedback = field.nextElementSibling;
    if (oldFeedback && oldFeedback.classList.contains('invalid-feedback')) {
        oldFeedback.remove();
    }
    const feedback = document.createElement('div');
    feedback.className = 'invalid-feedback';
    feedback.textContent = message;
    field.parentNode.appendChild(feedback);
    field.addEventListener('input', function() {
        field.classList.remove('is-invalid');
        if (feedback.parentNode) feedback.remove();
    }, { once: true });
}
</script>
{% endblock %}
```

- [ ] **Step 2: Обновить register.html**

Заменить содержимое `templates/register.html`:

```html
{% extends "base.html" %}

{% block title %}Регистрация — DocFiller{% endblock %}

{% block navbar %}{% endblock %}

{% block content %}
<div class="auth-container">
    <div class="auth-card">
        <div class="auth-header">
            <div class="auth-brand">
                <div class="brand-icon" style="width:36px;height:36px;background:var(--color-primary-gradient);border-radius:var(--radius-md);display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:16px;">D</div>
                <span style="font-weight:700;font-size:18px;color:var(--color-text-primary);">DocFiller</span>
            </div>
            <h1 class="auth-title">Регистрация</h1>
            <p class="auth-subtitle">Создайте новый аккаунт</p>
        </div>

        {% with messages = get_flashed_messages(with_categories=true) %}
            {% if messages %}
                {% for category, message in messages %}
                    <div class="alert alert-{{ category }} alert-dismissible fade show" role="alert">
                        {{ message }}
                        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
                    </div>
                {% endfor %}
            {% endif %}
        {% endwith %}

        <form method="POST" class="auth-form" id="registerForm">
            <div class="form-field">
                <label for="username">Имя пользователя</label>
                <input type="text" class="form-control" id="username" name="username"
                       placeholder="Придумайте имя пользователя" minlength="3" required autofocus>
                <div class="form-text">Минимум 3 символа</div>
            </div>
            <div class="form-field">
                <label for="email">Email</label>
                <input type="email" class="form-control" id="email" name="email"
                       placeholder="Введите ваш email" required>
            </div>
            <div class="form-field">
                <label for="password">Пароль</label>
                <input type="password" class="form-control" id="password" name="password"
                       placeholder="Придумайте пароль" minlength="6" required>
                <div class="form-text">Минимум 6 символов</div>
            </div>
            <div class="form-field">
                <label for="password_confirm">Подтвердите пароль</label>
                <input type="password" class="form-control" id="password_confirm" name="password_confirm"
                       placeholder="Повторите пароль" required>
            </div>
            <div class="d-grid mt-3">
                <button type="submit" class="btn btn-primary btn-lg">Зарегистрироваться</button>
            </div>
        </form>

        <div class="auth-footer">
            <p>Уже есть аккаунт? <a href="{{ url_for('login') }}">Войти</a></p>
        </div>
    </div>
</div>

<script>
document.getElementById('registerForm').addEventListener('submit', function(e) {
    const password = document.getElementById('password').value;
    const passwordConfirm = document.getElementById('password_confirm').value;
    if (password !== passwordConfirm) {
        e.preventDefault();
        const field = document.getElementById('password_confirm');
        field.classList.add('is-invalid');
        let feedback = field.nextElementSibling;
        if (!feedback || !feedback.classList.contains('invalid-feedback')) {
            feedback = document.createElement('div');
            feedback.className = 'invalid-feedback';
            field.parentNode.appendChild(feedback);
        }
        feedback.textContent = 'Пароли не совпадают';
        return false;
    }
});
</script>
{% endblock %}
```

- [ ] **Step 3: Commit**

```bash
git add templates/login.html templates/register.html
git commit -m "style: redesign auth pages with new brand and palette"
```

---

### Task 7: Обновить страницу справочников

**Files:**
- Modify: `templates/snippets.html`

- [ ] **Step 1: Обновить snippets.html — наследовать от base.html**

Заменить содержимое `templates/snippets.html`:

```html
{% extends "base.html" %}

{% block title %}Справочники — DocFiller{% endblock %}

{% block content %}
<div class="page-content-wide">
    <div class="page-header">
        <h1>Справочники фрагментов</h1>
    </div>

    <div class="row">
        <!-- Категории -->
        <div class="col-md-4">
            <div class="app-card">
                <div class="app-card-header">
                    <h5 class="mb-0" style="font-size: 15px; font-weight: 600;">Категории</h5>
                    <button class="btn btn-sm btn-primary" onclick="showCreateCategoryModal()">+ Создать</button>
                </div>
                <div style="padding: 0;">
                    <div id="categoriesList">
                        <div class="text-center p-4">
                            <div class="spinner-border text-primary" role="status"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Фрагменты -->
        <div class="col-md-8">
            <div class="app-card">
                <div class="app-card-header">
                    <h5 class="mb-0" id="snippetsTitle" style="font-size: 15px; font-weight: 600;">Выберите категорию</h5>
                    <button class="btn btn-sm btn-primary" id="addSnippetBtn" style="display:none;" onclick="showCreateSnippetModal()">+ Добавить фрагмент</button>
                </div>
                <div class="app-card-body">
                    <div id="snippetsList">
                        <div class="alert alert-info mb-0">Выберите категорию слева для просмотра фрагментов</div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

<!-- Модальное окно создания категории -->
<div class="modal fade" id="createCategoryModal" tabindex="-1">
    <div class="modal-dialog">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title">Новая категория</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
                <div class="form-field">
                    <label>Название <span class="text-danger">*</span></label>
                    <input type="text" class="form-control" id="catName" placeholder="Например: Туроператоры">
                </div>
                <div class="form-field">
                    <label>Описание</label>
                    <textarea class="form-control" id="catDescription" rows="2"></textarea>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" data-bs-dismiss="modal">Отмена</button>
                <button class="btn btn-primary" onclick="createCategory()">Создать</button>
            </div>
        </div>
    </div>
</div>

<!-- Модальное окно создания фрагмента -->
<div class="modal fade" id="createSnippetModal" tabindex="-1">
    <div class="modal-dialog modal-lg">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title">Новый фрагмент</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
                <div class="form-field">
                    <label>Название <span class="text-danger">*</span></label>
                    <input type="text" class="form-control" id="snippetName" placeholder="Например: ООО Туроператор Солнце">
                </div>
                <div class="form-field">
                    <label>Описание</label>
                    <textarea class="form-control" id="snippetDescription" rows="2"></textarea>
                </div>

                <ul class="nav nav-tabs" role="tablist">
                    <li class="nav-item">
                        <button class="nav-link active" data-bs-toggle="tab" data-bs-target="#tabFile">Загрузить файл</button>
                    </li>
                    <li class="nav-item">
                        <button class="nav-link" data-bs-toggle="tab" data-bs-target="#tabForm">Заполнить форму</button>
                    </li>
                </ul>
                <div class="tab-content pt-3">
                    <div class="tab-pane fade show active" id="tabFile">
                        <div class="drop-zone p-4" id="snippetDropZone">
                            <p class="drop-zone-text mb-2">Перетащите .docx файл сюда</p>
                            <button type="button" class="btn-select-file" onclick="document.getElementById('snippetFileInput').click()">Выберите файл</button>
                            <input type="file" id="snippetFileInput" accept=".docx" hidden>
                            <div id="snippetFileInfo" style="display:none;" class="mt-2 text-success"></div>
                        </div>
                    </div>
                    <div class="tab-pane fade" id="tabForm">
                        <div id="formFields">
                            <div class="row mb-2 form-field-row">
                                <div class="col-5">
                                    <input type="text" class="form-control form-control-sm" placeholder="Название поля" name="field_key">
                                </div>
                                <div class="col-5">
                                    <input type="text" class="form-control form-control-sm" placeholder="Значение" name="field_value">
                                </div>
                                <div class="col-2">
                                    <button class="btn btn-sm btn-outline-danger" onclick="this.closest('.form-field-row').remove()">X</button>
                                </div>
                            </div>
                        </div>
                        <button class="btn btn-sm btn-outline-primary mt-2" onclick="addFormField()">+ Добавить поле</button>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" data-bs-dismiss="modal">Отмена</button>
                <button class="btn btn-primary" onclick="createSnippet()">Создать</button>
            </div>
        </div>
    </div>
</div>

<!-- Модальное окно просмотра фрагмента -->
<div class="modal fade" id="previewSnippetModal" tabindex="-1">
    <div class="modal-dialog modal-lg">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="previewTitle">Просмотр фрагмента</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
                <div id="previewContent">
                    <div class="text-center"><div class="spinner-border text-primary"></div></div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-outline-primary" id="previewDownloadBtn">Скачать оригинал</button>
                <button class="btn btn-outline-secondary" id="previewReplaceBtn">Заменить файл</button>
                <input type="file" id="replaceFileInput" accept=".docx" hidden>
                <button class="btn btn-secondary" data-bs-dismiss="modal">Закрыть</button>
            </div>
        </div>
    </div>
</div>

<!-- Модальное окно подтверждения удаления -->
<div class="modal fade" id="confirmDeleteModal" tabindex="-1">
    <div class="modal-dialog">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title">Подтверждение удаления</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
                <p id="snippetDeleteMessage">Вы уверены?</p>
                <p class="text-muted small mb-0">Это действие нельзя отменить.</p>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" data-bs-dismiss="modal">Отмена</button>
                <button class="btn btn-danger" id="snippetConfirmDeleteBtn">Удалить</button>
            </div>
        </div>
    </div>
</div>
{% endblock %}

{% block extra_js %}
<script src="{{ url_for('static', filename='js/snippets.js') }}"></script>
{% endblock %}
```

- [ ] **Step 2: Commit**

```bash
git add templates/snippets.html
git commit -m "style: redesign snippets page with new design system"
```

---

### Task 8: Адаптировать app.js

**Files:**
- Modify: `static/js/app.js`

- [ ] **Step 1: Обновить app.js**

Изменения в app.js:
1. Убрать функции `loadTemplates()`, `loadHistory()` и связанный код модалок (они переехали в templates.js и history.js)
2. Обновить `buildSnippetSelectors()` — использовать CSS-класс `snippet-field` вместо инлайн стилей
3. Обновить `parseTemplate()` — использовать CSS-класс `form-field` для динамических полей

Конкретно нужно найти и обновить:

**a)** В функции `parseTemplate()`, где создаются динамические поля — каждое поле обернуть в `<div class="form-field">` вместо `<div class="mb-3">`.

Найти паттерн создания полей формы (строки вида `<div class="mb-3">` внутри функции `parseTemplate`) и заменить на `<div class="form-field">`.

**b)** В функции `buildSnippetSelectors()` — оборачивать каждый snippet-селектор в `<div class="snippet-field">` с label и hint.

**c)** Убрать вызовы `loadTemplates()` из обработчика модалки библиотеки (этот обработчик больше не нужен — модалки нет).

**d)** Убрать вызовы `loadHistory()` из обработчика модалки истории.

Точные изменения зависят от текущего содержимого app.js. Инженер должен прочитать файл, найти эти паттерны и обновить. Ключевые CSS-классы для замены:
- `mb-3` → `form-field` для полей формы в динамической генерации
- Инлайн стили snippet-секций → `snippet-field`
- Убрать обработчики событий `libraryModal` и `historyModal` (модалки удалены из HTML)

- [ ] **Step 2: Проверить что JS файл не имеет синтаксических ошибок**

Run: `node -c static/js/app.js`
Expected: (без ошибок)

- [ ] **Step 3: Commit**

```bash
git add static/js/app.js
git commit -m "refactor: adapt app.js for new page structure"
```

---

### Task 9: Финальная проверка и деплой

**Files:**
- Нет новых файлов

- [ ] **Step 1: Проверить синтаксис Python**

Run: `python3 -m py_compile app.py && echo "OK"`
Expected: `OK`

- [ ] **Step 2: Проверить все страницы локально**

Run: `python3 -c "
from app import app
c = app.test_client()
for path in ['/', '/login', '/register', '/my-templates', '/history-page', '/snippets', '/health']:
    r = c.get(path, follow_redirects=True)
    print(f'{path}: {r.status_code}')
"`
Expected: все 200

- [ ] **Step 3: Commit и push**

```bash
git push origin main
```

- [ ] **Step 4: Дождаться деплоя и проверить на сервере**

Run: `gh run watch --exit-status`

Затем проверить:
Run: `curl -sk -o /dev/null -w "%{http_code}" https://85.239.39.232/health`
Expected: `200`

- [ ] **Step 5: Визуальная проверка в браузере**

Открыть https://85.239.39.232 и проверить:
1. Login/Register — новый дизайн с лого DocFiller
2. Главная — navbar с табами, шаги 1-2, кнопка генерации
3. Шаблоны — отдельная страница с таблицей
4. Справочники — обновлённый дизайн
5. История — отдельная страница с таблицей
6. Справка — модалка из navbar
7. Мобильная версия — hamburger menu
