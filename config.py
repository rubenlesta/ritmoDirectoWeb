import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Carpeta donde se guardan los mp3
MP3_FOLDER = os.path.join(BASE_DIR, "mp3")

# Ruta del archivo de cookies para yt-dlp
COOKIES_PATH = os.path.expanduser('/home/ruben/Musica/ritmoDirectoWeb/cookies.txt')

# Carpeta donde se guardan los archivos txt de álbumes
ALBUMES_TXT_FOLDER = os.path.join(BASE_DIR, "albumes_txt")

# Base de datos MySQL
SQLALCHEMY_DATABASE_URI = "mysql+pymysql://ruben:db1234@localhost/musica"

# Configuraciones para yt-dlp
YTDLP_OPTIONS = {
    'format': 'bestaudio/best',
    'cookiefile': COOKIES_PATH,
    'noplaylist': True,
    'quiet': False,
    'no_warnings': True,
    'ignoreerrors': True,
    'postprocessors': [{
        'key': 'FFmpegExtractAudio',
        'preferredcodec': 'mp3',
        'preferredquality': '192',
    }],
}

# user: ruben
# password: db1234