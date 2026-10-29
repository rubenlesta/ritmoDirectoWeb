let cancionSeleccionada = null;
let cancionesAlbum = [];
let indiceActual = 0;
let modoAleatorio = true;
let albumActual = "";

let colaReproduccion = [];
let cancionesSiguientes = [];
let currentContextSong = null;
let cancionesPendientesAlbum = [];
let descargaActiva = false;

document.addEventListener('click', (e) => {
    const menu = document.getElementById('contextMenu');
    if (menu && menu.style.display === 'block') {
        menu.style.display = 'none';
    }
});

// --- Toast Notification System ---
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let icon = type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check';

    toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// --- Formatting ---
function formatTime(time) {
    if (isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    let seconds = Math.floor(time % 60);
    if (seconds < 10) seconds = "0" + seconds;
    return `${minutes}:${seconds}`;
}

// --- Initialization ---
window.onload = () => {
    cargarAlbumes();
    cargarCancionesAlbum("Sin clasificar");
    setupMediaSession();
    registerServiceWorker();

    // MP3 Upload Handler
    const mp3Input = document.getElementById('mp3UploadInput');
    if (mp3Input) {
        mp3Input.addEventListener('change', handleFileUpload);
    }
};

// --- Global State ---
let selectedSongs = new Set();
let isSelectionMode = false;

// --- Loading Bar ---
function showLoading() {
    const bar = document.getElementById('loading-bar');
    if (bar) bar.style.width = '100%';
}

function hideLoading() {
    const bar = document.getElementById('loading-bar');
    if (bar) {
        bar.style.width = '100%';
        setTimeout(() => {
            bar.style.width = '0%';
        }, 300);
    }
}

function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js", { scope: "/" })
        .catch(error => console.error("No se pudo registrar el Service Worker:", error));
}

function setupMediaSession() {
    if (!("mediaSession" in navigator)) return;

    const audioPlayer = document.getElementById("audioPlayer");
    const actions = {
        play: () => audioPlayer.play(),
        pause: () => audioPlayer.pause(),
        previoustrack: () => reiniciarCancion(),
        nexttrack: () => reproducirSiguienteCancion(),
        seekbackward: details => {
            audioPlayer.currentTime = Math.max(
                0,
                audioPlayer.currentTime - (details.seekOffset || 10)
            );
        },
        seekforward: details => {
            audioPlayer.currentTime = Math.min(
                audioPlayer.duration || Infinity,
                audioPlayer.currentTime + (details.seekOffset || 10)
            );
        },
        seekto: details => {
            if (Number.isFinite(details.seekTime)) {
                audioPlayer.currentTime = details.seekTime;
            }
        }
    };

    Object.entries(actions).forEach(([action, handler]) => {
        try {
            navigator.mediaSession.setActionHandler(action, handler);
        } catch (error) {
            console.debug(`Media Session no admite la acción ${action}:`, error);
        }
    });

    audioPlayer.addEventListener("play", updateMediaPlaybackState);
    audioPlayer.addEventListener("pause", updateMediaPlaybackState);
    audioPlayer.addEventListener("ended", updateMediaPlaybackState);
    audioPlayer.addEventListener("timeupdate", updateMediaSessionPosition);
}

function updateMediaSessionMetadata(song) {
    if (!("mediaSession" in navigator) || !window.MediaMetadata || !song) return;

    navigator.mediaSession.metadata = new MediaMetadata({
        title: song.titulo || "Ritmo Directo",
        artist: song.artista || "Desconocido",
        album: albumActual || "Ritmo Directo",
        artwork: [
            {
                src: new URL("/static/icons/icon-512.png", window.location.origin).href,
                sizes: "512x512",
                type: "image/png"
            }
        ]
    });
}

function updateMediaPlaybackState() {
    if (!("mediaSession" in navigator)) return;
    const audioPlayer = document.getElementById("audioPlayer");
    navigator.mediaSession.playbackState = audioPlayer.paused ? "paused" : "playing";
    const playIcon = document.getElementById("playIcon");
    playIcon.classList.toggle("fa-play", audioPlayer.paused);
    playIcon.classList.toggle("fa-pause", !audioPlayer.paused);
}

function updateMediaSessionPosition() {
    if (!("mediaSession" in navigator) || !navigator.mediaSession.setPositionState) return;
    const audioPlayer = document.getElementById("audioPlayer");
    if (!Number.isFinite(audioPlayer.duration) || audioPlayer.duration <= 0) return;

    navigator.mediaSession.setPositionState({
        duration: audioPlayer.duration,
        playbackRate: audioPlayer.playbackRate,
        position: Math.min(audioPlayer.currentTime, audioPlayer.duration)
    });
}

// --- MP3 Upload ---
function triggerUpload() {
    document.getElementById('mp3UploadInput').click();
}

function handleFileUpload(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    showLoading();
    showToast(`Subiendo ${files.length} archivos...`);

    let uploadedCount = 0;
    const total = files.length;
    const promises = [];

    for (let i = 0; i < total; i++) {
        const formData = new FormData();
        formData.append('file', files[i]);

        promises.push(
            fetch('/api/upload', {
                method: 'POST',
                body: formData
            }).then(res => res.json())
        );
    }

    Promise.all(promises)
        .then(results => {
            const success = results.filter(r => r.success).length;
            showToast(`Subidos ${success} de ${total} archivos`);
            cargarCancionesAlbum("Home"); // Refresh
        })
        .catch(err => {
            console.error(err);
            showToast("Error en la subida", 'error');
        })
        .finally(() => {
            hideLoading();
            event.target.value = ''; // Reset input
        });
}

// --- Album Management ---
function cargarAlbumes() {
    fetch("/api/albumes")
        .then(res => res.json())
        .then(data => {
            renderAlbumList(data.albumes || []);
        })
        .catch(error => {
            console.error("Error loading albums:", error);
        });
}

function renderAlbumList(albums) {
    const lista = document.getElementById("listaAlbumes");
    lista.innerHTML = "";
    albums.forEach(album => {
        const btn = document.createElement("button");
        btn.className = `album-item ${album === albumActual ? 'active' : ''}`;
        const icon = document.createElement("i");
        icon.className = "fa-solid fa-folder";
        btn.append(icon, document.createTextNode(` ${album}`));
        btn.onclick = () => cargarCancionesAlbum(album);
        lista.appendChild(btn);
    });
}

function crearAlbum() {
    const nombre = prompt("Nombre del nuevo álbum:");
    if (!nombre) return;

    fetch("/crear_album", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre })
    })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                showToast("Álbum creado exitosamente");
                cargarAlbumes();
            } else {
                showToast(data.error, 'error');
            }
        })
        .catch(error => {
            console.error("Error creating album:", error);
            showToast("No se pudo crear el álbum", "error");
        });
}

// --- Song Management ---
function cargarCancionesAlbum(album) {
    albumActual = album;
    document.querySelectorAll('.album-item').forEach(el => {
        el.classList.toggle('active', el.textContent.trim() === album);
    });

    const url = album === "Sin clasificar" ? "/lista_canciones_sin_album" : `/lista_canciones_album?album=${encodeURIComponent(album)}`;

    fetch(url)
        .then(res => res.json())
        .then(data => {
            cancionesAlbum = data.canciones || [];
            indiceActual = 0;
            prepararSiguientes();
            renderSongs();
            cancionSeleccionada = null;
        })
        .catch(err => {
            console.error("Error:", err);
            showToast("Error al cargar canciones", 'error');
        });
}

function renderSongs() {
    const tbody = document.querySelector("#cancionesLista tbody");
    const emptyState = document.getElementById("emptyState");
    tbody.innerHTML = '';

    if (cancionesAlbum.length === 0) {
        emptyState.style.display = 'flex';
        return;
    }
    emptyState.style.display = 'none';

    // Update Master Checkbox
    const masterCheckbox = document.getElementById('selectAllCheckbox');
    if (masterCheckbox) {
        const allSelected = cancionesAlbum.length > 0 && cancionesAlbum.every(c => selectedSongs.has(c.filename));
        masterCheckbox.checked = allSelected;
    }

    cancionesAlbum.forEach((cancion, index) => {
        const row = document.createElement("tr");
        row.classList.add("song-row");
        const isSelected = selectedSongs.has(cancion.filename);
        if (isSelected) row.classList.add('selected-batch');

        row.innerHTML = `
            <td>
                <label class="checkbox-wrapper-custom">
                    <input type="checkbox" ${isSelected ? 'checked' : ''} onclick="event.stopPropagation(); toggleSelection(${index}, this)">
                    <span class="custom-checkmark"></span>
                </label>
            </td>
            <td>${index + 1}</td>
            <td class="track-cell">
                <div class="song-info">
                    <span class="song-art" aria-hidden="true">
                        <i class="fa-solid fa-music"></i>
                    </span>
                    <span class="song-text">
                        <span class="song-title">${cancion.titulo}</span>
                        <span class="song-artist">${cancion.artista || 'Desconocido'}</span>
                    </span>
                </div>
            </td>
            <td class="duration-cell">${cancion.duracion}</td>
            <td class="song-actions">
                <button class="action-btn-small" onclick="event.stopPropagation(); agregarColaDirecto(${index})" title="Agregar a cola">
                    <i class="fa-solid fa-plus"></i>
                </button>
                <button class="action-btn-small" onclick="showContextMenu(event, cancionesAlbum[${index}])" title="Más opciones">
                    <i class="fa-solid fa-ellipsis-vertical"></i>
                </button>
            </td>
        `;
        row.onclick = () => seleccionarCancion(row, cancion, index);
        tbody.appendChild(row);
    });
}

function seleccionarCancion(row, cancion, index) {
    document.querySelectorAll("tbody tr").forEach(r => r.classList.remove('selected'));
    row.classList.add('selected');
    cancionSeleccionada = cancion;
    indiceActual = index;
    prepararSiguientes();
    renderQueue();
    updateMediaSessionMetadata(cancion);

    // Update player info immediately
    document.getElementById("cancionActual").textContent = cancion.titulo;
    document.getElementById("artistaActual").textContent = cancion.artista || "Desconocido";

    reproducirCancion();
}

// --- Player Logic ---
function reproducirCancion() {
    if (!cancionSeleccionada) return;

    const audioPlayer = document.getElementById("audioPlayer");
    const playIcon = document.getElementById("playIcon");

    let nombreArchivo = cancionSeleccionada.filename;

    if (!nombreArchivo) {
        // Fallback if filename missing
        nombreArchivo = cancionSeleccionada.artista
            ? `${cancionSeleccionada.artista} - ${cancionSeleccionada.titulo}.mp3`
            : `${cancionSeleccionada.titulo}.mp3`;
    }

    const src = `/reproducir?cancion=${encodeURIComponent(nombreArchivo)}&album=${encodeURIComponent(albumActual)}`;
    audioPlayer.src = src;

    audioPlayer.play().then(() => {
        playIcon.classList.remove("fa-play");
        playIcon.classList.add("fa-pause");
        updateMediaPlaybackState();
    }).catch(e => console.warn("Autoplay blocked or error", e));

    audioPlayer.ontimeupdate = updateProgress;
    audioPlayer.onended = onSongEnd;
}

function togglePlayPause() {
    const audioPlayer = document.getElementById("audioPlayer");
    const playIcon = document.getElementById("playIcon");

    if (audioPlayer.paused) {
        if (!audioPlayer.src && cancionSeleccionada) {
            reproducirCancion();
        } else if (audioPlayer.src) {
            audioPlayer.play();
            playIcon.classList.remove("fa-play");
            playIcon.classList.add("fa-pause");
        }
    } else {
        audioPlayer.pause();
        playIcon.classList.remove("fa-pause");
        playIcon.classList.add("fa-play");
    }
}

function toggleMute() {
    const audioPlayer = document.getElementById("audioPlayer");
    audioPlayer.muted = !audioPlayer.muted;
    updateVolumeControl();
}

function setVolume(value) {
    const audioPlayer = document.getElementById("audioPlayer");
    audioPlayer.volume = Number(value);
    audioPlayer.muted = audioPlayer.volume === 0;
    updateVolumeControl();
}

function updateVolumeControl() {
    const audioPlayer = document.getElementById("audioPlayer");
    const toggle = document.getElementById("volumeToggle");
    const slider = document.getElementById("volumeSlider");
    if (!toggle || !slider) return;

    const muted = audioPlayer.muted || audioPlayer.volume === 0;
    const icon = toggle.querySelector("i");
    icon.className = `fa-solid ${muted ? "fa-volume-xmark" : "fa-volume-high"}`;
    toggle.title = muted ? "Activar sonido" : "Silenciar";
    toggle.setAttribute("aria-label", toggle.title);
    slider.value = muted ? 0 : audioPlayer.volume;
}

document.addEventListener("DOMContentLoaded", () => {
    const audioPlayer = document.getElementById("audioPlayer");
    const volumeSlider = document.getElementById("volumeSlider");
    if (!audioPlayer || !volumeSlider) return;
    audioPlayer.volume = Number(volumeSlider.value);
    updateVolumeControl();
});

function updateProgress() {
    const audioPlayer = document.getElementById("audioPlayer");
    const current = audioPlayer.currentTime;
    const duration = audioPlayer.duration;

    document.getElementById("currentTime").textContent = formatTime(current);
    document.getElementById("duration").textContent = formatTime(duration);

    const percent = duration ? (current / duration) * 100 : 0;
    document.getElementById("progress").style.width = percent + "%";
    document.querySelector(".progress-bar-wrapper")
        ?.setAttribute("aria-valuenow", String(Math.round(percent)));
}

function seek(event) {
    const audioPlayer = document.getElementById("audioPlayer");
    if (!audioPlayer.duration) return;

    const wrapper = event.currentTarget;
    const bounds = wrapper.getBoundingClientRect();
    const clickX = Math.max(0, Math.min(event.clientX - bounds.left, bounds.width));
    const width = wrapper.clientWidth;
    const percent = clickX / width;

    audioPlayer.currentTime = percent * audioPlayer.duration;
}

function onSongEnd() {
    // Record play
    if (cancionSeleccionada) {
        fetch('/api/record_play', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: cancionSeleccionada.filename })
        }).catch(e => console.error("Error recording play:", e));
    }

    reproducirSiguienteCancion();
}

function reproducirSiguienteCancion() {
    if (colaReproduccion.length > 0) {
        const next = colaReproduccion.shift();
        renderQueue();
        reproducirCancionDeCola(next, true);
        return;
    }

    const next = cancionesSiguientes.shift();
    if (!next) return;
    const nextIndex = cancionesAlbum.findIndex(
        song => song.filename === next.filename
    );
    if (nextIndex !== -1) {
        seleccionarCancionByIndex(nextIndex);
    } else {
        reproducirCancionDeCola(next, false);
    }
}

function reproducirCancionDeCola(song, isPriority) {
    cancionSeleccionada = song;
    const songIndex = cancionesAlbum.findIndex(
        item => item.filename === song.filename
    );
    if (!isPriority && songIndex >= 0) {
        indiceActual = songIndex;
        prepararSiguientes();
    }
    document.getElementById("cancionActual").textContent = song.titulo;
    document.getElementById("artistaActual").textContent = song.artista || "Desconocido";
    updateMediaSessionMetadata(song);
    reproducirCancion();
    renderQueue();
}

function prepararSiguientes() {
    if (indiceActual < 0 || !cancionesAlbum.length) {
        cancionesSiguientes = [];
        return;
    }

    const restantes = cancionesAlbum.filter((_, index) => index !== indiceActual);
    if (modoAleatorio) {
        for (let index = restantes.length - 1; index > 0; index--) {
            const swapIndex = Math.floor(Math.random() * (index + 1));
            [restantes[index], restantes[swapIndex]] =
                [restantes[swapIndex], restantes[index]];
        }
        cancionesSiguientes = restantes;
        return;
    }

    cancionesSiguientes = [
        ...cancionesAlbum.slice(indiceActual + 1),
        ...cancionesAlbum.slice(0, indiceActual)
    ];
}

function seleccionarCancionByIndex(index) {
    const rows = document.querySelectorAll("tbody tr");
    if (rows[index]) {
        rows[index].click();
    }
}

function reiniciarCancion() {
    document.getElementById("audioPlayer").currentTime = 0;
}

function cambiarModo() {
    modoAleatorio = !modoAleatorio;
    const btn = document.getElementById("modoReproduccion");
    btn.classList.toggle('active', modoAleatorio);
    btn.setAttribute("aria-pressed", String(modoAleatorio));
    btn.setAttribute(
        "aria-label",
        modoAleatorio ? "Desactivar modo aleatorio" : "Activar modo aleatorio"
    );
    prepararSiguientes();
    renderQueue();
    showToast(modoAleatorio ? "Modo Aleatorio Activado" : "Modo Secuencial Activado");
}

function toggleRepeatMode() {
    const audioPlayer = document.getElementById("audioPlayer");
    const button = document.getElementById("repeatToggle");
    audioPlayer.loop = !audioPlayer.loop;
    button.classList.toggle("active", audioPlayer.loop);
    button.setAttribute("aria-pressed", String(audioPlayer.loop));
    button.setAttribute(
        "aria-label",
        audioPlayer.loop ? "Desactivar repetición" : "Activar repetición"
    );
    button.title = audioPlayer.loop ? "Repetir activado" : "Repetir desactivado";
}

// --- Download progress ---
function setDownloadProgress(task) {
    const panel = document.getElementById("downloadProgress");
    const message = document.getElementById("downloadProgressMessage");
    const percentLabel = document.getElementById("downloadProgressPercent");
    const fill = document.getElementById("downloadProgressFill");
    const speedLabel = document.getElementById("downloadProgressSpeed");
    const progressTrack = document.querySelector(".download-progress-track");
    const percent = Number.isFinite(Number(task.percent))
        ? Math.max(0, Math.min(100, Number(task.percent)))
        : null;

    panel.hidden = false;
    panel.classList.toggle("failed", task.state === "failed");
    panel.classList.toggle("indeterminate", percent === null && task.state === "running");
    message.textContent = task.message || "Procesando descarga...";
    percentLabel.textContent = percent === null ? "" : `${Math.round(percent)}%`;
    fill.style.width = percent === null ? "0%" : `${percent}%`;
    progressTrack.setAttribute(
        "aria-valuenow", percent === null ? "0" : String(Math.round(percent))
    );
    speedLabel.textContent = task.speed
        ? `${(task.speed / 1024 / 1024).toFixed(2)} MB/s`
        : "";
}

const delay = milliseconds =>
    new Promise(resolve => window.setTimeout(resolve, milliseconds));

async function pollDownload(taskId) {
    while (true) {
        const response = await fetch(
            `/api/download_status/${encodeURIComponent(taskId)}`
        );
        const task = await response.json();
        if (!response.ok) {
            throw new Error(task.error || "No se pudo consultar la descarga");
        }

        setDownloadProgress(task);
        if (task.state === "completed") {
            showToast(task.result?.message || "Descarga finalizada");
            cargarAlbumes();
            cargarCancionesAlbum("Home");
            await delay(3500);
            document.getElementById("downloadProgress").hidden = true;
            return;
        }
        if (task.state === "failed") {
            throw new Error(task.error || "La descarga no se pudo completar");
        }
        await delay(700);
    }
}

async function descargar() {
    const input = document.getElementById("urlInput");
    const button = document.querySelector(".download-group .btn-primary");
    const entrada = input.value.trim();

    if (descargaActiva) return;
    if (!entrada) {
        showToast("Introduce una URL o búsqueda", "error");
        return;
    }

    descargaActiva = true;
    button.disabled = true;
    setDownloadProgress({
        state: "running",
        phase: "fetching",
        message: "Obteniendo información...",
        percent: null
    });

    try {
        const response = await fetch("/api/downloads", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ entrada })
        });
        const result = await response.json();
        if (!response.ok || !result.success) {
            throw new Error(result.error || "No se pudo iniciar la descarga");
        }
        input.value = "";
        await pollDownload(result.task_id);
    } catch (error) {
        console.error("Download failed:", error);
        setDownloadProgress({
            state: "failed",
            message: error.message || "Error de red",
            percent: null
        });
        showToast(error.message || "Error de red durante la descarga", "error");
    } finally {
        descargaActiva = false;
        button.disabled = false;
    }
}

function eliminarCancion(nombreCancion) {
    if (!confirm(`¿Eliminar ${nombreCancion}?`)) return;

    fetch(`/eliminar?cancion=${encodeURIComponent(nombreCancion)}&album=${encodeURIComponent(albumActual)}`)
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                showToast(data.message || "Canción eliminada");
                cargarCancionesAlbum(albumActual);
            } else {
                showToast(data.error || "Error al eliminar", "error");
            }
        });
}

function agregarColaDirecto(index) {
    const cancion = cancionesAlbum[index];
    if (!cancion) return;
    colaReproduccion.push(cancion);
    showToast(`Añadida a la cola: ${cancion.titulo}`);
    renderQueue();
}

function toggleQueue() {
    const isOpen = document.getElementById("queueSidebar").classList.contains("open");
    if (isOpen) closeQueue();
    else openQueue();
}

function openQueue() {
    const sidebar = document.getElementById("queueSidebar");
    const backdrop = document.getElementById("queueBackdrop");
    const toggle = document.getElementById("queueToggle");
    if (!sidebar || !backdrop || !toggle) return;
    document.getElementById("contextMenu").style.display = "none";
    sidebar.classList.add("open");
    sidebar.setAttribute("aria-hidden", "false");
    backdrop.classList.add("open");
    toggle.setAttribute("aria-expanded", "true");
    renderQueue();
}

function closeQueue() {
    const sidebar = document.getElementById("queueSidebar");
    const backdrop = document.getElementById("queueBackdrop");
    const toggle = document.getElementById("queueToggle");
    if (!sidebar || !backdrop || !toggle) return;
    sidebar.classList.remove("open");
    sidebar.setAttribute("aria-hidden", "true");
    backdrop.classList.remove("open");
    toggle.setAttribute("aria-expanded", "false");
}

function appendQueueItem(container, song, position, onRemove) {
    const item = document.createElement("div");
    item.className = "queue-item";

    if (position !== null) {
        const number = document.createElement("span");
        number.className = "queue-position";
        number.textContent = String(position);
        item.appendChild(number);
    }

    const info = document.createElement("div");
    info.className = "info";
    const title = document.createElement("span");
    title.className = "title";
    title.textContent = song.titulo;
    const artist = document.createElement("span");
    artist.className = "artist";
    artist.textContent = song.artista || "Desconocido";
    info.append(title, artist);
    item.appendChild(info);

    if (onRemove) {
        const remove = document.createElement("button");
        remove.className = "action-btn-small";
        remove.type = "button";
        remove.title = "Quitar de la cola";
        remove.setAttribute("aria-label", `Quitar ${song.titulo} de la cola`);
        remove.innerHTML = '<i class="fa-solid fa-xmark"></i>';
        remove.addEventListener("click", onRemove);
        item.appendChild(remove);
    }
    container.appendChild(item);
}

function renderQueue() {
    const list = document.getElementById("queueList");
    const upcoming = document.getElementById("upcomingList");
    if (!list || !upcoming) return;

    list.replaceChildren();
    upcoming.replaceChildren();
    document.getElementById("clearQueueButton").disabled =
        colaReproduccion.length === 0;
    document.getElementById("queueModeLabel").textContent =
        modoAleatorio ? "Aleatorio" : "Orden del álbum";

    if (!colaReproduccion.length) {
        const empty = document.createElement("div");
        empty.className = "queue-empty";
        empty.textContent = "No hay canciones añadidas";
        list.appendChild(empty);
    } else {
        colaReproduccion.forEach((song, index) => {
            appendQueueItem(list, song, index + 1, () => removeFromQueue(index));
        });
    }

    const planned = cancionesSiguientes.filter(song =>
        !colaReproduccion.some(queued => queued.filename === song.filename)
    ).slice(0, 20);
    if (!planned.length) {
        const empty = document.createElement("div");
        empty.className = "queue-empty";
        empty.textContent = "No hay más canciones en este álbum";
        upcoming.appendChild(empty);
    } else {
        planned.forEach((song, index) =>
            appendQueueItem(upcoming, song, index + 1, null)
        );
    }
}

function removeFromQueue(index) {
    colaReproduccion.splice(index, 1);
    renderQueue();
}

function clearQueue() {
    colaReproduccion = [];
    renderQueue();
}

function mostrarCola() {
    openQueue();
}

// --- Song context menu and album selector ---
function showContextMenu(event, song) {
    event.preventDefault();
    event.stopPropagation();
    currentContextSong = song;
    const menu = document.getElementById("contextMenu");
    const x = Math.max(8, Math.min(event.clientX, window.innerWidth - 210));
    const y = Math.max(8, Math.min(event.clientY, window.innerHeight - 160));
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    menu.style.display = "block";
}

function openAlbumDialog(songs) {
    cancionesPendientesAlbum = songs.filter(Boolean);
    const backdrop = document.getElementById("albumDialogBackdrop");
    const select = document.getElementById("albumSelect");
    const fields = document.getElementById("createAlbumFields");
    const input = document.getElementById("newAlbumName");
    fields.hidden = true;
    input.value = "";
    select.disabled = true;
    select.replaceChildren(new Option("Cargando álbumes...", ""));
    backdrop.classList.add("open");
    backdrop.setAttribute("aria-hidden", "false");

    fetch("/api/albumes")
        .then(response => {
            if (!response.ok) throw new Error("No se pudieron cargar los álbumes");
            return response.json();
        })
        .then(data => {
            if (!Array.isArray(data.albumes)) {
                throw new Error("La respuesta de álbumes no es válida");
            }
            select.replaceChildren();
            select.add(new Option("Selecciona un álbum...", ""));
            (data.albumes || []).forEach(album =>
                select.add(new Option(album, album))
            );
            select.disabled = false;
            if (!data.albumes?.length) {
                select.options[0].textContent = "No hay álbumes disponibles";
            }
        })
        .catch(error => {
            console.error("Error loading albums:", error);
            select.replaceChildren(new Option("Error al cargar álbumes", ""));
            showToast(error.message, "error");
        });
}

function closeAlbumDialog() {
    const backdrop = document.getElementById("albumDialogBackdrop");
    backdrop.classList.remove("open");
    backdrop.setAttribute("aria-hidden", "true");
    cancionesPendientesAlbum = [];
}

async function confirmarAlbum() {
    const select = document.getElementById("albumSelect");
    const newAlbumFields = document.getElementById("createAlbumFields");
    const newAlbumName = document.getElementById("newAlbumName");
    let albumName = select.value;

    try {
        if (!newAlbumFields.hidden) {
            albumName = newAlbumName.value.trim();
            if (!albumName) {
                showToast("Escribe el nombre del nuevo álbum", "error");
                newAlbumName.focus();
                return;
            }
            const createResponse = await fetch("/crear_album", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nombre: albumName })
            });
            const createResult = await createResponse.json();
            if (!createResponse.ok || !createResult.success) {
                throw new Error(createResult.error || "No se pudo crear el álbum");
            }
        } else if (!albumName) {
            showToast("Selecciona un álbum", "error");
            return;
        }

        const results = await Promise.all(cancionesPendientesAlbum.map(song =>
            fetch("/api/agregar_a_album", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ cancion: song.filename, album: albumName })
            }).then(response => response.json())
        ));
        const failed = results.filter(result => !result.success);
        if (failed.length) {
            throw new Error(failed[0].error || "No se pudieron añadir todas las canciones");
        }
        showToast(`Añadidas ${results.length} canción(es) a ${albumName}`);
        cargarAlbumes();
        closeAlbumDialog();
    } catch (error) {
        console.error("Error adding songs to album:", error);
        showToast(error.message || "No se pudo añadir al álbum", "error");
    }
}

function bindAlbumDialog() {
    document.getElementById("showCreateAlbum").addEventListener("click", () => {
        const fields = document.getElementById("createAlbumFields");
        fields.hidden = !fields.hidden;
        if (!fields.hidden) document.getElementById("newAlbumName").focus();
    });
    document.getElementById("confirmAlbumAdd").addEventListener(
        "click", confirmarAlbum
    );
    document.getElementById("albumDialogBackdrop").addEventListener("click", event => {
        if (event.target.id === "albumDialogBackdrop") closeAlbumDialog();
    });
    document.addEventListener("keydown", event => {
        if (event.key === "Escape") {
            closeAlbumDialog();
            closeQueue();
        }
    });
}

function bindSongContextMenu() {
    document.getElementById("ctxAddQueue").addEventListener("click", () => {
        if (currentContextSong) {
            colaReproduccion.push(currentContextSong);
            renderQueue();
            showToast(`Añadida a la cola: ${currentContextSong.titulo}`);
        }
        document.getElementById("contextMenu").style.display = "none";
    });
    document.getElementById("ctxAddAlbum").addEventListener("click", () => {
        document.getElementById("contextMenu").style.display = "none";
        if (currentContextSong) openAlbumDialog([currentContextSong]);
    });
    document.getElementById("ctxDelete").addEventListener("click", () => {
        if (currentContextSong) eliminarCancion(currentContextSong.filename);
        document.getElementById("contextMenu").style.display = "none";
    });
}

function bindQueueControls() {
    const toggle = document.getElementById("queueToggle");
    const closeButton = document.getElementById("queueCloseButton");
    const backdrop = document.getElementById("queueBackdrop");
    if (toggle) toggle.addEventListener("click", toggleQueue);
    if (closeButton) closeButton.addEventListener("click", closeQueue);
    if (backdrop) backdrop.addEventListener("click", closeQueue);
}

document.addEventListener("DOMContentLoaded", () => {
    bindAlbumDialog();
    bindSongContextMenu();
    bindQueueControls();
    renderQueue();
});

function buscar() {
    const texto = document.getElementById("busquedaInput").value.toLowerCase();
    const rows = document.querySelectorAll("tbody tr");
    rows.forEach(row => {
        const text = row.innerText.toLowerCase();
        row.style.display = text.includes(texto) ? "" : "none";
    });
}

// --- Batch Actions Functions ---
function toggleSelectAll(checkbox) {
    if (checkbox.checked) {
        cancionesAlbum.forEach(c => {
            if (c.filename) selectedSongs.add(c.filename);
        });
    } else {
        selectedSongs.clear();
    }
    renderSongs();
    updateBatchToolbar();
}

function toggleSelection(index, checkbox) {
    const song = cancionesAlbum[index];
    if (song && song.filename) {
        const filename = song.filename;
        if (selectedSongs.has(filename)) {
            selectedSongs.delete(filename);
            if (checkbox) checkbox.closest('tr').classList.remove('selected-batch');
        } else {
            selectedSongs.add(filename);
            if (checkbox) checkbox.closest('tr').classList.add('selected-batch');
        }
    }
    updateBatchToolbar();

    // Update Master Checkbox state
    const masterCheckbox = document.getElementById('selectAllCheckbox');
    if (masterCheckbox) {
        masterCheckbox.checked = cancionesAlbum.length > 0 && cancionesAlbum.every(c => selectedSongs.has(c.filename));
    }
}

function updateBatchToolbar() {
    let toolbar = document.getElementById('batchToolbar');
    // Create toolbar if not exists
    if (!toolbar) {
        toolbar = document.createElement('div');
        toolbar.id = 'batchToolbar';
        toolbar.className = 'batch-toolbar';
        toolbar.innerHTML = `
            <span id="selectedCount">0 seleccionada(s)</span>
            <div class="batch-actions">
                <button onclick="batchAddToAlbum()" class="action-btn-small" title="Añadir a Álbum"><i class="fa-solid fa-folder-plus"></i></button>
                <button onclick="batchDelete()" class="action-btn-danger" title="Eliminar"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
        document.body.appendChild(toolbar);
    }

    const countSpan = document.getElementById('selectedCount');

    if (selectedSongs.size > 0) {
        toolbar.classList.add('visible');
        if (countSpan) countSpan.textContent = `${selectedSongs.size} seleccionada(s)`;
    } else {
        toolbar.classList.remove('visible');
    }
}

function batchDelete() {
    if (selectedSongs.size === 0) return;
    if (!confirm(`¿Eliminar ${selectedSongs.size} canciones?`)) return;

    showLoading();
    fetch('/api/batch/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            filenames: Array.from(selectedSongs),
            album: albumActual
        })
    })
        .then(r => r.json())
        .then(data => {
            if (data.success) {
                showToast(data.message);
                selectedSongs.clear();
                cargarCancionesAlbum(albumActual);
            } else {
                showToast(data.error, 'error');
            }
        })
        .finally(() => hideLoading());
}

function batchAddToAlbum() {
    const songs = cancionesAlbum.filter(song => selectedSongs.has(song.filename));
    if (songs.length) openAlbumDialog(songs);
}
