"""
MinIO S3 клиент для работы с хранилищем шаблонов
"""
import boto3
from botocore.client import Config
from botocore.exceptions import ClientError
import os
import logging


class S3ConfigurationError(Exception):
	"""Ошибка конфигурации S3"""
	pass


class S3Client:
	# Список небезопасных дефолтных credentials
	INSECURE_CREDENTIALS = {'minioadmin', 'admin', 'root', 'password', '123456'}

	def __init__(self):
		self.endpoint = self._get_required_env('S3_ENDPOINT')
		self.access_key = self._get_required_env('S3_ACCESS_KEY')
		self.secret_key = self._get_required_env('S3_SECRET_KEY')
		self.bucket = os.getenv('S3_BUCKET', 'templates')

		# Проверка на небезопасные credentials в production
		if os.getenv('FLASK_ENV') == 'production':
			if self.access_key.lower() in self.INSECURE_CREDENTIALS:
				raise S3ConfigurationError(
					"Insecure S3 access key detected in production. "
					"Please use strong credentials."
				)
			if self.secret_key.lower() in self.INSECURE_CREDENTIALS:
				raise S3ConfigurationError(
					"Insecure S3 secret key detected in production. "
					"Please use strong credentials."
				)

		self.client = boto3.client(
			's3',
			endpoint_url=f'http://{self.endpoint}',
			aws_access_key_id=self.access_key,
			aws_secret_access_key=self.secret_key,
			config=Config(
				signature_version='s3v4',
				connect_timeout=5,
				read_timeout=30,
				retries={'max_attempts': 3, 'mode': 'standard'}
			)
		)

		self._ensure_bucket_exists()

	@staticmethod
	def _get_required_env(key):
		"""Получение обязательной переменной окружения"""
		value = os.getenv(key)
		if not value:
			raise S3ConfigurationError(
				f"Missing required environment variable: {key}. "
				f"Please set it in your .env file."
			)
		return value

	def _ensure_bucket_exists(self):
		"""Создание bucket если не существует"""
		try:
			self.client.head_bucket(Bucket=self.bucket)
		except ClientError:
			self.client.create_bucket(Bucket=self.bucket)

	def upload_file(self, file_path, object_name):
		"""Загрузка файла в S3"""
		try:
			self.client.upload_file(file_path, self.bucket, object_name)
			return True
		except ClientError as e:
			logging.error(f"Error uploading file: {e}")
			return False

	def download_file(self, object_name, file_path):
		"""Скачивание файла из S3"""
		try:
			self.client.download_file(self.bucket, object_name, file_path)
			return True
		except ClientError as e:
			logging.error(f"Error downloading file: {e}")
			return False

	def delete_file(self, object_name):
		"""Удаление файла из S3"""
		try:
			self.client.delete_object(Bucket=self.bucket, Key=object_name)
			return True
		except ClientError as e:
			logging.error(f"Error deleting file: {e}")
			return False

	def list_files(self):
		"""Список всех файлов в bucket"""
		try:
			response = self.client.list_objects_v2(Bucket=self.bucket)
			return response.get('Contents', [])
		except ClientError as e:
			logging.error(f"Error listing files: {e}")
			return []
