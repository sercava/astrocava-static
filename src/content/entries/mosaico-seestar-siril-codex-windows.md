---
slug: mosaico-seestar-siril-codex-windows
title: "Cómo procesé un mosaico Seestar con Siril y Codex en Windows"
type: post
status: published
primary_tag_slug: preprocesado-astrofoto
pathname: /astrofotografia/preprocesado/mosaico-seestar-siril-codex-windows/
url: "https://www.astrocava.com/astrofotografia/preprocesado/mosaico-seestar-siril-codex-windows/"
canonical_url: "https://www.astrocava.com/astrofotografia/preprocesado/mosaico-seestar-siril-codex-windows/"
published_at: 2026-08-13T11:27:19.197Z
updated_at: 2026-08-13T11:27:19.197Z
excerpt: "Cómo registré en Siril un mosaico Seestar de 1.278 tomas usando Codex, Astrometry.net y WSL2 en Windows."
content_plaintext: "La función de mosaico del Seestar S30 convirtió la Cadena de Markarian en un objetivo muy interesante, pero registrar sus 1.278 tomas en Windows exigió conectar Siril con Astrometry.net mediante WSL2. Este es el proceso completo, desde las primeras pruebas fallidas hasta la selección de las 886 mejores imágenes."
tags: [preprocesado-astrofoto]
author: sergio
meta_title: "Mosaico Seestar con Siril y Codex en Windows | Astrocava"
meta_description: "Así registré en Siril un mosaico Seestar de 1.278 tomas de la Cadena de Markarian, usando Codex, Astrometry.net y WSL2 en Windows."
feature_image: /content/images/2026/08/cadena-de-markarian-seestar-s30.jpg
feature_image_alt: "Mosaico de la Cadena de Markarian obtenido con un Seestar S30"
feature_image_srcset: "/content/images/size/w600/2026/08/cadena-de-markarian-seestar-s30.jpg 600w, /content/images/size/w1000/2026/08/cadena-de-markarian-seestar-s30.jpg 1000w, /content/images/size/w1600/2026/08/cadena-de-markarian-seestar-s30.jpg 1600w, /content/images/2026/08/cadena-de-markarian-seestar-s30.jpg 1920w"
feature_image_sizes: "(min-width: 1200px) 1200px, 100vw"
feature_image_caption: "Cadena de Markarian y campo galáctico del Cúmulo de Virgo."
feature_image_credit: Sergio Cava / Astrocava
feature_image_credit_url: "https://www.astrocava.com/author/sergio/"
feature_image_license: CC BY 4.0
feature_image_license_url: "https://creativecommons.org/licenses/by/4.0/"
og_title: "Mosaico Seestar con Siril y Codex en Windows"
og_description: "De 1.278 imágenes desalineadas a un mosaico completo de la Cadena de Markarian con Siril, Astrometry.net y WSL2."
og_image: /content/images/2026/08/cadena-de-markarian-seestar-s30.jpg
twitter_title: "Mosaico Seestar con Siril y Codex en Windows"
twitter_description: "De 1.278 imágenes desalineadas a un mosaico completo de la Cadena de Markarian con Siril, Astrometry.net y WSL2."
twitter_image: /content/images/2026/08/cadena-de-markarian-seestar-s30.jpg
---
<h2 id="cadena-de-markarian">La Cadena de Markarian: de 1.278 imágenes desalineadas a un mosaico completo</h2>

<p>La Cadena de Markarian es uno de esos campos que invitan a ampliar el encuadre. Alrededor de las galaxias M84 y M86 aparecen decenas de galaxias del cúmulo de Virgo, muchas de ellas pequeñas, pero perfectamente reconocibles cuando se consigue suficiente señal.</p>

<p>Con mis telescopios anteriores, encuadrar la cadena era tarea imposible, pero la función de mosaico del Seestar y el campo del S30 la convertían en un objetivo muy interesante. Merecía una prueba, no solo para captar la cadena, sino también para ampliar el campo y sacar todas las galaxias posibles de la zona.</p>

<p>Para este proyecto partíamos de 1.278 imágenes FITS obtenidas con un Seestar S30 durante cuatro sesiones de febrero de 2025. Cada exposición era de 10 segundos, con filtro IRCUT y ganancia 200. En total, unas 3 horas y 33 minutos de exposición nominal.</p>

<p>El registro y la integración de las tomas de los mosaicos del Seestar me habían resultado imposibles con PixInsight, mi herramienta favorita de procesado. Una charla impartida por Marcos en la Asociación Astronómica Cruz del Norte me inspiró a probar Siril junto con Codex, de OpenAI.</p>

<p>El objetivo parecía sencillo: registrar las tomas, evaluar su calidad, construir el mosaico y apilarlas con Siril. La realidad, especialmente trabajando en Windows, fue bastante más complicada.</p>

<p>Codex hizo de operador e ingeniero del flujo: generó los guiones para Siril, ejecutó pruebas pequeñas, inspeccionó los registros, comparó resultados y fue creando las herramientas auxiliares necesarias. El preprocesado de las imágenes lo realizó Siril y la resolución astrométrica, Astrometry.net.</p>

<p>Este artículo desarrolla la parte técnica del proyecto que presenté en <a href="/galeria/cielo-profundo/cadena-de-markarian/">la entrada dedicada a la Cadena de Markarian</a> y forma parte de la sección de este sitio web sobre <a href="/astrofotografia/preprocesado/">preprocesado de imágenes astronómicas</a>.</p>

<p>Lo que sigue es una explicación bastante técnica de los problemas que nos encontramos. Si lo prefieres, pasa directamente a la <a href="#conclusion">conclusión</a>. Ahí encontrarás el enlace al repositorio desde el que puedes descargar las herramientas para aplicarlas a tus propias tomas.</p>

<h2 id="primera-prueba">Una primera prueba que daba demasiada confianza</h2>

<p>El primer paso fue construir un flujo reutilizable para Siril 1.4.4. Los datos de la Cadena de Markarian eran nuestro «conejillo de indias», pero, si funcionaba, sería la puerta a procesar otros objetos que estaban guardados en el cajón a la espera de un flujo que permitiera trabajar con ellos.</p>

<p>Antes de lanzar las 1.278 imágenes hicimos una prueba con 50. Siril consiguió registrar 46 y rechazó solo cuatro por problemas de correspondencia de estrellas. Parecía un resultado prometedor...</p>

<p>Sin embargo, al procesar el conjunto completo solo se registraron 254 de las 1.278 tomas.</p>

<p>El problema no era simplemente que las imágenes no registradas fueran malas. Estábamos intentando construir un mosaico: muchas teselas no compartían suficientes estrellas con la imagen de referencia. Un método de registro que funcionaba en un pequeño grupo cercano fallaba cuando el campo se extendía por zonas alejadas del mosaico. Era lo mismo que me pasaba con PixInsight.</p>

<h2 id="intentos-mosaico">Intentos de construir el mosaico</h2>

<p>Probamos cambiando la resolución de catálogo y algunas variantes de mosaico progresivo. Incluso relajamos la detección de estrellas, tanto con los FITS originales como con versiones debayerizadas.</p>

<p>Nada funcionaba. Solo nos quedaba una posibilidad: resolver astrométricamente cada imagen con Astrometry.net para guiar el proceso de registro. Y ahí nos estaba esperando el siguiente problema...</p>

<h2 id="muro-windows">El muro de Windows</h2>

<p>En Linux, Siril puede invocar una instalación local de Astrometry.net de una forma relativamente directa. En Windows la situación es más compleja: Siril espera encontrar una estructura parecida a ANSVR o Cygwin, mientras que Astrometry.net estaba instalado en el subsistema Linux.</p>

<p>Además, durante la instalación aparecieron varios problemas:</p>

<ul>
  <li>La ruta de paquetes e índices 2MASS resultó poco fiable.</li>
  <li>Siril y WSL interpretaban de forma diferente las rutas de Windows.</li>
  <li>Algunas rutas llegaban a Astrometry.net mezclando <code>/</code> y <code>\</code>.</li>
  <li>El primer intento integrado terminó con el error <code>cannot create temporary file</code>.</li>
  <li>Una resolución ejecutada directamente en WSL podía funcionar, pero eso no demostraba que Siril fuera capaz de completar todo el proceso.</li>
  <li>Y unos cuantos problemas adicionales que alargarían esta lista demasiado...</li>
</ul>

<p>Finalmente dejamos instalada y verificada la versión 0.93 de <code>solve-field</code>, con los índices Tycho2 del 07 al 19. Una imagen FITS original del Seestar S30 se resolvió correctamente utilizando el índice Tycho2-11, con una escala aproximada de 3,99 segundos de arco por píxel y un campo de unos 1,20 × 2,13 grados.</p>

<p>Eso demostraba que Astrometry.net entendía las imágenes. Todavía faltaba conseguir que Siril pudiera hablar con él.</p>

<h2 id="puente-siril-windows-wsl">El puente entre Siril, Windows y WSL</h2>

<p>La inspiración para construir el puente entre Siril y Astrometry.net llegó casi por casualidad. Encontré el repositorio abierto <a href="https://github.com/luzbel/fake-ansvr-in-wsl2-for-nina"><code>luzbel/fake-ansvr-in-wsl2-for-nina</code></a>.</p>

<p>Este proyecto, creado originalmente para N.I.N.A., propone una solución poco ortodoxa: instalar una versión de Astrometry.net dentro de WSL2 y hacer creer a una aplicación de Windows que está utilizando una instalación convencional de ANSVR bajo Cygwin.</p>

<p>Aunque el repositorio estaba pensado para N.I.N.A., Siril hacía suposiciones muy parecidas cuando intentaba utilizar Astrometry.net localmente en Windows.</p>

<p>La investigación de los registros y del comportamiento de Siril nos dio muchas pistas.</p>

<p>Cuando Siril utiliza Astrometry.net local en Windows, escribe un guion temporal llamado <code>asnet.sh</code> dentro del directorio configurado para el solucionador. Después intenta ejecutarlo como si estuviera dentro de un entorno Cygwin:</p>

<pre><code>Siril en Windows
    → falsa instalación Cygwin
    → guion temporal /tmp/asnet.sh
    → WSL2
    → Astrometry.net
    → solución WCS devuelta a Siril</code></pre>

<p>El primer puente no proporcionaba correctamente ese directorio temporal. Por eso Siril detectaba Astrometry.net, pero fallaba antes de que el solucionador pudiera empezar.</p>

<p>La solución consistió en crear:</p>

<ul>
  <li>Un pequeño directorio que simula la estructura de Cygwin esperada por Siril.</li>
  <li>Envoltorios de Windows en PowerShell y CMD.</li>
  <li>Un enlace entre el <code>asnet.sh</code> generado por Siril y el <code>/tmp/asnet.sh</code> visto desde WSL.</li>
  <li>Un envoltorio de <code>solve-field</code> dentro de WSL que normaliza las rutas mixtas antes de llamar al ejecutable real.</li>
  <li>Un archivo de configuración de Siril específico para este proyecto, evitando modificar la configuración global del usuario.</li>
</ul>

<p>Esta es probablemente la parte más específica de Windows. No bastaba con instalar Astrometry.net en WSL: había que reproducir exactamente las suposiciones que hace Siril sobre Cygwin, los directorios temporales y las rutas.</p>

<h2 id="primero-cinco-despues-cincuenta">Primero cinco, después cincuenta</h2>

<p>Antes de arriesgarnos a lanzar un trabajo de muchas horas, probamos el puente con cinco imágenes. Después repetimos la prueba con cincuenta.</p>

<p>La segunda prueba terminó con 50 de 50 imágenes resueltas astrométricamente y exportadas. Siril construyó un FITS de 2.640 × 2.791 píxeles en unos 8 minutos y 54 segundos.</p>

<p>A diferencia de las pruebas externas con archivos <code>.xyls</code>, esto ya demostraba el flujo completo:</p>

<ol>
  <li>Siril extraía las estrellas.</li>
  <li>Siril invocaba Astrometry.net a través del puente.</li>
  <li>Astrometry.net calculaba la solución WCS.</li>
  <li>Siril recuperaba esa solución.</li>
  <li>Siril registraba y exportaba las imágenes.</li>
  <li>El conjunto podía apilarse.</li>
</ol>

<p>Con esa evidencia llegó el momento de lanzar las 1.278 tomas.</p>

<h2 id="ejecucion-completa">La ejecución completa</h2>

<p>El proceso completo tardó aproximadamente 12 horas y 58 minutos:</p>

<ul>
  <li>Conversión: 31 segundos.</li>
  <li>Resolución astrométrica: 5 horas y 1 minuto.</li>
  <li>Exportación del registro: 3 minutos y 15 segundos.</li>
  <li>Apilado: 7 horas y 53 minutos.</li>
</ul>

<p>El resultado fue un FITS de 6.212 × 4.059 píxeles y 32 bits.</p>

<p>Lo realmente importante fue que las 1.278 imágenes quedaron resueltas y exportadas: pasamos de registrar 254 de 1.278 con el método convencional a registrar 1.278 de 1.278 mediante resolución astrométrica individual. La parte de apilado fue la más lenta, sobre todo por la igualación de los fondos de cielo de cada tesela.</p>

<figure class="kg-card kg-image-card kg-width-wide kg-card-hascaption"><img src="/content/images/2026/08/mosaico-seestar-siril-todas-las-tomas-anotado.jpg" class="kg-image" alt="Mosaico completo anotado tras resolver y registrar las 1.278 tomas del Seestar S30" loading="lazy" width="6212" height="4059" srcset="/content/images/size/w600/2026/08/mosaico-seestar-siril-todas-las-tomas-anotado.jpg 600w, /content/images/size/w1000/2026/08/mosaico-seestar-siril-todas-las-tomas-anotado.jpg 1000w, /content/images/size/w1600/2026/08/mosaico-seestar-siril-todas-las-tomas-anotado.jpg 1600w, /content/images/2026/08/mosaico-seestar-siril-todas-las-tomas-anotado.jpg 6212w" sizes="(min-width: 1200px) 1200px, 100vw"><figcaption><span style="white-space: pre-wrap;">Mosaico anotado construido con las 1.278 tomas. Fotografía: Sergio Cava / Astrocava. Licencia: <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>.</span></figcaption></figure>

<h2 id="resolver-una-vez">Resolver una vez, apilar muchas veces</h2>

<p>Después de invertir casi trece horas en el proceso, no tenía sentido repetir la conversión, la resolución astrométrica y el registro cada vez que quisiéramos probar una selección de calidad diferente.</p>

<p>La solución final se dividió por fases:</p>

<ol>
  <li>Resolver y registrar todas las imágenes una sola vez.</li>
  <li>Conservar esa secuencia registrada como fuente canónica.</li>
  <li>Analizar la calidad de las 1.278 imágenes.</li>
  <li>Crear selecciones reproducibles.</li>
  <li>Ejecutar nuevos apilados reutilizando el registro existente.</li>
</ol>

<p>Aquí apareció otra trampa de Siril. Modificar las banderas de selección dentro de la secuencia no era suficiente: si el comando de apilado no incluía <code>-filter-included</code>, Siril volvía a integrar las 1.278 imágenes.</p>

<p>También probamos a compactar manualmente la secuencia y reorganizar sus datos de registro. El resultado fue más frágil y llegó a provocar un cierre de Siril.</p>

<p>La solución fue conservar intacta la secuencia completa, modificar las banderas únicamente en una copia local de cada experimento y ejecutar:</p>

<pre><code>stack ... -filter-included</code></pre>

<p>Una prueba extrema confirmó el comportamiento: Siril apiló exactamente 3 imágenes de una secuencia de 1.278 en unos 33 segundos, sin repetir ningún cálculo astrométrico.</p>

<h2 id="elegir-imagenes-con-datos">Elegir imágenes con datos, no a ojo</h2>

<p>Tras la charla de Marcos, este era el objetivo inicial con Codex: seleccionar las imágenes antes de apilar. A partir de la secuencia registrada generamos un informe CSV con una fila por imagen. El informe conserva el nombre original, la fecha y hora de captura, los principales metadatos FITS y varias métricas calculadas por Siril:</p>

<ul>
  <li>FWHM.</li>
  <li>Redondez de las estrellas.</li>
  <li>Nivel de fondo.</li>
  <li>Número de estrellas detectadas.</li>
</ul>

<p>Sobre ese CSV construimos un informe HTML que puede abrirse directamente en el navegador. Permite estudiar las distribuciones generales, comparar sesiones, ver la evolución durante cada noche y observar las relaciones entre las distintas métricas.</p>

<figure class="kg-card kg-image-card kg-card-hascaption"><img src="/content/images/2026/08/mosaico-seestar-siril-informe-calidad.jpg" class="kg-image" alt="Informe HTML para analizar FWHM, redondez, fondo de cielo y número de estrellas de las tomas" loading="lazy" width="941" height="1270" srcset="/content/images/size/w600/2026/08/mosaico-seestar-siril-informe-calidad.jpg 600w, /content/images/2026/08/mosaico-seestar-siril-informe-calidad.jpg 941w" sizes="(min-width: 720px) 720px, 100vw"><figcaption><span style="white-space: pre-wrap;">Herramienta de análisis y filtrado de las 1.278 tomas. Captura: Sergio Cava / Astrocava. Licencia: <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>.</span></figcaption></figure>

<p>El informe también permite ajustar umbrales y muestra en directo cuántas imágenes se conservan. Al terminar genera los índices exactos, el comando reproducible y una nota para documentar la decisión.</p>

<h2 id="apilado-filtrado">El apilado filtrado actual</h2>

<p>La integración filtrada que conservamos para la imagen definitiva utiliza 886 de las 1.278 imágenes: unas 2 horas, 27 minutos y 40 segundos de exposición. Se descartaron 392, aproximadamente el 30,7 % del conjunto, principalmente por un fondo de cielo excesivamente brillante, debido sobre todo a la contaminación lumínica o a las nubes.</p>

<p>La selección no afectó por igual a las cuatro sesiones:</p>

<ul>
  <li>20 de 23 imágenes de la primera sesión.</li>
  <li>381 de 431 de la segunda.</li>
  <li>379 de 408 de la tercera.</li>
  <li>106 de 416 de la cuarta.</li>
</ul>

<p>Esto demuestra la utilidad de estudiar cada noche por separado. El número de imágenes capturadas no equivale necesariamente a su contribución útil al resultado.</p>

<figure class="kg-card kg-image-card kg-width-wide kg-card-hascaption"><img src="/content/images/2026/08/mosaico-seestar-siril-integracion-filtrada-anotada.jpg" class="kg-image" alt="Mosaico anotado de la Cadena de Markarian tras seleccionar 886 de las 1.278 tomas" loading="lazy" width="1920" height="1270" srcset="/content/images/size/w600/2026/08/mosaico-seestar-siril-integracion-filtrada-anotada.jpg 600w, /content/images/size/w1000/2026/08/mosaico-seestar-siril-integracion-filtrada-anotada.jpg 1000w, /content/images/size/w1600/2026/08/mosaico-seestar-siril-integracion-filtrada-anotada.jpg 1600w, /content/images/2026/08/mosaico-seestar-siril-integracion-filtrada-anotada.jpg 1920w" sizes="(min-width: 1200px) 1200px, 100vw"><figcaption><span style="white-space: pre-wrap;">Mosaico anotado de la integración filtrada. Fotografía: Sergio Cava / Astrocava. Licencia: <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>.</span></figcaption></figure>

<p>En comparación con la imagen que incluía todas las tomas, se aprecia una mejora en los gradientes, sobre todo en la parte superior, gracias al descarte de las capturas con demasiado brillo de fondo.</p>

<h2 id="sorpresa-pixinsight">Una última sorpresa al abrir el FITS en PixInsight</h2>

<p>El FITS producido por Siril se abría invertido en PixInsight.</p>

<p>La primera tentación era reflejar físicamente la imagen, pero el problema no estaba en los píxeles ni en la solución astrométrica. Era una diferencia en la interpretación del orden de las filas del FITS: en ausencia de una indicación explícita, los programas no siempre interpretan la orientación de la misma manera.</p>

<p>La corrección fue crear una copia y añadir a la cabecera:</p>

<pre><code>ROWORDER = 'BOTTOM-UP'</code></pre>

<p>Esto no modifica la imagen; simplemente le indica a PixInsight cómo debe leerla para mostrarla con la orientación correcta.</p>

<h2 id="aporte-codex">Lo que aportó Codex</h2>

<p>Codex no sustituyó a Siril ni a Astrometry.net. Su papel fue convertir una sucesión de pruebas manuales en un proceso comprobable y repetible:</p>

<ul>
  <li>Generar los guiones de Siril.</li>
  <li>Empezar siempre con ejecuciones pequeñas.</li>
  <li>Leer los registros y distinguir avisos inocuos de errores reales.</li>
  <li>Construir el puente entre Windows y WSL.</li>
  <li>Mantener intactas las imágenes originales.</li>
  <li>Conservar manifiestos, métricas e índices de selección.</li>
  <li>Convertir cada fallo en una prueba que evitase repetirlo.</li>
  <li>Preparar el FITS para su apertura correcta en PixInsight.</li>
</ul>

<p>El resultado no es aplicable solamente a la Cadena de Markarian: es un flujo que puede reutilizarse con otros objetos, justo lo que necesitaba para empezar a procesar aquellos que estaban a la espera de la herramienta.</p>

<p>Además, una vez construida, la herramienta ya no depende de Codex: se puede utilizar directamente.</p>

<h2 id="conclusion">Conclusión</h2>

<p>El principal problema del apilado de la Cadena de Markarian era conseguir registrar en Windows un mosaico de gran extensión y aprovechar todas las imágenes que tuvieran suficiente calidad.</p>

<p>La solución que quedó estable combina Siril 1.4.4, WSL2 y Astrometry.net mediante un puente que adapta las expectativas de Siril sobre Cygwin y normaliza las rutas entre ambos sistemas. Está disponible en <a href="https://github.com/sercava/siril-astro-processing">este repositorio de GitHub</a>.</p>

<p>Después de resolver y registrar las 1.278 tomas una sola vez, la secuencia queda preparada para probar distintas selecciones de calidad sin repetir las cinco horas de resolución astrométrica. El apilado filtrado actual integra 886 imágenes y sirve de base para el procesado y la anotación final.</p>
