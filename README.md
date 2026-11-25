# Mono Cromat & Co. — Estudio (PWA)

Aplicación de una sola página para el estudio: clientes, cotizaciones, pedidos, producción, calidad y entregas. Los datos se guardan en `localStorage` del navegador; **no** viajan a ningún servidor.

## Por qué no se instalaba

La app era un `index.html` suelto: no tenía manifest, ni service worker, ni íconos. Sin esos archivos el navegador no puede ofrecer «Instalar app», no abre en modo independiente y no funciona sin conexión. Además, cuando se activó la PWA el proyecto de Vercel `monocromat` no tenía ningún deployment, así que la URL pública no existía; hoy publica desde `main`.

Esto es lo que se agregó:

| Archivo | Para qué sirve |
| --- | --- |
| `manifest.webmanifest` | Nombre, colores, `start_url`, modo `standalone`, íconos y atajos. |
| `sw.js` | Service worker: precachea la app, responde sin conexión, no cachea `/api/*`. |
| `icons/` | Íconos 192, 512, maskable y Apple Touch Icon (mascota del mono). |
| `favicon.ico`, `icons/favicon-32.png` | Ícono de la pestaña. |
| `vercel.json` | Cabeceras correctas (`manifest`, `sw.js` sin caché, seguridad). |
| `.vercelignore` | Evita publicar `backend/`, `database/` y `tools/`. |
| `tools/serve.mjs` | Servidor estático local (sin dependencias). |
| `tools/pwa.test.mjs` | Pruebas del manifest, íconos, service worker, offline y servidor. |
| `tools/quote-autofill.test.mjs` | Pruebas del autocompletado de clientes. |
| `tools/local-flow.test.mjs` | Pruebas de folios, fechas, estados, vínculo e historial. |
| `tools/polish.test.mjs` | Pruebas de la pulida 2026-11-25 (ver abajo). |

También se optimizó `logo.png` (1.6 MB → 255 KB) y se añadió en la app el botón **Instalar app**, el aviso **Sin conexión**, la actualización automática del service worker y los atajos del manifest (`/?view=quote&new=1`, etc.).

## Pulida 2026-11-25 — «Hoy en el taller» (rama `polish/hoy-en-el-taller`)

El panorama ya no es una rejilla de tarjetas: es una cola de trabajo en una sola columna, ordenada por urgencia:

1. **Hoy — entregas**: las entregas de hoy y las vencidas primero, con cliente, proyecto y forma de entrega.
2. **En producción ahora**: pipeline Confirmado → Producción → Calidad → Entrega con su conteo, y los trabajos trabados (4 días o más en la misma etapa) marcados con los días que llevan ahí.
3. **Dinero que falta**: pedidos con saldo pendiente, ordenados por monto, con «Registrar abono» en la misma fila.
4. **Cotizaciones esperando**: cotizaciones enviadas con sus días sin respuesta y «Recordar por WhatsApp».
5. Un botón grande **+ Nueva cotización** al final.

El resto de la pulida:

- **Respaldo**: en el panorama, **Exportar respaldo** descarga un JSON con clientes, cotizaciones, pedidos y contadores de folios; **Importar respaldo** lo restaura (pide confirmación y valida que el archivo sea un respaldo de Mono Cromat antes de tocar nada).
- **Cotización usable**: nueva sección **00 / Especificación del trabajo** — servicio (de la lista real del estudio), cantidad, formato/medidas, papel, fecha de entrega, anticipo, vigencia y acabados estrella como casillas (texturas en frío, hot stamping, laminados térmicos). Las opciones ya no son texto libre con un solo total: son partidas **cantidad × precio unitario = total**, con subtotal, IVA 16 % y anticipo. La validación es en línea (cliente, proyecto, técnica, cantidad y precio > 0) y hay **autoguardado del borrador** («Borrador guardado HH:MM»). Guardar y crear pedido están separados: crear pedido abre un panel de confirmación con el resumen antes de crear nada. La producción hereda la especificación en vez de reescribirla a mano.
- **Enviar por WhatsApp**: el botón abre WhatsApp con el mensaje de la cotización ya escrito (al número del estudio, 55 4929 1166, o al teléfono del cliente si está en el directorio). El QR falso ya no existe.
- **Sin diálogos del navegador**: ningún `alert()` ni `confirm()` en la app; los avisos usan el toast de la PWA y las eliminaciones piden confirmación en el mismo toast.
- **Marca**: papel `#FAF7F4` y Blanco Hielo `#F5F8FA` (fondo del manifest y lavado de página); `CACHE_VERSION` subió a `v5`. La versión de caché vive solo en `sw.js`: es la única fuente.
- **Ícono M (candidato, NO final)**: `icons/m-192.png`, `icons/m-512.png`, `icons/m-maskable-512.png` y `icons/m-apple-touch-icon.png` son un trazo raster de la M sólida de Mick (blanca sobre negro, plana, sin textura), trazada a partir de su propia imagen y reproducida en royal #2E48A1 sobre papel #FAF7F4 y en blanco sobre oxford #081C30. El manifest **sigue apuntando a los íconos del mono**; el cambio a la M es una decisión pendiente de Mick. Para activarlo: cambiar los íconos del manifest a `icons/m-*.png`, el favicon, y subir `CACHE_VERSION`. La versión vectorial final (formas cerradas, para bordado/sello/suajado) sigue pendiente.

### Ícono de la app

El ícono es la mascota del mono (2048×2048 original). Se generan estos tamaños:

| Archivo | Uso |
| --- | --- |
| `icons/icon-192.png` y `icons/icon-512.png` | Ícono estándar (Android, escritorio, manifest). |
| `icons/maskable-512.png` | Zona segura para recortes circulares de Android (mascota al 70 % del lienzo). |
| `icons/apple-touch-icon.png` (180×180) | Pantalla de inicio en iOS. |
| `icons/favicon-32.png` y `favicon.ico` | Pestaña del navegador, con recorte más cerrado para que la cara se lea a 32 px. |

Si cambias cualquier ícono, sube también `CACHE_VERSION` en `sw.js` para que los dispositivos que ya instalaron la app descarguen los nuevos. La M candidata (`icons/m-*.png`) aún no está activa: ver «Pulida 2026-11-25» arriba.

## Autocompletado de clientes

En la cotización, el campo **CLIENTE** sugiere los contactos guardados en **Clientes**:

- Al escribir aparecen sugerencias con nombre, empresa y correo (datalist nativo).
- Si el nombre coincide con un cliente del directorio, el **correo se llena solo**.
- Al salir del campo se completa con un prefijo único (`Marian` → `Mariana López`); si hay varios clientes con ese prefijo, avisa y no elige a ciegas.
- El aviso debajo del nombre muestra empresa y teléfono del contacto; si no existe, indica «Cliente nuevo».
- **Nunca sobrescribe un correo escrito a mano**: solo rellena el campo vacío o el que puso el propio autocompletado.
- Al crear el pedido, este hereda el cliente, empresa, correo y teléfono, y los muestra en la ficha del pedido.

La comparación ignora mayúsculas y acentos (`JOSE ALVAREZ` encuentra a `José Álvarez`).

## Flujo local: folios, estados e historial

- Al guardar una cotización se le asigna un folio consecutivo (`MCCO-C-0001`) y la fecha del día. El pedido recibe su propio folio (`MCCO-P-0001`).
- El estado de la cotización puede ser **Borrador**, **Enviada**, **Aceptada** o **Rechazada**; si ya está guardada, el cambio se aplica al instante.
- Crear un pedido guarda la cotización, la marca como **Aceptada** y la vincula con `quoteId`. Si esa cotización ya tiene pedido, la app ofrece abrirlo en vez de duplicarlo.
- Una cotización vinculada no se puede borrar hasta eliminar su pedido. Al borrar el pedido, la cotización vuelve a **Enviada**.
- En **Clientes**, al editar un contacto aparece su historial de cotizaciones y pedidos. Borrar el contacto conserva esos documentos.
- Los datos anteriores se normalizan al abrir la app: abonos con `amount` pasan a centavos, pedidos sin `total` muestran «Sin definir» en vez de romper la vista y cotizaciones con menos de tres opciones se completan.
- Las condiciones de la cotización conservan sus saltos de línea al imprimir.
- El botón **Imprimir / guardar PDF** guarda primero la cotización, para que el folio y la fecha reales salgan en el documento.

## Probarlo en local

```bash
node tools/serve.mjs
# abre http://localhost:4173
```

`localhost` cuenta como contexto seguro, así que el service worker y la instalación funcionan igual que en HTTPS.

En Chrome / Edge:

1. Abre `http://localhost:4173`.
2. Menú del navegador → **Instalar Mono Cromat** (o el botón «Instalar app» de la barra superior).
3. Abre DevTools → **Application** → **Manifest** y **Service Workers** para revisar que todo esté activo.
4. En **Application → Service Workers** marca **Offline** y recarga: la app debe seguir abriendo.

En iPhone / iPad (Safari): **Compartir → Añadir a pantalla de inicio**. La app muestra esas instrucciones si tocas «Instalar app».

## Pruebas

```bash
node --test tools/pwa.test.mjs tools/quote-autofill.test.mjs tools/local-flow.test.mjs tools/polish.test.mjs
```

Las pruebas revisan:

- manifest completo y con íconos 192/512/maskable;
- íconos existentes y del tamaño declarado;
- metadatos en el `<head>` (no dentro del CSS), manifest, íconos y registro del service worker;
- precache del shell, respaldo offline, exclusión de `/api/*` y caché de fuentes;
- cabeceras MIME y de caché del servidor, además de rutas y ataques de traversal;
- normalización de nombres, coincidencia exacta, prefijo único y prefijo ambiguo;
- que el pedido herede los datos del cliente y el correo manual nunca se sobrescriba;
- folios consecutivos por tipo, formato de fechas y normalización de datos viejos;
- que la interfaz conserve folio, fecha, estado, vínculo, borrado e historial;
- el dashboard «Hoy en el taller», el respaldo JSON, la especificación y las partidas de la cotización, el envío por WhatsApp, la marca (papel y Blanco Hielo), los íconos M y que no quede ningún `alert()`/`confirm()`.

## Publicar en Vercel

El proyecto `monocromat` publica el sitio estático desde `main`. Como no hay build, cada cambio de `index.html` o `sw.js` se publica al integrar el cambio:

```bash
npx vercel --prod
```

O desde el panel: **Add New → Project → monocromat → Deploy**. Framework: *Other*, sin build command, output en la raíz.

`vercel.json` sirve `/sw.js` sin caché y con `Service-Worker-Allowed: /`, el manifest como `application/manifest+json` y los íconos con caché de una semana.

## Actualizar la app publicada

Cuando cambies `index.html` u otro archivo del shell:

1. Sube `CACHE_VERSION` en `sw.js` (la versión actual es `v5`; el siguiente cambio sería `v5` → `v6`).
2. Publica de nuevo.

La app detecta la versión nueva y muestra el aviso **«Hay una versión nueva del estudio»** con el botón **Actualizar**; al aceptarlo se activa el service worker nuevo y se recarga.

> Sin subir `CACHE_VERSION`, los navegadores que ya tienen la app instalada pueden seguir viendo la versión anterior.

## Notas y pendientes

- El service worker solo se activa en HTTPS o en `localhost`.
- Los datos viven en `localStorage`: si se borran los datos del sitio, se pierden. Usa **Exportar respaldo** en el panorama para guardar una copia (y **Importar respaldo** para restaurarla). El `backend/` y `database/` aún no están conectados a la app (siguen siendo un borrador).
- Para que la instalación sea válida, el manifest y los íconos deben servirse desde la raíz del dominio (`/manifest.webmanifest`, `/icons/...`), como hace este repositorio.
