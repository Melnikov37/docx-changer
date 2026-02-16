"""
PostgreSQL база данных для хранения метаданных шаблонов и пользователей
"""
import os
import psycopg2
from psycopg2.extras import RealDictCursor
from contextlib import contextmanager
from datetime import datetime
import json
from werkzeug.security import generate_password_hash, check_password_hash

# Параметры подключения к PostgreSQL из переменных окружения
POSTGRES_HOST = os.environ.get('POSTGRES_HOST', 'localhost')
POSTGRES_PORT = os.environ.get('POSTGRES_PORT', '5432')
POSTGRES_USER = os.environ.get('POSTGRES_USER', 'docx')
POSTGRES_PASSWORD = os.environ.get('POSTGRES_PASSWORD', '')
POSTGRES_DB = os.environ.get('POSTGRES_DB', 'docx_changer')


def get_connection_string():
	"""Формирование строки подключения к PostgreSQL"""
	return f"host={POSTGRES_HOST} port={POSTGRES_PORT} dbname={POSTGRES_DB} user={POSTGRES_USER} password={POSTGRES_PASSWORD}"


@contextmanager
def get_db_connection():
	"""
	Context manager для безопасной работы с БД.
	Гарантирует закрытие соединения даже при исключениях.
	"""
	conn = psycopg2.connect(get_connection_string())
	try:
		yield conn
	finally:
		conn.close()


def init_db():
	"""Инициализация базы данных"""
	with get_db_connection() as conn:
		cursor = conn.cursor()

		# Таблица пользователей
		cursor.execute('''
			CREATE TABLE IF NOT EXISTS users (
				id SERIAL PRIMARY KEY,
				username TEXT NOT NULL UNIQUE,
				email TEXT NOT NULL UNIQUE,
				password_hash TEXT NOT NULL,
				created_at TIMESTAMP DEFAULT NOW(),
				is_active BOOLEAN DEFAULT TRUE
			)
		''')

		# Таблица шаблонов
		cursor.execute('''
			CREATE TABLE IF NOT EXISTS templates (
				id SERIAL PRIMARY KEY,
				name TEXT NOT NULL,
				original_filename TEXT NOT NULL,
				s3_key TEXT NOT NULL UNIQUE,
				description TEXT,
				variables TEXT,
				user_id INTEGER REFERENCES users(id),
				created_at TIMESTAMP DEFAULT NOW(),
				updated_at TIMESTAMP DEFAULT NOW()
			)
		''')

		# Таблица истории сгенерированных документов
		cursor.execute('''
			CREATE TABLE IF NOT EXISTS generated_documents (
				id SERIAL PRIMARY KEY,
				template_name TEXT NOT NULL,
				output_filename TEXT NOT NULL,
				s3_key TEXT NOT NULL UNIQUE,
				json_data TEXT,
				file_size INTEGER,
				user_id INTEGER REFERENCES users(id),
				created_at TIMESTAMP DEFAULT NOW()
			)
		''')

		conn.commit()


def migrate_db():
	"""Миграция существующей БД для добавления user_id"""
	with get_db_connection() as conn:
		cursor = conn.cursor()

		# Проверяем, есть ли колонка user_id в templates
		cursor.execute("""
			SELECT column_name FROM information_schema.columns
			WHERE table_name = 'templates' AND column_name = 'user_id'
		""")
		if not cursor.fetchone():
			cursor.execute('ALTER TABLE templates ADD COLUMN user_id INTEGER REFERENCES users(id)')

		# Проверяем, есть ли колонка user_id в generated_documents
		cursor.execute("""
			SELECT column_name FROM information_schema.columns
			WHERE table_name = 'generated_documents' AND column_name = 'user_id'
		""")
		if not cursor.fetchone():
			cursor.execute('ALTER TABLE generated_documents ADD COLUMN user_id INTEGER REFERENCES users(id)')

		# Проверяем, существует ли таблица users
		cursor.execute("""
			SELECT table_name FROM information_schema.tables
			WHERE table_name = 'users'
		""")
		if not cursor.fetchone():
			cursor.execute('''
				CREATE TABLE users (
					id SERIAL PRIMARY KEY,
					username TEXT NOT NULL UNIQUE,
					email TEXT NOT NULL UNIQUE,
					password_hash TEXT NOT NULL,
					created_at TIMESTAMP DEFAULT NOW(),
					is_active BOOLEAN DEFAULT TRUE
				)
			''')

		conn.commit()

# ===== Функции для работы с пользователями =====

def create_user(username, email, password):
	"""Создание нового пользователя"""
	password_hash = generate_password_hash(password)

	with get_db_connection() as conn:
		cursor = conn.cursor()
		try:
			cursor.execute('''
				INSERT INTO users (username, email, password_hash)
				VALUES (%s, %s, %s)
				RETURNING id
			''', (username, email, password_hash))
			user_id = cursor.fetchone()[0]
			conn.commit()
			return user_id
		except psycopg2.IntegrityError:
			conn.rollback()
			return None


def get_user_by_id(user_id):
	"""Получение пользователя по ID"""
	with get_db_connection() as conn:
		cursor = conn.cursor(cursor_factory=RealDictCursor)
		cursor.execute('SELECT * FROM users WHERE id = %s', (user_id,))
		user = cursor.fetchone()
		return dict(user) if user else None


def get_user_by_username(username):
	"""Получение пользователя по username"""
	with get_db_connection() as conn:
		cursor = conn.cursor(cursor_factory=RealDictCursor)
		cursor.execute('SELECT * FROM users WHERE username = %s', (username,))
		user = cursor.fetchone()
		return dict(user) if user else None


def get_user_by_email(email):
	"""Получение пользователя по email"""
	with get_db_connection() as conn:
		cursor = conn.cursor(cursor_factory=RealDictCursor)
		cursor.execute('SELECT * FROM users WHERE email = %s', (email,))
		user = cursor.fetchone()
		return dict(user) if user else None


def verify_password(user_dict, password):
	"""Проверка пароля пользователя"""
	if not user_dict or not user_dict.get('password_hash'):
		return False
	return check_password_hash(user_dict['password_hash'], password)


# ===== Функции для работы с шаблонами =====

def add_template(name, original_filename, s3_key, description='', variables=None, user_id=None):
	"""Добавление шаблона в БД"""
	variables_json = json.dumps(variables) if variables else None

	with get_db_connection() as conn:
		cursor = conn.cursor()
		cursor.execute('''
			INSERT INTO templates (name, original_filename, s3_key, description, variables, user_id)
			VALUES (%s, %s, %s, %s, %s, %s)
			RETURNING id
		''', (name, original_filename, s3_key, description, variables_json, user_id))
		template_id = cursor.fetchone()[0]
		conn.commit()

	return template_id


def get_all_templates(user_id=None):
	"""Получение всех шаблонов пользователя"""
	with get_db_connection() as conn:
		cursor = conn.cursor(cursor_factory=RealDictCursor)
		if user_id is not None:
			cursor.execute('''
				SELECT id, name, original_filename, description, created_at
				FROM templates
				WHERE user_id = %s
				ORDER BY created_at DESC
			''', (user_id,))
		else:
			cursor.execute('''
				SELECT id, name, original_filename, description, created_at
				FROM templates
				ORDER BY created_at DESC
			''')
		return [dict(row) for row in cursor.fetchall()]


def get_template(template_id, user_id=None):
	"""Получение шаблона по ID с проверкой владельца"""
	with get_db_connection() as conn:
		cursor = conn.cursor(cursor_factory=RealDictCursor)
		if user_id is not None:
			cursor.execute('SELECT * FROM templates WHERE id = %s AND user_id = %s', (template_id, user_id))
		else:
			cursor.execute('SELECT * FROM templates WHERE id = %s', (template_id,))
		template = cursor.fetchone()
		return dict(template) if template else None


def delete_template(template_id, user_id=None):
	"""Удаление шаблона из БД с проверкой владельца"""
	with get_db_connection() as conn:
		cursor = conn.cursor()

		# Получаем s3_key перед удалением
		if user_id is not None:
			cursor.execute('SELECT s3_key FROM templates WHERE id = %s AND user_id = %s', (template_id, user_id))
		else:
			cursor.execute('SELECT s3_key FROM templates WHERE id = %s', (template_id,))
		result = cursor.fetchone()

		if result:
			s3_key = result[0]
			if user_id is not None:
				cursor.execute('DELETE FROM templates WHERE id = %s AND user_id = %s', (template_id, user_id))
			else:
				cursor.execute('DELETE FROM templates WHERE id = %s', (template_id,))
			conn.commit()
			return s3_key

	return None


# ===== Функции для работы с историей сгенерированных документов =====

def add_generated_document(template_name, output_filename, s3_key, json_data, file_size=0, user_id=None):
	"""Добавление сгенерированного документа в историю"""
	json_data_str = json.dumps(json_data) if json_data else None

	with get_db_connection() as conn:
		cursor = conn.cursor()
		cursor.execute('''
			INSERT INTO generated_documents (template_name, output_filename, s3_key, json_data, file_size, user_id)
			VALUES (%s, %s, %s, %s, %s, %s)
			RETURNING id
		''', (template_name, output_filename, s3_key, json_data_str, file_size, user_id))
		doc_id = cursor.fetchone()[0]
		conn.commit()

	return doc_id


def get_all_generated_documents(limit=100, user_id=None):
	"""Получение всех сгенерированных документов пользователя"""
	with get_db_connection() as conn:
		cursor = conn.cursor(cursor_factory=RealDictCursor)
		if user_id is not None:
			cursor.execute('''
				SELECT id, template_name, output_filename, file_size, created_at
				FROM generated_documents
				WHERE user_id = %s
				ORDER BY created_at DESC
				LIMIT %s
			''', (user_id, limit))
		else:
			cursor.execute('''
				SELECT id, template_name, output_filename, file_size, created_at
				FROM generated_documents
				ORDER BY created_at DESC
				LIMIT %s
			''', (limit,))
		return [dict(row) for row in cursor.fetchall()]


def get_generated_document(doc_id, user_id=None):
	"""Получение сгенерированного документа по ID с проверкой владельца"""
	with get_db_connection() as conn:
		cursor = conn.cursor(cursor_factory=RealDictCursor)
		if user_id is not None:
			cursor.execute('SELECT * FROM generated_documents WHERE id = %s AND user_id = %s', (doc_id, user_id))
		else:
			cursor.execute('SELECT * FROM generated_documents WHERE id = %s', (doc_id,))
		document = cursor.fetchone()

		if document:
			doc_dict = dict(document)
			# Парсим JSON данные
			if doc_dict.get('json_data'):
				try:
					doc_dict['json_data'] = json.loads(doc_dict['json_data'])
				except json.JSONDecodeError:
					doc_dict['json_data'] = None
			return doc_dict

	return None


def delete_generated_document(doc_id, user_id=None):
	"""Удаление сгенерированного документа из истории с проверкой владельца"""
	with get_db_connection() as conn:
		cursor = conn.cursor()

		# Получаем s3_key перед удалением
		if user_id is not None:
			cursor.execute('SELECT s3_key FROM generated_documents WHERE id = %s AND user_id = %s', (doc_id, user_id))
		else:
			cursor.execute('SELECT s3_key FROM generated_documents WHERE id = %s', (doc_id,))
		result = cursor.fetchone()

		if result:
			s3_key = result[0]
			if user_id is not None:
				cursor.execute('DELETE FROM generated_documents WHERE id = %s AND user_id = %s', (doc_id, user_id))
			else:
				cursor.execute('DELETE FROM generated_documents WHERE id = %s', (doc_id,))
			conn.commit()
			return s3_key

	return None
