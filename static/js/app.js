// Глобальные переменные
let uploadedFile = null;
let templateFile = null;
let templateVariables = null;
let currentMode = 'form';
let currentTemplateFile = null;

// ===== Toast notification system =====

// Toast notification system
function showToast(type, title, message, duration = 5000) {
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type} show`;
    toast.setAttribute('role', 'alert');

    const iconMap = {
        success: '✓',
        error: '✗',
        warning: '⚠',
        info: 'ℹ'
    };

    toast.innerHTML = `
        <div class="toast-header">
            <strong class="me-auto">${iconMap[type] || ''} ${title}</strong>
            <button type="button" class="btn-close" data-bs-dismiss="toast"></button>
        </div>
        <div class="toast-body">
            ${message}
        </div>
    `;

    container.appendChild(toast);

    const bsToast = new bootstrap.Toast(toast, { delay: duration });
    bsToast.show();

    toast.addEventListener('hidden.bs.toast', () => {
        toast.remove();
    });
}

// ===== Обёртка fetch с обработкой 401 =====

async function fetchWithAuth(url, options = {}) {
    const response = await fetch(url, options);

    // Обработка 401 Unauthorized
    if (response.status === 401) {
        // Redirect to login page
        window.location.href = '/login?next=' + encodeURIComponent(window.location.pathname);
        throw new Error('Session expired. Redirecting to login...');
    }

    return response;
}

// Форматирование имени поля для отображения
function formatFieldName(name) {
    return name
        .replace(/_/g, ' ')  // Заменяем _ на пробелы
        .replace(/\b\w/g, l => l.toUpperCase());  // Capitalize каждое слово
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    setupDropZone();
    setupFileInput();
    setupJsonValidation();
    setupModeSwitch();
    checkFirstVisit();
});

// Проверка первого посещения и показ инструкции
function checkFirstVisit() {
    // Проверяем, был ли пользователь на сайте раньше
    const hasVisited = localStorage.getItem('docx_filler_visited');

    if (!hasVisited) {
        // Если первое посещение - показываем инструкцию через 1 секунду
        setTimeout(function() {
            const instructionModal = new bootstrap.Modal(document.getElementById('instructionModal'));
            instructionModal.show();
        }, 1000);

        // Отмечаем, что пользователь посетил сайт
        localStorage.setItem('docx_filler_visited', 'true');
    }
}

// Настройка переключения режимов
function setupModeSwitch() {
    const modeForm = document.getElementById('modeForm');
    const modeJson = document.getElementById('modeJson');

    modeForm.addEventListener('change', function() {
        if (this.checked) {
            switchMode('form');
        }
    });

    modeJson.addEventListener('change', function() {
        if (this.checked) {
            switchMode('json');
        }
    });

    // Установка начального режима
    switchMode('form');
}

// Переключение режимов
function switchMode(mode) {
    currentMode = mode;
    const formMode = document.getElementById('formMode');
    const jsonMode = document.getElementById('jsonMode');

    if (mode === 'form') {
        formMode.style.display = 'block';
        jsonMode.style.display = 'none';
    } else {
        formMode.style.display = 'none';
        jsonMode.style.display = 'block';
    }
}

// Настройка зоны drag-and-drop
function setupDropZone() {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');

    dropZone.addEventListener('dragover', function(e) {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', function(e) {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', function(e) {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('drag-over');

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFile(files[0]);
        }
    });

    // Клик по зоне открывает диалог выбора файла
    // Исключаем клики по кнопкам и ссылкам внутри зоны
    dropZone.addEventListener('click', function(e) {
        // Не открывать диалог, если клик был по кнопке или ссылке
        if (e.target.closest('button') || e.target.closest('a') || e.target === fileInput) {
            return;
        }
        fileInput.click();
    });
}

// Настройка input для выбора файла
function setupFileInput() {
    const fileInput = document.getElementById('fileInput');
    const selectFileBtn = document.getElementById('selectFileBtn');

    fileInput.addEventListener('change', function(e) {
        if (e.target.files.length > 0) {
            handleFile(e.target.files[0]);
        }
    });

    // Обработчик для кнопки выбора файла
    if (selectFileBtn) {
        selectFileBtn.addEventListener('click', function(e) {
            e.stopPropagation(); // Предотвращаем всплытие к dropZone
            fileInput.click();
        });
    }
}

// Обработка выбранного файла
async function handleFile(file) {
    // Проверка расширения
    if (!file.name.toLowerCase().endsWith('.docx')) {
        showAlert('danger', 'Пожалуйста, выберите файл с расширением .docx');
        return;
    }

    // Проверка размера (10 MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
        showAlert('danger', 'Файл слишком большой. Максимальный размер: 10 MB');
        return;
    }

    uploadedFile = file;

    // Отображение информации о файле
    document.querySelector('.drop-zone-content').style.display = 'none';
    document.getElementById('fileInfo').style.display = 'flex';
    document.getElementById('fileName').textContent = file.name;

    hideAlert();

    // Парсинг шаблона
    await parseTemplate(file);
}

// Парсинг шаблона для извлечения переменных
async function parseTemplate(file) {
    const formData = new FormData();
    formData.append('template', file);

    try {
        const response = await fetchWithAuth('/parse-template', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (response.ok && result.success) {
            templateVariables = result.variables;
            templateFile = result.template_file;

            // Генерация динамической формы
            buildDynamicForm(templateVariables);

            // Показываем уведомление
            showAlert('success', `✓ Шаблон загружен. Найдено полей: ${Object.keys(templateVariables).length}`);

            // Автоматически переключаемся в режим формы
            document.getElementById('modeForm').checked = true;
            switchMode('form');
        } else {
            showAlert('danger', '❌ Ошибка парсинга шаблона: ' + (result.error || 'Unknown error'));
        }
    } catch (error) {
        showAlert('danger', '❌ Ошибка сети: ' + error.message);
    }
}

// Построение динамической формы
function buildDynamicForm(variables) {
    const dynamicForm = document.getElementById('dynamicForm');
    const templateNotLoaded = document.getElementById('templateNotLoaded');

    templateNotLoaded.style.display = 'none';
    dynamicForm.innerHTML = '';

    // Сортируем переменные по порядку вхождения в документе
    const sortedKeys = Object.keys(variables).sort((a, b) => {
        const posA = variables[a].position || 9999;
        const posB = variables[b].position || 9999;
        return posA - posB;
    });

    for (const key of sortedKeys) {
        const variable = variables[key];
        const fieldGroup = document.createElement('div');
        fieldGroup.className = 'mb-4';

        if (variable.type === 'simple') {
            // Простое текстовое поле
            const displayName = formatFieldName(key);
            fieldGroup.innerHTML = `
                <label for="field_${key}" class="form-label">${displayName}</label>
                <input type="text" class="form-control" id="field_${key}" name="${key}" placeholder="Введите ${displayName}">
            `;
        } else if (variable.type === 'boolean') {
            // Checkbox для boolean переменных
            const displayName = formatFieldName(key);
            fieldGroup.innerHTML = `
                <div class="form-check">
                    <input class="form-check-input" type="checkbox" id="field_${key}" name="${key}">
                    <label class="form-check-label" for="field_${key}">${displayName}</label>
                </div>
            `;
        } else if (variable.type === 'array') {
            // Массив объектов
            const displayName = formatFieldName(key);
            fieldGroup.innerHTML = `
                <label class="form-label fw-bold">${displayName} (массив)</label>
                <div id="array_${key}" class="border rounded p-3 bg-light">
                    <!-- Элементы массива будут добавлены здесь -->
                </div>
                <button type="button" class="btn btn-sm btn-outline-primary mt-2" onclick="addArrayItem('${key}', ${JSON.stringify(variable.fields || [])})">
                    + Добавить ${displayName}
                </button>
            `;

            // Добавляем первый элемент по умолчанию
            setTimeout(() => addArrayItem(key, variable.fields || []), 0);
        }

        dynamicForm.appendChild(fieldGroup);
    }
}

// Добавление элемента массива
function addArrayItem(arrayName, fields) {
    const arrayContainer = document.getElementById(`array_${arrayName}`);
    const itemIndex = arrayContainer.children.length;

    const itemDiv = document.createElement('div');
    itemDiv.className = 'mb-3 p-3 bg-white border rounded position-relative';
    itemDiv.id = `array_${arrayName}_item_${itemIndex}`;

    let fieldsHtml = `<div class="d-flex justify-content-between align-items-center mb-2">
        <strong>Элемент ${itemIndex + 1}</strong>
        <button type="button" class="btn btn-sm btn-danger" onclick="removeArrayItem('${arrayName}', ${itemIndex})">Удалить</button>
    </div>`;

    if (fields.length > 0) {
        fieldsHtml += '<div class="row">';
        for (const field of fields) {
            const displayName = formatFieldName(field);
            fieldsHtml += `
                <div class="col-md-6 mb-2">
                    <label class="form-label small">${displayName}</label>
                    <input type="text" class="form-control form-control-sm" name="${arrayName}[${itemIndex}].${field}" placeholder="${displayName}">
                </div>
            `;
        }
        fieldsHtml += '</div>';
    } else {
        // Если полей нет, показываем простой JSON input
        fieldsHtml += `
            <label class="form-label small">Данные (JSON)</label>
            <textarea class="form-control form-control-sm" name="${arrayName}[${itemIndex}]" rows="2" placeholder='{"key": "value"}'></textarea>
        `;
    }

    itemDiv.innerHTML = fieldsHtml;
    arrayContainer.appendChild(itemDiv);
}

// Удаление элемента массива
function removeArrayItem(arrayName, itemIndex) {
    const item = document.getElementById(`array_${arrayName}_item_${itemIndex}`);
    if (item) {
        item.remove();
    }
}

// Сборка JSON из формы
function buildJsonFromForm() {
    const data = {};
    const dynamicForm = document.getElementById('dynamicForm');

    // Простые поля
    const inputs = dynamicForm.querySelectorAll('input[type="text"], input[type="checkbox"]');
    inputs.forEach(input => {
        const name = input.getAttribute('name');
        if (name && !name.includes('[')) {
            if (input.type === 'checkbox') {
                data[name] = input.checked;
            } else {
                data[name] = input.value;
            }
        }
    });

    // Массивы
    if (templateVariables) {
        for (const key in templateVariables) {
            if (templateVariables[key].type === 'array') {
                const arrayContainer = document.getElementById(`array_${key}`);
                if (arrayContainer) {
                    const items = [];
                    const arrayItems = arrayContainer.children;

                    for (let i = 0; i < arrayItems.length; i++) {
                        const item = {};
                        const itemInputs = arrayItems[i].querySelectorAll('input, textarea');

                        itemInputs.forEach(input => {
                            const name = input.getAttribute('name');
                            if (name) {
                                const match = name.match(/\[(\d+)\]\.(.+)/);
                                if (match) {
                                    const fieldName = match[2];
                                    item[fieldName] = input.value;
                                }
                            }
                        });

                        if (Object.keys(item).length > 0) {
                            items.push(item);
                        }
                    }

                    data[key] = items;
                }
            }
        }
    }

    return data;
}

// Очистка выбранного файла
function clearFile() {
    uploadedFile = null;
    templateFile = null;
    templateVariables = null;
    document.querySelector('.drop-zone-content').style.display = 'block';
    document.getElementById('fileInfo').style.display = 'none';
    document.getElementById('fileInput').value = '';
    document.getElementById('dynamicForm').innerHTML = '';
    document.getElementById('templateNotLoaded').style.display = 'block';
}

// Настройка валидации JSON
function setupJsonValidation() {
    const jsonData = document.getElementById('jsonData');
    let validationTimeout;

    jsonData.addEventListener('input', function() {
        // Дебаунс для валидации
        clearTimeout(validationTimeout);
        validationTimeout = setTimeout(function() {
            validateJson();
        }, 500);
    });
}

// Валидация JSON
function validateJson() {
    const jsonData = document.getElementById('jsonData');
    const jsonError = document.getElementById('jsonError');
    const jsonValid = document.getElementById('jsonValid');

    if (!jsonData.value.trim()) {
        jsonError.style.display = 'none';
        jsonValid.style.display = 'none';
        return true;
    }

    try {
        JSON.parse(jsonData.value);
        jsonError.style.display = 'none';
        jsonValid.style.display = 'block';
        return true;
    } catch (e) {
        jsonError.textContent = '❌ Ошибка JSON: ' + e.message;
        jsonError.style.display = 'block';
        jsonValid.style.display = 'none';
        return false;
    }
}

// Генерация документа
async function generateDocument() {
    // Проверка наличия файла
    if (!uploadedFile && !templateFile) {
        showAlert('danger', 'Пожалуйста, загрузите DOCX шаблон');
        return;
    }

    let jsonData;

    // Получение данных в зависимости от режима
    if (currentMode === 'form') {
        // Собираем JSON из формы
        const formData = buildJsonFromForm();
        jsonData = JSON.stringify(formData, null, 2);
    } else {
        // Берем JSON из textarea
        jsonData = document.getElementById('jsonData').value.trim();
        if (!jsonData) {
            showAlert('warning', 'Пожалуйста, введите JSON данные');
            return;
        }
        if (!validateJson()) {
            showAlert('danger', 'Пожалуйста, исправьте ошибки в JSON');
            return;
        }
    }

    // Отключение кнопки и показ спиннера
    const generateBtn = document.getElementById('generateBtn');
    const btnText = document.getElementById('btnText');
    const btnSpinner = document.getElementById('btnSpinner');

    generateBtn.disabled = true;
    btnText.textContent = 'Генерация...';
    btnSpinner.style.display = 'inline-block';

    // Подготовка данных для отправки
    const formData = new FormData();

    if (templateFile) {
        // Используем сохраненный файл из сессии
        formData.append('template_file', templateFile);
    } else {
        // Загружаем новый файл
        formData.append('template', uploadedFile);
    }

    formData.append('data', jsonData);

    try {
        const response = await fetchWithAuth('/generate', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (response.ok && result.success) {
            showAlert('success',
                `✓ Документ успешно сгенерирован!
                <a href="/download/${result.filename}" class="btn btn-success btn-sm ms-2">
                    Скачать
                </a>`
            );
        } else {
            showAlert('danger', '❌ Ошибка: ' + (result.error || 'Unknown error'));
        }
    } catch (error) {
        showAlert('danger', '❌ Ошибка сети: ' + error.message);
    } finally {
        // Возврат кнопки в исходное состояние
        generateBtn.disabled = false;
        btnText.textContent = 'Сгенерировать документ';
        btnSpinner.style.display = 'none';
    }
}

// Показ уведомления
function showAlert(type, message) {
    const resultAlert = document.getElementById('resultAlert');
    resultAlert.className = `alert alert-${type}`;
    resultAlert.innerHTML = message;
    resultAlert.style.display = 'block';

    // Автоматическое скрытие через 10 секунд для успешных сообщений
    if (type === 'success') {
        setTimeout(function() {
            hideAlert();
        }, 10000);
    }
}

// Скрытие уведомления
function hideAlert() {
    const resultAlert = document.getElementById('resultAlert');
    resultAlert.style.display = 'none';
}

// Копирование примера JSON
function copyExample() {
    const exampleJson = document.getElementById('exampleJson').textContent;
    const jsonData = document.getElementById('jsonData');

    jsonData.value = exampleJson;
    jsonData.focus();

    // Триггер валидации
    validateJson();

    // Переключаемся в режим JSON
    document.getElementById('modeJson').checked = true;
    switchMode('json');

    // Показ уведомления
    const tooltip = document.createElement('div');
    tooltip.className = 'alert alert-info position-fixed top-0 start-50 translate-middle-x mt-3';
    tooltip.style.zIndex = '9999';
    tooltip.textContent = '✓ Пример скопирован в форму';
    document.body.appendChild(tooltip);

    setTimeout(function() {
        tooltip.remove();
    }, 2000);
}

// ===== Функции для работы с библиотекой шаблонов =====

// Загрузка библиотеки при открытии модального окна
document.getElementById('libraryModal')?.addEventListener('show.bs.modal', function() {
    loadTemplatesLibrary();
});

// Загрузка списка шаблонов
async function loadTemplatesLibrary() {
    try {
        const response = await fetchWithAuth('/templates');
        const data = await response.json();

        if (data.success) {
            renderTemplatesList(data.templates);
        }
    } catch (error) {
        console.error('Error loading templates:', error);
        showTemplateLibraryError('Ошибка загрузки библиотеки');
    }
}

// Отрисовка списка шаблонов
function renderTemplatesList(templates) {
    const container = document.getElementById('templatesListContainer');

    if (templates.length === 0) {
        container.innerHTML = '<div class="alert alert-info">Библиотека пуста. Сохраните свой первый шаблон!</div>';
        return;
    }

    let html = '<div class="list-group">';
    templates.forEach(template => {
        const createdDate = new Date(template.created_at).toLocaleString('ru-RU');
        html += `
            <div class="list-group-item">
                <div class="d-flex justify-content-between align-items-start">
                    <div class="flex-grow-1">
                        <h6 class="mb-1">${escapeHtml(template.name)}</h6>
                        <p class="mb-1 text-muted small">${escapeHtml(template.description || 'Без описания')}</p>
                        <small class="text-muted">${createdDate}</small>
                    </div>
                    <div class="btn-group">
                        <button class="btn btn-sm btn-primary" onclick="loadTemplateFromLibrary(${template.id})">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-download" viewBox="0 0 16 16">
                                <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
                                <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/>
                            </svg>
                            Загрузить
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="deleteTemplateFromLibrary(${template.id})">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-trash" viewBox="0 0 16 16">
                                <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                                <path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
                            </svg>
                            Удалить
                        </button>
                    </div>
                </div>
            </div>
        `;
    });
    html += '</div>';

    container.innerHTML = html;
}

// Загрузка шаблона из библиотеки
async function loadTemplateFromLibrary(templateId) {
    try {
        const response = await fetchWithAuth(`/templates/${templateId}`);
        const data = await response.json();

        if (data.success) {
            // Закрываем модальное окно
            const modal = bootstrap.Modal.getInstance(document.getElementById('libraryModal'));
            modal.hide();

            // Загружаем шаблон в форму
            currentTemplateFile = data.template_file;
            templateFile = data.template_file;
            templateVariables = data.variables;

            // Обновляем UI
            uploadedFile = { name: data.name };
            document.querySelector('.drop-zone-content').style.display = 'none';
            document.getElementById('fileInfo').style.display = 'flex';
            document.getElementById('fileName').textContent = data.name;

            // Показываем форму
            buildDynamicForm(data.variables);

            // Переключаемся в режим формы
            document.getElementById('modeForm').checked = true;
            switchMode('form');

            showAlert('success', `✓ Шаблон "${escapeHtml(data.name)}" загружен из библиотеки`);
        } else {
            showTemplateLibraryError(data.error || 'Ошибка загрузки шаблона');
        }
    } catch (error) {
        console.error('Error loading template:', error);
        showTemplateLibraryError('Ошибка загрузки шаблона');
    }
}

// Сохранение шаблона в библиотеку
async function saveTemplateToLibrary(name, description) {
    if (!templateFile && !uploadedFile) {
        showAlert('danger', 'Сначала загрузите шаблон');
        return;
    }

    const formData = new FormData();
    formData.append('template_file', templateFile);
    formData.append('name', name);
    formData.append('description', description);

    try {
        const response = await fetchWithAuth('/templates/save', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (data.success) {
            showAlert('success', '✓ Шаблон сохранен в библиотеку');
        } else {
            showAlert('danger', '❌ ' + (data.error || 'Ошибка сохранения'));
        }
    } catch (error) {
        console.error('Error saving template:', error);
        showAlert('danger', '❌ Ошибка сохранения шаблона');
    }
}

// Удаление шаблона из библиотеки (с модальным подтверждением)
function deleteTemplateFromLibrary(templateId) {
    showConfirmDialog(
        'Вы уверены, что хотите удалить этот шаблон?',
        async () => {
            try {
                const response = await fetchWithAuth(`/templates/${templateId}`, {
                    method: 'DELETE'
                });

                const data = await response.json();

                if (data.success) {
                    // Перезагружаем список
                    loadTemplatesLibrary();
                    showTemplateLibraryMessage('success', 'Шаблон удален');
                } else {
                    showTemplateLibraryError(data.error || 'Ошибка удаления');
                }
            } catch (error) {
                console.error('Error deleting template:', error);
                showTemplateLibraryError('Ошибка удаления шаблона');
            }
        }
    );
}

// Диалог сохранения шаблона (модальное окно)
function showSaveTemplateDialog() {
    if (!templateFile && !uploadedFile) {
        showAlert('danger', 'Сначала загрузите шаблон');
        return;
    }

    // Очищаем форму
    document.getElementById('templateName').value = '';
    document.getElementById('templateDescription').value = '';

    // Показываем модальное окно
    const modal = new bootstrap.Modal(document.getElementById('saveTemplateModal'));
    modal.show();
}

// Обработчик подтверждения сохранения шаблона
document.getElementById('confirmSaveTemplate')?.addEventListener('click', async function() {
    const name = document.getElementById('templateName').value.trim();
    const description = document.getElementById('templateDescription').value.trim();

    if (!name) {
        document.getElementById('templateName').classList.add('is-invalid');
        return;
    }

    document.getElementById('templateName').classList.remove('is-invalid');

    // Закрываем модальное окно
    const modal = bootstrap.Modal.getInstance(document.getElementById('saveTemplateModal'));
    modal.hide();

    // Сохраняем шаблон
    await saveTemplateToLibrary(name, description);
});

// Вспомогательные функции для библиотеки
function showTemplateLibraryError(message) {
    const container = document.getElementById('templatesListContainer');
    container.innerHTML = `<div class="alert alert-danger">${escapeHtml(message)}</div>`;
}

function showTemplateLibraryMessage(type, message) {
    const container = document.getElementById('templatesListContainer');
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.innerHTML = `
        ${escapeHtml(message)}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    container.prepend(alertDiv);

    setTimeout(() => alertDiv.remove(), 3000);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ===== Функции для работы с историей сгенерированных документов =====

// Загрузка истории при открытии модального окна
document.getElementById('historyModal')?.addEventListener('show.bs.modal', function() {
    loadHistory();
});

// Загрузка истории документов
async function loadHistory() {
    const container = document.getElementById('historyListContainer');

    try {
        container.innerHTML = '<div class="text-center"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Загрузка...</span></div></div>';

        const response = await fetchWithAuth('/history?limit=100');
        const data = await response.json();

        if (data.success) {
            renderHistoryList(data.documents);
        } else {
            showHistoryError('Ошибка загрузки истории');
        }
    } catch (error) {
        console.error('Error loading history:', error);
        showHistoryError('Ошибка загрузки истории');
    }
}

// Отрисовка списка истории
function renderHistoryList(documents) {
    const container = document.getElementById('historyListContainer');

    if (documents.length === 0) {
        container.innerHTML = '<div class="alert alert-info">История пуста. Сгенерируйте свой первый документ!</div>';
        return;
    }

    let html = '<div class="list-group">';
    documents.forEach(doc => {
        const createdDate = new Date(doc.created_at).toLocaleString('ru-RU');
        const fileSize = doc.file_size ? formatFileSize(doc.file_size) : 'неизвестно';

        html += `
            <div class="list-group-item">
                <div class="d-flex justify-content-between align-items-start">
                    <div class="flex-grow-1">
                        <h6 class="mb-1">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-file-earmark-text text-primary" viewBox="0 0 16 16">
                                <path d="M5.5 7a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1h-5zM5 9.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5zm0 2a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 0 1h-2a.5.5 0 0 1-.5-.5z"/>
                                <path d="M9.5 0H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V4.5L9.5 0zm0 1v2A1.5 1.5 0 0 0 11 4.5h2V14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h5.5z"/>
                            </svg>
                            ${escapeHtml(doc.output_filename)}
                        </h6>
                        <p class="mb-1 text-muted small">
                            <strong>Шаблон:</strong> ${escapeHtml(doc.template_name)}
                        </p>
                        <small class="text-muted">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" class="bi bi-calendar3" viewBox="0 0 16 16">
                                <path d="M14 0H2a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2zM1 3.857C1 3.384 1.448 3 2 3h12c.552 0 1 .384 1 .857v10.286c0 .473-.448.857-1 .857H2c-.552 0-1-.384-1-.857V3.857z"/>
                                <path d="M6.5 7a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm3 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm3 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm-9 3a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm3 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm3 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm3 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm-9 3a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm3 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm3 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"/>
                            </svg>
                            ${createdDate} • ${fileSize}
                        </small>
                    </div>
                    <div class="btn-group-vertical">
                        <button class="btn btn-sm btn-primary" onclick="downloadFromHistory(${doc.id})">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-download" viewBox="0 0 16 16">
                                <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
                                <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/>
                            </svg>
                            Скачать
                        </button>
                        <button class="btn btn-sm btn-info" onclick="viewHistoryData(${doc.id})">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-eye" viewBox="0 0 16 16">
                                <path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8zM1.173 8a13.133 13.133 0 0 1 1.66-2.043C4.12 4.668 5.88 3.5 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.133 13.133 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.119 12.5 8 12.5c-2.12 0-3.879-1.168-5.168-2.457A13.134 13.134 0 0 1 1.172 8z"/>
                                <path d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM4.5 8a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0z"/>
                            </svg>
                            Данные
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="deleteFromHistory(${doc.id})">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-trash" viewBox="0 0 16 16">
                                <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                                <path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
                            </svg>
                            Удалить
                        </button>
                    </div>
                </div>
            </div>
        `;
    });
    html += '</div>';

    container.innerHTML = html;
}

// Скачивание документа из истории
async function downloadFromHistory(docId) {
    try {
        window.location.href = `/history/${docId}/download`;
    } catch (error) {
        console.error('Error downloading from history:', error);
        showAlert('danger', 'Ошибка скачивания документа');
    }
}

// Просмотр данных документа
async function viewHistoryData(docId) {
    try {
        const response = await fetchWithAuth(`/history/${docId}/data`);
        const data = await response.json();

        if (data.success) {
            // Создаем модальное окно для показа данных
            const jsonStr = JSON.stringify(data.json_data, null, 2);

            const modal = document.createElement('div');
            modal.className = 'modal fade';
            modal.innerHTML = `
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header bg-info text-white">
                            <h5 class="modal-title">Данные документа: ${escapeHtml(data.output_filename)}</h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <p class="mb-2"><strong>Шаблон:</strong> ${escapeHtml(data.template_name)}</p>
                            <p class="mb-2"><strong>Дата создания:</strong> ${new Date(data.created_at).toLocaleString('ru-RU')}</p>
                            <hr>
                            <h6>JSON данные:</h6>
                            <pre class="bg-light p-3 rounded"><code>${escapeHtml(jsonStr)}</code></pre>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Закрыть</button>
                            <button type="button" class="btn btn-primary" onclick="navigator.clipboard.writeText('${jsonStr.replace(/'/g, "\\'")}')">
                                Копировать JSON
                            </button>
                        </div>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);
            const bsModal = new bootstrap.Modal(modal);
            bsModal.show();

            // Удаляем модалку после закрытия
            modal.addEventListener('hidden.bs.modal', () => modal.remove());
        } else {
            showAlert('danger', data.error || 'Ошибка загрузки данных');
        }
    } catch (error) {
        console.error('Error viewing document data:', error);
        showAlert('danger', 'Ошибка загрузки данных документа');
    }
}

// Удаление документа из истории (с модальным подтверждением)
function deleteFromHistory(docId) {
    showConfirmDialog(
        'Вы уверены, что хотите удалить этот документ из истории?',
        async () => {
            try {
                const response = await fetchWithAuth(`/history/${docId}`, {
                    method: 'DELETE'
                });

                const data = await response.json();

                if (data.success) {
                    // Перезагружаем список
                    loadHistory();
                    showHistoryMessage('success', 'Документ удален из истории');
                } else {
                    showHistoryError(data.error || 'Ошибка удаления');
                }
            } catch (error) {
                console.error('Error deleting from history:', error);
                showHistoryError('Ошибка удаления документа');
            }
        }
    );
}

// Форматирование размера файла
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Вспомогательные функции для истории
function showHistoryError(message) {
    const container = document.getElementById('historyListContainer');
    container.innerHTML = `<div class="alert alert-danger">${escapeHtml(message)}</div>`;
}

function showHistoryMessage(type, message) {
    const container = document.getElementById('historyListContainer');
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.innerHTML = `
        ${escapeHtml(message)}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    container.prepend(alertDiv);

    setTimeout(() => alertDiv.remove(), 3000);
}

// ===== Модальное окно подтверждения =====

let confirmCallback = null;

// Показать модальное окно подтверждения
function showConfirmDialog(message, onConfirm) {
    const modal = document.getElementById('confirmDeleteModal');
    const messageEl = document.getElementById('deleteConfirmMessage');
    const confirmBtn = document.getElementById('confirmDeleteBtn');

    // Устанавливаем сообщение
    messageEl.textContent = message;

    // Сохраняем callback
    confirmCallback = onConfirm;

    // Показываем модальное окно
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
}

// Обработчик кнопки подтверждения удаления
document.getElementById('confirmDeleteBtn')?.addEventListener('click', function() {
    // Закрываем модальное окно
    const modal = bootstrap.Modal.getInstance(document.getElementById('confirmDeleteModal'));
    modal.hide();

    // Вызываем callback
    if (confirmCallback) {
        confirmCallback();
        confirmCallback = null;
    }
});
