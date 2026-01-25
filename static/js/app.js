// Глобальные переменные
let uploadedFile = null;
let templateFile = null;
let templateVariables = null;
let currentMode = 'form';

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
    dropZone.addEventListener('click', function() {
        document.getElementById('fileInput').click();
    });
}

// Настройка input для выбора файла
function setupFileInput() {
    const fileInput = document.getElementById('fileInput');
    fileInput.addEventListener('change', function(e) {
        if (e.target.files.length > 0) {
            handleFile(e.target.files[0]);
        }
    });
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
        const response = await fetch('/parse-template', {
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

    // Сортируем переменные: сначала простые, потом сложные
    const sortedKeys = Object.keys(variables).sort((a, b) => {
        const typeA = variables[a].type;
        const typeB = variables[b].type;
        if (typeA === 'simple' && typeB !== 'simple') return -1;
        if (typeA !== 'simple' && typeB === 'simple') return 1;
        return a.localeCompare(b);
    });

    for (const key of sortedKeys) {
        const variable = variables[key];
        const fieldGroup = document.createElement('div');
        fieldGroup.className = 'mb-4';

        if (variable.type === 'simple') {
            // Простое текстовое поле
            fieldGroup.innerHTML = `
                <label for="field_${key}" class="form-label">${key}</label>
                <input type="text" class="form-control" id="field_${key}" name="${key}" placeholder="Введите ${key}">
            `;
        } else if (variable.type === 'boolean') {
            // Checkbox для boolean переменных
            fieldGroup.innerHTML = `
                <div class="form-check">
                    <input class="form-check-input" type="checkbox" id="field_${key}" name="${key}">
                    <label class="form-check-label" for="field_${key}">${key}</label>
                </div>
            `;
        } else if (variable.type === 'array') {
            // Массив объектов
            fieldGroup.innerHTML = `
                <label class="form-label fw-bold">${key} (массив)</label>
                <div id="array_${key}" class="border rounded p-3 bg-light">
                    <!-- Элементы массива будут добавлены здесь -->
                </div>
                <button type="button" class="btn btn-sm btn-outline-primary mt-2" onclick="addArrayItem('${key}', ${JSON.stringify(variable.fields || [])})">
                    + Добавить ${key}
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
            fieldsHtml += `
                <div class="col-md-6 mb-2">
                    <label class="form-label small">${field}</label>
                    <input type="text" class="form-control form-control-sm" name="${arrayName}[${itemIndex}].${field}" placeholder="${field}">
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
        const response = await fetch('/generate', {
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
