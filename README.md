# Mono Cromat & Co. — Estudio (PWA)

Aplicación de una sola página para el estudio: clientes, cotizaciones, pedidos, producción, calidad y entregas. Los datos se guardan en `localStorage` del navegador; **no** viajan a ningún servidor.

## Por qué no se instalaba

La app era un `index.html` suelto: no tenía manifest, ni service worker, ni íconos. Sin esos archivos el navegador no puede ofrecer «Instalar app», no abre en modo independiente y no funciona sin conexión. Además, el proyecto de Vercel `monocromat` está vinculado al repositorio pero **no tiene ningún deployment**, así que la URL pública no existía.

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

También se optimizó `logo.png` (1.6 MB → 255 KB) y se añadió en la app el botón **Instalar app**, el aviso **Sin conexión**, la actualización automática del service worker y los atajos del manifest (`/?view=quote&new=1`, etc.).

### Ícono de la app

El ícono es la mascota del mono (2048×2048 original). Se generan estos tamaños:

| Archivo | Uso |
| --- | --- |
| `icons/icon-192.png` y `icons/icon-512.png` | Ícono estándar (Android, escritorio, manifest). |
| `icons/maskable-512.png` | Zona segura para recortes circulares de Android (mascota al 70 % del lienzo). |
| `icons/apple-touch-icon.png` (180×180) | Pantalla de inicio en iOS. |
| `icons/favicon-32.png` y `favicon.ico` | Pestaña del navegador, con recorte más cerrado para que la cara se lea a 32 px. |

Si cambias cualquier ícono, sube también `CACHE_VERSION` en `sw.js` para que los dispositivos que ya instalaron la app descarguen los nuevos.

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
node --test tools/pwa.test.mjs
```

Las 9 pruebas revisan:

- manifest completo y con íconos 192/512/maskable;
- íconos existentes y del tamaño declarado;
- metadatos en el `<head>` (no dentro del CSS), manifest, íconos y registro del service worker;
- precache del shell, respaldo offline, exclusión de `/api/*` y caché de fuentes;
- cabeceras MIME y de caché del servidor, además de rutas y ataques de traversal.

## Publicar en Vercel

El proyecto `monocromat` ya existe en Vercel pero nunca se desplegó. Como el sitio es estático, no hace falta build:

```bash
npx vercel --prod
```

O desde el panel: **Add New → Project → monocromat → Deploy**. Framework: *Other*, sin build command, output en la raíz.

`vercel.json` sirve `/sw.js` sin caché y con `Service-Worker-Allowed: /`, el manifest como `application/manifest+json` y los íconos con caché de una semana.

## Actualizar la app publicada

Cuando cambies `index.html` u otro archivo del shell:

1. Sube `CACHE_VERSION` en `sw.js` (`v1` → `v2`).
2. Publica de nuevo.

La app detecta la versión nueva y muestra el aviso **«Hay una versión nueva del estudio»** con el botón **Actualizar**; al aceptarlo se activa el service worker nuevo y se recarga.

> Sin subir `CACHE_VERSION`, los navegadores que ya tienen la app instalada pueden seguir viendo la versión anterior.

## Notas y pendientes

- El service worker solo se activa en HTTPS o en `localhost`.
- Los datos viven en `localStorage`: si se borran los datos del sitio, se pierden. El `backend/` y `database/` aún no están conectados a la app (siguen siendo un borrador).
- Para que la instalación sea válida, el manifest y los íconos deben servirse desde la raíz del dominio (`/manifest.webmanifest`, `/icons/...`), como hace este repositorio.
