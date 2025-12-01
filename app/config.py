import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev_secret_key'
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or 'sqlite:///site.db'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    MP3_FOLDER = os.environ.get('MP3_FOLDER') or os.path.join(BASE_DIR, 'mp3')
    ALBUMES_TXT_FOLDER = os.environ.get('ALBUMES_TXT_FOLDER') or os.path.join(BASE_DIR, 'albumes_txt')
    COOKIES_PATH = os.environ.get('COOKIES_PATH') or os.path.join(BASE_DIR, 'cookies.txt')

    # Ensure directories exist
    os.makedirs(MP3_FOLDER, exist_ok=True)
    os.makedirs(ALBUMES_TXT_FOLDER, exist_ok=True)
