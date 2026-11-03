---
layout: about
# One template, one About page per language version (ADR-0002): the pagination
# yields `/acerca-de/` for Spanish and `/en/acerca-de/` for English. Every page
# of the pagination enters the collections, so the `languageRoutes` registry
# sees both and the header language link, the hreflang set and the sitemap
# alternates appear for this route without any further work (see
# layouts/base.njk).
pagination:
  data: languages
  size: 1
  alias: lang
  resolve: values
  addAllPagesToCollections: true
permalink: "{{ lang.prefix }}/acerca-de/"
# The page's own heading and `<title>` come from the language version below, so
# each renders its own text rather than one language borrowing the other's.
# `localizedText` applies the Untranslated field rule (GLOSSARY, ADR-0002): with
# no English title written, the English page carries the Spanish one.
eleventyComputed:
  title: "{{ { es: es, en: en } | localizedText(lang.code, 'title') }}"
es:
  title: "Acerca de"
  bio: |-
    Lava es materia incandescente que fluye entre las faldas de un volcán que marca nuevas cartografías en su recorrido.
    Lava es un colectivo curatorial situado en Ciudad de México, conformado por curadoras que realizan proyectos transversales de investigación y curaduría de prácticas artísticas. Lava desarrolla líneas de investigación para su programa anual vinculados a temáticas urgentes para nuestro(s) tiempo(s) presente(s). Nuestro colectivo da salida a su programa a través de proyectos inmersos en la relación arte y ciencia que pueden derivar en formatos curatoriales desde la ficción especulativa, el enfoque eco comunitario y pedagógico en espacio público o colaboraciones expositivas con espacios independientes.
  team: |-
    **Adriana Flores Suárez**
    *Fundadora y Curadora*

    *Colaboradoras anteriores:*

    **Fernanda Ramos Mena**
    *Curadora Asociada*

    **Fátima Payró Arandia**
    *Asistencia Curatorial*
en:
  title: "About"
  bio: |-
    Lava is incandescent matter that flows down the slopes of a volcano, marking new cartographies in its path.
    Lava is a curatorial collective based in Mexico City, composed of curators who carry out transversal projects of research and curation of artistic practices. Lava develops lines of research for its annual program linked to urgent themes of our present time(s). Our collective implements its program through projects immersed in the relationship between art and science, which can result in curatorial formats ranging from speculative fiction, eco-community and pedagogical approaches in public spaces, to exhibition collaborations with artist run space and independent spaces.
  team: |-
    **Adriana Flores Suárez**
    *Founder and Curator*

    *Former collaborators:*

    **Fernanda Ramos Mena**
    *Associate Curator*

    **Fátima Payró Arandia**
    *Curatorial Assistant*
---
