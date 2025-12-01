import os
import yt_dlp
from mutagen.mp3 import MP3
from app.config import Config
from app.models import db, Cancion, Album, AlbumCancion

class MusicService:
    @staticmethod
    def get_duration(path):
        try:
            audio = MP3(path)
            duracion_seg = int(audio.info.length)
            minutos = duracion_seg // 60
            segundos = duracion_seg % 60
            return f"{minutos:02}:{segundos:02}"
        except Exception:
            return "??:??"

    @staticmethod
    def download_song(entry, output_folder, filename=None):
        os.makedirs(output_folder, exist_ok=True)
        
        if filename:
            outtmpl = os.path.join(output_folder, filename + '.%(ext)s')
        else:
            outtmpl = os.path.join(output_folder, '%(title)s.%(ext)s')

        ydl_opts = {
            'format': 'bestaudio/best',
            'cookiefile': Config.COOKIES_PATH,
            'noplaylist': True,
            'quiet': False,
            'no_warnings': True,
            'ignoreerrors': True,
            'outtmpl': outtmpl,
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '192',
            }],
        }

        if os.path.isfile(entry):
             with open(entry, "r", encoding="utf-8") as f:
                urls = [line.strip() for line in f if line.strip()]
        else:
            if not entry.startswith("http"):
                entry = f"ytsearch1:{entry}"
            urls = [entry]

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            for url in urls:
                try:
                    ydl.extract_info(url, download=True)
                except Exception as e:
                    print(f"Error downloading {url}: {e}")
                    raise e

    @staticmethod
    def process_album_txt(txt_path, album_name):
        # Logic to process album txt, download songs, and update DB
        # This is a simplified version of the logic in convertidor.py
        # For now, we will just implement the basic structure
        pass

    @staticmethod
    def get_all_songs():
        songs = []
        for filename in os.listdir(Config.MP3_FOLDER):
            if filename.endswith(".mp3"):
                path = os.path.join(Config.MP3_FOLDER, filename)
                name = filename[:-4]
                duration = MusicService.get_duration(path)
                
                if " - " in name:
                    artist, title = name.split(" - ", 1)
                else:
                    artist, title = "Desconocido", name
                
                songs.append({
                    "artista": artist,
                    "cancion": title,
                    "duracion": duration
                })
        return songs
