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
