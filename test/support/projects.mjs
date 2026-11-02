/**
 * Baseline editorial expectations for the generated site.
 *
 * These values describe the public site as it is deployed today, not how the
 * templates are written. They are the safety net for the content-model
 * migration: every entry here is a fact a visitor can see, so a change in
 * front matter, layouts, or the image pipeline that alters one of them must
 * fail the suite.
 *
 * `featured: true` marks a homepage project; the rest are archive projects.
 * Array order is the order each group must appear in on its page.
 */
export const PROJECTS = [
  {
    route: "/proyectos/mineralia-indisciplinada/",
    title: "Mineralia indisciplinada",
    featured: true,
    venue: "Museo Universitario del Chopo. Ciudad de México.",
    dates: "Inauguración: Octubre 23, 2025 — Marzo 2026",
    spanish: "es un proyecto curatorial realizado en conjunto con lxs artistas Mariana Dussel",
    english: "is a curatorial project developed in collaboration with artists Mariana Dussel",
    images: 11,
    // `position` is the item's zero-based index in the gallery, so a gallery
    // that reorders media items fails here even when the count is unchanged.
    videos: [{ source: "Reel_chopo_audio.mp4", position: 1, hasPoster: true, autoplay: false, loop: false, muted: false }],
  },
  {
    route: "/proyectos/y-las-entranas-gritaron/",
    title: "Y las entrañas gritaron...",
    featured: true,
    venue: "guadalajara90210",
    dates: "29 marzo - 26 abril, 2025. Ciudad de México.",
    spanish: "es una exposición colectiva que se adentra en la alteración de los compuestos naturales y minerales de la Tierra",
    english: "is a group show that delves into the alteration of Earth's natural and mineral compounds",
    images: 9,
    videos: [{ source: "LAVA-FLYER-MOTION.mp4", position: 9, hasPoster: false, autoplay: true, loop: true, muted: true }],
  },
  {
    route: "/proyectos/corteza-liquida/",
    title: "Corteza Líquida",
    featured: true,
    venue: "laNao Galería",
    dates: "1 febrero - 1 abril, 2025. Ciudad de México.",
    spanish: "es una exposición individual de la artista Sonia Bandura",
    english: "is a solo exhibition by artist Sonia Bandura",
    images: 10,
    videos: [],
  },
  {
    route: "/proyectos/tramas-de-lo-indomito/",
    title: "Tramas de lo indómito",
    featured: false,
    venue: "Galería Municipal",
    dates: "16 octubre - 20 noviembre, 2024. Querétaro.",
    spanish: "ahonda en las nociones de ecologías y poéticas queer",
    images: 9,
    videos: [],
  },
  {
    route: "/proyectos/tiempos-pendulares/",
    title: "Tiempos Pendulares",
    featured: false,
    venue: "Islera",
    dates: "20 Julio - 17 Agosto, 2024. CDMX.",
    spanish: "es una una propuesta expositiva entre dos artistas",
    images: 11,
    videos: [],
  },
  {
    route: "/proyectos/infernal-natures/",
    title: "Infernal Natures",
    featured: false,
    venue: "B-LA-M > Roam Space + Wonzimer + Lava",
    dates: "29 Jun - 7 Jul 2024. Berlín.",
    spanish: "es un intercambio de tres años que busca fortalecer las relaciones",
    images: 8,
    videos: [],
  },
  {
    route: "/proyectos/penumbra/",
    title: "Penumbra",
    featured: false,
    // The source content has no venue; the page must not invent one.
    venue: null,
    dates: "1 - 18 Febrero 2024. Ciudad de México.",
    spanish: "es una exposición colectiva en la que se reúne la obra de siete artistas",
    images: 12,
    videos: [],
  },
  {
    route: "/proyectos/vestigios-metabolicos/",
    title: "Vestigios Metabolicos",
    featured: false,
    venue: "Más Arte Galería",
    dates: "26 Octubre - 10 Noviembre 2023. Quito, Ecuador.",
    spanish: "es el espacio donde se muestran piezas o vestigios de corporalidades indistintas",
    images: 9,
    videos: [],
  },
  {
    route: "/proyectos/piel-de-proxy/",
    title: "Piel de Proxy",
    featured: false,
    venue: "Trámite Buró de Coleccionistas",
    dates: "5 - 8 Octubre 2023. Quéretaro.",
    spanish: "es el acontecer de un mundo pospretérito",
    images: 9,
    videos: [],
  },
  {
    route: "/proyectos/open-studio-christian-wedel/",
    title: "Open Studio: Christian Wedel",
    featured: false,
    venue: "Porvenir Residencias",
    dates: "12 de Agosto 2023. Ciudad de México.",
    spanish: "es un artista que trabaja desde la inmensidad y densidad de los ecosistemas tropicales",
    images: 13,
    videos: [],
  },
  {
    route: "/proyectos/sangre-y-savia/",
    title: "Sangre y Savia",
    featured: false,
    venue: "Studio Croma",
    dates: "17 Junio - 15 Julio 2023. Ciudad de México.",
    spanish: "En este ejercicio de ficción especulativa, suceden vínculos interespecie",
    images: 10,
    videos: [],
  },
  {
    route: "/proyectos/lianas-neotropicales/",
    title: "Lianas Neotropicales",
    featured: false,
    venue: "Compás 88",
    dates: "13 - 20 de Mayo 2023. Ciudad de México.",
    spanish: "es un despliegue de la investigación de la artista",
    images: 6,
    videos: [],
  },
];

export const HOMEPAGE_PROJECTS = PROJECTS.filter((project) => project.featured);
export const ARCHIVE_PROJECTS = PROJECTS.filter((project) => !project.featured);

/** Site-wide copy the migration must keep using. */
export const SITE = {
  title: "Lava",
  description:
    "Lava es una plataforma de encuentros transversales entre investigación, gestión y curaduría de prácticas artísticas ubicada en la Ciudad de México.",
};

/** About page copy the migration must keep rendering. */
export const ABOUT = {
  spanish:
    "Lava es materia incandescente que fluye entre las faldas de un volcán que marca nuevas cartografías en su recorrido.",
  english: "Lava is incandescent matter that flows down the slopes of a volcano, marking new cartographies in its path.",
  team: [
    "Adriana Flores Suárez",
    "Fernanda Ramos Mena",
    "Fátima Payró Arandia",
    "Colaboradoras anteriores / Former collaborators:",
  ],
};
