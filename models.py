"""
Модели для Flask-Login
"""
from flask_login import UserMixin
import db


class User(UserMixin):
	"""Модель пользователя для Flask-Login"""

	def __init__(self, user_id, username, email, is_active=True):
		self.id = user_id
		self.username = username
		self.email = email
		self._is_active = is_active

	@property
	def is_active(self):
		return self._is_active

	@staticmethod
	def get(user_id):
		"""Получение пользователя по ID"""
		user_data = db.get_user_by_id(user_id)
		if user_data:
			return User(
				user_id=user_data['id'],
				username=user_data['username'],
				email=user_data['email'],
				is_active=bool(user_data.get('is_active', True))
			)
		return None

	@staticmethod
	def get_by_username(username):
		"""Получение пользователя по username"""
		user_data = db.get_user_by_username(username)
		if user_data:
			return User(
				user_id=user_data['id'],
				username=user_data['username'],
				email=user_data['email'],
				is_active=bool(user_data.get('is_active', True))
			)
		return None

	@staticmethod
	def get_by_email(email):
		"""Получение пользователя по email"""
		user_data = db.get_user_by_email(email)
		if user_data:
			return User(
				user_id=user_data['id'],
				username=user_data['username'],
				email=user_data['email'],
				is_active=bool(user_data.get('is_active', True))
			)
		return None

	@staticmethod
	def verify_credentials(username, password):
		"""Проверка учетных данных пользователя"""
		user_data = db.get_user_by_username(username)
		if user_data and db.verify_password(user_data, password):
			return User(
				user_id=user_data['id'],
				username=user_data['username'],
				email=user_data['email'],
				is_active=bool(user_data.get('is_active', True))
			)
		return None

	@staticmethod
	def create(username, email, password):
		"""Создание нового пользователя"""
		user_id = db.create_user(username, email, password)
		if user_id:
			return User(user_id=user_id, username=username, email=email)
		return None
