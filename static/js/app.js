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
    // Проверка, не пришел ли пользователь со страницы шаблонов
    checkLoadTemplate();
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

// Проверка, нужно ли загрузить шаблон из библиотеки
function checkLoadTemplate() {
    const templateId = sessionStorage.getItem('loadTemplateId');
    if (templateId) {
        sessionStorage.removeItem('loadTemplateId');
        loadTemplateFromLibrary(parseInt(templateId));
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
            // Сохраняем SNIPPET-метки
            window.templateSnippets = result.snippets || [];
            templateFile = result.template_file;

            // Генерация динамической формы
            buildDynamicForm(templateVariables);

            // Если есть SNIPPET-метки, добавляем dropdown'ы
            if (window.templateSnippets && window.templateSnippets.length > 0) {
                buildSnippetSelectors(window.templateSnippets);
            }

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
        fieldGroup.className = 'form-field';

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

    // Добавляем выбранные SNIPPET-фрагменты
    const snippetSelections = {};
    document.querySelectorAll('.snippet-selector').forEach(select => {
        const snippetName = select.getAttribute('data-snippet-name');
        snippetSelections[snippetName] = select.value;
    });
    formData.append('snippets', JSON.stringify(snippetSelections));

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

// Загрузка шаблона из библиотеки
async function loadTemplateFromLibrary(templateId) {
    try {
        const response = await fetchWithAuth(`/templates/${templateId}`);
        const data = await response.json();

        if (data.success) {
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
            showAlert('danger', data.error || 'Ошибка загрузки шаблона');
        }
    } catch (error) {
        console.error('Error loading template:', error);
        showAlert('danger', 'Ошибка загрузки шаблона');
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

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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

// ===== Функции для SNIPPET-меток =====

async function buildSnippetSelectors(snippets) {
    // Загружаем список фрагментов пользователя
    try {
        const response = await fetchWithAuth('/snippets/items');
        const data = await response.json();

        if (!data.success) return;

        const dynamicForm = document.getElementById('dynamicForm');
        const grouped = data.snippets; // {category_name: [{id, name, description}, ...]}

        for (const snippet of snippets) {
            const fieldGroup = document.createElement('div');
            fieldGroup.className = 'snippet-field';
            fieldGroup.id = `snippet_field_${snippet.name}`;

            let optionsHtml = '<option value="">— Не вставлять —</option>';
            for (const [catName, items] of Object.entries(grouped)) {
                optionsHtml += `<optgroup label="${escapeHtml(catName)}">`;
                for (const item of items) {
                    optionsHtml += `<option value="${item.id}">${escapeHtml(item.name)}</option>`;
                }
                optionsHtml += '</optgroup>';
            }

            const displayName = formatFieldName(snippet.name);
            fieldGroup.innerHTML = `
                <label class="form-label">
                    SNIPPET: ${displayName}
                </label>
                <span class="snippet-hint">Фрагмент из справочника</span>
                <select class="form-select snippet-selector" name="snippet_${snippet.name}" data-snippet-name="${snippet.name}">
                    ${optionsHtml}
                </select>
            `;

            dynamicForm.appendChild(fieldGroup);
        }
    } catch (error) {
        console.error('Error loading snippets for selectors:', error);
    }
}
