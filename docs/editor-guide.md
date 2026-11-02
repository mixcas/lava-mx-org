# Guía para editoras — Pages CMS

Esta guía explica cómo actualizar el sitio de Lava sin tocar código ni usar
GitHub. El contenido se edita en [Pages CMS](https://app.pagescms.org), un
editor que trabaja directamente sobre el repositorio del sitio: cada vez que
guardas, tus cambios se guardan como un commit y el sitio publicado se
reconstruye solo.

Si no encuentras un campo, no puedes entrar o algo se ve mal en el sitio,
escribe al mantenedor del sitio. Solo el mantenedor puede invitarte o recuperar
un cambio desde el historial de Git.

## Antes de empezar

- **La invitación llega por correo.** El mantenedor te invita con tu dirección
  de correo; no necesitas cuenta de GitHub. Abre el enlace del correo y entra a
  <https://app.pagescms.org>. Si no llega o no te deja entrar, pide al
  mantenedor que confirme que tu dirección es exactamente la que registró.
- **Elige la rama correcta.** La app tiene un selector de rama. Para publicar
  cambios de verdad, trabaja en la rama de producción (`main`). Si el
  mantenedor te pide probar algo, te dirá qué otra rama usar: en esas ramas
  nada se publica hasta que el mantenedor las une a `main`.
- **El menú está en inglés, los campos están en español.** El marco de Pages
  CMS (botones, menús) está en inglés; los nombres de los campos y las ayudas
  están en español.
- **No hay vista previa.** Pages CMS no puede mostrarte cómo quedará la página.
  Después de guardar, espera la publicación y revisa el sitio publicado
  (ver [Publicar y revisar](#publicar-y-revisar)).

El menú lateral tiene tres secciones: **Proyectos**, **Acerca de** y
**Ajustes del sitio**.

## Encontrar un proyecto

Abre **Proyectos**. La lista muestra, para cada proyecto, el título, si está en
portada, su orden y sus fechas, ordenados por orden. Haz clic en un proyecto
para abrir su formulario.

## Editar los datos de un proyecto

| Campo | Qué hace |
|---|---|
| **Título** | Nombre público del proyecto. Aparece en la portada, en «Proyectos anteriores» y en su página. |
| **Sede** | Espacio donde se presentó (galería, museo, ciudad). Admite negritas y cursivas con Markdown. |
| **Fechas** | Fechas de exhibición tal como se muestran en la página; admite Markdown. |
| **Proyecto en portada** | Actívalo para que el proyecto aparezca en la portada. Desactivado, aparece en «Proyectos anteriores». Es una decisión editorial: **no** depende de las fechas. |
| **Orden** | Posición dentro de su grupo (portada o proyectos anteriores). El número menor aparece primero. |
| **Columnas de la galería** | `1` para una columna de imágenes, `2` para pares de obras. Solo se admiten 1 y 2. |

La portada y la página «Proyectos anteriores» se llenan con esa casilla y ese
número: no hay que tocar nada más para mover un proyecto de un grupo a otro.

## Editar la galería

La **Galería** es una lista ordenada de imágenes y videos. El orden de la lista
es el orden en que se muestran.

- **Añadir un elemento:** usa el botón para añadir un elemento a la lista y
  elige **Imagen** o **Video**.
- **Elegir una imagen o video existente:** abre el selector de medios y elige
  un archivo de la biblioteca. Reutilizar una imagen ya subida no la duplica.
- **Subir uno nuevo:** desde el mismo selector puedes subir un archivo. Se
  guarda con el nombre original en el repositorio.
- **Texto alternativo (imágenes):** describe la imagen para quien usa lector de
  pantalla. Si lo dejas vacío, se usa el título del proyecto.
- **Imagen de portada (videos):** la imagen fija que se ve antes de reproducir
  y que se usa al compartir el proyecto.
- **Reproducción automática, Repetir y Silenciar (videos):** eligen cómo se
  comporta el video. Los navegadores solo permiten la reproducción automática si
  el video también está silenciado, así que activa **Silenciar** cuando actives
  **Reproducción automática**.
- **Reordenar:** arrastra los elementos de la lista.
- **Quitar:** elimina el elemento de la lista. El archivo no se borra de la
  biblioteca, solo deja de mostrarse en el proyecto.

### Formatos aceptados

- **Imágenes:** WebP, JPG, JPEG, PNG, AVIF y GIF.
- **Videos:** MP4 y WebM.
- **Documentos (PDF):** se guardan en la biblioteca de documentos y se enlazan
  desde el texto (ver abajo).

El sitio rechaza otros formatos (SVG, TIFF, ICO, MOV, …) a propósito: el
procesador de imágenes no puede publicarlos. Si la subida falla con un formato
distinto, convierte el archivo antes de subirlo.

### El proyecto de tres columnas

**Infernal Natures** conserva un diseño de tres columnas que no se edita desde
el CMS. Su galería es, igual que las demás, una sola lista: el sitio la divide a
la mitad y la primera mitad aparece en la columna izquierda. Si necesitas ese
diseño en un proyecto nuevo, pídelo al mantenedor.

## Escribir el texto en español y en inglés

Cada proyecto tiene dos textos, uno por idioma:

- **Texto en español** (obligatorio): se muestra primero.
- **Texto en inglés** (opcional): se muestra después del texto en español,
  separado automáticamente por una línea con `//`. **No escribas `//`**: el
  separador lo pone el sitio. Si dejas el campo vacío, el proyecto se muestra
  solo en español.

Los textos aceptan Markdown: párrafos, **negritas**, *cursivas*, enlaces y
listas. Cada campo tiene un interruptor **Editor / Source**: usa *Source* si el
editor visual se atora y necesitas corregir el formato a mano.

- **Enlaces y descargas van al final del texto en español**, porque el texto en
  inglés es opcional y no queremos que los enlaces desaparezcan cuando no hay
  traducción.
- **Enlazar un PDF:** el archivo vive en la biblioteca de **Documentos** y su
  dirección en el sitio es `/assets/files/nombre-del-archivo.pdf`. En el texto,
  escribe un enlace con esa dirección (por ejemplo
  `[Dossier](/assets/files/Dossier.pdf)`). El sitio añade solo el prefijo
  necesario cuando se publica en una subcarpeta, así que la dirección siempre
  funciona igual.
- **Enlaces externos** (otro sitio, un dossier en la nube) se escriben completos,
  con `https://`.

## Editar «Acerca de»

Abre **Acerca de**. La página tiene tres campos, todos con Markdown:

- **Biografía en español** (obligatoria): se muestra primero.
- **Biografía en inglés** (opcional): se muestra después, separada
  automáticamente por `//`. No escribas `//`.
- **Equipo**: nombres, cargos y el encabezado de colaboradoras anteriores en un
  solo texto.

El título y el diseño de la página no están en el CMS: se conservan tal como
están en el archivo al guardar.

## Editar los ajustes del sitio

Abre **Ajustes del sitio**. Son textos y datos que se repiten en todas las
páginas: nombre y descripción del sitio, correos del encabezado, pie de página
(copyright, ciudad, Instagram) y las etiquetas y direcciones de los dos enlaces
del encabezado.

- Algunos campos **no cambian nada en el sitio**; su propia descripción lo dice
  («No afecta al sitio»). Son valores guardados como referencia: puedes
  dejarlos como están.
- Las **direcciones** de los enlaces del encabezado solo deben cambiar si la
  página cambia de dirección. Una dirección equivocada deja el enlace roto.

## Crear, renombrar y borrar un proyecto

- **Crear:** en **Proyectos**, usa el botón de crear. El nombre del archivo se
  propone a partir del título y puedes cambiarlo antes de guardar.
- **Renombrar o borrar:** desde la lista o desde el formulario del proyecto.
  Puedes hacerlo sin el mantenedor; el historial de Git es la forma de
  recuperar lo que se pierda.

### Aviso: el nombre del archivo define la dirección pública

La dirección de un proyecto es su nombre de archivo:

```
src/proyectos/penumbra.md  →  /proyectos/penumbra/
```

El campo **Filename** está al inicio del formulario. En un proyecto existente
aparece bloqueado; si lo desbloqueas y lo cambias, **cambia la dirección
pública y se rompen los enlaces y marcadores que apuntan al proyecto**. No hay
redirecciones automáticas. Cambia el nombre solo si es necesario y avisa al
mantenedor.

## Publicar y revisar

1. Guarda el formulario. Pages CMS guarda el cambio como un commit en la rama
   en la que estás trabajando. Puede tardar unos segundos.
2. En la rama de producción (`main`), ese commit inicia la publicación
   automática (**GitHub Actions**). Tarda **aproximadamente 4 minutos**.
3. Cuando termine, abre el sitio publicado en la dirección de producción (por
   ejemplo <https://lava-mx.org>) y revisa la página: el proyecto, su galería,
   el texto y la portada o «Proyectos anteriores» si moviste la casilla.
   Recarga la página (o ábrela en una ventana nueva) para no ver la versión
   guardada en el navegador.
4. Si guardaste en otra rama, **nada se publica** hasta que el mantenedor la
   una a `main`.

### Si algo sale mal

- **La página no cambió:** espera unos minutos más y recarga. Si sigue igual,
  revisa que guardaste en la rama correcta.
- **El sitio no muestra tu último cambio:** la publicación pudo fallar; avisa
  al mantenedor con el nombre del proyecto y la hora del guardado.
- **Moviste o borraste algo por error:** no lo vuelvas a escribir a mano. Avisa
  al mantenedor: puede recuperar la versión anterior desde el historial de Git.

## Lo que el CMS no hace

- **No hay vista previa** de la página: revisa el sitio publicado.
- **No hay aviso automático de cambio de dirección** al renombrar: el aviso es
  el texto de ayuda del campo **Filename** y del **Título** (ver arriba).
- **No corrige formatos de imagen:** convierte el archivo antes de subirlo.
- **No renombra tus archivos:** las subidas conservan el nombre original, que
  es el que el sitio espera encontrar.
