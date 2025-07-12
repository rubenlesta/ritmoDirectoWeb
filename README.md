# ritmoDirectoWeb
Paso a web de ritmoDirecto

#Convertidor_mp3
Convertidor de youtube a mp3 sin anuncios

Aplicación personal en Python para descargar música de YouTube como archivos MP3 y reproducirlos localmente en tu sistema.

---

## ✅ Requisitos

- **Python 3.12** (o superior recomendado)
- **pip**
- **ffmpeg** (instalado en el sistema)
- **mpg123** (para reproducir los mp3 en terminal)

---

## 🔧 Instalación

1. **Clona el repositorio**

```bash
git clone https://github.com/rubenlesta/convertidor_mp3.git
cd convertidor_mp3

---

2. Crea un entorno virtual

python3 -m venv yt-env
source yt-env/bin/activate

---

3. Instala dependencias

pip install -r requirements.txt

---

4. Exporta cookies

Usa la extensión Get cookies.txt en tu navegador.
Accede a YouTube logueado y guarda las cookies en formato Netscape como cookies.txt.
Mueve cookies.txt a la carpeta anterior a la raiz de este proyecto.

---

5. Como descargar desde Makefile

Tienes 3 opciones:

Url -> make song https://www.youtube.com/watch?v=abc123
Titulo -> make tema "Bohemian Rhapsody Queen"
Archivo con varias urls -> make music urls.txt

---

6. Como reproducir musica desde terminal

sudo apt install mpg123
mpg123 cancion.mp3

La musica se descargara por defecto en ../mp3, para cambiar, se cambia en convertidor.py

Si no quieres usar mpg123 siempre, haz:

nano ~/.bashrc 

Al final de todo mete la linea:

alias play=mpg123
Ctrl + X
S
source ~/.bashrc

Ahora en vez de poner mpg123, usas play:

play cancion.mp3

---

7. Disfruta

Nada mas por ahora
