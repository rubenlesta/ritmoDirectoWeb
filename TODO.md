# TODO — RitmoDirectoWeb

## Completado

- [x] Corregido el HTTP 500 de las listas: el `.env` apuntaba a MySQL `musica`, que no existía; base creada e inicializada.
- [x] Migrado el esquema SQLite legacy: `canciones.nombre` se migró a `titulo` y se añadieron `filename`, `plays` y `last_played`.
- [x] Inicializadas y verificadas las tablas `canciones`, `albumes` y `album_cancion`; `/api/albumes` y `/lista_canciones_album` devuelven HTTP 200.
- [x] Hecho robusto `sync_files()` para carpetas MP3 vacías o ausentes.
- [x] Añadida la configuración PWA: manifiesto, Service Worker, iconos locales y metadatos iOS.
- [x] Añadidas mejoras responsive/táctiles y controles Media Session del reproductor.
- [x] Documentada en README la puesta en marcha HTTPS con Cloudflare Tunnel, Caddy o Nginx/Let's Encrypt.
- [x] Probada la descarga real del vídeo Creative Commons de Blender `aqz-KE-bpKQ` por `/descargar`: MP3 a 192 kbps, duración leída por Mutagen y registro en «Home».

## Cosas que hacer (Pendientes / Bugs detectados)

- [ ] Instalar/configurar un runtime JavaScript compatible con yt-dlp (por ejemplo, Deno): la descarga probada terminó bien, pero yt-dlp avisó que no detecta uno y que la extracción sin runtime está deprecada.
- [ ] Configurar `DOWNLOAD_SOCKET_TIMEOUT` en `.env` si los tiempos de red del servidor requieren un límite distinto (predeterminado: 30 segundos por operación de red).
- [ ] Mantener yt-dlp actualizado: YouTube puede cambiar firmas, extracción o controles anti-bot; el servicio ahora entrega un error claro, pero no puede corregir esos cambios por sí solo.
- [ ] Verificar en cada entorno de despliegue que el archivo configurado en `COOKIES_PATH`, si se necesita, sea legible por el proceso.
- [ ] Confirmar FFmpeg y FFprobe en cada entorno de despliegue; están disponibles en el entorno de prueba y se validan al invocar la descarga.
- [ ] Revisar periódicamente el directorio `MP3_FOLDER` por temporales antiguos que hayan quedado tras un cierre abrupto del proceso o del servidor.
- [ ] Restringir la descarga a contenido para el que se tenga autorización y revisar las condiciones aplicables del servicio de origen.

## Recomendaciones y siguientes mejoras

- [ ] Mover las descargas a trabajos en segundo plano (Celery/RQ u otra cola) para que `GET /descargar` no mantenga la petición HTTP ocupada.
- [ ] Cambiar la descarga a un endpoint `POST` y devolver un identificador de trabajo; exponer estado, errores y resultado mediante polling, SSE o WebSockets.
- [ ] Añadir progreso de descarga/conversión, cancelación, límites de concurrencia y límites de duración/tamaño.
- [ ] Guardar en caché metadatos de búsquedas y detectar duplicados antes de iniciar la descarga.
- [ ] Añadir soporte explícito de playlists, con selección de elementos, deduplicación y límites configurables.
- [ ] Mejorar la interfaz responsive y mostrar estados de cola, porcentaje, errores recuperables y acciones para reintentar.
- [ ] Añadir métricas y logs estructurados para tiempo de extracción, descarga, conversión, bitrate final y fallos por categoría.
- [ ] Ampliar pruebas con fallos simulados de FFmpeg, timeout, falta de herramientas, base de datos y descarga interrumpida.
