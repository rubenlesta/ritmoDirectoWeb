let cancionSeleccionada = null;
let cancionesAlbum = [];
let indiceActual = 0;
let modoAleatorio = true;
let albumActual = "";
let colaReproduccion = [];

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

    // File upload handler
    const fileInput = document.getElementById('archivoTxt');
    if (fileInput) {
        fileInput.addEventListener('change', function (event) {
            const archivo = event.target.files[0];
            if (archivo) {
                document.getElementById('urlInput').value = archivo.name;
                // Auto upload logic could go here
                descargar(); // Trigger download flow
            }
        });
    }
};

// --- Album Management ---
function cargarAlbumes() {
    fetch("/api/albumes") // Assuming we might add this endpoint or use existing logic
        .then(res => res.json())
        .then(data => {
            // Fallback if API structure differs, adapting to old structure for now
            // The old endpoint returned {albumes: ["name1", "name2"]}
            renderAlbumList(data.albumes || []);
        })
        .catch(error => {
            console.error("Error loading albums:", error);
            // Fallback to old endpoint if new one not ready
            fetch("/albumes").then(r => r.json()).then(d => renderAlbumList(d.albumes));
        });
}

function renderAlbumList(albums) {
    const lista = document.getElementById("listaAlbumes");
    lista.innerHTML = "";
    albums.forEach(album => {
        const btn = document.createElement("button");
        btn.className = `album-item ${album === albumActual ? 'active' : ''}`;
        btn.innerHTML = `<i class="fa-solid fa-folder"></i> ${album}`;
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

    cancionesAlbum.forEach((cancion, index) => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${cancion.titulo}</td>
            <td>${cancion.artista || 'Desconocido'}</td>
            <td>${cancion.duracion}</td>
            <td>
                <button class="action-btn-small" onclick="event.stopPropagation(); eliminarCancion('${cancion.filename}')" title="Eliminar">
                    <i class="fa-solid fa-trash"></i>
                </button>
                <button class="action-btn-small" onclick="event.stopPropagation(); agregarColaDirecto(${index})" title="Agregar a cola">
                    <i class="fa-solid fa-plus"></i>
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

    // Backend now expects filename directly or we construct it safely
    // The API returns 'filename' in the song object now
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

function updateProgress() {
    const audioPlayer = document.getElementById("audioPlayer");
    const current = audioPlayer.currentTime;
    const duration = audioPlayer.duration;

    document.getElementById("currentTime").textContent = formatTime(current);
    document.getElementById("duration").textContent = formatTime(duration);

    const percent = duration ? (current / duration) * 100 : 0;
    document.getElementById("progress").style.width = percent + "%";
}

function seek(event) {
    const audioPlayer = document.getElementById("audioPlayer");
    if (!audioPlayer.duration) return;

    const wrapper = event.currentTarget;
    const clickX = event.offsetX;
    const width = wrapper.clientWidth;
    const percent = clickX / width;

    audioPlayer.currentTime = percent * audioPlayer.duration;
}

function onSongEnd() {
    if (modoAleatorio) {
        // Simple random logic
        if (cancionesAlbum.length > 0) {
            let nextIndex = Math.floor(Math.random() * cancionesAlbum.length);
            seleccionarCancionByIndex(nextIndex);
        }
    } else {
        reproducirSiguienteCancion();
    }
}

function reproducirSiguienteCancion() {
    if (colaReproduccion.length > 0) {
        const next = colaReproduccion.shift();
        // Find index in current list if possible, otherwise just play
        // For simplicity, we just play it and don't highlight if not in list
        cancionSeleccionada = next;
        // Update UI info manually since it might not be in the list
        document.getElementById("cancionActual").textContent = next.titulo;
        document.getElementById("artistaActual").textContent = next.artista;
        reproducirCancion();
        return;
    }

    let nextIndex = (indiceActual + 1) % cancionesAlbum.length;
    seleccionarCancionByIndex(nextIndex);
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
    showToast(modoAleatorio ? "Modo Aleatorio Activado" : "Modo Secuencial Activado");
}

// --- Actions ---
function descargar() {
    const entrada = document.getElementById("urlInput").value.trim();
    const fileInput = document.getElementById('archivoTxt');

    if (fileInput.files.length > 0) {
        // Upload TXT logic
        const formData = new FormData();
        formData.append('archivoTxt', fileInput.files[0]);

        showToast("Subiendo lista y descargando...", "info");

        fetch('/subir_txt_album', { method: 'POST', body: formData })
            .then(r => r.json())
            .then(data => {
                if (data.success) {
                    showToast("Álbum importado correctamente");
                    cargarAlbumes();
                    fileInput.value = '';
                    document.getElementById("urlInput").value = '';
                } else {
                    showToast(data.error, 'error');
                }
            });
        return;
    }

    if (!entrada) {
        showToast("Introduce una URL o selecciona un archivo", "error");
        return;
    }

    showToast("Iniciando descarga...", "info");
    fetch(`/descargar?entrada=${encodeURIComponent(entrada)}`)
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                if (data.exists) {
                    showToast(data.message, "info"); // Yellow/Info for existing
                } else {
                    showToast(data.message, "success");
                }
                cargarCancionesAlbum("Home"); // Always refresh Home/Current
            } else {
                showToast(data.error || "Error en la descarga", "error");
            }
        })
        .catch(err => {
            console.error(err);
            showToast("Error de red", "error");
        });
}

function eliminarCancion(nombreCancion) {
    if (!confirm(`¿Eliminar ${nombreCancion}?`)) return;

    // Backend expects filename now
    fetch(`/eliminar?cancion=${encodeURIComponent(nombreCancion)}`)
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                showToast("Canción eliminada");
                cargarCancionesAlbum(albumActual);
            } else {
                showToast("Error al eliminar", "error");
            }
        });
}

function agregarColaDirecto(index) {
    const cancion = cancionesAlbum[index];
    colaReproduccion.push(cancion);
    showToast(`Agregada a la cola: ${cancion.titulo}`);
}

function mostrarCola() {
    if (colaReproduccion.length === 0) {
        showToast("La cola está vacía");
    } else {
        // Could be a modal, for now just a toast summary
        showToast(`${colaReproduccion.length} canciones en cola`);
    }
}

function buscar() {
    const texto = document.getElementById("busquedaInput").value.toLowerCase();
    const rows = document.querySelectorAll("tbody tr");
    rows.forEach(row => {
        const text = row.innerText.toLowerCase();
        row.style.display = text.includes(texto) ? "" : "none";
    });
}
