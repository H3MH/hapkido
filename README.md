# Baby Shower · Eros Salvatore

Invitación web de confirmación de asistencia (RSVP) y mesa de regalos para el baby shower de Eros Salvatore. Es un sitio **estático** (HTML, CSS y JavaScript sin framework) pensado para desplegarse en Azure Static Web Apps. Cada invitado abre su enlace personal, ve su nombre y sus acompañantes permitidos, confirma asistencia y puede reservar un regalo de la lista.

## Tabla de contenido

- [Estructura del proyecto](#estructura-del-proyecto)
- [Cómo funciona](#cómo-funciona)
- [Configuración del evento](#configuración-del-evento)
- [Invitados](#invitados)
- [Mesa de regalos](#mesa-de-regalos)
- [Preview en WhatsApp](#preview-en-whatsapp)
- [Backend (Google Apps Script)](#backend-google-apps-script)
- [Desarrollo local](#desarrollo-local)
- [Despliegue](#despliegue)

## Estructura del proyecto

```
index.html                     Estructura de las 3 escenas + mesa de regalos + modal
assets/
  css/styles.css               Todos los estilos (escenas, RSVP, regalos, modal)
  js/
    config.js                  Datos editables: evento, URLs, flags
    app.js                     Lógica: invitado, RSVP, regalos, animaciones
    gsap-fallback.js           Respaldo si GSAP no carga
  data/
    invitados.json             Lista de invitados (editable a mano)
    regalos.json               Catálogo de regalos (editable a mano)
  svg/                         Ilustraciones papercraft de las escenas
  social/                      Imagen JPG usada por WhatsApp/Open Graph
google-apps-script/
  Code.gs                      Backend: guarda RSVP y reservas, devuelve conteos
```

## Cómo funciona

La invitación tiene tres escenas: un **sobre** que se abre al tocar el sello, un **libro pop-up** con el saludo personalizado, la información del evento, el formulario de RSVP y la mesa de regalos, y una escena final de **agradecimiento**.

El invitado se identifica por un token ofuscado en el parámetro `i` de la URL:

```
https://witty-stone-03a73a110.5.azurestaticapps.net/index.html?pv=20260625&i=NDU1MzQ2NTAyMw
```

`app.js` decodifica ese token y busca el teléfono resultante en `invitados.json`. Si lo encuentra, muestra el nombre y el máximo de acompañantes; si no, bloquea el formulario. El parámetro `telefono` en claro se mantiene solo como respaldo para pruebas. Sin parámetro, entra en modo **demo** (invitado de ejemplo) para previsualizar.

Como es un sitio estático, el navegador **no puede escribir** en los archivos JSON. Por eso las confirmaciones y las reservas se envían a un **Google Apps Script** que las guarda en una hoja de cálculo, y la confirmación local se recuerda en `localStorage` del invitado.

## Configuración del evento

Edita `assets/js/config.js`:

```js
const EVENT = {
  nombre: "Baby Shower de Eros Salvatore",
  diaSemana: "Miércoles",
  fecha: "12 de agosto de 2026",
  hora: "7:00 PM",
  lugar: "Salón / dirección del evento",   // ← pendiente: poner la dirección real
  mapsUrl: "https://maps.google.com/?q=...", // ← pendiente: poner el enlace real
};
```

> **Pendiente:** `lugar` y `mapsUrl` aún tienen valores de marcador de posición. Sustitúyelos por la dirección y el enlace de Google Maps reales del evento.

Otros flags en `config.js`:

- `APPS_SCRIPT_URL` — URL de la aplicación web de Apps Script (RSVP **y** regalos).
- `GIFTS_ENABLED` — pon `false` para ocultar toda la mesa de regalos.
- `INVITADOS_JSON_URL` / `REGALOS_JSON_URL` — rutas de los datos.

## Invitados

`assets/data/invitados.json`. La clave de cada entrada es el teléfono (el mismo que va en la URL):

```json
{
  "8090000000": {
    "nombre": "María González",
    "acompanantesPermitidos": 2,
    "yaConfirmo": false,
    "confirmacion": null
  }
}
```

- `acompanantesPermitidos` — número máximo de acompañantes (0 = va sola/o).
- `yaConfirmo` / `confirmacion` — se pueden precargar para mostrar a alguien como ya confirmado.

## Mesa de regalos

`assets/data/regalos.json` es el **catálogo** (se edita a mano). Cada regalo:

```json
{
  "id": "ikea-30221316",
  "nombre": "KRAMIG — Oso panda",
  "categoria": "Peluches",
  "descripcion": "Peluche panda blanco/negro, blandito...",
  "tienda": "IKEA",
  "url": "https://applink.ikea.com/...",
  "imagen": "https://www.ikea.com/.../kramig...s5.jpg",
  "icono": "🎁",
  "cantidadTotal": 2,
  "reservadosManual": 0
}
```

- `cantidadTotal` — **cuántas unidades del mismo regalo hay**. Si es 3, tres personas pueden reservar una unidad cada una. Al llegar al límite el regalo aparece como **"Completo ✓"** y deja de poder seleccionarse (sigue visible con su previsualización y su enlace).
- `imagen` — URL de la foto. Si está vacía o falla la carga, se muestra el `icono` (emoji) como respaldo.
- `icono` — emoji de respaldo cuando no hay imagen.
- `url` — enlace a la tienda (IKEA, Amazon, etc.).
- `reservadosManual` — **bloqueo manual**: súbelo para marcar unidades como reservadas sin pasar por la web (ver abajo).

### Cómo se calcula el bloqueo

Para cada regalo:

```
reservadas  = max(reservasEnElSheet, reservadosManual) + reservasDeEstaSesión
disponibles = cantidadTotal − reservadas
```

El **Google Sheet es la fuente de verdad** del bloqueo compartido entre todos los invitados (se lee al cargar la página). El campo `reservadosManual` del JSON es un **respaldo/override manual**: si el conteo del Sheet no está disponible, o si quieres bloquear un regalo a mano (porque alguien lo avisó por WhatsApp, por ejemplo), súbelo y se respetará.

### Estados de un regalo

- **Disponible** / **"X de N disponibles"** — se puede reservar.
- **"Lo reservaste tú ★"** — este invitado ya lo reservó (no puede repetirlo).
- **"Completo ✓"** — todas las unidades reservadas; queda visible pero no seleccionable.

### Añadir un regalo nuevo

Copia un bloque del array `regalos`, cambia `id` (único), `nombre`, `descripcion`, `url`, `imagen` y `cantidadTotal`. Para regalos de IKEA, la imagen oficial es la etiqueta `og:image` de la página del producto.

## Preview en WhatsApp

WhatsApp no espera a que se ejecute JavaScript, así que el preview sale de los metadatos estáticos del `<head>` de `index.html`. El sitio incluye etiquetas `og:*`, `twitter:*`, descripción, canonical e imagen social absoluta apuntando al dominio de Azure:

```
https://witty-stone-03a73a110.5.azurestaticapps.net/assets/social/whatsapp-preview-eros-2026.jpg?v=20260625
```

La imagen se genera en `assets/social/whatsapp-preview-eros-2026.jpg` con tamaño 1200×630, que es el formato recomendado para tarjetas grandes. Para regenerarla:

```powershell
.\scripts\generate_social_preview.ps1
```

Si WhatsApp ya cacheó un enlace antiguo sin imagen, vuelve a generar los links con un parámetro de versión en la URL base, por ejemplo:

```powershell
.\scripts\generate_links_obfuscated.ps1 -BaseUrl "https://witty-stone-03a73a110.5.azurestaticapps.net/index.html?pv=20260625"
```

La app ignora `pv`; solo sirve para que WhatsApp trate el enlace como nuevo y vuelva a leer los metadatos.

## Backend (Google Apps Script)

El archivo `google-apps-script/Code.gs` cubre **todo el backend**:

- `doPost` con `tipo=regalo` → añade una fila a la hoja **"Regalos"** (fecha, idRegalo, regalo, teléfono, invitado) e ignora duplicados del mismo invitado+regalo.
- `doPost` sin `tipo` → guarda el **RSVP** en la hoja **"Confirmaciones"**.
- `doGet` con `tipo=regalos` → devuelve `{ ok:true, conteos:{ idRegalo: nº } }` para que la web bloquee los regalos completos.

### Pasos de despliegue

1. Abre la hoja de cálculo de Google donde quieres guardar los datos.
2. **Extensiones → Apps Script** y pega el contenido de `Code.gs`.
3. **Implementar → Nueva implementación → Aplicación web**:
   - *Ejecutar como:* Yo
   - *Quién tiene acceso:* Cualquier usuario
4. Copia la URL `/exec` y pégala en `APPS_SCRIPT_URL` (config.js).
5. Si ya tenías un script para el RSVP, usa **Gestionar implementaciones → editar → Nueva versión** para conservar la misma URL.

> Las hojas "Confirmaciones" y "Regalos" se crean solas la primera vez que llega un dato.

## Desarrollo local

La invitación usa `fetch` sobre los JSON, así que **no funciona abriendo `index.html` directamente** (`file://` bloquea el fetch). Hay que servirla por HTTP.

**Windows sin Python ni Node (forma más fácil):** haz **doble clic en `Iniciar servidor.bat`**. Abre una ventana con un servidor local (PowerShell, sin instalar nada) en `http://localhost:8000`. Deja esa ventana abierta mientras usas la invitación; ciérrala para detener el servidor.

> Nota: `serve.ps1` contiene la lógica del servidor, pero **no lo abras con doble clic** — Windows abre los `.ps1` en el editor en vez de ejecutarlos. Usa siempre el `.bat`.

**Si tienes Python o Node instalados**, también puedes:

```bash
python -m http.server 8000   # Python
npx serve .                  # Node
```

Luego visita `http://localhost:8000/index.html?telefono=678910967` (o sin parámetro para el modo demo).

## Despliegue

El sitio se publica con **Azure Static Web Apps** (ver `.github/workflows/`). Cualquier `push` a la rama configurada actualiza la web. Recuerda que cambiar `invitados.json`, `regalos.json` o `config.js` y hacer push es suficiente para actualizar datos; el backend de Apps Script se despliega aparte (ver sección anterior).

## Limitaciones conocidas

- La respuesta del Apps Script al enviar (POST) es opaca (`no-cors`): se confirma el envío de forma optimista. Si el invitado pierde conexión justo al enviar, puede reintentar.
- Si dos personas reservan la última unidad casi a la vez, podría sobre-reservarse; para un evento privado de bajo tráfico el riesgo es mínimo y el anfitrión puede ajustar con `reservadosManual`.
- Las imágenes de regalos se cargan desde la tienda (IKEA). Si alguna deja de estar disponible, se muestra el emoji de respaldo; puedes alojar la imagen tú y poner su ruta en `imagen`.
