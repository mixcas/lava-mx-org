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

## Dos versiones del sitio: español e inglés

El sitio se publica en dos versiones. El español está en las direcciones de
siempre (`/`, `/proyectos/`, cada proyecto y `/acerca-de/`); el inglés está en
las mismas direcciones con `/en/` adelante (`/en/`, `/en/proyectos/`, el mismo
proyecto y `/en/acerca-de/`). No hay que elegir idioma ni cambiar de dirección:
cada página lleva arriba un enlace al idioma contrario — «English» en las
páginas en español y «Español» en las de inglés — que lleva a *esa misma*
página en el otro idioma.

Cada proyecto y la página «Acerca de» tienen dos bloques, uno por idioma:

- **Versión en español:** es la única obligatoria: el título y el texto son
  necesarios para publicar; la sede y las fechas, no.
- **Versión en inglés:** todo es opcional. **No hace falta traducir para
  publicar**: un campo en inglés que dejes vacío se muestra en español en la
  versión en inglés, sin aviso en la página. Puedes traducir un proyecto a la
  vez, cuando tengas el texto.

Cómo se leen los dos casos:

- **Campo en inglés vacío:** la versión en inglés muestra ese dato en español.
  La página nunca se ve incompleta ni rota.
- **Mismo valor en los dos idiomas** (el nombre de un proyecto, una sede):
  cópialo también al campo en inglés. Copiarlo **no repite nada** en la
  página: es la forma de decir «lo revisé, se escribe igual en los dos idiomas»
  y deja de aparecer en la lista de pendientes (ver
  [La lista de pendientes de traducción](#la-lista-de-pendientes-de-traducción)).
  Un campo en inglés vacío y un campo copiado idéntico no se ven distintos en
  el sitio; sí en esa lista.

## La lista de pendientes de traducción

Cada vez que el sitio se reconstruye, revisa en el registro de la publicación
—la pestaña **Actions** de GitHub, o la salida de `npm run build` en una
computadora— una lista como esta:

```text
Untranslated English values (3 projects):
  - src/proyectos/corteza-liquida.md: en.venue, en.dates
  - src/proyectos/penumbra.md: en.title, en.dates, en.text
  - src/proyectos/piel-de-proxy.md: en.title, en.venue, en.dates, en.text
```

- Es la **única lista de qué falta traducir**. Pidesela al mantenedor o
  mírala con quien tenga acceso al registro.
- Cada línea nombra el archivo de un proyecto (el nombre del archivo es el de
  su dirección pública) y los campos del **bloque en inglés** que están vacíos
  y que en español sí tienen texto: `en.title` es «Título en inglés`,
  `en.venue` «Sede en inglés», `en.dates` «Fechas en inglés» y `en.text` «Texto
  en inglés».
- Cuando escribes ese campo —traducido o copiado porque es igual en los dos
  idiomas— desaparece de la lista.
- **La lista nunca impide publicar.** Un proyecto con todo el inglés vacío se
  publica igual; la lista es la tarea pendiente, no un error.

## Encontrar un proyecto

Abre **Proyectos**. La lista muestra, para cada proyecto, su título en español,
si está en portada, su orden y sus fechas en español, ordenados por orden. Haz
clic en un proyecto para abrir su formulario.

## Editar los datos de un proyecto

El formulario empieza con los dos bloques de idioma, **Versión en español** y
**Versión en inglés**. Los datos son los mismos en los dos:

| Campo | Qué hace |
|---|---|
| **Título** | Nombre público del proyecto. Aparece en la portada, en «Proyectos anteriores» y en su página. En español es obligatorio y, además, es el que genera el nombre del archivo y la dirección pública. |
| **Sede** | Espacio donde se presentó (galería, museo, ciudad). |
| **Fechas** | Fechas de exhibición tal como se muestran en la página; admite Markdown. |
| **Texto** | El texto del proyecto; admite Markdown (ver [Escribir el texto en español y en inglés](#escribir-el-texto-en-español-y-en-inglés)). |

En el bloque en inglés todos los campos son opcionales; si lo dejas vacío, la
versión en inglés usa el valor en español.

Después vienen los datos compartidos, que son **uno solo para las dos
versiones**:

| Campo | Qué hace |
|---|---|
| **Proyecto en portada** | Actívalo para que el proyecto aparezca en la portada. Desactivado, aparece en «Proyectos anteriores» (en las dos versiones). Es una decisión editorial: **no** depende de las fechas. |
| **Orden** | Posición dentro de su grupo (portada o proyectos anteriores). El número menor aparece primero. |
| **Columnas de la galería** | `1` para una columna de imágenes, `2` para pares de obras. Solo se admiten 1 y 2. |

La portada y la página «Proyectos anteriores» se llenan con esa casilla y ese
número: no hay que tocar nada más para mover un proyecto de un grupo a otro, y
un proyecto aparece en el mismo lugar en español y en inglés.

## Editar la galería

La **Galería** es una lista ordenada de imágenes y videos, compartida por las
dos versiones del idioma: el orden de la lista es el orden en que se muestran,
en español y en inglés. No hay que subir ni ordenar las imágenes dos veces.

- **Añadir un elemento:** usa el botón para añadir un elemento a la lista y
  elige **Imagen** o **Video**.
- **Elegir una imagen o video existente:** abre el selector de medios y elige
  un archivo de la biblioteca. Reutilizar una imagen ya subida no la duplica.
- **Subir uno nuevo:** desde el mismo selector puedes subir un archivo. Se
  guarda con el nombre original en el repositorio.
- **Texto alternativo en español / en inglés (imágenes):** describe la imagen
  para quien usa lector de pantalla, en cada idioma. Si dejas vacío el de un
  idioma, se usa el título del proyecto en ese idioma y, si tampoco existe, el
  título en español.
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

Cada proyecto tiene dos textos, uno en cada bloque de idioma:

- **Texto en español** (obligatorio): es el que se ve en la página en español.
  No se muestra en la página en inglés.
- **Texto en inglés** (opcional): es el que se ve en la página en inglés. Si lo
  dejas vacío, la página en inglés muestra el texto en español —sin aviso y
  marcado como español para quien usa lector de pantalla—, así que el proyecto
  nunca se ve vacío.

Los dos bloques se ven **en páginas distintas**, no uno debajo del otro: no hay
separadores que escribir, y ninguna página muestra las dos versiones juntas. La
única excepción es la página «no encontrada» (404), que lleva una línea en cada
idioma (su texto se edita en los ajustes del sitio).

Los textos aceptan Markdown: párrafos, **negritas**, *cursivas*, enlaces y
listas. Cada campo tiene un interruptor **Editor / Source**: usa *Source* si el
editor visual se atora y necesitas corregir el formato a mano.

- **Enlaces y descargas:** cada bloque tiene su propio botón de insertar y la
  misma biblioteca de **Documentos**, así que puedes enlazar un PDF desde el
  texto en español y, si quieres, también desde el texto en inglés. Un enlace
  escrito solo en el texto en español no aparece en la página en inglés.
- **Subir y enlazar un PDF:** usa el botón de insertar del editor y elige la
  biblioteca de **Documentos**: puedes subir el PDF ahí mismo y enlazarlo en el
  texto. Si lo prefieres, escribe el enlace a mano: la dirección del archivo es
  `/assets/files/nombre-del-archivo.pdf` (por ejemplo
  `[Dossier](/assets/files/Dossier.pdf)`). El sitio añade solo el prefijo
  necesario cuando se publica en una subcarpeta, así que la dirección siempre
  funciona igual.
- **Enlaces externos** (otro sitio, un dossier en la nube) se escriben completos,
  con `https://`.

## Editar «Acerca de»

Abre **Acerca de**. La página tiene los dos bloques de idioma, con los mismos
tres campos, todos con Markdown:

En **Versión en español** (la única obligatoria):

- **Título de la página en español:** se ve como título de la pestaña y como
  encabezado de la versión en español.
- **Biografía en español:** el texto sobre el colectivo.
- **Equipo en español:** nombres, cargos y el encabezado de colaboradoras
  anteriores en un solo texto.

En **Versión en inglés** los tres son opcionales: los que dejes vacíos se
muestran en español en la versión en inglés. Escribe cada cargo en su idioma,
sin la traducción al lado: `/en/acerca-de/` tiene su propia lista.

El diseño de la página no está en el CMS: se conserva tal como está en el
archivo al guardar.

## Editar los ajustes del sitio

Abre **Ajustes del sitio**. Son textos y datos que se repiten en todas las
páginas. Primero están los datos que no dependen del idioma: nombre del sitio,
correos del encabezado, ciudad y redes de referencia. Debajo vienen **Versión en
español** y **Versión en inglés**, cada una con lo mismo:

- la **descripción** del sitio para buscadores y redes sociales;
- el **nombre de la navegación** y los **encabezados** de la portada y de
  «Proyectos anteriores» (textos que solo leen los lectores de pantalla);
- el **pie de página** (copyright, ciudad, Instagram);
- las **etiquetas y la página enlazada** de los dos enlaces del encabezado;
- el aviso de **página no encontrada** (404): es la única página que se muestra
  en los dos idiomas a la vez, así que lleva una línea en español y otra en
  inglés, cada una con su enlace a la portada de ese idioma. Por eso **sus dos
  versiones son obligatorias**.

Ten en cuenta:

- Aquí **no hay respaldo automático al español**: si dejas vacía la versión en
  inglés de un ajuste, en las páginas en inglés se ve vacío, no en español.
  Escribe los dos idiomas (o copia el valor cuando sea igual en los dos).
- Algunos campos **no cambian nada en el sitio**; su propia descripción lo dice
  («No afecta al sitio»). Son valores guardados como referencia: puedes
  dejarlos como están.
- La **página enlazada** de cada enlace del encabezado es una clave
  (`about`, `projects`), no una dirección: el sitio construye la dirección de
  cada idioma a partir de ella. Cámbiala solo si el mantenedor te lo pide.

## Crear, renombrar y borrar un proyecto

- **Crear:** en **Proyectos**, usa el botón de crear. El nombre del archivo se
  propone a partir del **título en español** y puedes cambiarlo antes de
  guardar. Escribe el título en español primero: de él sale la dirección.
- **Renombrar o borrar:** desde la lista o desde el formulario del proyecto.
  Puedes hacerlo sin el mantenedor; el historial de Git es la forma de
  recuperar lo que se pierda.

### Aviso: el nombre del archivo define la dirección pública

El nombre del archivo viene del título en español y define las **dos**
direcciones del proyecto, la española y la inglesa con `/en/` adelante:

```
src/proyectos/penumbra.md  →  /proyectos/penumbra/
                              /en/proyectos/penumbra/
```

El campo **Filename** está al inicio del formulario. En un proyecto existente
aparece bloqueado; si lo desbloqueas y lo cambias, **cambian las dos direcciones
públicas y se rompen los enlaces y marcadores que apuntan al proyecto**. No hay
redirecciones automáticas. El título en inglés no cambia ninguna dirección.
Cambia el nombre solo si es necesario y avisa al mantenedor.

## Publicar y revisar

1. Guarda el formulario. Pages CMS guarda el cambio como un commit en la rama
   en la que estás trabajando. Puede tardar unos segundos. El commit queda
   registrado a tu nombre y con tu correo, así que el historial muestra quién
   hizo cada cambio.
2. En la rama de producción (`main`), ese commit inicia la publicación
   automática (**GitHub Actions**). Tarda **aproximadamente 4 minutos**.
3. Cuando termine, abre el sitio publicado en la dirección de producción (por
   ejemplo <https://lava-mx.org>) y revisa la página: el proyecto, su galería,
   el texto y la portada o «Proyectos anteriores» si moviste la casilla. Revisa
   también la versión en inglés: el enlace «English» del encabezado lleva a la
   misma página en `/en/`. Recarga la página (o ábrela en una ventana nueva) para
   no ver la versión guardada en el navegador.
4. Si guardaste en otra rama, **nada se publica** hasta que el mantenedor la
   una a `main`.

### Si algo sale mal

- **La página no cambió:** espera unos minutos más y recarga. Si sigue igual,
  revisa que guardaste en la rama correcta.
- **El sitio no muestra tu último cambio:** la publicación pudo fallar; avisa
  al mantenedor con el nombre del proyecto y la hora del guardado.
- **La publicación falló después de tu cambio:** el sitio no se publica cuando
  un proyecto quedó sin título o sin texto en español, cuando un campo en
  inglés se guardó solo con espacios o cuando un enlace apunta a un archivo que
  ya no existe. El registro nombra el archivo y el campo: corrige ese campo,
  vuelve a guardar y, si no sabes cuál es, avisa al mantenedor con el mensaje.
- **Moviste o borraste algo por error:** no lo vuelvas a escribir a mano. Avisa
  al mantenedor: puede recuperar la versión anterior desde el historial de Git.

## Lo que el CMS no hace

- **No hay vista previa** de la página: revisa el sitio publicado.
- **No muestra qué está traducido:** la lista de pendientes la imprime la
  publicación (ver arriba); el CMS no tiene una columna de estado.
- **No valida el inglés de un proyecto:** el CMS te deja guardar un campo en
  inglés solo con espacios, y el sitio rechaza esa publicación del proyecto. En
  «Acerca de» un campo en inglés vacío se guarda sin problema y la versión en
  inglés muestra el español. Deja vacío el campo si no hay traducción.
- **No hay aviso automático de cambio de dirección** al renombrar: el aviso es
  el texto de ayuda del campo **Filename** y del **Título en español** (ver
  arriba).
- **No corrige formatos de imagen:** convierte el archivo antes de subirlo.
- **No renombra tus archivos:** las subidas conservan el nombre original, que
  es el que el sitio espera encontrar.
