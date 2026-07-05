// ============================================================
// i18n.js — bilingual FR/EN, no build step, live toggle
// ----------------------------------------------------------------
// - Language resolution: ?lang=xx  >  localStorage  >  navigator  >  fr
// - Translates every [data-i18n] (textContent), [data-i18n-html]
//   (innerHTML, for <b> emphasis) and [data-i18n-attr] (attributes).
// - Persists the choice and fires `ic:langchange` so the 3D page can
//   re-render its panel/labels without a reload.
// - Page-level copy lives here; hotspot copy lives in content.js (`en`).
// Load this BEFORE analytics.js so pageviews carry the right lang.
// ============================================================

(function () {
  const STORE_KEY = 'ic:lang';
  const SUPPORTED = ['fr', 'en'];

  const DICT = {
    fr: {
      // -- nav / chrome --------------------------------------------------
      'nav.back': 'Retour',
      'brand.imoca': 'Imoca · 60 pieds',

      // -- index ---------------------------------------------------------
      'index.title': 'Initiatives-Cœur · Bienvenue à bord',
      'index.hero.eyebrow': 'Bienvenue à bord',
      'index.hero.h1': 'Le bateau de <b>Violette Dorange</b>',
      'index.hero.baseline': '« Défier les océans pour sauver des enfants. »',
      'index.hero.intro': 'Le bateau est inaccessible aujourd’hui — mais tout son univers tient dans votre main. Choisissez par où commencer.',
      'index.t1.num': '01 · Visite immersive',
      'index.t1.h2': 'Monter à bord <b>en 3D</b>',
      'index.t1.p': 'Tournez autour du bateau, explorez ses huit points-clés : foils, quille, cockpit, mât, safrans, et plus encore. Avec audio guidé.',
      'index.t1.cta': 'Démarrer la visite',
      'index.t2.num': '02 · Le projet',
      'index.t2.h2': 'Violette & <b>l’aventure</b>',
      'index.t2.p': 'La skippeuse, ses objectifs sportifs, la Route du Rhum, le Vendée Globe 2028, et la double dimension humanitaire du projet.',
      'index.t2.cta': 'Découvrir',
      'index.t3.num': '03 · Mécénat',
      'index.t3.h2': 'Chirurgie <b>Cardiaque</b>',
      'index.t3.p': 'Plus de cinq cents enfants sauvés grâce au projet. Comment fonctionne l’association partenaire, et comment chaque mille parcouru compte.',
      'index.t3.cta': 'En savoir plus',
      'index.t4.num': '04 · Sponsors',
      'index.t4.h2': 'Les <b>mécènes</b>',
      'index.t4.p': 'Ils rendent possible le projet sportif et solidaire. Découvrez les marques engagées aux côtés d’Initiatives-Cœur.',
      'index.t4.cta': 'Voir les sponsors',

      // -- visite (chrome; hotspot copy is in content.js) ----------------
      'visite.title': 'Visite immersive · Initiatives-Cœur',
      'visite.brand.eyebrow': 'Visite immersive',
      'visite.loader': 'Chargement du bateau · 3,5 Mo',
      'visite.loading': 'Chargement',
      'visite.hint': 'Faites tourner · touchez un point lumineux',
      'visite.nav.prev': '‹ Précédent',
      'visite.nav.next': 'Suivant ›',
      'visite.aria.close': 'Fermer',
      'visite.aria.listen': 'Écouter',
      'visite.mode.video': 'Vidéo',
      'visite.tab.text': 'Texte',
      'visite.tab.video': 'Vidéo Violette',
      'visite.tab.360': 'Vue 360°',
      'visite.tab.image': 'Photo',
      'visite.audio.listen': 'Écouter la description',
      'visite.audio.playing': 'Lecture en cours…',
      'visite.audio.paused': 'En pause',
      'visite.audio.done': 'Description terminée',
      'visite.audio.generating': 'Audio en cours de génération…',
      'visite.audio.error': 'Audio à régénérer · scripts/generate_audio.py',
      'visite.err.engine': 'Impossible de charger la visite 3D. Vérifiez votre connexion et rechargez la page.',
      'visite.err.model': 'Impossible de charger le modèle du bateau. Vérifiez votre connexion et rechargez la page.',
      'visite.alert.360': 'La galerie 360° (Insta X5) sera disponible dès que les prises auront été tournées.',
      'visite.alert.video': 'La vidéo de visite par Violette sera intégrée dès qu’elle sera fournie.',
      'visite.ph.video.label': 'Vidéo Violette · à intégrer',
      'visite.ph.video.note': 'Le montage de la visite par Violette Dorange sera glissé ici.',
      'visite.ph.360.label': 'Photo 360° · à tourner',
      'visite.ph.360.note': 'Les prises 360° de l’Insta X5 seront affichées en navigation immersive.',
      'visite.ph.image.label': 'Photo détail · à fournir',
      'visite.ph.image.note': 'Une photo HD de la zone du bateau viendra illustrer le descriptif.',

      // -- projet --------------------------------------------------------
      'projet.title': 'Le projet · Initiatives-Cœur',
      'projet.brand.eyebrow': 'Le projet',
      'projet.s1.eyebrow': 'Le projet',
      'projet.s1.h1': 'Défier les océans pour <b>sauver des enfants</b>',
      'projet.s1.lead': 'Initiatives-Cœur est un projet de course au large qui finance la chirurgie cardiaque d’enfants en situation de précarité. Chaque mille parcouru sur l’océan, chaque sponsor mobilisé contribue à une opération qui sauve une vie.',
      'projet.s1.img': 'L’IMOCA Initiatives-Cœur en navigation',
      'projet.s2.eyebrow': 'La skippeuse',
      'projet.s2.h2': 'Violette <b>Dorange</b>',
      'projet.s2.p1': 'À vingt-quatre ans, Violette Dorange s’est affirmée comme l’une des figures montantes de la course au large. Sortie du Vendée Globe 2024-2025 avec une notoriété immense et une réputation d’authenticité, elle prend en 2026 les commandes du projet Initiatives-Cœur en préparation du Vendée Globe 2028.',
      'projet.s2.p2': 'Elle incarne une nouvelle génération de marins : sportifs de très haut niveau, mais aussi engagés sur des causes qui dépassent la performance pure. Le mariage avec Initiatives-Cœur va de soi.',
      'projet.s3.eyebrow': 'Le calendrier sportif',
      'projet.s3.h2': 'Les prochaines <b>courses</b>',
      'projet.s3.c1': 'Vendée Arctique',
      'projet.s3.c2': 'Route du Rhum',
      'projet.s3.c3': 'Vendée Globe',
      'projet.s3.p': 'Avant le grand rendez-vous de 2028, deux étapes majeures rythment la saison : la Vendée Arctique au départ des Sables-d’Olonne en juin, puis la mythique Route du Rhum entre Saint-Malo et Pointe-à-Pitre en novembre. Le bateau y est suivi par les villages des départs et arrivées, où le public peut le découvrir.',
      'projet.s4.eyebrow': 'Le bateau',
      'projet.s4.h2': 'Un IMOCA de <b>dernière génération</b>',
      'projet.s4.p': 'Lancé en 2022, l’IMOCA Initiatives-Cœur intègre les dernières avancées techniques de la classe : foils larges qui permettent au bateau de voler au-dessus de l’eau, proue arrondie qui dévie les paquets de mer, cockpit fermé qui protège la skippeuse. Dix-huit mètres de coque, vingt-neuf mètres de mât, seize tonnes — un objet de course extrême.',
      'projet.s4.cta': 'Visiter le bateau en 3D →',

      // -- mécénat -------------------------------------------------------
      'mecenat.title': 'Mécénat Chirurgie Cardiaque · Initiatives-Cœur',
      'mecenat.brand.eyebrow': 'Mécénat',
      'mecenat.s1.eyebrow': 'L’association partenaire',
      'mecenat.s1.h1': 'Plus de <b>cinq cents enfants</b><br/>sauvés grâce au projet',
      'mecenat.s1.lead': 'L’association Mécénat Chirurgie Cardiaque accueille en France des enfants atteints de malformations cardiaques venus de pays qui n’ont pas les moyens techniques de les soigner. Initiatives-Cœur en est l’ambassadeur sportif depuis sa création.',
      'mecenat.s1.img': 'Un enfant accueilli par Mécénat Chirurgie Cardiaque',
      'mecenat.s2.h2': 'Le <b>cycle vertueux</b> du projet',
      'mecenat.s2.p': 'Chaque sponsor mobilisé sur le bateau, chaque marque de chocolat vendue, chaque mille parcouru en course contribue directement au financement des opérations cardiaques. Le sport n’est pas qu’une vitrine — c’est le moteur économique du programme humanitaire.',
      'mecenat.s2.c1': 'Enfants sauvés',
      'mecenat.s2.c2': 'opération / mécène',
      'mecenat.s2.c3': 'Vies changées',
      'mecenat.s3.h2': 'Comment <b>fonctionne</b> l’association',
      'mecenat.s3.p1': 'Les enfants accueillis viennent principalement d’Afrique, du Moyen-Orient et d’Asie. Ils sont opérés par des équipes médicales bénévoles dans des hôpitaux partenaires en France, hébergés dans des familles d’accueil pendant la durée du traitement, puis raccompagnés dans leur pays une fois rétablis. L’ensemble du parcours médical et humain est pris en charge par l’association.',
      'mecenat.s3.p2.pre': 'Pour soutenir directement Mécénat Chirurgie Cardiaque, rendez-vous sur ',

      // -- sponsors ------------------------------------------------------
      'sponsors.title': 'Sponsors & mécènes · Initiatives-Cœur',
      'sponsors.brand.eyebrow': 'Les mécènes',
      'sponsors.s1.eyebrow': 'Sans eux, rien ne serait possible',
      'sponsors.s1.h1': 'Les marques <b>engagées</b>',
      'sponsors.s1.lead': 'Chaque sponsor d’Initiatives-Cœur ne soutient pas seulement une équipe sportive — il finance directement les opérations chirurgicales d’enfants accueillis par Mécénat Chirurgie Cardiaque. Voici les marques qui, par leur engagement, transforment chaque mille parcouru en vie sauvée.',
      'sponsors.s2.h2': 'Partenaires <b>principaux</b>',
      'sponsors.card.main': 'Partenaire principal',
      'sponsors.card.tech': 'Partenaire technique',
      'sponsors.card.free': 'Espace disponible',
      'sponsors.card.yourbrand': 'Votre marque',
      'sponsors.s2.note': 'Les logos officiels seront intégrés ici quand vous fournirez les fichiers SVG/PNG haute résolution.',
      'sponsors.s3.h2': 'Devenir <b>mécène</b>',
      'sponsors.s3.p': 'Vous représentez une marque sensible aux valeurs de dépassement, d’engagement et de solidarité ? Le projet Initiatives-Cœur offre une visibilité internationale à travers les plus grandes courses au large, tout en s’inscrivant dans une démarche philanthropique concrète et mesurable.',
      'sponsors.s3.cta': 'Contacter l’équipe →'
    },

    en: {
      // -- nav / chrome --------------------------------------------------
      'nav.back': 'Back',
      'brand.imoca': 'Imoca · 60 ft',

      // -- index ---------------------------------------------------------
      'index.title': 'Initiatives-Cœur · Welcome aboard',
      'index.hero.eyebrow': 'Welcome aboard',
      'index.hero.h1': '<b>Violette Dorange</b>’s boat',
      'index.hero.baseline': '“Defying the oceans to save children.”',
      'index.hero.intro': 'The boat is off-limits today — but its whole world fits in your hand. Choose where to begin.',
      'index.t1.num': '01 · Immersive tour',
      'index.t1.h2': 'Step aboard <b>in 3D</b>',
      'index.t1.p': 'Spin the boat around and explore its eight key features: foils, keel, cockpit, mast, rudders and more. With guided audio.',
      'index.t1.cta': 'Start the tour',
      'index.t2.num': '02 · The project',
      'index.t2.h2': 'Violette & <b>the adventure</b>',
      'index.t2.p': 'The skipper, her racing goals, the Route du Rhum, the 2028 Vendée Globe, and the project’s twin humanitarian purpose.',
      'index.t2.cta': 'Discover',
      'index.t3.num': '03 · Charity',
      'index.t3.h2': 'Heart <b>Surgery</b>',
      'index.t3.p': 'More than five hundred children saved through the project. How the partner charity works, and how every mile sailed counts.',
      'index.t3.cta': 'Learn more',
      'index.t4.num': '04 · Sponsors',
      'index.t4.h2': 'The <b>patrons</b>',
      'index.t4.p': 'They make this sporting and charitable project possible. Meet the brands standing alongside Initiatives-Cœur.',
      'index.t4.cta': 'See the sponsors',

      // -- visite --------------------------------------------------------
      'visite.title': 'Immersive tour · Initiatives-Cœur',
      'visite.brand.eyebrow': 'Immersive tour',
      'visite.loader': 'Loading the boat · 3.5 MB',
      'visite.loading': 'Loading',
      'visite.hint': 'Drag to rotate · tap a glowing point',
      'visite.nav.prev': '‹ Previous',
      'visite.nav.next': 'Next ›',
      'visite.aria.close': 'Close',
      'visite.aria.listen': 'Listen',
      'visite.mode.video': 'Video',
      'visite.tab.text': 'Text',
      'visite.tab.video': 'Violette’s video',
      'visite.tab.360': '360° view',
      'visite.tab.image': 'Photo',
      'visite.audio.listen': 'Listen to the description',
      'visite.audio.playing': 'Now playing…',
      'visite.audio.paused': 'Paused',
      'visite.audio.done': 'Description finished',
      'visite.audio.generating': 'Audio is being generated…',
      'visite.audio.error': 'Audio to be regenerated · scripts/generate_audio.py',
      'visite.err.engine': 'The 3D tour could not load. Check your connection and reload the page.',
      'visite.err.model': 'The boat model could not load. Check your connection and reload the page.',
      'visite.alert.360': 'The 360° gallery (Insta X5) will be available once the shots have been filmed.',
      'visite.alert.video': 'Violette’s tour video will be added as soon as it is provided.',
      'visite.ph.video.label': 'Violette’s video · to be added',
      'visite.ph.video.note': 'Violette Dorange’s tour edit will be dropped in here.',
      'visite.ph.360.label': '360° photo · to be filmed',
      'visite.ph.360.note': 'The Insta X5 360° shots will be shown in immersive navigation.',
      'visite.ph.image.label': 'Detail photo · to be provided',
      'visite.ph.image.note': 'An HD photo of this part of the boat will illustrate the description.',

      // -- projet --------------------------------------------------------
      'projet.title': 'The project · Initiatives-Cœur',
      'projet.brand.eyebrow': 'The project',
      'projet.s1.eyebrow': 'The project',
      'projet.s1.h1': 'Defying the oceans to <b>save children</b>',
      'projet.s1.lead': 'Initiatives-Cœur is an offshore racing project that funds heart surgery for children in precarious circumstances. Every mile sailed across the ocean, every sponsor rallied, helps fund an operation that saves a life.',
      'projet.s1.img': 'The IMOCA Initiatives-Cœur under sail',
      'projet.s2.eyebrow': 'The skipper',
      'projet.s2.h2': 'Violette <b>Dorange</b>',
      'projet.s2.p1': 'At twenty-four, Violette Dorange has established herself as one of the rising figures of offshore racing. Emerging from the 2024-2025 Vendée Globe with huge recognition and a reputation for authenticity, in 2026 she takes the helm of the Initiatives-Cœur project in preparation for the 2028 Vendée Globe.',
      'projet.s2.p2': 'She embodies a new generation of sailors: elite athletes who are also committed to causes that go beyond pure performance. The match with Initiatives-Cœur is a natural one.',
      'projet.s3.eyebrow': 'The racing calendar',
      'projet.s3.h2': 'The next <b>races</b>',
      'projet.s3.c1': 'Vendée Arctique',
      'projet.s3.c2': 'Route du Rhum',
      'projet.s3.c3': 'Vendée Globe',
      'projet.s3.p': 'Before the great rendezvous of 2028, two major stages punctuate the season: the Vendée Arctique starting from Les Sables-d’Olonne in June, then the legendary Route du Rhum from Saint-Malo to Pointe-à-Pitre in November. The boat is showcased in the race villages at the starts and finishes, where the public can discover it.',
      'projet.s4.eyebrow': 'The boat',
      'projet.s4.h2': 'A <b>latest-generation</b> IMOCA',
      'projet.s4.p': 'Launched in 2022, the IMOCA Initiatives-Cœur incorporates the class’s latest technical advances: wide foils that let the boat fly above the water, a rounded bow that deflects breaking waves, a closed cockpit that shelters the skipper. Eighteen metres of hull, a twenty-nine-metre mast, sixteen tonnes — an object built for extreme racing.',
      'projet.s4.cta': 'Tour the boat in 3D →',

      // -- mécénat -------------------------------------------------------
      'mecenat.title': 'Heart Surgery Charity · Initiatives-Cœur',
      'mecenat.brand.eyebrow': 'Charity',
      'mecenat.s1.eyebrow': 'The partner charity',
      'mecenat.s1.h1': 'More than <b>five hundred children</b><br/>saved through the project',
      'mecenat.s1.lead': 'The charity Mécénat Chirurgie Cardiaque welcomes to France children with heart defects from countries that lack the technical means to treat them. Initiatives-Cœur has been its sporting ambassador since its inception.',
      'mecenat.s1.img': 'A child welcomed by Mécénat Chirurgie Cardiaque',
      'mecenat.s2.h2': 'The project’s <b>virtuous circle</b>',
      'mecenat.s2.p': 'Every sponsor rallied to the boat, every bar of chocolate sold, every mile sailed in a race contributes directly to funding heart operations. The sport is not just a showcase — it is the economic engine of the humanitarian programme.',
      'mecenat.s2.c1': 'Children saved',
      'mecenat.s2.c2': 'operation / patron',
      'mecenat.s2.c3': 'Lives changed',
      'mecenat.s3.h2': 'How the <b>charity works</b>',
      'mecenat.s3.p1': 'The children welcomed come mainly from Africa, the Middle East and Asia. They are operated on by volunteer medical teams in partner hospitals in France, housed with host families for the duration of treatment, then accompanied back to their country once recovered. The entire medical and human journey is covered by the charity.',
      'mecenat.s3.p2.pre': 'To support Mécénat Chirurgie Cardiaque directly, visit ',

      // -- sponsors ------------------------------------------------------
      'sponsors.title': 'Sponsors & patrons · Initiatives-Cœur',
      'sponsors.brand.eyebrow': 'The patrons',
      'sponsors.s1.eyebrow': 'Without them, none of this would be possible',
      'sponsors.s1.h1': 'The <b>committed</b> brands',
      'sponsors.s1.lead': 'Every sponsor of Initiatives-Cœur supports more than a racing team — it directly funds the surgical operations of children welcomed by Mécénat Chirurgie Cardiaque. Here are the brands whose commitment turns every mile sailed into a life saved.',
      'sponsors.s2.h2': '<b>Main</b> partners',
      'sponsors.card.main': 'Main partner',
      'sponsors.card.tech': 'Technical partner',
      'sponsors.card.free': 'Space available',
      'sponsors.card.yourbrand': 'Your brand',
      'sponsors.s2.note': 'The official logos will be added here once you provide the high-resolution SVG/PNG files.',
      'sponsors.s3.h2': 'Become a <b>patron</b>',
      'sponsors.s3.p': 'Do you represent a brand that values ambition, commitment and solidarity? The Initiatives-Cœur project offers international visibility across the greatest offshore races, while forming part of a concrete, measurable philanthropic endeavour.',
      'sponsors.s3.cta': 'Contact the team →'
    }
  };

  function detect() {
    const p = new URLSearchParams(location.search).get('lang');
    if (p && SUPPORTED.includes(p)) return p;
    try {
      const s = localStorage.getItem(STORE_KEY);
      if (s && SUPPORTED.includes(s)) return s;
    } catch (e) { /* ignore */ }
    const n = (navigator.language || 'fr').slice(0, 2).toLowerCase();
    return SUPPORTED.includes(n) ? n : 'fr';
  }

  let current = detect();

  function t(key) {
    return (DICT[current] && DICT[current][key]) ||
           (DICT.fr && DICT.fr[key]) || '';
  }

  function apply() {
    document.documentElement.lang = current;

    document.querySelectorAll('[data-i18n]').forEach(el => {
      const v = t(el.getAttribute('data-i18n'));
      if (v) el.textContent = v;
    });
    document.querySelectorAll('[data-i18n-html]').forEach(el => {
      const v = t(el.getAttribute('data-i18n-html'));
      if (v) el.innerHTML = v;
    });
    document.querySelectorAll('[data-i18n-attr]').forEach(el => {
      el.getAttribute('data-i18n-attr').split(';').forEach(pair => {
        const idx = pair.indexOf(':');
        if (idx < 0) return;
        const attr = pair.slice(0, idx).trim();
        const v = t(pair.slice(idx + 1).trim());
        if (v) el.setAttribute(attr, v);
      });
    });

    const titleKey = document.documentElement.getAttribute('data-i18n-title');
    if (titleKey) { const v = t(titleKey); if (v) document.title = v; }

    document.querySelectorAll('.lang-switch').forEach(b => {
      const on = b.getAttribute('data-lang') === current;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function setLang(l) {
    if (!SUPPORTED.includes(l) || l === current) return;
    current = l;
    try { localStorage.setItem(STORE_KEY, l); } catch (e) { /* ignore */ }
    apply();
    window.dispatchEvent(new CustomEvent('ic:langchange', { detail: { lang: l } }));
  }

  window.IC = window.IC || {};
  window.IC.getLang = () => current;
  window.IC.setLang = setLang;
  window.IC.t = t;

  function wire() {
    document.querySelectorAll('.lang-switch').forEach(b => {
      b.addEventListener('click', () => setLang(b.getAttribute('data-lang')));
    });
    apply();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wire);
  } else {
    wire();
  }
})();
