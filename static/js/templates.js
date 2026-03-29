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
