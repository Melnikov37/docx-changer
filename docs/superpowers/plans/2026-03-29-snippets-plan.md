# DOCX Snippets (Справочники фрагментов) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add universal snippet directories (categories + DOCX fragments) that users can insert into templates via `{{SNIPPET:name}}` markers.

**Architecture:** Two new DB tables (`snippet_categories`, `snippets`), DOCX fragments stored in MinIO, new `/snippets` page for management, modified template parser and generator to handle SNIPPET markers. Fragments inserted into documents using `python-docx` paragraph/table copying.

**Tech Stack:** Python 3.9, Flask, PostgreSQL, MinIO (boto3), python-docx, docxtpl, Bootstrap 5, vanilla JS.

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `db.py` | Modify | Add snippet_categories and snippets CRUD + init/migrate |
| `app.py` | Modify | Add snippet routes, modify parse/generate logic |
| `requirements.txt` | Modify | Add `docxcompose` |
| `templates/snippets.html` | Create | Snippets management page |
| `templates/index.html` | Modify | Add "Справочники" navbar link, SNIPPET syntax docs |
| `static/js/snippets.js` | Create | Client-side logic for snippets page |
| `static/js/app.js` | Modify | Add SNIPPET dropdown support in dynamic form |
| `static/css/style.css` | Modify | Add styles for snippets page |

---

### Task 1: Database — snippet tables and CRUD

**Files:**
- Modify: `db.py`

- [ ] **Step 1: Add table creation to `init_db()`**

Add after the `generated_documents` table creation (after line 82 in `db.py`):

```python
		# Таблица категорий справочников
		cursor.execute('''
			CREATE TABLE IF NOT EXISTS snippet_categories (
				id SERIAL PRIMARY KEY,
				name TEXT NOT NULL,
				description TEXT,
				user_id INTEGER NOT NULL REFERENCES users(id),
				created_at TIMESTAMP DEFAULT NOW(),
				updated_at TIMESTAMP DEFAULT NOW()
			)
		''')

		# Таблица фрагментов справочников
		cursor.execute('''
			CREATE TABLE IF NOT EXISTS snippets (
				id SERIAL PRIMARY KEY,
				category_id INTEGER NOT NULL REFERENCES snippet_categories(id) ON DELETE CASCADE,
				name TEXT NOT NULL,
				description TEXT,
				s3_key TEXT NOT NULL UNIQUE,
				original_filename TEXT NOT NULL,
				file_size INTEGER,
				user_id INTEGER NOT NULL REFERENCES users(id),
				created_at TIMESTAMP DEFAULT NOW(),
				updated_at TIMESTAMP DEFAULT NOW()
			)
		''')
```

- [ ] **Step 2: Add snippet_categories CRUD functions**

Add at the end of `db.py`:

```python
# ===== Функции для работы с категориями справочников =====

def create_snippet_category(name, user_id, description=''):
	"""Создание категории справочника"""
	with get_db_connection() as conn:
		cursor = conn.cursor()
		cursor.execute('''
			INSERT INTO snippet_categories (name, description, user_id)
			VALUES (%s, %s, %s)
			RETURNING id
		''', (name, description, user_id))
		cat_id = cursor.fetchone()[0]
		conn.commit()
		return cat_id


def get_snippet_categories(user_id):
	"""Получение всех категорий справочников пользователя"""
	with get_db_connection() as conn:
		cursor = conn.cursor(cursor_factory=RealDictCursor)
		cursor.execute('''
			SELECT sc.id, sc.name, sc.description, sc.created_at,
				COUNT(s.id) as snippet_count
			FROM snippet_categories sc
			LEFT JOIN snippets s ON s.category_id = sc.id
			WHERE sc.user_id = %s
			GROUP BY sc.id
			ORDER BY sc.name
		''', (user_id,))
		return [dict(row) for row in cursor.fetchall()]


def update_snippet_category(cat_id, user_id, name=None, description=None):
	"""Обновление категории справочника"""
	with get_db_connection() as conn:
		cursor = conn.cursor()
		updates = []
		params = []
		if name is not None:
			updates.append('name = %s')
			params.append(name)
		if description is not None:
			updates.append('description = %s')
			params.append(description)
		if not updates:
			return False
		updates.append('updated_at = NOW()')
		params.extend([cat_id, user_id])
		cursor.execute(
			f'UPDATE snippet_categories SET {", ".join(updates)} WHERE id = %s AND user_id = %s',
			params
		)
		conn.commit()
		return cursor.rowcount > 0


def delete_snippet_category(cat_id, user_id):
	"""Удаление категории и всех её фрагментов. Возвращает список s3_key для удаления из S3."""
	with get_db_connection() as conn:
		cursor = conn.cursor()
		# Получаем s3_key всех фрагментов в категории
		cursor.execute(
			'SELECT s3_key FROM snippets WHERE category_id = %s AND user_id = %s',
			(cat_id, user_id)
		)
		s3_keys = [row[0] for row in cursor.fetchall()]
		# Удаляем категорию (каскадно удалит фрагменты)
		cursor.execute(
			'DELETE FROM snippet_categories WHERE id = %s AND user_id = %s',
			(cat_id, user_id)
		)
		conn.commit()
		if cursor.rowcount > 0:
			return s3_keys
		return None
```

- [ ] **Step 3: Add snippets CRUD functions**

Add at the end of `db.py`:

```python
# ===== Функции для работы с фрагментами справочников =====

def create_snippet(category_id, name, s3_key, original_filename, user_id, description='', file_size=0):
	"""Создание фрагмента в справочнике"""
	with get_db_connection() as conn:
		cursor = conn.cursor()
		cursor.execute('''
			INSERT INTO snippets (category_id, name, description, s3_key, original_filename, file_size, user_id)
			VALUES (%s, %s, %s, %s, %s, %s, %s)
			RETURNING id
		''', (category_id, name, description, s3_key, original_filename, file_size, user_id))
		snippet_id = cursor.fetchone()[0]
		conn.commit()
		return snippet_id


def get_snippets_by_category(category_id, user_id):
	"""Получение всех фрагментов в категории"""
	with get_db_connection() as conn:
		cursor = conn.cursor(cursor_factory=RealDictCursor)
		cursor.execute('''
			SELECT id, name, description, original_filename, file_size, created_at
			FROM snippets
			WHERE category_id = %s AND user_id = %s
			ORDER BY name
		''', (category_id, user_id))
		return [dict(row) for row in cursor.fetchall()]


def get_all_snippets_grouped(user_id):
	"""Получение всех фрагментов пользователя, сгруппированных по категориям"""
	with get_db_connection() as conn:
		cursor = conn.cursor(cursor_factory=RealDictCursor)
		cursor.execute('''
			SELECT s.id, s.name, s.description, s.category_id,
				sc.name as category_name
			FROM snippets s
			JOIN snippet_categories sc ON sc.id = s.category_id
			WHERE s.user_id = %s
			ORDER BY sc.name, s.name
		''', (user_id,))
		rows = [dict(row) for row in cursor.fetchall()]

	# Группируем по категориям
	grouped = {}
	for row in rows:
		cat_name = row['category_name']
		if cat_name not in grouped:
			grouped[cat_name] = []
		grouped[cat_name].append({
			'id': row['id'],
			'name': row['name'],
			'description': row['description']
		})
	return grouped


def get_snippet(snippet_id, user_id):
	"""Получение фрагмента по ID с проверкой владельца"""
	with get_db_connection() as conn:
		cursor = conn.cursor(cursor_factory=RealDictCursor)
		cursor.execute(
			'SELECT * FROM snippets WHERE id = %s AND user_id = %s',
			(snippet_id, user_id)
		)
		row = cursor.fetchone()
		return dict(row) if row else None


def update_snippet(snippet_id, user_id, name=None, description=None, s3_key=None, original_filename=None, file_size=None):
	"""Обновление фрагмента (метаданные или замена файла)"""
	with get_db_connection() as conn:
		cursor = conn.cursor()
		# Получаем старый s3_key если заменяется файл
		old_s3_key = None
		if s3_key is not None:
			cursor.execute(
				'SELECT s3_key FROM snippets WHERE id = %s AND user_id = %s',
				(snippet_id, user_id)
			)
			result = cursor.fetchone()
			if result:
				old_s3_key = result[0]

		updates = []
		params = []
		if name is not None:
			updates.append('name = %s')
			params.append(name)
		if description is not None:
			updates.append('description = %s')
			params.append(description)
		if s3_key is not None:
			updates.append('s3_key = %s')
			params.append(s3_key)
		if original_filename is not None:
			updates.append('original_filename = %s')
			params.append(original_filename)
		if file_size is not None:
			updates.append('file_size = %s')
			params.append(file_size)
		if not updates:
			return None
		updates.append('updated_at = NOW()')
		params.extend([snippet_id, user_id])
		cursor.execute(
			f'UPDATE snippets SET {", ".join(updates)} WHERE id = %s AND user_id = %s',
			params
		)
		conn.commit()
		if cursor.rowcount > 0:
			return old_s3_key
		return None


def delete_snippet(snippet_id, user_id):
	"""Удаление фрагмента. Возвращает s3_key для удаления из S3."""
	with get_db_connection() as conn:
		cursor = conn.cursor()
		cursor.execute(
			'SELECT s3_key FROM snippets WHERE id = %s AND user_id = %s',
			(snippet_id, user_id)
		)
		result = cursor.fetchone()
		if result:
			s3_key = result[0]
			cursor.execute(
				'DELETE FROM snippets WHERE id = %s AND user_id = %s',
				(snippet_id, user_id)
			)
			conn.commit()
			return s3_key
		return None
```

- [ ] **Step 4: Commit**

```bash
git add db.py
git commit -m "feat: add snippet_categories and snippets DB tables and CRUD"
```

---

### Task 2: Backend — snippet API routes

**Files:**
- Modify: `app.py`

- [ ] **Step 1: Add snippet category routes**

Add after the `/history/<int:doc_id>` DELETE route (after line 753 in `app.py`):

```python
# ===== Endpoints справочников (snippets) =====

@app.route('/snippets')
@login_required
def snippets_page():
	"""Страница управления справочниками"""
	return render_template('snippets.html')


@app.route('/snippets/categories', methods=['GET'])
@login_required
def get_snippet_categories():
	"""Получение списка категорий справочников"""
	try:
		categories = db.get_snippet_categories(user_id=current_user.id)
		return jsonify({'success': True, 'categories': categories})
	except Exception as e:
		app.logger.error(f"Error getting snippet categories: {e}")
		return jsonify({'error': str(e)}), 500


@app.route('/snippets/categories', methods=['POST'])
@login_required
def create_snippet_category():
	"""Создание категории справочника"""
	try:
		data = request.get_json()
		name = data.get('name', '').strip()
		description = data.get('description', '').strip()

		if not name:
			return jsonify({'error': 'Category name is required'}), 400

		cat_id = db.create_snippet_category(
			name=name,
			user_id=current_user.id,
			description=description
		)
		return jsonify({'success': True, 'category_id': cat_id})
	except Exception as e:
		app.logger.error(f"Error creating snippet category: {e}")
		return jsonify({'error': str(e)}), 500


@app.route('/snippets/categories/<int:cat_id>', methods=['PUT'])
@login_required
def update_snippet_category_endpoint(cat_id):
	"""Обновление категории справочника"""
	try:
		data = request.get_json()
		success = db.update_snippet_category(
			cat_id=cat_id,
			user_id=current_user.id,
			name=data.get('name'),
			description=data.get('description')
		)
		if success:
			return jsonify({'success': True})
		return jsonify({'error': 'Category not found'}), 404
	except Exception as e:
		app.logger.error(f"Error updating snippet category: {e}")
		return jsonify({'error': str(e)}), 500


@app.route('/snippets/categories/<int:cat_id>', methods=['DELETE'])
@login_required
def delete_snippet_category_endpoint(cat_id):
	"""Удаление категории справочника (каскадно удаляет фрагменты)"""
	try:
		s3_keys = db.delete_snippet_category(cat_id, user_id=current_user.id)
		if s3_keys is None:
			return jsonify({'error': 'Category not found'}), 404
		# Удаляем файлы из S3
		for key in s3_keys:
			s3_client.delete_file(key)
		return jsonify({'success': True})
	except Exception as e:
		app.logger.error(f"Error deleting snippet category: {e}")
		return jsonify({'error': str(e)}), 500
```

- [ ] **Step 2: Add snippet item routes**

Add right after the category routes:

```python
@app.route('/snippets/categories/<int:cat_id>/items', methods=['GET'])
@login_required
def get_snippets_in_category(cat_id):
	"""Получение фрагментов в категории"""
	try:
		items = db.get_snippets_by_category(cat_id, user_id=current_user.id)
		return jsonify({'success': True, 'items': items})
	except Exception as e:
		app.logger.error(f"Error getting snippets: {e}")
		return jsonify({'error': str(e)}), 500


@app.route('/snippets/items', methods=['GET'])
@login_required
def get_all_snippets():
	"""Получение всех фрагментов пользователя (для dropdown при генерации)"""
	try:
		grouped = db.get_all_snippets_grouped(user_id=current_user.id)
		return jsonify({'success': True, 'snippets': grouped})
	except Exception as e:
		app.logger.error(f"Error getting all snippets: {e}")
		return jsonify({'error': str(e)}), 500


@app.route('/snippets/items', methods=['POST'])
@login_required
def create_snippet():
	"""Создание фрагмента (загрузка DOCX файла)"""
	try:
		name = request.form.get('name', '').strip()
		category_id = request.form.get('category_id', type=int)
		description = request.form.get('description', '').strip()

		if not name or not category_id:
			return jsonify({'error': 'Name and category are required'}), 400

		if 'file' not in request.files:
			return jsonify({'error': 'No file provided'}), 400

		file = request.files['file']
		if file.filename == '' or not allowed_file(file.filename):
			return jsonify({'error': 'Only .docx files are allowed'}), 400

		# Валидация DOCX
		try:
			validate_docx_file(file.stream)
		except ValueError as e:
			return jsonify({'error': f'Invalid file: {str(e)}'}), 400

		# Сохранение во временную папку
		filename = secure_filename(file.filename)
		timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
		temp_path = os.path.join(app.config['UPLOAD_FOLDER'], f"snippet_{timestamp}_{filename}")
		file.save(temp_path)

		try:
			file_size = os.path.getsize(temp_path)
			s3_key = f"snippets/{uuid.uuid4()}_{filename}"

			if not s3_client.upload_file(temp_path, s3_key):
				return jsonify({'error': 'Failed to upload to storage'}), 500

			snippet_id = db.create_snippet(
				category_id=category_id,
				name=name,
				s3_key=s3_key,
				original_filename=filename,
				user_id=current_user.id,
				description=description,
				file_size=file_size
			)
			return jsonify({'success': True, 'snippet_id': snippet_id})
		finally:
			if os.path.exists(temp_path):
				os.remove(temp_path)

	except Exception as e:
		app.logger.error(f"Error creating snippet: {e}")
		return jsonify({'error': str(e)}), 500


@app.route('/snippets/items/from-form', methods=['POST'])
@login_required
def create_snippet_from_form():
	"""Создание фрагмента из формы (генерирует DOCX таблицу)"""
	try:
		data = request.get_json()
		name = data.get('name', '').strip()
		category_id = data.get('category_id')
		description = data.get('description', '').strip()
		fields = data.get('fields', [])  # [{"key": "...", "value": "..."}, ...]

		if not name or not category_id or not fields:
			return jsonify({'error': 'Name, category, and fields are required'}), 400

		# Генерация DOCX с таблицей
		doc = Document()
		table = doc.add_table(rows=len(fields), cols=2)
		table.style = 'Table Grid'
		for i, field in enumerate(fields):
			table.cell(i, 0).text = field.get('key', '')
			table.cell(i, 1).text = field.get('value', '')

		# Сохранение во временную папку
		timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
		filename = f"form_{timestamp}.docx"
		temp_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
		doc.save(temp_path)

		try:
			file_size = os.path.getsize(temp_path)
			s3_key = f"snippets/{uuid.uuid4()}_{filename}"

			if not s3_client.upload_file(temp_path, s3_key):
				return jsonify({'error': 'Failed to upload to storage'}), 500

			snippet_id = db.create_snippet(
				category_id=category_id,
				name=name,
				s3_key=s3_key,
				original_filename=filename,
				user_id=current_user.id,
				description=description,
				file_size=file_size
			)
			return jsonify({'success': True, 'snippet_id': snippet_id})
		finally:
			if os.path.exists(temp_path):
				os.remove(temp_path)

	except Exception as e:
		app.logger.error(f"Error creating snippet from form: {e}")
		return jsonify({'error': str(e)}), 500


@app.route('/snippets/items/<int:snippet_id>/preview', methods=['GET'])
@login_required
def preview_snippet(snippet_id):
	"""HTML-превью содержимого фрагмента"""
	try:
		snippet = db.get_snippet(snippet_id, user_id=current_user.id)
		if not snippet:
			return jsonify({'error': 'Snippet not found'}), 404

		# Скачиваем из S3
		temp_path = os.path.join(app.config['UPLOAD_FOLDER'], f"preview_{uuid.uuid4()}.docx")
		if not s3_client.download_file(snippet['s3_key'], temp_path):
			return jsonify({'error': 'Failed to download from storage'}), 500

		try:
			doc = Document(temp_path)
			html_parts = []

			for element in doc.element.body:
				tag = element.tag.split('}')[-1] if '}' in element.tag else element.tag

				if tag == 'p':
					# Параграф
					from docx.oxml.ns import qn
					texts = []
					for run in element.findall(qn('w:r')):
						t = run.find(qn('w:t'))
						if t is not None and t.text:
							# Проверяем форматирование
							rpr = run.find(qn('w:rPr'))
							text = t.text
							if rpr is not None:
								if rpr.find(qn('w:b')) is not None:
									text = f'<strong>{text}</strong>'
								if rpr.find(qn('w:i')) is not None:
									text = f'<em>{text}</em>'
							texts.append(text)
					if texts:
						html_parts.append(f'<p>{"".join(texts)}</p>')

				elif tag == 'tbl':
					# Таблица
					from docx.oxml.ns import qn
					html_parts.append('<table class="table table-bordered table-sm">')
					for tr in element.findall(qn('w:tr')):
						html_parts.append('<tr>')
						for tc in tr.findall(qn('w:tc')):
							cell_texts = []
							for p in tc.findall(qn('w:p')):
								for run in p.findall(qn('w:r')):
									t = run.find(qn('w:t'))
									if t is not None and t.text:
										cell_texts.append(t.text)
							html_parts.append(f'<td>{" ".join(cell_texts)}</td>')
						html_parts.append('</tr>')
					html_parts.append('</table>')

			return jsonify({
				'success': True,
				'html': '\n'.join(html_parts),
				'name': snippet['name']
			})
		finally:
			if os.path.exists(temp_path):
				os.remove(temp_path)

	except Exception as e:
		app.logger.error(f"Error previewing snippet: {e}")
		return jsonify({'error': str(e)}), 500


@app.route('/snippets/items/<int:snippet_id>/download', methods=['GET'])
@login_required
def download_snippet(snippet_id):
	"""Скачивание оригинального DOCX фрагмента"""
	try:
		snippet = db.get_snippet(snippet_id, user_id=current_user.id)
		if not snippet:
			return jsonify({'error': 'Snippet not found'}), 404

		temp_path = os.path.join(app.config['OUTPUT_FOLDER'], snippet['original_filename'])
		if not s3_client.download_file(snippet['s3_key'], temp_path):
			return jsonify({'error': 'Failed to download from storage'}), 500

		return send_file(
			temp_path,
			as_attachment=True,
			download_name=snippet['original_filename'],
			mimetype='application/vnd.openxmlformats-officedocument.wordprocessingml.document'
		)
	except Exception as e:
		app.logger.error(f"Error downloading snippet: {e}")
		return jsonify({'error': str(e)}), 500


@app.route('/snippets/items/<int:snippet_id>', methods=['PUT'])
@login_required
def update_snippet_endpoint(snippet_id):
	"""Обновление фрагмента (метаданные или замена файла)"""
	try:
		name = request.form.get('name')
		description = request.form.get('description')

		new_s3_key = None
		new_filename = None
		new_file_size = None

		# Если есть новый файл
		if 'file' in request.files:
			file = request.files['file']
			if file.filename and allowed_file(file.filename):
				try:
					validate_docx_file(file.stream)
				except ValueError as e:
					return jsonify({'error': f'Invalid file: {str(e)}'}), 400

				new_filename = secure_filename(file.filename)
				timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
				temp_path = os.path.join(app.config['UPLOAD_FOLDER'], f"snippet_{timestamp}_{new_filename}")
				file.save(temp_path)

				try:
					new_file_size = os.path.getsize(temp_path)
					new_s3_key = f"snippets/{uuid.uuid4()}_{new_filename}"
					if not s3_client.upload_file(temp_path, new_s3_key):
						return jsonify({'error': 'Failed to upload to storage'}), 500
				finally:
					if os.path.exists(temp_path):
						os.remove(temp_path)

		old_s3_key = db.update_snippet(
			snippet_id=snippet_id,
			user_id=current_user.id,
			name=name,
			description=description,
			s3_key=new_s3_key,
			original_filename=new_filename,
			file_size=new_file_size
		)

		# Удаляем старый файл из S3 если был заменён
		if old_s3_key and new_s3_key:
			s3_client.delete_file(old_s3_key)

		return jsonify({'success': True})
	except Exception as e:
		app.logger.error(f"Error updating snippet: {e}")
		return jsonify({'error': str(e)}), 500


@app.route('/snippets/items/<int:snippet_id>', methods=['DELETE'])
@login_required
def delete_snippet_endpoint(snippet_id):
	"""Удаление фрагмента"""
	try:
		s3_key = db.delete_snippet(snippet_id, user_id=current_user.id)
		if not s3_key:
			return jsonify({'error': 'Snippet not found'}), 404
		s3_client.delete_file(s3_key)
		return jsonify({'success': True})
	except Exception as e:
		app.logger.error(f"Error deleting snippet: {e}")
		return jsonify({'error': str(e)}), 500
```

- [ ] **Step 3: Commit**

```bash
git add app.py
git commit -m "feat: add snippet API routes (categories + items CRUD, preview, from-form)"
```

---

### Task 3: Backend — modify template parser for SNIPPET markers

**Files:**
- Modify: `app.py` (function `extract_template_variables` and `/parse-template` route)

- [ ] **Step 1: Add SNIPPET pattern to `extract_template_variables`**

In `app.py`, in function `extract_template_variables` (line 163), add after the `if_pattern` matches (after line 192):

```python
		# Поиск SNIPPET-меток {{SNIPPET:name}}
		snippet_pattern = r'\{\{\s*SNIPPET\s*:\s*([a-zA-Zа-яА-ЯёЁ0-9_]+)\s*\}\}'
		snippet_matches = [(m.group(1), m.start()) for m in re.finditer(snippet_pattern, full_text)]
```

Then modify the section where `all_vars` is built (line 206) to exclude snippet vars from regular variables. After `all_vars = set(...)`, add:

```python
		# Имена SNIPPET-меток (исключаем из обычных переменных)
		snippet_names = set(m[0] for m in snippet_matches)
		all_vars = all_vars - snippet_names
```

Before the `return result` (line 259), add snippet markers to the result:

```python
		# Добавляем SNIPPET-метки
		snippets_list = []
		for name, pos in snippet_matches:
			if name not in [s['name'] for s in snippets_list]:
				snippets_list.append({'name': name, 'position': pos})
		result['__snippets__'] = snippets_list
```

- [ ] **Step 2: Update `/parse-template` response to include snippets**

In the `/parse-template` route (line 274), modify the success response to separate snippets from variables. Change the return block (line 313-318):

```python
		# Разделяем SNIPPET-метки от обычных переменных
		snippets_info = variables.pop('__snippets__', [])

		return jsonify({
			'success': True,
			'variables': variables,
			'snippets': snippets_info,
			'template_file': session_filename,
			'filename': filename
		})
```

- [ ] **Step 3: Commit**

```bash
git add app.py
git commit -m "feat: parse SNIPPET markers from templates separately from variables"
```

---

### Task 4: Backend — modify document generator for snippet insertion

**Files:**
- Modify: `app.py` (function `generate`)
- Modify: `requirements.txt`

- [ ] **Step 1: Add `docxcompose` to requirements**

Add to `requirements.txt`:

```
docxcompose>=1.4.0
```

- [ ] **Step 2: Add snippet insertion helper function**

In `app.py`, add after `extract_template_variables` function (after line 263):

```python
def insert_snippet_into_doc(doc_path, snippet_marker, snippet_doc_path):
	"""
	Вставляет содержимое DOCX-фрагмента на место метки в документе.
	Метка: {{SNIPPET:name}} — заменяется всеми параграфами и таблицами из фрагмента.
	"""
	from docx.oxml.ns import qn
	from copy import deepcopy

	doc = Document(doc_path)
	snippet_doc = Document(snippet_doc_path)
	marker_text = '{{SNIPPET:' + snippet_marker + '}}'
	found = False

	for i, paragraph in enumerate(doc.paragraphs):
		if marker_text in paragraph.text:
			found = True
			# Получаем родительский элемент и позицию
			parent = paragraph._element.getparent()
			idx = list(parent).index(paragraph._element)

			# Вставляем элементы из фрагмента
			insert_idx = idx
			for element in snippet_doc.element.body:
				tag = element.tag.split('}')[-1] if '}' in element.tag else element.tag
				if tag in ('p', 'tbl'):
					new_element = deepcopy(element)
					parent.insert(insert_idx + 1, new_element)
					insert_idx += 1

			# Удаляем параграф с меткой
			parent.remove(paragraph._element)
			break

	if not found:
		# Проверяем таблицы (метка может быть внутри ячейки)
		for table in doc.tables:
			for row in table.rows:
				for cell in row.cells:
					for paragraph in cell.paragraphs:
						if marker_text in paragraph.text:
							found = True
							parent = paragraph._element.getparent()
							idx = list(parent).index(paragraph._element)

							insert_idx = idx
							for element in snippet_doc.element.body:
								tag = element.tag.split('}')[-1] if '}' in element.tag else element.tag
								if tag in ('p', 'tbl'):
									new_element = deepcopy(element)
									parent.insert(insert_idx + 1, new_element)
									insert_idx += 1

							parent.remove(paragraph._element)
							break
					if found:
						break
				if found:
					break
			if found:
				break

	doc.save(doc_path)
	return found
```

- [ ] **Step 3: Modify `generate` endpoint to handle SNIPPET markers**

In the `generate` function (line 328), after the template is rendered with `docxtpl` and saved (after line 393 `doc.save(output_path)`), add:

```python
		# Обработка SNIPPET-меток
		try:
			snippet_data = json.loads(request.form.get('snippets', '{}'))
			for marker_name, snippet_id in snippet_data.items():
				if not snippet_id:
					# "Не вставлять" — удаляем метку
					temp_doc = Document(output_path)
					marker_text = '{{SNIPPET:' + marker_name + '}}'
					for paragraph in temp_doc.paragraphs:
						if marker_text in paragraph.text:
							paragraph._element.getparent().remove(paragraph._element)
							break
					temp_doc.save(output_path)
					continue

				# Получаем фрагмент из БД
				snippet = db.get_snippet(int(snippet_id), user_id=current_user.id)
				if not snippet:
					continue

				# Скачиваем фрагмент из S3
				snippet_temp_path = os.path.join(
					app.config['UPLOAD_FOLDER'],
					f"snippet_{uuid.uuid4()}.docx"
				)
				if s3_client.download_file(snippet['s3_key'], snippet_temp_path):
					try:
						insert_snippet_into_doc(output_path, marker_name, snippet_temp_path)
					finally:
						if os.path.exists(snippet_temp_path):
							os.remove(snippet_temp_path)
		except Exception as e:
			app.logger.error(f"Error processing snippets: {e}")
```

- [ ] **Step 4: Commit**

```bash
git add app.py requirements.txt
git commit -m "feat: insert DOCX snippets into generated documents at SNIPPET markers"
```

---

### Task 5: Frontend — snippets management page

**Files:**
- Create: `templates/snippets.html`
- Create: `static/js/snippets.js`

- [ ] **Step 1: Create `templates/snippets.html`**

```html
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Справочники — DOCX Template Filler</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="{{ url_for('static', filename='css/style.css') }}">
    <link rel="icon" type="image/svg+xml" href="{{ url_for('static', filename='favicon.svg') }}">
</head>
<body>
    <div class="container py-4">
        <header class="mb-4">
            <div class="d-flex justify-content-between align-items-center">
                <div>
                    <h1 class="h2 mb-1">Справочники фрагментов</h1>
                    <p class="text-muted mb-0">Управление DOCX-фрагментами для вставки в шаблоны</p>
                </div>
                <div class="d-flex gap-2">
                    <a href="{{ url_for('index') }}" class="btn btn-outline-primary">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-house me-1" viewBox="0 0 16 16">
                            <path d="M8.707 1.5a1 1 0 0 0-1.414 0L.646 8.146a.5.5 0 0 0 .708.708L2 8.207V13.5A1.5 1.5 0 0 0 3.5 15h9a1.5 1.5 0 0 0 1.5-1.5V8.207l.646.647a.5.5 0 0 0 .708-.708L13 5.793V2.5a.5.5 0 0 0-.5-.5h-1a.5.5 0 0 0-.5.5v1.293L8.707 1.5ZM13 7.207V13.5a.5.5 0 0 1-.5.5h-9a.5.5 0 0 1-.5-.5V7.207l5-5 5 5Z"/>
                        </svg>
                        На главную
                    </a>
                    <div class="dropdown">
                        <button class="btn btn-outline-secondary dropdown-toggle" type="button" data-bs-toggle="dropdown">
                            {{ current_user.username }}
                        </button>
                        <ul class="dropdown-menu dropdown-menu-end">
                            <li><span class="dropdown-item-text text-muted">{{ current_user.email }}</span></li>
                            <li><hr class="dropdown-divider"></li>
                            <li><a class="dropdown-item text-danger" href="{{ url_for('logout') }}">Выйти</a></li>
                        </ul>
                    </div>
                </div>
            </div>
        </header>

        <div class="row">
            <!-- Категории -->
            <div class="col-md-4">
                <div class="card shadow-sm">
                    <div class="card-header bg-warning text-dark d-flex justify-content-between align-items-center">
                        <h5 class="mb-0">Категории</h5>
                        <button class="btn btn-sm btn-dark" onclick="showCreateCategoryModal()">+ Создать</button>
                    </div>
                    <div class="card-body p-0">
                        <div id="categoriesList">
                            <div class="text-center p-4">
                                <div class="spinner-border text-primary" role="status"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Фрагменты в выбранной категории -->
            <div class="col-md-8">
                <div class="card shadow-sm">
                    <div class="card-header bg-primary text-white d-flex justify-content-between align-items-center">
                        <h5 class="mb-0" id="snippetsTitle">Выберите категорию</h5>
                        <button class="btn btn-sm btn-light" id="addSnippetBtn" style="display:none;" onclick="showCreateSnippetModal()">+ Добавить фрагмент</button>
                    </div>
                    <div class="card-body">
                        <div id="snippetsList">
                            <div class="alert alert-info">Выберите категорию слева для просмотра фрагментов</div>
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
                <div class="modal-header bg-warning text-dark">
                    <h5 class="modal-title">Новая категория</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <div class="mb-3">
                        <label class="form-label">Название <span class="text-danger">*</span></label>
                        <input type="text" class="form-control" id="catName" placeholder="Например: Туроператоры">
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Описание</label>
                        <textarea class="form-control" id="catDescription" rows="2"></textarea>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" data-bs-dismiss="modal">Отмена</button>
                    <button class="btn btn-warning" onclick="createCategory()">Создать</button>
                </div>
            </div>
        </div>
    </div>

    <!-- Модальное окно создания фрагмента -->
    <div class="modal fade" id="createSnippetModal" tabindex="-1">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header bg-primary text-white">
                    <h5 class="modal-title">Новый фрагмент</h5>
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <div class="mb-3">
                        <label class="form-label">Название <span class="text-danger">*</span></label>
                        <input type="text" class="form-control" id="snippetName" placeholder="Например: ООО Туроператор Солнце">
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Описание</label>
                        <textarea class="form-control" id="snippetDescription" rows="2"></textarea>
                    </div>

                    <!-- Табы: загрузка файла / форма -->
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
                                <p class="mb-2">Перетащите .docx файл сюда или</p>
                                <button type="button" class="btn btn-outline-primary btn-sm" onclick="document.getElementById('snippetFileInput').click()">Выберите файл</button>
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
                <div class="modal-header bg-info text-white">
                    <h5 class="modal-title" id="previewTitle">Просмотр фрагмента</h5>
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <div id="previewContent">
                        <div class="text-center"><div class="spinner-border text-primary"></div></div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline-primary" id="previewDownloadBtn">Скачать оригинал</button>
                    <button class="btn btn-warning" id="previewReplaceBtn">Заменить файл</button>
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
                <div class="modal-header bg-danger text-white">
                    <h5 class="modal-title">Подтверждение удаления</h5>
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
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

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script src="{{ url_for('static', filename='js/snippets.js') }}"></script>
</body>
</html>
```

- [ ] **Step 2: Create `static/js/snippets.js`**

```javascript
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
```

- [ ] **Step 3: Commit**

```bash
git add templates/snippets.html static/js/snippets.js
git commit -m "feat: add snippets management page with categories, CRUD, preview, and form creation"
```

---

### Task 6: Frontend — add SNIPPET dropdown to main form

**Files:**
- Modify: `static/js/app.js`
- Modify: `templates/index.html`

- [ ] **Step 1: Modify `parseTemplate` to handle snippets**

In `app.js`, in the `parseTemplate` function (line 222), after `templateVariables = result.variables;` (line 235), add:

```javascript
            // Сохраняем SNIPPET-метки
            window.templateSnippets = result.snippets || [];
```

After `buildDynamicForm(templateVariables);` (line 239), add:

```javascript
            // Если есть SNIPPET-метки, добавляем dropdown'ы
            if (window.templateSnippets && window.templateSnippets.length > 0) {
                buildSnippetSelectors(window.templateSnippets);
            }
```

- [ ] **Step 2: Add `buildSnippetSelectors` function**

Add at the end of `app.js`:

```javascript
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
            fieldGroup.className = 'mb-4 p-3 border border-warning rounded bg-light';
            fieldGroup.id = `snippet_field_${snippet.name}`;

            let optionsHtml = '<option value="">— Не вставлять —</option>';
            for (const [catName, items] of Object.entries(grouped)) {
                optionsHtml += `<optgroup label="${catName}">`;
                for (const item of items) {
                    optionsHtml += `<option value="${item.id}">${item.name}</option>`;
                }
                optionsHtml += '</optgroup>';
            }

            const displayName = formatFieldName(snippet.name);
            fieldGroup.innerHTML = `
                <label class="form-label fw-bold">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-puzzle me-1" viewBox="0 0 16 16">
                        <path d="M5.5 0a.5.5 0 0 1 .5.5V2h4V.5a.5.5 0 0 1 1 0V2h1a2 2 0 0 1 2 2v1h1.5a.5.5 0 0 1 0 1H14v4h1.5a.5.5 0 0 1 0 1H14v1a2 2 0 0 1-2 2h-1v1.5a.5.5 0 0 1-1 0V14H6v1.5a.5.5 0 0 1-1 0V14H4a2 2 0 0 1-2-2v-1H.5a.5.5 0 0 1 0-1H2V6H.5a.5.5 0 0 1 0-1H2V4a2 2 0 0 1 2-2h1V.5a.5.5 0 0 1 .5-.5z"/>
                    </svg>
                    Фрагмент: ${displayName}
                </label>
                <select class="form-select snippet-selector" name="snippet_${snippet.name}" data-snippet-name="${snippet.name}">
                    ${optionsHtml}
                </select>
                <small class="text-muted">Выберите фрагмент из справочника для вставки в метку {{SNIPPET:${snippet.name}}}</small>
            `;

            dynamicForm.appendChild(fieldGroup);
        }
    } catch (error) {
        console.error('Error loading snippets for selectors:', error);
    }
}
```

- [ ] **Step 3: Modify `generateDocument` to include snippet selections**

In `app.js`, in the `generateDocument` function (line 466), after `formData.append('data', jsonData);` (line 513), add:

```javascript
    // Добавляем выбранные SNIPPET-фрагменты
    const snippetSelections = {};
    document.querySelectorAll('.snippet-selector').forEach(select => {
        const snippetName = select.getAttribute('data-snippet-name');
        snippetSelections[snippetName] = select.value;
    });
    formData.append('snippets', JSON.stringify(snippetSelections));
```

- [ ] **Step 4: Add "Справочники" link to navbar in `templates/index.html`**

In `templates/index.html`, in the header btn-group (line 23-44), add a new button before the "Библиотека шаблонов" button (before line 24):

```html
                        <a href="{{ url_for('snippets_page') }}" class="btn btn-lg btn-warning">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" class="bi bi-puzzle me-2" viewBox="0 0 16 16">
                                <path d="M5.5 0a.5.5 0 0 1 .5.5V2h4V.5a.5.5 0 0 1 1 0V2h1a2 2 0 0 1 2 2v1h1.5a.5.5 0 0 1 0 1H14v4h1.5a.5.5 0 0 1 0 1H14v1a2 2 0 0 1-2 2h-1v1.5a.5.5 0 0 1-1 0V14H6v1.5a.5.5 0 0 1-1 0V14H4a2 2 0 0 1-2-2v-1H.5a.5.5 0 0 1 0-1H2V6H.5a.5.5 0 0 1 0-1H2V4a2 2 0 0 1 2-2h1V.5a.5.5 0 0 1 .5-.5z"/>
                            </svg>
                            Справочники
                        </a>
```

Also add SNIPPET syntax to the right-column docs card (after the "Фильтры" section around line 192):

```html
                        <h6 class="mt-3">Вставка фрагментов:</h6>
                        {% raw %}<pre class="bg-light p-2 rounded"><code>{{SNIPPET:туроператор}}
{{SNIPPET:страховая}}</code></pre>{% endraw %}
                        <small class="text-muted">Выберите фрагмент из справочника при генерации</small>
```

- [ ] **Step 5: Commit**

```bash
git add static/js/app.js templates/index.html
git commit -m "feat: add SNIPPET dropdown to generation form and Справочники link to navbar"
```

---

### Task 7: Deploy and test

**Files:** None (deployment and testing)

- [ ] **Step 1: Verify all changes work locally**

```bash
cd /Users/m.melnikov/projects/docx-changer
source venv/bin/activate
pip install docxcompose
python -c "import db; db.init_db(); db.migrate_db(); print('DB OK')"
```

- [ ] **Step 2: Create final commit with all uncommitted changes (if any)**

```bash
git status
git add -A
git commit -m "feat: complete snippets feature — directories, CRUD, DOCX fragment insertion"
```

- [ ] **Step 3: Push to main and trigger deploy**

```bash
git push origin main
```

- [ ] **Step 4: SSH to server and verify deployment**

```bash
ssh root@85.239.39.232
# Check containers
su - docxapp -c "cd docx-template-filler && docker compose ps"
# Check logs
su - docxapp -c "cd docx-template-filler && docker compose logs --tail=30 web"
# Check health
curl -s http://127.0.0.1:80/health
```

- [ ] **Step 5: Test on production**

Manual test checklist:
1. Login → Navigate to "Справочники"
2. Create category "Туроператоры"
3. Create snippet via file upload (upload a .docx with a table)
4. Create snippet via form (fill key-value fields)
5. Preview snippet (check HTML rendering)
6. Download original snippet
7. Replace snippet file
8. Go to main page, upload template with `{{SNIPPET:туроператор}}` marker
9. Verify dropdown appears with snippet options
10. Generate document, verify fragment is inserted
11. Generate with "Не вставлять", verify marker is removed
12. Delete snippet, delete category (check cascade)
