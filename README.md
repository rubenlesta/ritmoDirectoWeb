# RitmoDirectoWeb

Aplicación web para gestionar y reproducir tu colección de música local.

## Características

- **Gestión de Álbumes**: Organiza tus canciones en álbumes.
- **Reproducción**: Reproductor integrado con soporte para listas de reproducción.
- **Descarga**: Descarga canciones desde YouTube (requiere `cookies.txt`).
- **Estadísticas**: Visualiza tus hábitos de escucha (Top canciones, artistas, tiempo total).
- **Acceso Móvil**: Diseño responsivo y soporte PWA (instalable en móviles).

## Requisitos

- Python 3.8+
- FFmpeg (para la conversión de audio)
- Dependencias:
  ```bash
  pip install flask flask-sqlalchemy yt-dlp mutagen python-dotenv pymysql
  ```

## Configuración

1.  Asegúrate de tener el archivo `.env` configurado correctamente.
2.  El archivo `cookies.txt` es necesario para las descargas de YouTube.

## Ejecución

Para iniciar todos los servicios (App Principal y Estadísticas) de una vez:

```bash
./start_server.sh
```

- **App Principal**: `http://localhost:5000`
- **Estadísticas**: `http://localhost:5001`

## Cómo conectar desde el móvil

1.  Asegúrate de que tu móvil y este ordenador estén en la **misma red WiFi**.
2.  Averigua la **IP local** de este ordenador:
    - Linux/Mac: Ejecuta `ip addr` o `hostname -I` en la terminal.
    - Windows: Ejecuta `ipconfig` en CMD.
    - *Ejemplo: 192.168.1.45*
3.  En el navegador de tu móvil, ve a:
    - App: `http://<TU_IP_LOCAL>:5000`
    - Stats: `http://<TU_IP_LOCAL>:5002`
4.  **Instalar App**: En el menú del navegador (Chrome/Safari), selecciona "Añadir a pantalla de inicio" para instalarla como una app nativa.

## Almacenamiento de Datos

- **Música**: Carpeta `mp3/`.
- **Base de Datos**: MySQL/MariaDB (configurado en `.env`).

## Solución de Problemas

- **Sincronización**: Si las canciones no aparecen, refresca la página.
- **No conecta desde el móvil**: Verifica que el firewall no esté bloqueando los puertos 5000 y 5002.
