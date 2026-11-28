# Mono Cromat & Co. — Estudio (PWA)

Aplicación de una sola página para el estudio: clientes, cotizaciones, pedidos, producción, calidad y entregas. Los datos se guardan en `localStorage` del navegador; **no** viajan a ningún servidor.

## Por qué no se instalaba

La app era un `index.html` suelto: no tenía manifest, ni service worker, ni íconos. Sin esos archivos el navegador no puede ofrecer «Instalar app», no abre en modo independiente y no funciona sin conexión. Además, cuando se activó la PWA el proyecto de Vercel `monocromat` no tenía ningún deployment, así que la URL pública no existía; hoy publica desde `main`.

Esto es lo que se agregó:

| Archivo | Para qué sirve |
| --- | --- |
| `manifest.webmanifest` | Nombre, colores, `start_url`, modo `standalone`, íconos y atajos. |
| `sw.js` | Service worker: precachea la app, responde sin conexión, no cachea `/api/*`. |
| `icons/` | Íconos 192, 512, maskable y Apple Touch Icon basados en el monograma M azul. |
| `favicon.ico`, `icons/favicon-32.png` | Ícono de la pestaña. |
| `vercel.json` | Cabeceras correctas (`manifest`, `sw.js` sin caché, seguridad). |
| `.vercelignore` | Evita publicar `backend/`, `database/` y `tools/`. |
| `tools/serve.mjs` | Servidor estático local (sin dependencias). |
| `tools/pwa.test.mjs` | Pruebas del manifest, íconos, service worker, offline y servidor. |
| `tools/quote-autofill.test.mjs` | Pruebas del autocompletado de clientes. |
| `tools/local-flow.test.mjs` | Pruebas de folios, fechas, estados, vínculo e historial. |
| `tools/polish.test.mjs` | Pruebas del rediseño 2026-11-27 (ver abajo). |

La marca actualizada queda en `logo.png` (logotipo completo) y `assets/brand/monogram-{navy,blue}.png` (monogramas transparentes); la app usa la M azul para sus íconos y la M navy en la navegación. También conserva el botón **Instalar app**, el aviso **Sin conexión**, la actualización automática del service worker y los atajos del manifest (`/?view=quote&new=1`, etc.).

## Rediseño 2026-11-27 — «Hoy en el taller»

El panorama ahora es un mosaico operativo asimétrico —sin frase motivacional ni columna interminable— que combina resumen, próximas entregas, flujo, saldos y seguimiento en una sola mirada:

1. **Hoy — entregas**: las entregas de hoy y las vencidas primero, con cliente, proyecto y forma de entrega.
2. **En producción ahora**: pipeline Confirmado → Producción → Calidad → Entrega con su conteo, y los trabajos en producción/calidad con 4 días o más desde la fecha del pedido, marcados para revisión.
3. **Dinero que falta**: pedidos con saldo pendiente, ordenados por monto, con «Registrar abono» en la misma fila.
4. **Cotizaciones esperando**: cotizaciones enviadas con sus días sin respuesta y «Recordar por WhatsApp».
5. El acceso rápido a cotizaciones, respaldo e importación permanece a mano en el encabezado.

El resto de la mejora:

- **Respaldo**: en el panorama, **Exportar respaldo** descarga un JSON con clientes, cotizaciones, pedidos y contadores de folios; **Importar respaldo** lo restaura (pide confirmación y valida que el archivo sea un respaldo de Mono Cromat antes de tocar nada).
- **Cotización por renglones libres**: en **01 / Productos y servicios** escribe cada producto o servicio, cantidad y precio unitario; no hay catálogo que elegir. Cada importe, el subtotal y el IVA del 16 % se calculan al vuelo. Formato, material, entrega, anticipo, vigencia y acabados quedan como detalles opcionales. La validación pide cliente, proyecto y al menos una partida completa; la técnica/proceso es opcional. Hay **autoguardado del borrador** («Borrador guardado HH:MM»). Guardar y crear pedido están separados: la confirmación resume todas las partidas y el pedido conserva sus descripciones, cantidades y precios, visibles también en su ficha y en el detalle para producción. Las cotizaciones antiguas con opciones se migran a partidas al abrirse; se conserva la alternativa que estaba seleccionada, sus datos y su precio.
- **Enviar por WhatsApp**: el botón abre WhatsApp con el mensaje de la cotización ya escrito (al número del estudio, 55 4929 1166, o al teléfono del cliente si está en el directorio). El QR falso ya no existe.
- **Sin diálogos del navegador**: ningún `alert()` ni `confirm()` en la app; los avisos usan el toast de la PWA y las eliminaciones piden confirmación en el mismo toast.
- **Marca**: papel `#FAF7F4` y Blanco Hielo `#F5F8FA` (fondo del manifest y lavado de página); `CACHE_VERSION` subió a `v9` para distribuir la marca y sus nuevos íconos junto al formulario de partidas libres (además del shell mint teal). La versión de caché vive solo en `sw.js`: es la única fuente.
- **Identidad actualizada**: el wordmark y las dos variantes de la M ya están activos. Los archivos recibidos son PNG rasterizados; el original vectorial editable para bordado, sello o suajado aún no está en el repositorio.

### Ícono de la app

El ícono instalado usa el monograma M azul sobre Blanco Hielo (`#F5F8FA`); la versión maskable conserva una zona segura para recortes de Android. Se generan estos tamaños:

| Archivo | Uso |
| --- | --- |
| `icons/icon-192.png` y `icons/icon-512.png` | Ícono estándar (Android, escritorio, manifest). |
| `icons/maskable-512.png` | Zona segura para recortes circulares de Android (monograma centrado). |
| `icons/apple-touch-icon.png` (180×180) | Pantalla de inicio en iOS. |
| `icons/favicon-32.png` y `favicon.ico` | Pestaña del navegador, con el monograma M. |

Si cambias cualquier ícono, sube también `CACHE_VERSION` en `sw.js` para que los dispositivos que ya instalaron la app descarguen los nuevos.

## Rediseño 2026-11-28 — «Balance»

La app dejó de ser una columna de bienvenida + tarjetas + listas. Ahora la estructura es la del manual de marca (*Creatividad con criterio. Producción con intención.*): el espacio se reparte según lo que hay y la información operativa manda.

### Navegación: riel a la derecha, barra abajo

- **Escritorio (>900 px):** los seis iconos viven en un riel oscuro **a la derecha** del contenido (`--rail-w: 84px`). El wordmark queda arriba a la izquierda, en la barra superior. Cada icono sigue siendo solo icono, con `aria-label`, tooltip al pasar el cursor y un **badge** con el número de pedidos abiertos.
- **Móvil (≤900 px):** el mismo riel se convierte en **barra inferior fija**, con área segura de iOS (`env(safe-area-inset-bottom)`) y sin etiquetas; el contenido reserva ese espacio.
- Se elimina el `side-label`, el «ESTUDIO EN MARCHA» y el avatar duplicado de la barra superior.

### Panel: gráfica de pedidos abiertos

El saludo ocupa una línea (`Buenos días/tardes/noches` + «Esto es lo que sigue») y desaparece el título gigante. El primer módulo es **«Abonado y por cobrar»**, una gráfica de barras donde:

- **cada barra es un pedido abierto** (máximo nueve, el resto se cuenta en el eje);
- la barra se apila en **abonado (mint `#49C7BE`)** abajo y **por cobrar (Dark Royal `#24479D`)** arriba, así que **abonado + por cobrar = total del pedido**;
- al entregarse un pedido **y** quedar liquidado, sale de la gráfica y la suma se cierra sola (`openOrderStats()`);
- tocar una barra abre el pedido en **Registrar abono**;
- arriba se lee el total de pedidos abiertos, el abonado y el por cobrar, con la leyenda «Abonado + por cobrar = total».

Debajo, en mosaico y con alturas según su contenido: **Hoy — entregas**, **En producción ahora**, **Dinero que falta**, **Puntos que piden atención**, **Cotizaciones esperando** y la tira de **directorio**. No hay hero de 300 px ni tarjetas de relleno.

### Documentos imprimibles A4

Los formatos viejos (Arial suelto, imagen de 130 px, 780 px de ancho) se reemplazaron por un **solo motor** (`docStyles`, `docHeader`, `docSigns`, `docFooter`, `docItemsTable`, `docTotals`, `docCoverage`, `docOpen`). Los cinco comparten retícula, tipografía de marca, pie y firmas:

| Documento | Botón | Qué incluye |
| --- | --- | --- |
| **Cotización** | `Cotización en PDF` (panel de edición) | Partidas con importe, subtotal/IVA/total, formato, papel, acabados, anticipo, vigencia, condiciones, cliente y proyecto. |
| **Pedido** | `Documento del pedido` (Pedidos) y `Pedido en PDF` (cotización) | Partidas, totales, **abonado y saldo**, estado de cuenta, barra de cobertura y tabla de abonos. |
| **Orden de producción** | `Orden de producción` (Producción) | Especificaciones, piezas sin precios, materiales, notas y checklist de taller. |
| **Control de calidad** | `Control de calidad` (Producción) | Puntos de revisión marcados, verificador, fecha, observaciones y resultado. |
| **Guía de entrega** | `Guía de entrega` (Calendario) | Punto de entrega, quien recibe, contenido, estado de cuenta y **saldo a la entrega**. |

Cada documento abre una pestaña con barra de **Imprimir / guardar PDF** (oculta al imprimir) y `@page A4` con márgenes de 14 mm. Si el navegador bloquea la pestaña, la app avisa con el toast en lugar de fallar en silencio.

### Marca

- **Tipografía del manual:** Bricolage Grotesque (display), Sora (lectura) y Fira Mono (datos). Ya no se usan Lexend ni Inter.
- **Paleta:** Oxford `#071E33`, Dark Royal `#24479D`, Bright `#138FD0`, Sky `#4CBFE0`, Mint `#49C7BE` y Papel `#F5F3ED`.
- **Logos actualizados:** `assets/brand/wordmark-{navy,light,white}.png` y `assets/brand/monogram-{navy,blue,light}.png`, todos con transparencia real (antes el logo se invertía con `filter`). `logo.png` es el wordmark navy.
- **Íconos de la app** regenerados con el monograma en Dark Royal sobre Blanco Hielo `#F5F8FA`.
- `CACHE_VERSION` subió a `v10` para distribuir marca, íconos y formatos nuevos.

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
- Los datos anteriores se normalizan al abrir la app: abonos con `amount` pasan a centavos, pedidos sin `total` muestran «Sin definir» en vez de romper la vista y cotizaciones guardadas con opciones se convierten en renglones libres al cargarse; los pedidos antiguos reciben un detalle compatible sin alterar sus totales ni abonos.
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
node --test tools/pwa.test.mjs tools/quote-autofill.test.mjs tools/local-flow.test.mjs tools/polish.test.mjs tools/documents.test.mjs
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
- el mosaico del dashboard, la navegación con seis SVG accesibles, el cálculo dinámico de saldos, las etiquetas de formularios, el respaldo JSON, la cotización, WhatsApp, el precache real de recursos y que no quede ningún `alert()`/`confirm()`;
- `tools/documents.test.mjs`: riel derecho / barra inferior, saludo compacto sin hero, **abonado + por cobrar = total** de pedidos abiertos (y que el pedido entregado y cobrado salga de la gráfica), motor único A4 y los cinco formatos con sus botones.

## Publicar en Vercel

El proyecto `monocromat` publica el sitio estático desde `main`. Como no hay build, cada cambio de `index.html` o `sw.js` se publica al integrar el cambio:

```bash
npx vercel --prod
```

O desde el panel: **Add New → Project → monocromat → Deploy**. Framework: *Other*, sin build command, output en la raíz.

`vercel.json` sirve `/sw.js` sin caché y con `Service-Worker-Allowed: /`, el manifest como `application/manifest+json` y los íconos con caché de una semana.

## Actualizar la app publicada

Cuando cambies `index.html` u otro archivo del shell:

1. Sube `CACHE_VERSION` en `sw.js` (la versión actual es `v10`; el siguiente cambio será `v10` → `v11`).
2. Publica de nuevo.

La app detecta la versión nueva y muestra el aviso **«Hay una versión nueva del estudio»** con el botón **Actualizar**; al aceptarlo se activa el service worker nuevo y se recarga.

> Sin subir `CACHE_VERSION`, los navegadores que ya tienen la app instalada pueden seguir viendo la versión anterior.

## Notas y pendientes

- El service worker solo se activa en HTTPS o en `localhost`.
- Los datos viven en `localStorage`: si se borran los datos del sitio, se pierden. Usa **Exportar respaldo** en el panorama para guardar una copia (y **Importar respaldo** para restaurarla). El `backend/` y `database/` aún no están conectados a la app (siguen siendo un borrador).
- Para que la instalación sea válida, el manifest y los íconos deben servirse desde la raíz del dominio (`/manifest.webmanifest`, `/icons/...`), como hace este repositorio.
