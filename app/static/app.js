/**
 * Ritmo Directo - Frontend Logic
 * Supports Auth, CD Preparation, Client Downloads, and Responsive Player
 */

// --- Global State ---
let cancionSeleccionada = null;
let cancionesAlbum = [];
let indiceActual = 0;
let modoAleatorio = true;
let albumActual = "Home";
let colaReproduccion = [];
let currentContextSong = null;
let selectedSongs = new Set();
let currentUser = null;

// --- Initialization ---
window.onload = () => {
    checkAuth();

    // Global Click Listener for Context Menu
    document.addEventListener('click', (e) => {
        const menu = document.getElementById('contextMenu');
        const userMenu = document.getElementById('userMenu');
        if (menu && menu.style.display === 'block') menu.style.display = 'none';
        if (userMenu && userMenu.style.display === 'block' && !e.target.closest('.user-profile')) {
            userMenu.style.display = 'none';
        }
    });

    // MP3 Upload Handler
    const mp3Input = document.getElementById('mp3UploadInput');
    if (mp3Input) mp3Input.addEventListener('change', handleFileUpload);
};

// --- Authentication ---
// --- Authentication ---

function checkAuth() {
    fetch('/api/current_user')
        .then(res => res.json())
        .then(data => {
            if (data.is_authenticated) {
                currentUser = data;
                document.getElementById('displayUsername').textContent = data.username;
                document.getElementById('authModal').style.display = 'none';
                document.querySelector('.app-container').classList.remove('blur');
                applyTheme(data.theme);
                initApp();
            } else {
                showAuthModal();
            }
        })
        .catch(() => showAuthModal());
}

function showAuthModal() {
    document.getElementById('authModal').style.display = 'flex';
    document.querySelector('.app-container').classList.add('blur');
    // Ensure form is reset
    document.getElementById('authForm').reset();
    isLoginMode = true;
    updateAuthUI();
}

function togglePasswordVisibility() {
    const input = document.getElementById('password');
    const icon = document.getElementById('togglePassword');

    if (input.type === "password") {
        input.type = "text";
        icon.classList.remove("fa-eye");
        icon.classList.add("fa-eye-slash");
    } else {
        input.type = "password";
        icon.classList.remove("fa-eye-slash");
        icon.classList.add("fa-eye");
    }
}

function switchAuthMode() {
    isLoginMode = !isLoginMode;
    updateAuthUI();
}

function updateAuthUI() {
    document.getElementById('authTitle').textContent = isLoginMode ? "Iniciar Sesión" : "Registrarse";
    document.getElementById('authSwitch').innerHTML = isLoginMode
        ? '¿No tienes cuenta? <a href="#" onclick="switchAuthMode()">Regístrate</a>'
        : '¿Ya tienes cuenta? <a href="#" onclick="switchAuthMode()">Inicia Sesión</a>';
}

function handleAuth(event) {
    if (event) event.preventDefault();

    const username = document.getElementById('username').value;
    const pass = document.getElementById('password').value;
    const endpoint = isLoginMode ? '/login' : '/register';

    console.log(`Attempting ${isLoginMode ? 'Login' : 'Register'} for ${username}`);

    fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password: pass })
    })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                console.log("Login success, checking verification...");

                // Verify session immediately
                fetch('/api/current_user')
                    .then(r => r.json())
                    .then(user => {
                        console.log("Session Check Result:", user);
                        if (user.is_authenticated) {
                            // Session is valid, reloading
                            window.location.reload();
                        } else {
                            alert("Error CRÍTICO: El servidor aceptó la contraseña, pero no guardó la sesión. \nPosible causa: Cookies bloqueadas por el navegador o configuración de privacidad.");
                        }
                    });
            } else {
                alert(data.error || "Error de autenticación");
                showToast(data.error || "Error de autenticación", 'error');
            }
        })
        .catch(err => {
            console.error("Auth Error:", err);
            alert("Error de conexión con el servidor");
        });
}

function logout() {
    fetch('/logout').then(() => {
        window.location.reload();
    });
}

function toggleUserMenu() {
    const menu = document.getElementById('userMenu');
    menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
}

// --- Theme Management ---
function openThemeModal() {
    document.getElementById('themeModal').style.display = 'flex';
}
function closeThemeModal() {
    document.getElementById('themeModal').style.display = 'none';
}
function previewTheme(color) {
    document.documentElement.style.setProperty('--primary-color', color);
}
function saveTheme() {
    const color = document.getElementById('themeColorPicker').value;
    fetch('/api/update_theme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: color })
    }).then(() => {
        applyTheme(color);
        closeThemeModal();
        showToast("Tema guardado");
    });
}
function applyTheme(color) {
    if (color && color !== 'default') {
        document.documentElement.style.setProperty('--primary-color', color);
    }
}

// --- Navigation & Data Loading ---
function cargarAlbumes() {
    fetch("/api/albumes")
        .then(res => res.json())
        .then(data => {
            renderAlbumList(data.albumes || []);
        });
}

function renderAlbumList(albums) {
    const lista = document.getElementById("listaAlbumes");
    lista.innerHTML = "";

    // Always add Home first if not present (usually present)
    const homeBtn = document.createElement("button");
    homeBtn.className = `album-item ${albumActual === 'Home' ? 'active' : ''}`;
    homeBtn.innerHTML = `<i class="fa-solid fa-house"></i> Home`;
    homeBtn.onclick = () => cargarCancionesAlbum("Home");
    lista.appendChild(homeBtn);

    albums.forEach(album => {
        if (album === 'Home') return; // Skip Home duplicates
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

function cargarCancionesAlbum(album) {
    albumActual = album;
    // Update active state in sidebar
    document.querySelectorAll('.album-item').forEach(el => {
        const isHome = album === 'Home' && el.innerHTML.includes('Home');
        const isOther = el.textContent.trim() === album;
        el.classList.toggle('active', isHome || isOther);
    });

    const url = `/lista_canciones_album?album=${encodeURIComponent(album)}`;

    fetch(url)
        .then(res => res.json())
        .then(data => {
            cancionesAlbum = data.canciones || [];
            if (modoAleatorio) {
                // Should we shuffle initially? No, let's keep order but play random
            }
            renderSongs();
        })
        .catch(err => {
            console.error(err);
            if (err.status === 401) window.location.reload();
        });
}

function renderSongs() {
    const tbody = document.querySelector("#cancionesLista tbody");
    const emptyState = document.getElementById("emptyState");
    tbody.innerHTML = '';

    if (cancionesAlbum.length === 0) {
        emptyState.style.display = 'flex';
        // Hide master checkbox if empty
        const master = document.getElementById('selectAllCheckbox');
        if (master) master.checked = false;
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
        const isSelected = selectedSongs.has(cancion.filename);
        if (isSelected) row.classList.add('selected-batch');
        if (cancionSeleccionada && cancion.filename === cancionSeleccionada.filename) row.classList.add('playing');

        row.innerHTML = `
            <td>
                <label class="checkbox-wrapper-custom">
                    <input type="checkbox" ${isSelected ? 'checked' : ''} onclick="event.stopPropagation(); toggleSelection(${index}, this)">
                    <span class="custom-checkmark"></span>
                </label>
            </td>
            <td>${index + 1}</td>
            <td><div class="text-truncate">${cancion.titulo}</div></td>
            <td><div class="text-truncate">${cancion.artista || 'Desconocido'}</div></td>
            <td>${cancion.duracion}</td>
            <td>
                <div class="action-buttons">
                    <button class="action-btn-small" onclick="event.stopPropagation(); downloadFile('${cancion.filename}')" title="Descargar MP3">
                        <i class="fa-solid fa-download"></i>
                    </button>
                    <button class="action-btn-small" onclick="event.stopPropagation(); agregarColaDirecto(${index})" title="Agregar a cola">
                        <i class="fa-solid fa-plus"></i>
                    </button>
                    <button class="action-btn-small" onclick="showContextMenu(event, cancionesAlbum[${index}])" title="Más opciones">
                        <i class="fa-solid fa-ellipsis-vertical"></i>
                    </button>
                </div>
            </td>
        `;
        row.onclick = () => seleccionarCancion(cancion, index);
        tbody.appendChild(row);
    });
}

// --- Player Logic ---
function seleccionarCancion(cancion, index) {
    cancionSeleccionada = cancion;
    indiceActual = index;
    renderSongs(); // Update highlighting

    // Update footer info
    document.getElementById("cancionActual").textContent = cancion.titulo;
    document.getElementById("artistaActual").textContent = cancion.artista || "Desconocido";

    reproducirCancion();
}

function reproducirCancion() {
    if (!cancionSeleccionada) return;

    const audioPlayer = document.getElementById("audioPlayer");
    const playIcon = document.getElementById("playIcon");

    const src = `/reproducir?cancion=${encodeURIComponent(cancionSeleccionada.filename)}`;
    audioPlayer.src = src;

    audioPlayer.play().then(() => {
        playIcon.classList.remove("fa-play");
        playIcon.classList.add("fa-pause");
    }).catch(e => console.warn("Autoplay blocked", e));

    audioPlayer.ontimeupdate = updateProgress;
    audioPlayer.onended = onSongEnd;
}

function togglePlayPause() {
    const audioPlayer = document.getElementById("audioPlayer");
    const playIcon = document.getElementById("playIcon");

    if (audioPlayer.paused) {
        if (audioPlayer.src) {
            audioPlayer.play();
            playIcon.classList.remove("fa-play");
            playIcon.classList.add("fa-pause");
        } else if (cancionSeleccionada) {
            reproducirCancion();
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
    const percent = event.offsetX / wrapper.clientWidth;
    audioPlayer.currentTime = percent * audioPlayer.duration;
}

function onSongEnd() {
    if (cancionSeleccionada) {
        fetch('/api/record_play', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: cancionSeleccionada.filename })
        });
    }

    if (modoAleatorio) {
        if (cancionesAlbum.length > 0) {
            const nextIndex = Math.floor(Math.random() * cancionesAlbum.length);
            seleccionarCancion(cancionesAlbum[nextIndex], nextIndex);
        }
    } else {
        reproducirSiguienteCancion();
    }
}

function reproducirSiguienteCancion() {
    if (colaReproduccion.length > 0) {
        try {
            const next = colaReproduccion.shift();
            renderQueue();
            seleccionarCancion(next, -1); // -1 index implies not necessarily in current list context
        } catch (e) { console.error(e) }
        return;
    }
    const nextIndex = (indiceActual + 1) % cancionesAlbum.length;
    seleccionarCancion(cancionesAlbum[nextIndex], nextIndex);
}

function reiniciarCancion() {
    document.getElementById("audioPlayer").currentTime = 0;
}

function cambiarModo() {
    modoAleatorio = !modoAleatorio;
    document.getElementById("modoReproduccion").classList.toggle('active', modoAleatorio);
    showToast(modoAleatorio ? "Aleatorio" : "Secuencial");
}

// --- Download & CD Features ---

function descargar() {
    const entrada = document.getElementById("urlInput").value.trim();
    if (!entrada) return showToast("Introduce una URL", "error");

    showLoading(true, "Descargando...");

    // Simulate progress bar movement for UX since backend is sync for now
    let fakeProgress = 0;
    const progressBar = document.getElementById('loading-bar-progress');
    const interval = setInterval(() => {
        fakeProgress += 5;
        if (fakeProgress > 90) fakeProgress = 90;
        if (progressBar) progressBar.style.width = fakeProgress + "%";
    }, 500);

    fetch(`/descargar?entrada=${encodeURIComponent(entrada)}`)
        .then(res => res.json())
        .then(data => {
            clearInterval(interval);
            if (data.success) {
                if (progressBar) progressBar.style.width = "100%";
                showToast(data.message, data.exists ? 'info' : 'success');
                // Auto add to list if we are in Home
                if (albumActual === 'Home') cargarCancionesAlbum("Home");
            } else {
                showToast(data.error, 'error');
            }
        })
        .catch(err => showToast("Error de conexión", "error"))
        .finally(() => {
            setTimeout(() => showLoading(false), 1000);
        });
}

function downloadFile(filename) {
    // Client-side download
    const link = document.createElement('a');
    link.href = `/api/download_file/${encodeURIComponent(filename)}`;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function prepareCD() {
    if (selectedSongs.size === 0) return showToast("Selecciona canciones primero", "warning");

    showLoading(true, "Preparando CD (ZIP)...");

    fetch('/api/prepare_cd', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filenames: Array.from(selectedSongs) })
    })
        .then(res => {
            if (res.ok) return res.blob();
            throw new Error('Error al generar ZIP');
        })
        .then(blob => {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = "CD_Compilation.zip";
            document.body.appendChild(a);
            a.click();
            a.remove();
            showToast("CD preparado. Descarga iniciada.");
        })
        .catch(err => showToast("Error preparando CD", "error"))
        .finally(() => showLoading(false));
}

// --- Batch & Context ---

function toggleSelectAll(checkbox) {
    if (checkbox.checked) {
        cancionesAlbum.forEach(c => selectedSongs.add(c.filename));
    } else {
        selectedSongs.clear();
    }
    renderSongs();
    updateBatchToolbar();
}

function toggleSelection(index, checkbox) {
    const song = cancionesAlbum[index];
    if (selectedSongs.has(song.filename)) {
        selectedSongs.delete(song.filename);
    } else {
        selectedSongs.add(song.filename);
    }
    checkbox.closest('tr').classList.toggle('selected-batch');
    updateBatchToolbar();
}

function updateBatchToolbar() {
    let toolbar = document.getElementById('batchToolbar');
    if (!toolbar) {
        toolbar = document.createElement('div');
        toolbar.id = 'batchToolbar';
        toolbar.className = 'batch-toolbar';
        toolbar.innerHTML = `
            <span id="selectedCount">0 seleccionadas</span>
            <div class="batch-actions">
                <button onclick="batchAddToAlbum(prompt('Nombre del álbum:'))"><i class="fa-solid fa-folder-plus"></i> Añadir a álbum</button>
                <button onclick="batchDelete()" class="danger"><i class="fa-solid fa-trash"></i> Eliminar</button>
            </div>
        `;
        document.body.appendChild(toolbar);
    }
    const count = selectedSongs.size;
    document.getElementById('selectedCount').textContent = `${count} seleccionadas`;
    toolbar.classList.toggle('visible', count > 0);
}

function batchDelete() {
    if (!confirm(`¿Eliminar ${selectedSongs.size} canciones?`)) return;

    fetch('/api/batch/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filenames: Array.from(selectedSongs), album: albumActual })
    }).then(res => res.json()).then(data => {
        if (data.success) {
            showToast(data.message);
            selectedSongs.clear();
            cargarCancionesAlbum(albumActual);
            updateBatchToolbar();
        }
    });
}

function batchAddToAlbum(name) {
    if (!name) return;
    fetch('/api/batch/add_to_album', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filenames: Array.from(selectedSongs), album: name })
    }).then(res => res.json()).then(data => {
        showToast(data.success ? data.message : data.error);
        if (data.success) updateBatchToolbar();
    });
}

function showContextMenu(e, song) {
    e.stopPropagation();
    currentContextSong = song;
    const menu = document.getElementById('contextMenu');
    menu.style.display = 'block';
    menu.style.left = `${e.clientX}px`;
    menu.style.top = `${e.clientY}px`;

    // Load albums for submenu
    const submenu = document.getElementById('albumSubmenu');
    submenu.innerHTML = "Cargando...";
    fetch('/api/albumes').then(r => r.json()).then(d => {
        submenu.innerHTML = '';
        d.albumes.forEach(a => {
            const item = document.createElement('div');
            item.className = 'menu-item';
            item.innerHTML = `<i class="fa-solid fa-folder"></i> ${a}`;
            item.onclick = (ev) => {
                ev.stopPropagation();
                addToAlbum(a);
                menu.style.display = 'none';
            };
            submenu.appendChild(item);
        });
    });

    // Bind single delete
    document.getElementById('ctxDelete').onclick = () => {
        if (confirm("¿Eliminar canción?")) {
            eliminarCancion(song.filename);
            menu.style.display = 'none';
        }
    };
}

function addToAlbum(album) {
    if (!currentContextSong) return;
    fetch('/api/agregar_a_album', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cancion: currentContextSong.filename, album })
    }).then(r => r.json()).then(d => showToast(d.success ? "Añadido" : d.error));
}

function eliminarCancion(filename) {
    fetch(`/eliminar?cancion=${encodeURIComponent(filename)}&album=${encodeURIComponent(albumActual)}`)
        .then(r => r.json())
        .then(d => {
            if (d.success) {
                showToast("Eliminada");
                cargarCancionesAlbum(albumActual);
            } else {
                showToast(d.error, 'error');
            }
        });
}

// --- Utils ---
function showLoading(show, text = "Cargando...") {
    const container = document.getElementById('loading-bar-container');
    const txt = document.getElementById('loading-text');
    const bar = document.getElementById('loading-bar-progress');

    if (show) {
        container.style.display = 'block';
        if (txt) txt.textContent = text;
        if (bar) bar.style.width = '0%';
    } else {
        container.style.display = 'none';
        if (bar) bar.style.width = '0%';
    }
}

function showToast(msg, type = 'info') {
    const c = document.getElementById('toast-container');
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.textContent = msg;
    c.appendChild(t);
    setTimeout(() => { t.style.opacity = 0; setTimeout(() => t.remove(), 300); }, 3000);
}

function formatTime(s) {
    if (isNaN(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
}

function buscar() {
    const val = document.getElementById('busquedaInput').value.toLowerCase();
    document.querySelectorAll("tbody tr").forEach(row => {
        row.style.display = row.innerText.toLowerCase().includes(val) ? "" : "none";
    });
}

function triggerUpload() { document.getElementById('mp3UploadInput').click(); }
function agregarColaDirecto(i) {
    colaReproduccion.push(cancionesAlbum[i]);
    showToast("Añadida a la cola");
    renderQueue();
}
function renderQueue() {
    const ql = document.getElementById('queueList');
    ql.innerHTML = '';
    colaReproduccion.forEach((c, i) => {
        const item = document.createElement('div');
        item.className = 'queue-item';
        item.textContent = c.titulo;
        item.onclick = () => { colaReproduccion.splice(i, 1); renderQueue(); };
        ql.appendChild(item);
    });
}
function toggleQueue() { document.getElementById('queueSidebar').classList.toggle('open'); }
