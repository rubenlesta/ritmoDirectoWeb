import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    INSTANCE_DIR = os.path.join(BASE_DIR, 'instance')

    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev_secret_key'
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or (
        f"sqlite:///{os.path.join(INSTANCE_DIR, 'ritmo_directo.db')}"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    MP3_FOLDER = os.environ.get('MP3_FOLDER') or os.path.join(BASE_DIR, 'mp3')
    COOKIES_PATH = os.environ.get('COOKIES_PATH') or os.path.join(BASE_DIR, 'cookies.txt')
    PORT = int(os.environ.get('PORT', 5000))
    STATS_PORT = int(os.environ.get('STATS_PORT', 5001))
    DEBUG = os.environ.get('DEBUG', 'false').strip().lower() in {'1', 'true', 'yes', 'on'}

    os.makedirs(INSTANCE_DIR, exist_ok=True)
    os.makedirs(MP3_FOLDER, exist_ok=True)
