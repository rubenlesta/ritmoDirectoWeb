import yt_dlp
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
cookies_path = '/home/ruben/Musica/cookies.txt'  # Asegúrate de que este archivo existe y es válido

def descargar(entrada, carpeta_salida):
    os.makedirs(carpeta_salida, exist_ok=True)

    ydl_opts = {
        'format': 'bestaudio/best',
        'outtmpl': os.path.join(carpeta_salida, '%(title)s.%(ext)s'),
        'cookiefile': cookies_path,
        'noplaylist': True,  # evita descargar listas completas si es un solo vídeo
        'quiet': False,
        'no_warnings': True,
        'ignoreerrors': True,  # continúa si hay errores
        'http_headers': {
            'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
        },
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '192',
        }],
    }

    # Soporte para búsqueda o archivo de entrada
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
                duracion = info_dict.get('duration', 0)
                minutos = duracion // 60
                segundos = duracion % 60
                print(f"✅ Descargada: {info_dict.get('title')} [{minutos:02}:{segundos:02}]")
            except Exception as e:
                print(f"❌ Error con '{url}': {e}")
cookies_path = '/home/ruben/Musica/ritmoDirecto/cookies.txt'  # RUTA ABSOLUTA DIRECTA

def descargar(entrada, carpeta_salida):
    os.makedirs(carpeta_salida, exist_ok=True)

    ydl_opts = {
        'format': 'bestaudio/best',  # 251: webm audio que suele estar disponible
        'outtmpl': os.path.join(carpeta_salida, '%(title)s.%(ext)s'),
        'cookiefile': cookies_path,
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


    # Soporte para búsqueda o archivo de entrada
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
                duracion = info_dict.get('duration', 0)
                minutos = duracion // 60
                segundos = duracion % 60
                print(f"✅ Descargada: {info_dict.get('title')} [{minutos:02}:{segundos:02}]")
            except Exception as e:
                print(f"❌ Error con '{url}': {e}")

def descargar_txt_como_album(ruta_txt, carpeta_mp3, carpeta_albumes_txt):
    import os
    os.makedirs(carpeta_mp3, exist_ok=True)
    os.makedirs(carpeta_albumes_txt, exist_ok=True)

    with open(ruta_txt, "r", encoding="utf-8") as f:
        lineas = [line.strip() for line in f if line.strip()]

    if not lineas:
        print("❌ El archivo está vacío.")
        return

    nombre_album = lineas[0]
    canciones = lineas[1:]
    print(f"🎶 Álbum: {nombre_album}")

    canciones_guardadas = []

    for entrada in canciones:
        if " - " in entrada:
            titulo, artista = entrada.split(" - ", 1)
            nombre_archivo = f"{artista.strip()} - {titulo.strip()}"
        else:
            titulo = entrada.strip()
            nombre_archivo = titulo

        nombre_archivo = nombre_archivo.strip()
        ruta_destino = os.path.join(carpeta_mp3, f"{nombre_archivo}.mp3")

        if os.path.exists(ruta_destino):
            print(f"📁 Ya existe: {nombre_archivo}")
        else:
            try:
                descargar(entrada, carpeta_mp3)  # Tu función existente
            except Exception as e:
                print(f"❌ Error al descargar '{entrada}': {e}")
                continue

        canciones_guardadas.append(nombre_archivo)

    # Guardar el .txt del álbum
    ruta_album_txt = os.path.join(carpeta_albumes_txt, f"{nombre_album}.txt")
    with open(ruta_album_txt, "w", encoding="utf-8") as f:
        for c in canciones_guardadas:
            f.write(c + "\n")

    print(f"✅ Álbum '{nombre_album}' creado con {len(canciones_guardadas)} canciones.")
