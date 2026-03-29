// Глобальные переменные
let currentCategoryId = null;
let snippetFile = null;
let deleteCallback = null;

// Обёртка fetch с обработкой 401
async function fetchWithAuth(url, options = {}) {
    const response = await fetch(url, options);
    if (response.status === 401) {
        window.location.href = '/login?next=' + encodeURIComponent(window.location.pathname);
        throw new Error('Session expired');
    }
    return response;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ===== Загрузка при старте =====
document.addEventListener('DOMContentLoaded', function() {
    loadCategories();
    setupSnippetFileInput();
});

// ===== Категории =====

async function loadCategories() {
    try {
        const response = await fetchWithAuth('/snippets/categories');
        const data = await response.json();
        if (data.success) {
            renderCategories(data.categories);
        }
    } catch (error) {
        console.error('Error loading categories:', error);
    }
}

function renderCategories(categories) {
    const container = document.getElementById('categoriesList');
    if (categories.length === 0) {
        container.innerHTML = '<div class="p-3 text-center text-muted">Нет категорий. Создайте первую!</div>';
        return;
    }

    let html = '<div class="list-group list-group-flush">';
    categories.forEach(cat => {
        const active = cat.id === currentCategoryId ? 'active' : '';
        html += `
            <a href="#" class="list-group-item list-group-item-action d-flex justify-content-between align-items-center ${active}"
               onclick="selectCategory(${cat.id}, '${escapeHtml(cat.name)}'); return false;">
                <div>
                    <strong>${escapeHtml(cat.name)}</strong>
                    ${cat.description ? '<br><small class="text-muted">' + escapeHtml(cat.description) + '</small>' : ''}
                </div>
                <div class="d-flex align-items-center gap-2">
                    <span class="badge bg-primary rounded-pill">${cat.snippet_count}</span>
                    <button class="btn btn-sm btn-outline-danger" onclick="event.stopPropagation(); deleteCategory(${cat.id}, '${escapeHtml(cat.name)}')">X</button>
                </div>
            </a>
        `;
    });
    html += '</div>';
    container.innerHTML = html;
}

function showCreateCategoryModal() {
    document.getElementById('catName').value = '';
    document.getElementById('catDescription').value = '';
    new bootstrap.Modal(document.getElementById('createCategoryModal')).show();
}

async function createCategory() {
    const name = document.getElementById('catName').value.trim();
    if (!name) {
        document.getElementById('catName').classList.add('is-invalid');
        return;
    }
    document.getElementById('catName').classList.remove('is-invalid');

    try {
        const response = await fetchWithAuth('/snippets/categories', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                name: name,
                description: document.getElementById('catDescription').value.trim()
            })
        });
        const data = await response.json();
        if (data.success) {
            bootstrap.Modal.getInstance(document.getElementById('createCategoryModal')).hide();
            loadCategories();
        }
    } catch (error) {
        console.error('Error creating category:', error);
    }
}

function deleteCategory(catId, catName) {
    showDeleteConfirm(
        `Удалить категорию "${catName}" и все её фрагменты?`,
        async () => {
            try {
                const response = await fetchWithAuth(`/snippets/categories/${catId}`, {method: 'DELETE'});
                const data = await response.json();
                if (data.success) {
                    if (currentCategoryId === catId) {
                        currentCategoryId = null;
                        document.getElementById('snippetsList').innerHTML = '<div class="alert alert-info">Выберите категорию</div>';
                        document.getElementById('snippetsTitle').textContent = 'Выберите категорию';
                        document.getElementById('addSnippetBtn').style.display = 'none';
                    }
                    loadCategories();
                }
            } catch (error) {
                console.error('Error deleting category:', error);
            }
        }
    );
}

// ===== Фрагменты =====

function selectCategory(catId, catName) {
    currentCategoryId = catId;
    document.getElementById('snippetsTitle').textContent = catName;
    document.getElementById('addSnippetBtn').style.display = 'inline-block';
    loadSnippets(catId);
    loadCategories(); // Обновляем active
}

async function loadSnippets(catId) {
    try {
        const response = await fetchWithAuth(`/snippets/categories/${catId}/items`);
        const data = await response.json();
        if (data.success) {
            renderSnippets(data.items);
        }
    } catch (error) {
        console.error('Error loading snippets:', error);
    }
}

function renderSnippets(items) {
    const container = document.getElementById('snippetsList');
    if (items.length === 0) {
        container.innerHTML = '<div class="alert alert-info">В этой категории пока нет фрагментов</div>';
        return;
    }

    let html = '<div class="list-group">';
    items.forEach(item => {
        const date = new Date(item.created_at).toLocaleString('ru-RU');
        const size = item.file_size ? formatFileSize(item.file_size) : '';
        html += `
            <div class="list-group-item">
                <div class="d-flex justify-content-between align-items-start">
                    <div>
                        <h6 class="mb-1">${escapeHtml(item.name)}</h6>
                        <small class="text-muted">${date} ${size ? '• ' + size : ''}</small>
                        ${item.description ? '<br><small class="text-muted">' + escapeHtml(item.description) + '</small>' : ''}
                    </div>
                    <div class="btn-group">
                        <button class="btn btn-sm btn-info" onclick="previewSnippet(${item.id})">Просмотр</button>
                        <button class="btn btn-sm btn-outline-primary" onclick="downloadSnippet(${item.id})">Скачать</button>
                        <button class="btn btn-sm btn-outline-danger" onclick="deleteSnippet(${item.id}, '${escapeHtml(item.name)}')">Удалить</button>
                    </div>
                </div>
            </div>
        `;
    });
    html += '</div>';
    container.innerHTML = html;
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// ===== Создание фрагмента =====

function setupSnippetFileInput() {
    const fileInput = document.getElementById('snippetFileInput');
    const dropZone = document.getElementById('snippetDropZone');

    fileInput.addEventListener('change', function(e) {
        if (e.target.files.length > 0) {
            snippetFile = e.target.files[0];
            document.getElementById('snippetFileInfo').style.display = 'block';
            document.getElementById('snippetFileInfo').textContent = 'Файл: ' + snippetFile.name;
        }
    });

    dropZone.addEventListener('dragover', function(e) {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });
    dropZone.addEventListener('dragleave', function(e) {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
    });
    dropZone.addEventListener('drop', function(e) {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        if (e.dataTransfer.files.length > 0) {
            snippetFile = e.dataTransfer.files[0];
            document.getElementById('snippetFileInfo').style.display = 'block';
            document.getElementById('snippetFileInfo').textContent = 'Файл: ' + snippetFile.name;
        }
    });
}

function showCreateSnippetModal() {
    document.getElementById('snippetName').value = '';
    document.getElementById('snippetDescription').value = '';
    snippetFile = null;
    document.getElementById('snippetFileInfo').style.display = 'none';
    document.getElementById('snippetFileInput').value = '';
    // Сброс полей формы
    const formFields = document.getElementById('formFields');
    formFields.innerHTML = `
        <div class="row mb-2 form-field-row">
            <div class="col-5"><input type="text" class="form-control form-control-sm" placeholder="Название поля" name="field_key"></div>
            <div class="col-5"><input type="text" class="form-control form-control-sm" placeholder="Значение" name="field_value"></div>
            <div class="col-2"><button class="btn btn-sm btn-outline-danger" onclick="this.closest('.form-field-row').remove()">X</button></div>
        </div>
    `;
    new bootstrap.Modal(document.getElementById('createSnippetModal')).show();
}

function addFormField() {
    const container = document.getElementById('formFields');
    const row = document.createElement('div');
    row.className = 'row mb-2 form-field-row';
    row.innerHTML = `
        <div class="col-5"><input type="text" class="form-control form-control-sm" placeholder="Название поля" name="field_key"></div>
        <div class="col-5"><input type="text" class="form-control form-control-sm" placeholder="Значение" name="field_value"></div>
        <div class="col-2"><button class="btn btn-sm btn-outline-danger" onclick="this.closest('.form-field-row').remove()">X</button></div>
    `;
    container.appendChild(row);
}

async function createSnippet() {
    const name = document.getElementById('snippetName').value.trim();
    if (!name) {
        document.getElementById('snippetName').classList.add('is-invalid');
        return;
    }
    document.getElementById('snippetName').classList.remove('is-invalid');

    const description = document.getElementById('snippetDescription').value.trim();
    const activeTab = document.querySelector('#createSnippetModal .nav-link.active');
    const isFileMode = activeTab.getAttribute('data-bs-target') === '#tabFile';

    try {
        let response;

        if (isFileMode) {
            if (!snippetFile) {
                alert('Выберите файл');
                return;
            }
            const formData = new FormData();
            formData.append('name', name);
            formData.append('description', description);
            formData.append('category_id', currentCategoryId);
            formData.append('file', snippetFile);

            response = await fetchWithAuth('/snippets/items', {
                method: 'POST',
                body: formData
            });
        } else {
            // Режим формы
            const fields = [];
            document.querySelectorAll('#formFields .form-field-row').forEach(row => {
                const key = row.querySelector('[name="field_key"]').value.trim();
                const value = row.querySelector('[name="field_value"]').value.trim();
                if (key) {
                    fields.push({key, value});
                }
            });
            if (fields.length === 0) {
                alert('Добавьте хотя бы одно поле');
                return;
            }

            response = await fetchWithAuth('/snippets/items/from-form', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    name: name,
                    description: description,
                    category_id: currentCategoryId,
                    fields: fields
                })
            });
        }

        const data = await response.json();
        if (data.success) {
            bootstrap.Modal.getInstance(document.getElementById('createSnippetModal')).hide();
            loadSnippets(currentCategoryId);
            loadCategories();
        } else {
            alert(data.error || 'Ошибка создания');
        }
    } catch (error) {
        console.error('Error creating snippet:', error);
    }
}

// ===== Просмотр =====

let currentPreviewSnippetId = null;

async function previewSnippet(snippetId) {
    currentPreviewSnippetId = snippetId;
    const modal = new bootstrap.Modal(document.getElementById('previewSnippetModal'));
    document.getElementById('previewContent').innerHTML = '<div class="text-center"><div class="spinner-border text-primary"></div></div>';
    modal.show();

    try {
        const response = await fetchWithAuth(`/snippets/items/${snippetId}/preview`);
        const data = await response.json();
        if (data.success) {
            document.getElementById('previewTitle').textContent = data.name;
            document.getElementById('previewContent').innerHTML = data.html || '<p class="text-muted">Пустой документ</p>';

            document.getElementById('previewDownloadBtn').onclick = () => downloadSnippet(snippetId);
            document.getElementById('previewReplaceBtn').onclick = () => document.getElementById('replaceFileInput').click();

            // Обработчик замены файла
            document.getElementById('replaceFileInput').onchange = async function(e) {
                if (e.target.files.length > 0) {
                    const formData = new FormData();
                    formData.append('file', e.target.files[0]);
                    try {
                        const resp = await fetchWithAuth(`/snippets/items/${snippetId}`, {
                            method: 'PUT',
                            body: formData
                        });
                        const result = await resp.json();
                        if (result.success) {
                            previewSnippet(snippetId); // Перезагрузить превью
                            loadSnippets(currentCategoryId);
                        }
                    } catch (err) {
                        console.error('Error replacing file:', err);
                    }
                    e.target.value = '';
                }
            };
        } else {
            document.getElementById('previewContent').innerHTML = '<div class="alert alert-danger">' + escapeHtml(data.error) + '</div>';
        }
    } catch (error) {
        document.getElementById('previewContent').innerHTML = '<div class="alert alert-danger">Ошибка загрузки</div>';
    }
}

function downloadSnippet(snippetId) {
    window.location.href = `/snippets/items/${snippetId}/download`;
}

function deleteSnippet(snippetId, snippetName) {
    showDeleteConfirm(
        `Удалить фрагмент "${snippetName}"?`,
        async () => {
            try {
                const response = await fetchWithAuth(`/snippets/items/${snippetId}`, {method: 'DELETE'});
                const data = await response.json();
                if (data.success) {
                    loadSnippets(currentCategoryId);
                    loadCategories();
                }
            } catch (error) {
                console.error('Error deleting snippet:', error);
            }
        }
    );
}

// ===== Подтверждение удаления =====

function showDeleteConfirm(message, onConfirm) {
    document.getElementById('snippetDeleteMessage').textContent = message;
    deleteCallback = onConfirm;
    new bootstrap.Modal(document.getElementById('confirmDeleteModal')).show();
}

document.getElementById('snippetConfirmDeleteBtn').addEventListener('click', function() {
    bootstrap.Modal.getInstance(document.getElementById('confirmDeleteModal')).hide();
    if (deleteCallback) {
        deleteCallback();
        deleteCallback = null;
    }
});
