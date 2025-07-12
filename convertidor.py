import yt_dlp
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
cookies_path = '/home/ruben/Musica/cookies.txt'  # RUTA ABSOLUTA DIRECTA

def descargar(entrada, carpeta_salida):
    os.makedirs(carpeta_salida, exist_ok=True)  # Crear la carpeta si no existe

    ydl_opts = {
        'format': 'bestaudio/best',
        'outtmpl': os.path.join(carpeta_salida, '%(title)s.%(ext)s'),
        'cookiefile': cookies_path,  # Si usas cookies
        'http_headers': {
            'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
        },
        'force_generic_extractor': True,
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '192',
        }],
    }

    # Si la entrada es un archivo, obtenemos las URLs desde él
    if os.path.isfile(entrada):
        with open(entrada, "r") as f:
            urls = [line.strip() for line in f if line.strip()]
    else:
        # Si es una búsqueda
        if not entrada.startswith("http"):
            entrada = f"ytsearch1:{entrada}"
        urls = [entrada]

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        for url in urls:
            # Obtener la información de la canción (incluyendo la duración)
            info_dict = ydl.extract_info(url, download=True)
            duracion = info_dict.get('duration', 0)  # Duración en segundos
            minutos = duracion // 60
            segundos = duracion % 60
            duracion_formateada = f"{minutos:02}:{segundos:02}"

            # Guardamos el nombre de la canción y la duración
            nombre_cancion = info_dict.get('title', 'Desconocido')
            print(f"Canción: {nombre_cancion}, Duración: {duracion_formateada}")

    return True
