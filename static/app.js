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
        lista.innerHTML = ""; // Limpiar la lista de álbumes
        data.albumes.forEach(album => {
          const boton = document.createElement("button");
          boton.classList.add("btn", "gris"); // Clase CSS para el estilo gris
          boton.textContent = album;
          boton.onclick = () => cargarCancionesAlbum(album); // Aquí se añade el onclick dinámico
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

    if (album === "Sin clasificar") {
        fetch(`/lista_canciones_sin_album`)
            .then(res => res.json())
            .then(data => {
                cancionesAlbum = data.canciones;
                indiceActual = 0;
                mostrarCancionesAlbum();
            });
            
    } else {
        fetch(`/lista_canciones_album?album=${album}`)
            .then(res => res.json())
            .then(data => {
                cancionesAlbum = data.canciones;
                indiceActual = 0;
                mostrarCancionesAlbum();
            });
    }
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

        row.onclick = () => {
            seleccionarCancion(row, cancion);
        };
    });
}

function reproducirCancionAlbum() {
    if (cancionesAlbum.length === 0) return;
  
    let cancion;
    if (modoAleatorio) {
      const indiceRandom = Math.floor(Math.random() * cancionesAlbum.length);
      cancion = cancionesAlbum[indiceRandom];
    } else {
      cancion = cancionesAlbum[indiceActual];
    }
  
    const audioPlayer = document.getElementById("audioPlayer");
    const audioSource = document.getElementById("audioSource");
    audioSource.src = `/reproducir_album?album=${albumActual}&cancion=${encodeURIComponent(cancion.cancion)}`;
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
    if (modoAleatorio) {
        modoBtn.textContent = "🔀";
    } else {
        modoBtn.textContent = "➡️";
    }
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
                actualizarLista(); // Actualizar la lista de canciones
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

    // 🔥 NO pausamos el audio aquí. Solo cambiamos la selección.
    cancionSeleccionada = cancion;
}

function reproducirCancion() {
    const audioPlayer = document.getElementById("audioPlayer");
    const audioSource = document.getElementById("audioSource");
    const botonPlayPause = document.querySelector(".player-controls button:nth-child(2)");

    if (!cancionSeleccionada) {
        alert("Selecciona una canción para reproducir.");
        return;
    }

    let nombreArchivo;
    if (cancionSeleccionada.artista) {
        nombreArchivo = `${cancionSeleccionada.artista}-${cancionSeleccionada.cancion}`;
    } else {
        nombreArchivo = cancionSeleccionada.cancion;
    }

    audioSource.src = `/reproducir?cancion=${encodeURIComponent(nombreArchivo)}&album=${encodeURIComponent(albumActual)}`;

    if (audioPlayer.src) {
        audioPlayer.pause();
    }

    audioPlayer.load();

    audioPlayer.play().catch(error => {
        console.warn("⚠ Error al reproducir:", error);
    });

    // 🔥 Cambia el botón a ⏸️ al empezar la reproducción
    botonPlayPause.textContent = "⏸️";

    document.getElementById("cancionActual").textContent =
        (cancionSeleccionada.artista ? cancionSeleccionada.artista + "-" : "") +
        cancionSeleccionada.cancion;

    audioPlayer.ontimeupdate = () => {
        const current = audioPlayer.currentTime;
        const duration = audioPlayer.duration;

        document.getElementById("currentTime").textContent = formatTime(current);
        document.getElementById("duration").textContent = formatTime(duration);

        const progressPercent = (current / duration) * 100;
        document.getElementById("progress").style.width = progressPercent + "%";
    };

    audioPlayer.onended = () => {
        if (modoAleatorio) {
            let randomIndex;
            do {
                randomIndex = Math.floor(Math.random() * cancionesAlbum.length);
            } while (cancionesAlbum.length > 1 && cancionesAlbum[randomIndex].cancion === cancionSeleccionada.cancion);

            const siguienteCancion = cancionesAlbum[randomIndex];
            const rows = document.getElementById("cancionesLista").getElementsByTagName("tbody")[0].rows;
            if (rows[randomIndex]) {
                seleccionarCancion(rows[randomIndex], siguienteCancion);
            }
            reproducirCancion();
        } else {
            const index = cancionesAlbum.findIndex(c =>
                c.cancion === cancionSeleccionada.cancion &&
                c.artista === cancionSeleccionada.artista
            );

            let siguienteIndex = index + 1;
            if (siguienteIndex >= cancionesAlbum.length) {
                siguienteIndex = 0; // loop al inicio
            }

            const siguienteCancion = cancionesAlbum[siguienteIndex];
            const rows = document.getElementById("cancionesLista").getElementsByTagName("tbody")[0].rows;
            if (rows[siguienteIndex]) {
                seleccionarCancion(rows[siguienteIndex], siguienteCancion);
            }
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
        // 🔥 Si hay canciones en cola, reproduce la primera
        const siguienteCancion = colaReproduccion.shift();

        const rows = document.getElementById("cancionesLista").getElementsByTagName("tbody")[0].rows;
        const index = cancionesAlbum.findIndex(c =>
            c.cancion === cancionSeleccionada.cancion &&
            c.artista === cancionSeleccionada.artista
        );
        
        if (index === -1) {
            console.error("❌ Error: canción seleccionada no encontrada en cancionesAlbum.");
            return;
        }

        if (rows[index]) {
            seleccionarCancion(rows[index], siguienteCancion);
        }

        reproducirCancion();
        return;
    }

    // 🔄 Comportamiento normal (modo aleatorio o normal)
    if (modoAleatorio) {
        let randomIndex;
        do {
            randomIndex = Math.floor(Math.random() * cancionesAlbum.length);
        } while (cancionesAlbum.length > 1 && cancionesAlbum[randomIndex].cancion === cancionSeleccionada.cancion);

        const siguienteCancion = cancionesAlbum[randomIndex];
        const rows = document.getElementById("cancionesLista").getElementsByTagName("tbody")[0].rows;
        if (rows[randomIndex]) {
            seleccionarCancion(rows[randomIndex], siguienteCancion);
        }
        reproducirCancion();
    } else {
        const index = cancionesAlbum.findIndex(c =>
            c.cancion === cancionSeleccionada.cancion &&
            c.artista === cancionSeleccionada.artista
        );

        let siguienteIndex = index + 1;
        if (siguienteIndex >= cancionesAlbum.length) {
            siguienteIndex = 0;
        }

        const siguienteCancion = cancionesAlbum[siguienteIndex];
        const rows = document.getElementById("cancionesLista").getElementsByTagName("tbody")[0].rows;
        if (rows[siguienteIndex]) {
            seleccionarCancion(rows[siguienteIndex], siguienteCancion);
        }
        reproducirCancion();
    }
}

function eliminarCancion() {
    if (cancionSeleccionada) {
        fetch(`/eliminar?cancion=${encodeURIComponent(cancionSeleccionada.cancion)}`)
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    alert("Canción eliminada.");
                    actualizarLista(); // Actualizar la lista de canciones
                } else {
                    alert("Error al eliminar la canción.");
                }
            });
    } else {
        alert("Selecciona una canción para eliminar.");
    }
}

function actualizarLista() {
    fetch("/lista_canciones")
        .then(response => response.json())
        .then(data => {
            const tbody = document.getElementById("cancionesLista").getElementsByTagName("tbody")[0];
            tbody.innerHTML = ''; // Limpiar la lista
            data.canciones.forEach(cancion => {
                const row = tbody.insertRow();
                const cell1 = row.insertCell(0);
                const cell2 = row.insertCell(1);
                const cell3 = row.insertCell(2);
                cell1.textContent = cancion.artista;
                cell2.textContent = cancion.cancion;
                cell3.textContent = cancion.duracion;

                row.addEventListener('click', () => seleccionarCancion(row, cancion));
            });
        });
}

function buscarCanciones() {
    const query = document.getElementById("busquedaInput").value.toLowerCase();
    const rows = document.getElementById("cancionesLista").getElementsByTagName("tbody")[0].getElementsByTagName("tr");
    Array.from(rows).forEach(row => {
        const artista = row.cells[0].textContent.toLowerCase();
        const cancion = row.cells[1].textContent.toLowerCase();
        row.style.display = artista.includes(query) || cancion.includes(query) ? "" : "none";
    });
}

function reiniciarCancion() {
    const audioPlayer = document.getElementById("audioPlayer");
    audioPlayer.currentTime = 0;
    audioPlayer.play();
}

function añadirSeleccionadaACola() {
    if (!cancionSeleccionada) {
        alert("❌ No hay ninguna canción seleccionada.");
        return;
    }
    colaReproduccion.push(cancionSeleccionada);
    alert(`✅ Tu canción "${(cancionSeleccionada.artista ? cancionSeleccionada.artista + " - " : "")}${cancionSeleccionada.cancion}" se ha añadido a la cola.`);
}

function mostrarCola() {
    if (colaReproduccion.length === 0) {
        alert("La cola de reproducción está vacía.");
        return;
    }

    let mensaje = "🎶 Cola de reproducción:\n\n";
    colaReproduccion.forEach((cancion, index) => {
        mensaje += `${index + 1}. ${(cancion.artista ? cancion.artista + " - " : "")}${cancion.cancion}\n`;
    });

    alert(mensaje);
}


document.getElementById("reproducirBtn").classList.add("azul");
document.getElementById("eliminarBtn").classList.add("rojo");

window.onload = () => {
    cargarAlbumes();
    albumActual = 'Sin clasificar';
    cargarCancionesAlbum(albumActual);

    // Inicializa botón de modo de reproducción
    const modoBtn = document.getElementById("modoReproduccion");
    if (modoBtn) {
        modoBtn.textContent = "🔀 Modo: Aleatorio";
    }

    // Añadir listener para el input de archivo .txt (álbum)
    const archivoInput = document.getElementById("archivoTxt");
    if (archivoInput) {
        archivoInput.addEventListener("change", function () {
            const archivo = this.files[0];
            if (!archivo) return;

            const formData = new FormData();
            formData.append("archivoTxt", archivo);

            fetch("/subir_txt_album", {
                method: "POST",
                body: formData
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    alert("✅ Álbum creado desde el archivo.");
                    cargarAlbumes();
                } else {
                    alert("❌ Error: " + data.error);
                }
            })
            .catch(err => {
                alert("❌ Error al subir el archivo.");
                console.error(err);
            });
        });
    }
};
