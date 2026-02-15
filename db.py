"""
SQLite база данных для хранения метаданных шаблонов
"""
import sqlite3
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
import json

DB_PATH = 'templates.db'


@contextmanager
def get_db_connection():
	"""
	Context manager для безопасной работы с БД.
	Гарантирует закрытие соединения даже при исключениях.
	"""
	conn = sqlite3.connect(DB_PATH)
	conn.row_factory = sqlite3.Row
	try:
		yield conn
	finally:
		conn.close()


def init_db():
	"""Инициализация базы данных"""
	with get_db_connection() as conn:
		cursor = conn.cursor()

		# Таблица шаблонов
		cursor.execute('''
			CREATE TABLE IF NOT EXISTS templates (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				name TEXT NOT NULL,
				original_filename TEXT NOT NULL,
				s3_key TEXT NOT NULL UNIQUE,
				description TEXT,
				variables TEXT,
				created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
				updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
			)
		''')

		# Таблица истории сгенерированных документов
		cursor.execute('''
			CREATE TABLE IF NOT EXISTS generated_documents (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				template_name TEXT NOT NULL,
				output_filename TEXT NOT NULL,
				s3_key TEXT NOT NULL UNIQUE,
				json_data TEXT,
				file_size INTEGER,
				created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
			)
		''')

		conn.commit()

def add_template(name, original_filename, s3_key, description='', variables=None):
	"""Добавление шаблона в БД"""
	variables_json = json.dumps(variables) if variables else None

	with get_db_connection() as conn:
		cursor = conn.cursor()
		cursor.execute('''
			INSERT INTO templates (name, original_filename, s3_key, description, variables)
			VALUES (?, ?, ?, ?, ?)
		''', (name, original_filename, s3_key, description, variables_json))
		template_id = cursor.lastrowid
		conn.commit()

	return template_id


def get_all_templates():
	"""Получение всех шаблонов"""
	with get_db_connection() as conn:
		cursor = conn.cursor()
		cursor.execute('''
			SELECT id, name, original_filename, description, created_at
			FROM templates
			ORDER BY created_at DESC
		''')
		return [dict(row) for row in cursor.fetchall()]


def get_template(template_id):
	"""Получение шаблона по ID"""
	with get_db_connection() as conn:
		cursor = conn.cursor()
		cursor.execute('SELECT * FROM templates WHERE id = ?', (template_id,))
		template = cursor.fetchone()
		return dict(template) if template else None


def delete_template(template_id):
	"""Удаление шаблона из БД"""
	with get_db_connection() as conn:
		cursor = conn.cursor()

		# Получаем s3_key перед удалением
		cursor.execute('SELECT s3_key FROM templates WHERE id = ?', (template_id,))
		result = cursor.fetchone()

		if result:
			s3_key = result[0]
			cursor.execute('DELETE FROM templates WHERE id = ?', (template_id,))
			conn.commit()
			return s3_key

	return None


# ===== Функции для работы с историей сгенерированных документов =====

def add_generated_document(template_name, output_filename, s3_key, json_data, file_size=0):
	"""Добавление сгенерированного документа в историю"""
	json_data_str = json.dumps(json_data) if json_data else None

	with get_db_connection() as conn:
		cursor = conn.cursor()
		cursor.execute('''
			INSERT INTO generated_documents (template_name, output_filename, s3_key, json_data, file_size)
			VALUES (?, ?, ?, ?, ?)
		''', (template_name, output_filename, s3_key, json_data_str, file_size))
		doc_id = cursor.lastrowid
		conn.commit()

	return doc_id


def get_all_generated_documents(limit=100):
	"""Получение всех сгенерированных документов"""
	with get_db_connection() as conn:
		cursor = conn.cursor()
		cursor.execute('''
			SELECT id, template_name, output_filename, file_size, created_at
			FROM generated_documents
			ORDER BY created_at DESC
			LIMIT ?
		''', (limit,))
		return [dict(row) for row in cursor.fetchall()]


def get_generated_document(doc_id):
	"""Получение сгенерированного документа по ID"""
	with get_db_connection() as conn:
		cursor = conn.cursor()
		cursor.execute('SELECT * FROM generated_documents WHERE id = ?', (doc_id,))
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


def delete_generated_document(doc_id):
	"""Удаление сгенерированного документа из истории"""
	with get_db_connection() as conn:
		cursor = conn.cursor()

		# Получаем s3_key перед удалением
		cursor.execute('SELECT s3_key FROM generated_documents WHERE id = ?', (doc_id,))
		result = cursor.fetchone()

		if result:
			s3_key = result[0]
			cursor.execute('DELETE FROM generated_documents WHERE id = ?', (doc_id,))
			conn.commit()
			return s3_key

	return None
