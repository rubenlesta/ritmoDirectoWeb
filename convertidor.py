from config import MP3_FOLDER, COOKIES_PATH, YTDLP_OPTIONS

import yt_dlp
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
cookies_path = COOKIES_PATH  # Asegúrate que este archivo existe y es válido

def descargar(entrada, carpeta_salida, nombre_archivo=None):
    os.makedirs(carpeta_salida, exist_ok=True)

    # Si nombre_archivo se pasa, úsalo para el nombre de archivo final
    if nombre_archivo:
        outtmpl = os.path.join(carpeta_salida, nombre_archivo + '.%(ext)s')
    else:
        outtmpl = os.path.join(carpeta_salida, '%(title)s.%(ext)s')

    ydl_opts = YTDLP_OPTIONS.copy()
    ydl_opts['outtmpl']=outtmpl

    if os.path.isfile(entrada):
        with open(entrada, "r", encoding="utf-8") as f:
            urls = [line.strip() for line in f if line.strip()]
    else:
        if not entrada.startswith("http"):
            entrada = f"ytsearch1:{entrada}"
        urls = [entrada]

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        for url in urls:
            try:
                print(f"🎧 Descargando: {url}")
                info_dict = ydl.extract_info(url, download=True)
                if isinstance(info_dict, dict) and 'entries' in info_dict:
                    info_dict = info_dict['entries'][0]
                duracion = info_dict.get('duration', 0)
                minutos = duracion // 60
                segundos = duracion % 60
                print(f"✅ Descargada: {info_dict.get('title')} [{minutos:02}:{segundos:02}]")
            except Exception as e:
                print(f"❌ Error con '{url}': {e}")

def descargar_txt_como_album(ruta_txt, carpeta_mp3, carpeta_albumes_txt):
    os.makedirs(carpeta_mp3, exist_ok=True)
    os.makedirs(carpeta_albumes_txt, exist_ok=True)

    with open(ruta_txt, "r", encoding="utf-8") as f:
        lineas = [line.strip() for line in f if line.strip()]

    if not lineas:
        print("❌ El archivo está vacío.")
        return

    nombre_album = os.path.splitext(os.path.basename(ruta_txt))[0]
    canciones = lineas[0:]
    print(f"🎶 Álbum: {nombre_album}")

    carpeta_album = carpeta_mp3;

    canciones_guardadas = []

    for entrada in canciones:
        if " - " in entrada:
            titulo, artista = entrada.split(" - ", 1)
            nombre_archivo = f"{artista.strip()} - {titulo.strip()}"
        else:
            titulo = entrada.strip()
            nombre_archivo = titulo

        nombre_archivo = nombre_archivo.strip()
        ruta_destino = os.path.join(carpeta_album, f"{nombre_archivo}.mp3")

        if os.path.exists(ruta_destino):
            print(f"📁 Ya existe: {nombre_archivo}")
        else:
            try:
                descargar(entrada, carpeta_album, nombre_archivo)
            except Exception as e:
                print(f"❌ Error al descargar '{entrada}': {e}")
                continue

        canciones_guardadas.append(nombre_archivo)

    ruta_album_txt = os.path.join(carpeta_albumes_txt, f"{nombre_album}.txt")
    with open(ruta_album_txt, "w", encoding="utf-8") as f:
        for c in canciones_guardadas:
            f.write(c + "\n")

    print(f"✅ Álbum '{nombre_album}' creado con {len(canciones_guardadas)} canciones.")
