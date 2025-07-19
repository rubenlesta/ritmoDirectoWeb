let cancionSeleccionada = null;
let cancionesAlbum = [];
let indiceActual = 0;
let modoAleatorio = true;
let albumActual = "";
let ordenAscendente = true;
let colaReproduccion = [];

function formatTime(time) {
    if (isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    let seconds = Math.floor(time % 60);
    if (seconds < 10) seconds = "0" + seconds;
    return `${minutes}:${seconds}`;
}

function cargarAlbumes() {
    fetch("/albumes")
      .then(res => res.json())
      .then(data => {
        const lista = document.getElementById("listaAlbumes");
        lista.innerHTML = "";
        data.albumes.forEach(album => {
          const boton = document.createElement("button");
          boton.classList.add("btn", "gris");
          boton.textContent = album;
          boton.onclick = () => cargarCancionesAlbum(album);
          lista.appendChild(boton);
        });
      })
      .catch(error => console.error("Error al cargar los álbumes:", error));
}

function crearAlbum() {
    const nombre = prompt("Introduce el nombre del nuevo álbum:");
    if (!nombre) return;
  
    fetch("/crear_album", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({nombre})
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) cargarAlbumes();
      else alert("Error al crear álbum: " + data.error);
    });
}

function cargarCancionesAlbum(album) {
    albumActual = album;
    document.getElementById("busquedaInput").placeholder = `Buscar canción en "${albumActual}"`;

    const url = album === "Sin clasificar" ? "/lista_canciones_sin_album" : `/lista_canciones_album?album=${encodeURIComponent(album)}`;
    
    fetch(url)
        .then(res => res.json())
        .then(data => {
            cancionesAlbum = data.canciones || [];
            indiceActual = 0;
            mostrarCancionesAlbum();
            cancionSeleccionada = null;  // limpiar selección al cambiar álbum
        })
        .catch(err => {
            console.error("Error al cargar canciones:", err);
            cancionesAlbum = [];
            mostrarCancionesAlbum();
        });
}

function mostrarCancionesAlbum() {
    const tbody = document.getElementById("cancionesLista").getElementsByTagName("tbody")[0];
    tbody.innerHTML = '';
    cancionesAlbum.forEach(cancion => {
        const row = tbody.insertRow();
        const cell1 = row.insertCell(0); // Artista
        const cell2 = row.insertCell(1); // Canción
        const cell3 = row.insertCell(2); // Duración
        cell1.textContent = cancion.artista;
        cell2.textContent = cancion.cancion;
        cell3.textContent = cancion.duracion;

        row.onclick = () => seleccionarCancion(row, cancion);
    });
}

function reproducirCancionAlbum() {
    if (cancionesAlbum.length === 0) return;

    let cancion;
    if (modoAleatorio) {
        indiceActual = Math.floor(Math.random() * cancionesAlbum.length);
        cancion = cancionesAlbum[indiceActual];
    } else {
        cancion = cancionesAlbum[indiceActual];
    }

    const audioPlayer = document.getElementById("audioPlayer");
    const audioSource = document.getElementById("audioSource");
    audioSource.src = `/reproducir_album?album=${encodeURIComponent(albumActual)}&cancion=${encodeURIComponent(cancion.cancion)}`;
    audioPlayer.load();
    audioPlayer.play();

    audioPlayer.onended = () => {
        if (!modoAleatorio) {
            indiceActual = (indiceActual + 1) % cancionesAlbum.length;
        } else {
            indiceActual = Math.floor(Math.random() * cancionesAlbum.length);
        }
        const siguienteCancion = cancionesAlbum[indiceActual];
        const rows = document.getElementById("cancionesLista").getElementsByTagName("tbody")[0].rows;
        if (rows[indiceActual]) {
            seleccionarCancion(rows[indiceActual], siguienteCancion);
        }
        reproducirCancionAlbum();
    };
}

function cambiarModo() {
    modoAleatorio = !modoAleatorio;
    const modoBtn = document.getElementById("modoReproduccion");
    modoBtn.textContent = modoAleatorio ? "🔀" : "➡️";
}

function descargar() {
    const entrada = document.getElementById("urlInput").value.trim();
    if (!entrada) {
        alert("Por favor introduce una URL o título.");
        return;
    }

    document.getElementById("estado").innerText = "⏳ Descargando...";

    fetch(`/descargar?entrada=${encodeURIComponent(entrada)}`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                document.getElementById("estado").innerText = "✅ Descarga completada.";
                actualizarLista();
                cargarAlbumes();
            } else {
                document.getElementById("estado").innerText = "❌ Error en la descarga.";
            }
        })
        .catch(error => {
            document.getElementById("estado").innerText = "❌ Error en la descarga.";
            console.error("Error:", error);
        });
}

function seleccionarCancion(row, cancion) {
    const rows = document.getElementById("cancionesLista").getElementsByTagName("tr");
    Array.from(rows).forEach(r => r.classList.remove('selected'));
    row.classList.add('selected');

    const reproducirBtn = document.getElementById("reproducirBtn");
    reproducirBtn.textContent = "▶️";

    cancionSeleccionada = cancion;
}

function reproducirCancion() {
    if (!cancionSeleccionada) {
        alert("Selecciona una canción para reproducir.");
        return;
    }

    const audioPlayer = document.getElementById("audioPlayer");
    const audioSource = document.getElementById("audioSource");
    const botonPlayPause = document.querySelector(".player-controls button:nth-child(2)");
    console.log("Cancion seleccionada:", cancionSeleccionada);

    let nombreArchivo = cancionSeleccionada.artista
        ? `${cancionSeleccionada.artista} - ${cancionSeleccionada.cancion}.mp3`
        : `${cancionSeleccionada.artista}.mp3`;

    audioSource.src = `/reproducir?cancion=${encodeURIComponent(nombreArchivo)}&album=${encodeURIComponent(albumActual)}`;

    audioPlayer.load();

    audioPlayer.play().catch(error => {
        console.warn("⚠ Error al reproducir:", error);
    });

    botonPlayPause.textContent = "⏸️";

    document.getElementById("cancionActual").textContent =
        (cancionSeleccionada.artista ? cancionSeleccionada.artista + "-" : "") +
        cancionSeleccionada.cancion;

    audioPlayer.ontimeupdate = () => {
        const current = audioPlayer.currentTime;
        const duration = audioPlayer.duration;

        document.getElementById("currentTime").textContent = formatTime(current);
        document.getElementById("duration").textContent = formatTime(duration);

        const progressPercent = duration ? (current / duration) * 100 : 0;
        document.getElementById("progress").style.width = progressPercent + "%";
    };

    audioPlayer.onended = () => {
        if (modoAleatorio) {
            if (cancionesAlbum.length === 0) return;

            let randomIndex;
            do {
                randomIndex = Math.floor(Math.random() * cancionesAlbum.length);
            } while (cancionesAlbum.length > 1 && cancionesAlbum[randomIndex].cancion === cancionSeleccionada.cancion);

            const siguienteCancion = cancionesAlbum[randomIndex];
            const rows = document.getElementById("cancionesLista").getElementsByTagName("tbody")[0].rows;
            if (rows[randomIndex]) seleccionarCancion(rows[randomIndex], siguienteCancion);
            reproducirCancion();
        } else {
            const index = cancionesAlbum.findIndex(c =>
                c.cancion === cancionSeleccionada.cancion &&
                c.artista === cancionSeleccionada.artista
            );
            if (index === -1) return;

            let siguienteIndex = (index + 1) % cancionesAlbum.length;
            const siguienteCancion = cancionesAlbum[siguienteIndex];
            const rows = document.getElementById("cancionesLista").getElementsByTagName("tbody")[0].rows;
            if (rows[siguienteIndex]) seleccionarCancion(rows[siguienteIndex], siguienteCancion);
            reproducirCancion();
        }
    };
}

function togglePlayPause() {
    const audioPlayer = document.getElementById("audioPlayer");
    const boton = document.querySelector(".player-controls button:nth-child(2)");

    if (audioPlayer.paused) {
        audioPlayer.play();
        boton.textContent = "⏸️";
    } else {
        audioPlayer.pause();
        boton.textContent = "▶️";
    }
}

function reproducirSiguienteCancion() {
    if (colaReproduccion.length > 0) {
        const siguienteCancion = colaReproduccion.shift();

        const rows = document.getElementById("cancionesLista").getElementsByTagName("tbody")[0].rows;
        const index = cancionesAlbum.findIndex(c =>
            c.cancion === siguienteCancion.cancion &&
            c.artista === siguienteCancion.artista
        );

        if (index === -1) {
            console.error("Canción en cola no encontrada en lista del álbum.");
            return;
        }

        if (rows[index]) seleccionarCancion(rows[index], siguienteCancion);
        reproducirCancion();
    } else {
        if (cancionesAlbum.length === 0) return;
        if (modoAleatorio) {
            let nuevoIndice;
            do {
                nuevoIndice = Math.floor(Math.random() * cancionesAlbum.length);
            } while (cancionesAlbum.length > 1 && nuevoIndice === indiceActual);
            indiceActual = nuevoIndice;
        } else {
            indiceActual = (indiceActual + 1) % cancionesAlbum.length;
        }
        const siguienteCancion = cancionesAlbum[indiceActual];
        const rows = document.getElementById("cancionesLista").getElementsByTagName("tbody")[0].rows;
        if (rows[indiceActual]) seleccionarCancion(rows[indiceActual], siguienteCancion);
        reproducirCancion();
    }
}

function eliminarCancion() {
    if (!cancionSeleccionada) {
        alert("Selecciona una canción para eliminar.");
        return;
    }

    if (!confirm(`¿Eliminar "${cancionSeleccionada.cancion}"?`)) return;

    fetch(`/eliminar?cancion=${encodeURIComponent(cancionSeleccionada.cancion)}`)
        .then(res => res.json())
        .then(data => {
            if (data.success) actualizarLista();
            else alert("Error al eliminar la canción.");
        });
}

function actualizarLista() {
    cargarCancionesAlbum(albumActual || "Sin clasificar");
}

function buscar() {
    const texto = document.getElementById("busquedaInput").value.toLowerCase();
    const rows = document.getElementById("cancionesLista").getElementsByTagName("tbody")[0].rows;

    Array.from(rows).forEach(row => {
        const cancion = row.cells[1].textContent.toLowerCase();
        row.style.display = cancion.includes(texto) ? "" : "none";
    });
}

function reiniciarCancion() {
    const audioPlayer = document.getElementById("audioPlayer");
    audioPlayer.currentTime = 0;
}

function agregarCola() {
    if (!cancionSeleccionada) {
        alert("Selecciona una canción para agregar a la cola.");
        return;
    }

    colaReproduccion.push(cancionSeleccionada);
    alert(`Se agregó "${cancionSeleccionada.cancion}" a la cola de reproducción.`);
}

function mostrarCola() {
    if (colaReproduccion.length === 0) {
        alert("La cola de reproducción está vacía.");
        return;
    }
    alert("Cola de reproducción:\n" + colaReproduccion.map(c => c.cancion).join("\n"));
}

window.onload = () => {
    cargarAlbumes();
    cargarCancionesAlbum("Sin clasificar");

    const inputFile = document.getElementById("inputFile");
    if (inputFile) {
        inputFile.addEventListener("change", () => {
            const archivo = inputFile.files[0];
            if (archivo) {
                const reader = new FileReader();
                reader.onload = e => {
                    fetch("/crear_album", {
                        method: "POST",
                        headers: {"Content-Type": "application/json"},
                        body: JSON.stringify({contenido: e.target.result})
                    })
                    .then(res => res.json())
                    .then(data => {
                        if (data.success) cargarAlbumes();
                        else alert("Error al crear álbum desde archivo");
                    });
                };
                reader.readAsText(archivo);
            }
        });
    }

    const nombreInput = document.getElementById("nombre");
    if (nombreInput) {
        nombreInput.addEventListener("keydown", e => {
            if (e.key === "Enter") {
                e.preventDefault();
                document.getElementById("reproducirBtn").click();
            }
        });
    }
};
