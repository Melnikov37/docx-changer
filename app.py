"""
Flask приложение для заполнения DOCX шаблонов
"""
import os
import json
import re
import uuid
from datetime import datetime
from pathlib import Path
from flask import Flask, render_template, request, jsonify, send_file
from werkzeug.utils import secure_filename
from docxtpl import DocxTemplate
from docx import Document
from s3_client import S3Client
import db

app = Flask(__name__)

# Конфигурация
app.config['MAX_CONTENT_LENGTH'] = 10 * 1024 * 1024  # 10 MB максимум
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['OUTPUT_FOLDER'] = 'output'
app.config['ALLOWED_EXTENSIONS'] = {'docx'}

# Создание необходимых директорий
for folder in [app.config['UPLOAD_FOLDER'], app.config['OUTPUT_FOLDER']]:
    Path(folder).mkdir(exist_ok=True)

# Инициализация S3 клиента и базы данных
s3_client = S3Client()
db.init_db()


def allowed_file(filename):
    """Проверка допустимого расширения файла"""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in app.config['ALLOWED_EXTENSIONS']


def cleanup_old_files():
    """Очистка старых файлов из папок uploads и output"""
    current_time = datetime.now().timestamp()
    max_age = 3600  # 1 час

    for folder in [app.config['UPLOAD_FOLDER'], app.config['OUTPUT_FOLDER']]:
        for file_path in Path(folder).glob('*'):
            if file_path.is_file():
                file_age = current_time - file_path.stat().st_mtime
                if file_age > max_age:
                    try:
                        file_path.unlink()
                    except Exception as e:
                        app.logger.error(f"Failed to delete old file {file_path}: {e}")


def extract_template_variables(doc_path):
    """Извлечение всех Jinja2 переменных из DOCX шаблона"""
    try:
        doc = Document(doc_path)
        text_content = []

        # Извлечение текста из параграфов
        for paragraph in doc.paragraphs:
            text_content.append(paragraph.text)

        # Извлечение текста из таблиц
        for table in doc.tables:
            for row in table.rows:
                for cell in row.cells:
                    text_content.append(cell.text)

        # Объединение всего текста
        full_text = ' '.join(text_content)

        # Поиск простых переменных {{variable}} (с поддержкой кириллицы)
        simple_vars = re.findall(r'\{\{\s*([a-zA-Zа-яА-ЯёЁ_][a-zA-Zа-яА-ЯёЁ0-9_\.]*?)\s*(?:\|[^}]*)?\}\}', full_text)

        # Поиск переменных в циклах {% for item in items %} (с поддержкой кириллицы)
        loop_vars = re.findall(r'\{%\s*for\s+[a-zA-Zа-яА-ЯёЁ_][a-zA-Zа-яА-ЯёЁ0-9_]*\s+in\s+([a-zA-Zа-яА-ЯёЁ_][a-zA-Zа-яА-ЯёЁ0-9_]*)\s*%\}', full_text)

        # Поиск переменных в условиях {% if variable %} (с поддержкой кириллицы)
        if_vars = re.findall(r'\{%\s*if\s+([a-zA-Zа-яА-ЯёЁ_][a-zA-Zа-яА-ЯёЁ0-9_]*)\s*%\}', full_text)

        # Объединение всех переменных
        all_vars = set(simple_vars + loop_vars + if_vars)

        # Разделение на простые переменные и вложенные объекты
        fields = {}
        arrays = set()

        for var in all_vars:
            # Пропускаем переменные цикла (loop.index и т.д.)
            if var.startswith('loop.'):
                continue

            # Проверяем, является ли это вложенным объектом
            if '.' in var:
                parts = var.split('.')
                root = parts[0]

                # Если корневая переменная в циклах, это массив объектов
                if root in loop_vars:
                    arrays.add(root)
                    if root not in fields:
                        fields[root] = {'type': 'array', 'fields': set()}
                    # Добавляем поле объекта
                    fields[root]['fields'].add(parts[1])
                else:
                    # Простой вложенный объект
                    if root not in fields:
                        fields[root] = {'type': 'object', 'fields': set()}
                    fields[root]['fields'].add('.'.join(parts[1:]))
            else:
                # Определяем тип переменной
                if var in loop_vars:
                    arrays.add(var)
                    if var not in fields:
                        fields[var] = {'type': 'array', 'fields': set()}
                elif var in if_vars:
                    # Условная переменная - вероятно boolean
                    if var not in fields:
                        fields[var] = {'type': 'boolean'}
                else:
                    # Простая переменная
                    if var not in fields:
                        fields[var] = {'type': 'simple'}

        # Преобразуем sets в lists для JSON
        result = {}
        for key, value in fields.items():
            if isinstance(value, dict):
                if 'fields' in value and isinstance(value['fields'], set):
                    value['fields'] = sorted(list(value['fields']))
                result[key] = value
            else:
                result[key] = value

        return result

    except Exception as e:
        app.logger.error(f"Error extracting variables: {e}")
        return {}


@app.route('/')
def index():
    """Главная страница"""
    cleanup_old_files()
    return render_template('index.html')


@app.route('/parse-template', methods=['POST'])
def parse_template():
    """Парсинг шаблона и извлечение переменных"""
    try:
        # Проверка наличия файла
        if 'template' not in request.files:
            return jsonify({'error': 'No template file provided'}), 400

        file = request.files['template']

        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400

        if not allowed_file(file.filename):
            return jsonify({'error': 'Only .docx files are allowed'}), 400

        # Сохранение временного файла
        filename = secure_filename(file.filename)
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        temp_path = os.path.join(app.config['UPLOAD_FOLDER'], f"temp_{timestamp}_{filename}")
        file.save(temp_path)

        # Извлечение переменных
        variables = extract_template_variables(temp_path)

        # Сохраняем путь к файлу для последующего использования
        # (файл будет использован при генерации)
        session_filename = f"session_{timestamp}_{filename}"
        session_path = os.path.join(app.config['UPLOAD_FOLDER'], session_filename)
        os.rename(temp_path, session_path)

        return jsonify({
            'success': True,
            'variables': variables,
            'template_file': session_filename,
            'filename': filename
        })

    except Exception as e:
        app.logger.error(f"Error parsing template: {e}")
        # Очистка временного файла при ошибке
        if 'temp_path' in locals() and os.path.exists(temp_path):
            os.remove(temp_path)
        return jsonify({'error': f'Error parsing template: {str(e)}'}), 500


@app.route('/generate', methods=['POST'])
def generate():
    """Генерация документа из шаблона и данных JSON"""
    try:
        upload_path = None

        # Проверяем, передан ли файл напрямую или используется сохраненный
        template_file = request.form.get('template_file')

        if template_file:
            # Используем ранее загруженный файл из сессии
            upload_path = os.path.join(app.config['UPLOAD_FOLDER'], secure_filename(template_file))
            if not os.path.exists(upload_path):
                return jsonify({'error': 'Template file not found. Please upload again.'}), 400
            # Извлекаем оригинальное имя файла
            filename = template_file.replace('session_', '').split('_', 2)[2] if '_' in template_file else template_file
        else:
            # Проверка наличия файла в запросе
            if 'template' not in request.files:
                return jsonify({'error': 'No template file provided'}), 400

            file = request.files['template']

            if file.filename == '':
                return jsonify({'error': 'No file selected'}), 400

            if not allowed_file(file.filename):
                return jsonify({'error': 'Only .docx files are allowed'}), 400

            # Сохранение загруженного шаблона
            filename = secure_filename(file.filename)
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            upload_path = os.path.join(app.config['UPLOAD_FOLDER'], f"{timestamp}_{filename}")
            file.save(upload_path)

        # Получение JSON данных
        try:
            json_data = request.form.get('data', '{}')
            context = json.loads(json_data)
        except json.JSONDecodeError as e:
            return jsonify({'error': f'Invalid JSON: {str(e)}'}), 400

        # Генерация имени выходного файла
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        output_filename = f"filled_{timestamp}_{filename}"
        output_path = os.path.join(app.config['OUTPUT_FOLDER'], output_filename)

        # Обработка шаблона
        try:
            doc = DocxTemplate(upload_path)
            doc.render(context)
            doc.save(output_path)
        except Exception as e:
            return jsonify({'error': f'Template processing error: {str(e)}'}), 500

        return jsonify({
            'success': True,
            'filename': output_filename,
            'message': 'Document generated successfully'
        })

    except Exception as e:
        app.logger.error(f"Error in generate endpoint: {e}")
        return jsonify({'error': f'Server error: {str(e)}'}), 500


@app.route('/download/<filename>')
def download(filename):
    """Скачивание сгенерированного документа"""
    try:
        # Безопасность: проверка что файл существует и находится в правильной директории
        safe_filename = secure_filename(filename)
        file_path = os.path.join(app.config['OUTPUT_FOLDER'], safe_filename)

        if not os.path.exists(file_path):
            return jsonify({'error': 'File not found'}), 404

        return send_file(
            file_path,
            as_attachment=True,
            download_name=safe_filename,
            mimetype='application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        )

    except Exception as e:
        app.logger.error(f"Error in download endpoint: {e}")
        return jsonify({'error': f'Download error: {str(e)}'}), 500


@app.route('/health')
def health():
    """Проверка состояния приложения"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat()
    })


@app.route('/templates', methods=['GET'])
def get_templates():
    """Получение списка всех шаблонов"""
    try:
        templates = db.get_all_templates()
        return jsonify({'success': True, 'templates': templates})
    except Exception as e:
        app.logger.error(f"Error getting templates: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/templates/save', methods=['POST'])
def save_template():
    """Сохранение шаблона в библиотеку"""
    try:
        template_file = request.form.get('template_file')
        name = request.form.get('name')
        description = request.form.get('description', '')

        if not template_file or not name:
            return jsonify({'error': 'Template file and name are required'}), 400

        # Путь к временному файлу
        upload_path = os.path.join(app.config['UPLOAD_FOLDER'], secure_filename(template_file))

        if not os.path.exists(upload_path):
            return jsonify({'error': 'Template file not found'}), 404

        # Извлечение переменных из шаблона
        variables = extract_template_variables(upload_path)

        # Генерация уникального ключа для S3
        s3_key = f"{uuid.uuid4()}_{secure_filename(template_file)}"

        # Загрузка в S3
        if not s3_client.upload_file(upload_path, s3_key):
            return jsonify({'error': 'Failed to upload to storage'}), 500

        # Сохранение метаданных в БД
        template_id = db.add_template(
            name=name,
            original_filename=template_file,
            s3_key=s3_key,
            description=description,
            variables=variables
        )

        return jsonify({
            'success': True,
            'template_id': template_id,
            'message': 'Template saved successfully'
        })

    except Exception as e:
        app.logger.error(f"Error saving template: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/templates/<int:template_id>', methods=['GET'])
def load_template(template_id):
    """Загрузка шаблона из библиотеки"""
    try:
        template = db.get_template(template_id)

        if not template:
            return jsonify({'error': 'Template not found'}), 404

        # Скачиваем файл из S3 во временную папку
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        temp_filename = f"session_{timestamp}_{template['original_filename']}"
        temp_path = os.path.join(app.config['UPLOAD_FOLDER'], temp_filename)

        if not s3_client.download_file(template['s3_key'], temp_path):
            return jsonify({'error': 'Failed to load template from storage'}), 500

        # Парсим переменные
        variables = extract_template_variables(temp_path)

        return jsonify({
            'success': True,
            'template_file': temp_filename,
            'variables': variables,
            'name': template['name'],
            'description': template['description']
        })

    except Exception as e:
        app.logger.error(f"Error loading template: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/templates/<int:template_id>', methods=['DELETE'])
def delete_template_endpoint(template_id):
    """Удаление шаблона из библиотеки"""
    try:
        s3_key = db.delete_template(template_id)

        if not s3_key:
            return jsonify({'error': 'Template not found'}), 404

        # Удаляем файл из S3
        s3_client.delete_file(s3_key)

        return jsonify({'success': True, 'message': 'Template deleted successfully'})

    except Exception as e:
        app.logger.error(f"Error deleting template: {e}")
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    app.run(debug=True, host='127.0.0.1', port=5001)
