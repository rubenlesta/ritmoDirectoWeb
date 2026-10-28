# RitmoDirectoWeb

Aplicación web para gestionar, descargar y reproducir una colección de música local, con una página independiente de estadísticas.

## Características

- Gestión de álbumes y biblioteca de MP3.
- Reproducción en el navegador con lista de reproducción y cola.
- Descarga de audio desde YouTube mediante yt-dlp y conversión a MP3.
- Estadísticas de canciones, artistas y tiempo de escucha.
- Interfaz adaptable y manifiesto PWA.

## Requisitos previos

- Python 3.8 o superior.
- FFmpeg y `ffprobe` instalados y disponibles en `PATH`. yt-dlp los utiliza para procesar y convertir audio.
- Conexión a Internet para las descargas de YouTube.
- `cookies.txt` es opcional: solo se necesita si yt-dlp requiere cookies para acceder al contenido. No lo subas al repositorio.

## Configuración

La aplicación usa SQLite por defecto y guarda la base de datos en `instance/ritmo_directo.db`. Las dos aplicaciones usan la misma configuración y la misma base de datos.

La configuración se lee desde `.env`. El archivo [`.env.example`](./.env.example) contiene las variables disponibles. `DATABASE_URL` puede dejarse vacío para usar SQLite; también puede configurarse para emplear otra base compatible con SQLAlchemy.

Valores predeterminados:

| Variable | Valor predeterminado | Uso |
|---|---|---|
| `PORT` | `5000` | Aplicación principal |
| `STATS_PORT` | `5001` | Aplicación de estadísticas |
| `DEBUG` | `False` | Modo de depuración de ambas aplicaciones |
| `MP3_FOLDER` | `mp3/` en la raíz del proyecto | Archivos de música |
| `COOKIES_PATH` | `cookies.txt` en la raíz del proyecto | Cookies opcionales para yt-dlp |

## Instalación y arranque

Desde la raíz del repositorio:

```bash
./setUp
```

El setup crea `.env` a partir de `.env.example` si todavía no existe, prepara el entorno virtual `venv/`, instala las dependencias desde `requirements.txt` e inicializa las tablas de la base de datos. No reemplaza un `.env` que ya exista.

Después, arranca ambos servidores:

```bash
./start_server.sh
```

El script activa el entorno virtual, inicia la app de estadísticas en segundo plano y ejecuta la app principal. Al detenerlo con `Ctrl+C`, también detiene el proceso de estadísticas. Sus logs se escriben en `stats.log`.

- Aplicación principal: <http://localhost:5000>
- Estadísticas: <http://localhost:5001>

Para cambiar los puertos o activar depuración, modifica `PORT`, `STATS_PORT` o `DEBUG` en `.env`. No expongas el servidor Flask de desarrollo con `DEBUG=True` en producción.

## Acceso desde un móvil

Conecta el móvil y el servidor a la misma red Wi-Fi y sustituye `<IP_LOCAL>` por la dirección local del equipo:

- Aplicación: `http://<IP_LOCAL>:5000`
- Estadísticas: `http://<IP_LOCAL>:5001`

Si cambiaste los puertos, usa los valores definidos en `.env`. Asegúrate de que el firewall permita el acceso.

## Almacenamiento

- Música: `mp3/` por defecto, configurable mediante `MP3_FOLDER`.
- Base de datos: `instance/ritmo_directo.db` por defecto, configurable mediante `DATABASE_URL`.
- Cookies para yt-dlp: `cookies.txt` por defecto, configurable mediante `COOKIES_PATH`.

## Pruebas

Con el entorno virtual activado:

```bash
python -m unittest discover -s tests -v
```
