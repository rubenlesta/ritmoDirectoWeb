# RitmoDirectoWeb

Aplicación web para gestionar y reproducir tu colección de música local.

## Características

- **Gestión de Álbumes**: Organiza tus canciones en álbumes.
- **Reproducción**: Reproductor integrado con soporte para listas de reproducción.
- **Descarga**: Descarga canciones desde YouTube (requiere `cookies.txt`).
- **Estadísticas**: Visualiza tus hábitos de escucha (Top canciones, artistas, tiempo total).

## Requisitos

- Python 3.8+
- FFmpeg (para la conversión de audio)
- Dependencias listadas en `requirements.txt` (si existe) o instalar:
  ```bash
  pip install flask flask-sqlalchemy yt-dlp mutagen python-dotenv pymysql
  ```

## Configuración

1.  Asegúrate de tener el archivo `.env` configurado correctamente (ver `.env.example` o crear uno nuevo).
2.  El archivo `cookies.txt` es necesario para las descargas de YouTube.

## Ejecución

### Aplicación Principal

Para iniciar la aplicación principal (reproductor):

```bash
python run.py
```

La aplicación estará disponible en `http://localhost:5000`.

### Estadísticas

Para iniciar el servicio de estadísticas:

```bash
python stats_app.py
```

Las estadísticas estarán disponibles en `http://localhost:5002`.

## Almacenamiento de Datos

- **Música**: Los archivos MP3 se guardan en la carpeta `mp3/`.
- **Base de Datos**: La información de canciones, álbumes y **estadísticas** se guarda en la base de datos configurada en `.env` (por defecto MySQL/MariaDB).
    - Las estadísticas (reproducciones, última vez escuchado) se almacenan en la tabla `canciones` dentro de las columnas `plays` y `last_played`.

## Solución de Problemas

- **Sincronización**: Si las canciones no aparecen, intenta refrescar la página. La aplicación escanea la carpeta `mp3/` automáticamente al listar los álbumes.
- **Descargas**: Si fallan las descargas, verifica que `cookies.txt` esté actualizado.
