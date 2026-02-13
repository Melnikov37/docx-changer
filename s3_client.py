"""
MinIO S3 клиент для работы с хранилищем шаблонов
"""
import boto3
from botocore.client import Config
from botocore.exceptions import ClientError
import os
import logging

class S3Client:
	def __init__(self):
		self.endpoint = os.getenv('S3_ENDPOINT', 'localhost:9000')
		self.access_key = os.getenv('S3_ACCESS_KEY', 'minioadmin')
		self.secret_key = os.getenv('S3_SECRET_KEY', 'minioadmin')
		self.bucket = os.getenv('S3_BUCKET', 'templates')

		self.client = boto3.client(
			's3',
			endpoint_url=f'http://{self.endpoint}',
			aws_access_key_id=self.access_key,
			aws_secret_access_key=self.secret_key,
			config=Config(signature_version='s3v4')
		)

		self._ensure_bucket_exists()

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
