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
- Node.js 20 o superior disponible en `PATH` para el runtime JavaScript de yt-dlp.
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
| `DOWNLOAD_SOCKET_TIMEOUT` | `30` | Tiempo máximo de espera de red para yt-dlp, en segundos |

## Instalación local y arranque de desarrollo

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

## Despliegue en Linux con systemd y Gunicorn

Estos pasos instalan dependencias para Ubuntu/Debian:

```bash
sudo apt update
sudo apt install -y git python3 python3-venv python3-pip ffmpeg nodejs
ffmpeg -version
ffprobe -version  # El ejecutable ffprobe lo instala el paquete ffmpeg.
node --version  # Debe ser v20 o superior para yt-dlp.
```

En Fedora/RHEL instala los paquetes equivalentes:

```bash
sudo dnf install -y git python3 python3-pip ffmpeg ffmpeg-libs nodejs
ffmpeg -version
ffprobe -version  # El ejecutable ffprobe lo instala el paquete FFmpeg.
node --version  # Debe ser v20 o superior para yt-dlp.
```

En Fedora/RHEL, habilita un repositorio que proporcione FFmpeg si el paquete no está disponible en los repositorios configurados. Si el Node.js del sistema es anterior a 20, instala una versión soportada antes de continuar.

Prepara la cuenta de servicio y clona el proyecto. Sustituye la URL por el fork/remote que vaya a mantener el administrador:

```bash
sudo useradd --system --home-dir /opt/ritmodirecto --shell /usr/sbin/nologin ritmodirecto
sudo mkdir -p /opt/ritmodirecto
sudo chown ritmodirecto:ritmodirecto /opt/ritmodirecto
sudo -u ritmodirecto git clone https://github.com/rubenlesta/ritmoDirectoWeb.git /opt/ritmodirecto
cd /opt/ritmodirecto
```

Crea el entorno virtual e instala la aplicación:

```bash
sudo -u ritmodirecto python3 -m venv /opt/ritmodirecto/venv
sudo -u ritmodirecto /opt/ritmodirecto/venv/bin/pip install --upgrade pip
sudo -u ritmodirecto /opt/ritmodirecto/venv/bin/pip install -r /opt/ritmodirecto/requirements.txt
sudo -u ritmodirecto cp /opt/ritmodirecto/.env.example /opt/ritmodirecto/.env
```

Edita `/opt/ritmodirecto/.env` antes de iniciar servicios: establece `SECRET_KEY` con un valor aleatorio (puedes generarlo con `python3 -c 'import secrets; print(secrets.token_hex(32))'`), deja `DEBUG=False` y define `DATABASE_URL`, `MP3_FOLDER`, `COOKIES_PATH` y puertos según el entorno. En SQLite, el directorio `instance/` y la base de datos deben ser escribibles por `ritmodirecto`. Para MySQL/MariaDB, crea o autoriza la base y concede a ese usuario los permisos requeridos por el inicializador.

Inicializa las tablas y migra un esquema anterior sin borrar datos:

```bash
sudo -u ritmodirecto /opt/ritmodirecto/venv/bin/python /opt/ritmodirecto/scripts/init_db.py
```

Instala y arranca las dos unidades systemd incluidas:

```bash
sudo cp /opt/ritmodirecto/deployment/systemd/ritmodirecto.service /etc/systemd/system/
sudo cp /opt/ritmodirecto/deployment/systemd/ritmodirecto-stats.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now ritmodirecto.service ritmodirecto-stats.service
sudo systemctl status ritmodirecto.service ritmodirecto-stats.service
```

Consulta logs con `sudo journalctl -u ritmodirecto -u ritmodirecto-stats -f`. Ambos procesos se reinician tras una caída y escuchan solo en `127.0.0.1`; coloca Caddy o Nginx delante para HTTPS, proxy y acceso público. La descarga síncrona puede ocupar un worker hasta 30 minutos; migra las descargas a una cola de trabajos antes de desplegar con mucho tráfico. Si la instalación no está en `/opt/ritmodirecto` o usa otra cuenta, adapta `User`, `Group`, `WorkingDirectory`, `EnvironmentFile` y `ExecStart` de las unidades antes de instalarlas.

## Acceso desde un móvil

Conecta el móvil y el servidor a la misma red Wi-Fi y sustituye `<IP_LOCAL>` por la dirección local del equipo:

- Aplicación: `http://<IP_LOCAL>:5000`
- Estadísticas: `http://<IP_LOCAL>:5001`

Si cambiaste los puertos, usa los valores definidos en `.env`. Asegúrate de que el firewall permita el acceso.

## HTTPS para PWA y acceso remoto

Los Service Workers requieren un origen seguro: usa HTTPS al acceder desde otro equipo o dominio (localhost es una excepción). No expongas directamente el servidor Flask de desarrollo a Internet. Para pruebas rápidas puedes crear un túnel HTTPS temporal con [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/):

```bash
cloudflared tunnel --url http://127.0.0.1:5000
```

Para un dominio permanente, configura un túnel con nombre o coloca un proxy inverso delante de la aplicación. [Caddy](https://caddyserver.com/docs/quick-starts/reverse-proxy) obtiene y renueva certificados automáticamente con HTTPS:

```caddyfile
musica.example.com {
    reverse_proxy 127.0.0.1:5000
}
```

Como alternativa, configura Nginx como proxy inverso y gestiona el certificado con Let's Encrypt/Certbot. Mantén Flask escuchando en `127.0.0.1` detrás del proxy en un despliegue público y usa un servidor WSGI de producción.

## Almacenamiento

- Música: `mp3/` por defecto, configurable mediante `MP3_FOLDER`.
- Base de datos: `instance/ritmo_directo.db` por defecto, configurable mediante `DATABASE_URL`.
- Cookies para yt-dlp: `cookies.txt` por defecto, configurable mediante `COOKIES_PATH`.

## Pruebas

Con el entorno virtual activado:

```bash
python -m unittest discover -s tests -v
```
