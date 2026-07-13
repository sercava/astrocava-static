# Astrocava

Sitio estático Astro para `https://www.astrocava.com`, destinado a GitHub Pages.

## Configuración

- `site`: `https://www.astrocava.com`
- `trailingSlash`: `always`
- Contenido importado: `src/content/entries/*.md`, con HTML Ghost embebido
- MDX: reservado para contenido nuevo

## Desarrollo local

La toolchain está fijada a Node `24.16.0` y npm `11.13.0`. Los gestores compatibles pueden leer `.nvmrc` o `.node-version`; `npm ci` rechaza otras versiones mediante `engine-strict`.

```bash
node --version
npm --version
npm ci
npm run check
npm run dev
```

## Build y preview

```bash
npm run build
npm run preview
```

El build genera `dist/`, `sitemap-index.xml` y su alias compatible `sitemap.xml`.

Después del build, `npm run check:predeploy` valida de forma determinista el contrato público completo: conjunto exacto de URLs, enlaces y fragmentos internos, inventario byte a byte de imágenes, SEO técnico básico, sitemap y `robots.txt`. Para clones y pull requests, usa `npm run check:verify`, seguido de `npm run build:verify && npm run check:predeploy:verify`; estos comandos inyectan exclusivamente la identidad sintética y `dist-verify/` nunca es desplegable.

## Aviso legal y datos privados

Los datos identificativos del aviso legal no se versionan. El Markdown público contiene únicamente tokens y Astro los sustituye en memoria durante el build; el proceso falla antes de generar si falta algún valor. El build de producción también rechaza una copia literal de cualquiera de esos valores dentro del árbol versionable y ejecuta el control exacto de derechos de imagen.

Para desarrollo local, copia `.env.example` como `.env.local` y sustituye todos los valores. `.env.local` está ignorado por Git. En GitHub, configura estas mismas claves como secretos del entorno de despliegue:

- `ASTROCAVA_LEGAL_OWNER`
- `ASTROCAVA_LEGAL_IDENTIFIER`
- `ASTROCAVA_LEGAL_ADDRESS_LINE_1`
- `ASTROCAVA_LEGAL_ADDRESS_LINE_2`
- `ASTROCAVA_LEGAL_EMAIL`

`npm run build` es estricto y produce el único artefacto desplegable en `dist/`. `npm run build:verify` usa una identidad sintética determinista para checks de clones y pull requests y escribe en `dist-verify/`; ese directorio está ignorado y nunca debe desplegarse.

## CI y staging

`.github/workflows/ci.yml` se ejecuta en pushes y pull requests con Node `24.16.0` y npm `11.13.0`. No accede a secretos: instala el lock, ejecuta todas las regresiones y `astro check`, genera solo `dist-verify/` y aplica el gate predeploy sintético.

El despliegue de `.github/workflows/deploy-pages.yml` es manual, acepta únicamente `main` y usa el entorno protegido `github-pages`. Ese entorno debe restringirse a la rama `main` y contener exactamente los cinco secretos legales. El job vuelve a ejecutar tests y checks, construye `dist/` con identidad real, valida el marcador legal de producción, añade `deployment-provenance.json` con el commit y digest SHA-256 del payload y despliega ese mismo directorio mediante GitHub Pages.

Antes del corte DNS, el smoke del workflow consulta directamente el backend Pages con `Host: www.astrocava.com`. Así valida el artefacto nuevo sin dirigir tráfico público desde Ghost; HTTPS y las redirecciones públicas se comprueban durante el corte.

## Comandos disponibles

| Comando | Función |
| --- | --- |
| `npm run dev` | Servidor local de desarrollo |
| `npm run build` | Build estático y alias del sitemap |
| `npm run build:verify` | Build no desplegable con identidad legal sintética en `dist-verify/` |
| `npm run preview` | Sirve el build existente |
| `npm run check` | Ejecuta `astro check` con la identidad legal local/de producción |
| `npm run check:verify` | Ejecuta `astro check` con la identidad sintética determinista para CI sin secretos |
| `npm run check:privacy` | Verifica que el aviso versionable no contiene PII |
| `npm run check:rights` | Compara las 272 familias/634 imágenes con el manifiesto exacto y valida la rotulación Midjourney |
| `npm run check:urls` | Compara las páginas de `dist/` con las 162 URLs aprobadas |
| `npm run check:links` | Rechaza enlaces o fragmentos internos rotos y referencias al host Ghost |
| `npm run check:images` | Compara todas las imágenes de `dist/` con las 634 rutas, tamaños y hashes aprobados |
| `npm run check:seo` | Valida idioma, title, description, H1, canonical, `og:url` y ausencia de `noindex` |
| `npm run check:sitemap` | Valida índice, alias, sitemap hijo, URLs exactas y `robots.txt` sin escribir informes |
| `npm run check:predeploy` | Ejecuta los cinco checks anteriores sobre `dist/` |
| `npm run check:predeploy:verify` | Ejecuta el gate completo sobre `dist-verify/` |
| `npm run test:legal-notice` | Pruebas de inyección y fallo seguro del aviso legal |
| `npm run test:licensing` | Verifica el alcance, los avisos y la superficie pública de licencias |
| `npm run test:rights` | Prueba los casos positivos y negativos del manifiesto de derechos |
| `npm run test:predeploy` | Prueba los casos positivos y negativos del gate predeploy |
| `npm run test:provenance` | Prueba el manifiesto de commit/digest del artefacto desplegable |
| `npm run test:smoke` | Prueba el smoke técnico y la conexión al backend Pages antes del DNS |
| `npm run test:workflow` | Fija separación de secretos, toolchain y contrato CI/Pages |
| `npm run test:ci` | Ejecuta todas las regresiones que usa CI |

## Licencias

El código propio se distribuye bajo licencia MIT, con copyright de Sergio Cava. Los textos editoriales originales y únicamente las imágenes propias identificadas de forma expresa se distribuyen bajo CC BY 4.0 con la atribución `Sergio Cava / Astrocava`.

Los materiales de terceros, de dominio público, logos, elementos de identidad y páginas legales no quedan relicenciados por estas concesiones. [`RIGHTS_MANIFEST.json`](RIGHTS_MANIFEST.json) cubre exactamente las 272 familias y 634 imágenes actuales; una ruta nueva o unos bytes distintos requieren revisión antes de que el build los acepte.

Consulta [LICENSE.md](LICENSE.md), [NOTICE.md](NOTICE.md), [ATTRIBUTIONS.md](ATTRIBUTIONS.md) y la página pública `/licencias/` para conocer el alcance y las atribuciones verificadas.

## Contenido generado

`src/content/entries/` y `public/content/images/` proceden de un proceso privado y controlado de migración. Este repositorio no incluye exports Ghost, backups, borradores, métricas ni comandos del workspace privado.
