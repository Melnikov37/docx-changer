"""
SQLite база данных для хранения метаданных шаблонов
"""
import sqlite3
from datetime import datetime
from pathlib import Path
import json

DB_PATH = 'templates.db'

def init_db():
	"""Инициализация базы данных"""
	conn = sqlite3.connect(DB_PATH)
	cursor = conn.cursor()

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

	conn.commit()
	conn.close()

def add_template(name, original_filename, s3_key, description='', variables=None):
	"""Добавление шаблона в БД"""
	conn = sqlite3.connect(DB_PATH)
	cursor = conn.cursor()

	variables_json = json.dumps(variables) if variables else None

	cursor.execute('''
		INSERT INTO templates (name, original_filename, s3_key, description, variables)
		VALUES (?, ?, ?, ?, ?)
	''', (name, original_filename, s3_key, description, variables_json))

	template_id = cursor.lastrowid
	conn.commit()
	conn.close()

	return template_id

def get_all_templates():
	"""Получение всех шаблонов"""
	conn = sqlite3.connect(DB_PATH)
	conn.row_factory = sqlite3.Row
	cursor = conn.cursor()

	cursor.execute('''
		SELECT id, name, original_filename, description, created_at
		FROM templates
		ORDER BY created_at DESC
	''')

	templates = [dict(row) for row in cursor.fetchall()]
	conn.close()

	return templates

def get_template(template_id):
	"""Получение шаблона по ID"""
	conn = sqlite3.connect(DB_PATH)
	conn.row_factory = sqlite3.Row
	cursor = conn.cursor()

	cursor.execute('SELECT * FROM templates WHERE id = ?', (template_id,))
	template = cursor.fetchone()
	conn.close()

	return dict(template) if template else None

def delete_template(template_id):
	"""Удаление шаблона из БД"""
	conn = sqlite3.connect(DB_PATH)
	cursor = conn.cursor()

	# Получаем s3_key перед удалением
	cursor.execute('SELECT s3_key FROM templates WHERE id = ?', (template_id,))
	result = cursor.fetchone()

	if result:
		s3_key = result[0]
		cursor.execute('DELETE FROM templates WHERE id = ?', (template_id,))
		conn.commit()
		conn.close()
		return s3_key

	conn.close()
	return None
