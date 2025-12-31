let cancionSeleccionada = null;
let cancionesAlbum = [];
let indiceActual = 0;
let modoAleatorio = true;
let albumActual = "";

let colaReproduccion = [];
let currentContextSong = null;

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

    // File upload handler (Legacy TXT)
    const fileInput = document.getElementById('archivoTxt');
    if (fileInput) {
        fileInput.addEventListener('change', function (event) {
            const archivo = event.target.files[0];
            if (archivo) {
                document.getElementById('urlInput').value = archivo.name;
                descargar();
            }
        });
    }

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
        const isSelected = selectedSongs.has(cancion.filename);
        if (isSelected) row.classList.add('selected-batch');

        row.innerHTML = `
            <td>
                <div class="checkbox-wrapper-custom">
                    <input type="checkbox" ${isSelected ? 'checked' : ''} onclick="event.stopPropagation(); toggleSelection('${cancion.filename}', this)">
                    <span class="custom-checkmark"></span>
                </div>
            </td>
            <td>${index + 1}</td>
            <td>${cancion.titulo}</td>
            <td>${cancion.artista || 'Desconocido'}</td>
            <td>${cancion.duracion}</td>
            <td>
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
    // Record play
    if (cancionSeleccionada) {
        fetch('/api/record_play', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: cancionSeleccionada.filename })
        }).catch(e => console.error("Error recording play:", e));
    }

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
        renderQueue();
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
    // Pass albumActual to handle conditional deletion
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
    colaReproduccion.push(cancion);
    showToast(`Agregada a la cola: ${cancion.titulo}`);
    renderQueue();
}

function toggleQueue() {
    const sidebar = document.getElementById('queueSidebar');
    sidebar.classList.toggle('open');
    renderQueue();
}

function renderQueue() {
    const list = document.getElementById('queueList');
    if (colaReproduccion.length === 0) {
        list.innerHTML = '<div class="empty-queue" style="padding: 20px; text-align: center; color: var(--text-muted);">Cola vacía</div>';
        return;
    }
    list.innerHTML = '';
    colaReproduccion.forEach((cancion, index) => {
        const item = document.createElement('div');
        item.className = 'queue-item';
        item.innerHTML = `
            <div class="info">
                <span class="title">${cancion.titulo}</span>
                <span class="artist">${cancion.artista || 'Desconocido'}</span>
            </div>
            <button class="action-btn-small" onclick="removeFromQueue(${index})">
                <i class="fa-solid fa-times"></i>
            </button>
        `;
        list.appendChild(item);
    });
}

function removeFromQueue(index) {
    colaReproduccion.splice(index, 1);
    renderQueue();
}

function mostrarCola() {
    toggleQueue();
}

// --- Context Menu ---
function showContextMenu(event, song) {
    event.preventDefault();
    event.stopPropagation();
    currentContextSong = song;
    const menu = document.getElementById('contextMenu');

    // Calculate position
    let x = event.clientX;
    let y = event.clientY;

    // Prevent overflow
    if (x + 200 > window.innerWidth) x = window.innerWidth - 210;
    if (y + 300 > window.innerHeight) y = window.innerHeight - 310;

    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;

    // Check if submenu would overflow (menu width ~200px + submenu width ~200px)
    if (x + 400 > window.innerWidth) {
        menu.classList.add('submenu-left');
    } else {
        menu.classList.remove('submenu-left');
    }

    menu.style.display = 'block';

    loadAlbumsForMenu();
}

function loadAlbumsForMenu() {
    const submenu = document.getElementById('albumSubmenu');
    submenu.innerHTML = '<div class="menu-item">Cargando...</div>';

    fetch("/api/albumes")
        .then(r => r.json())
        .then(data => {
            submenu.innerHTML = '';
            data.albumes.forEach(album => {
                const item = document.createElement('div');
                item.className = 'menu-item';
                item.innerHTML = `<i class="fa-solid fa-folder"></i> ${album}`;
                item.onclick = (e) => {
                    e.stopPropagation();
                    addToAlbum(album);
                    document.getElementById('contextMenu').style.display = 'none';
                };
                submenu.appendChild(item);
            });
        });
}

function addToAlbum(albumName) {
    if (!currentContextSong) return;

    fetch('/api/agregar_a_album', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            cancion: currentContextSong.filename,
            album: albumName
        })
    })
        .then(r => r.json())
        .then(data => {
            if (data.success) {
                showToast(`Añadida a ${albumName}`);
            } else {
                showToast(data.error, 'error');
            }
        });
}

// Bind delete action
document.addEventListener('DOMContentLoaded', () => {
    const deleteBtn = document.getElementById('ctxDelete');
    if (deleteBtn) {
        deleteBtn.onclick = () => {
            if (currentContextSong) {
                eliminarCancion(currentContextSong.filename);
                document.getElementById('contextMenu').style.display = 'none';
            }
        };
    }
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
function toggleSelection(filename, checkbox) {
    if (filename) {
        if (selectedSongs.has(filename)) {
            selectedSongs.delete(filename);
            if (checkbox) checkbox.closest('tr').classList.remove('selected-batch');
        } else {
            selectedSongs.add(filename);
            if (checkbox) checkbox.closest('tr').classList.add('selected-batch');
        }
    }
    updateBatchToolbar();
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
                <button onclick="batchAddToAlbum(prompt('Nombre del álbum:'))" class="action-btn-small" title="Añadir a Álbum"><i class="fa-solid fa-folder-plus"></i></button>
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

function batchAddToAlbum(albumName) {
    if (!albumName) return;
    if (selectedSongs.size === 0) return;

    showLoading();
    fetch('/api/batch/add_to_album', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            filenames: Array.from(selectedSongs),
            album: albumName
        })
    })
        .then(r => r.json())
        .then(data => {
            if (data.success) {
                showToast(data.message);
                selectedSongs.clear();
                updateBatchToolbar();
            } else {
                showToast(data.error, 'error');
            }
        })
        .finally(() => hideLoading());
}
