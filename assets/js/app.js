/*
  Logica de experiencia: personalizacion por invitado, escenas, RSVP y envio.
  Depende de assets/js/config.js para los datos editables y de GSAP
  o de assets/js/gsap-fallback.js para las animaciones.
*/

/* ===============================================================
   ESTADO Y UTILIDADES
=============================================================== */
const state = {
  telefono: null,
  invitado: null,
  invitados: {},
  confirmedPayload: null,
  attendance: null,        // 'si' | 'no'
  companions: 0,
  comment: "",
  regalos: [],             // catálogo de regalos
  giftCounts: {},          // conteo de reservas por idRegalo (desde el Sheet)
  myGifts: new Set()       // regalos que este invitado ya reservó
};

const CONFIRMATION_STORAGE_PREFIX = "eros.confirmacion.";

const $ = (sel) => document.querySelector(sel);

function getParam(name){
  const u = new URLSearchParams(window.location.search);
  return u.get(name);
}

function eventDateText(){
  return [EVENT.diaSemana, EVENT.fecha].filter(Boolean).join(" ");
}

// Escribe texto de forma defensiva: si el selector no existe, no rompe la página.
function setText(sel, value){
  const el = $(sel);
  if(el) el.textContent = value || "";
}

function escapeHtml(value){
  return String(value || "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}

// Pinta la información visible del evento desde config.js.
// Así fecha, hora y mapa tienen una sola fuente de verdad.
function setEventInfo(){
  setText("#eventDateDay", EVENT.diaSemana);
  setText("#eventDateFull", EVENT.fecha);
  setText("#eventTime", EVENT.hora);

  const m = $("#mapsLink");
  if(m){
    m.href = EVENT.mapsUrl;
    m.setAttribute("aria-label", `Ver ubicación: ${EVENT.lugar}`);
  }
}

function svgImg(src, width, height){
  return `<img src="${src}" width="${width}" height="${height}" alt="" aria-hidden="true">`;
}

/* ===============================================================
   DECORACIÓN FLOTANTE DE FONDO (estrellas, círculos, lunas y nubes)
=============================================================== */
function buildFloatingDecor(){
  const wrap = $("#floatingDecor");
  const items = [
    // Estrellas doradas
    {src:"assets/svg/decor/star-gold.svg", width:14, height:14, count: 8},
    // Círculos azul bebé suaves
    {src:"assets/svg/decor/circle-blue.svg", width:14, height:14, count: 5},
    // Círculos mint
    {src:"assets/svg/decor/circle-mint.svg", width:14, height:14, count: 4},
    // Lunas crecientes pequeñas
    {src:"assets/svg/decor/moon-gold.svg", width:14, height:14, count: 3},
    // Nubes pequeñas
    {src:"assets/svg/decor/cloud-white.svg", width:20, height:20, count: 5}
  ];
  items.forEach(it => {
    for(let i=0;i<it.count;i++){
      const el = document.createElement('span');
      el.innerHTML = svgImg(it.src, it.width, it.height);
      el.style.left = (Math.random()*100) + "%";
      el.style.top  = (Math.random()*100) + "%";
      el.style.animationDelay = (Math.random()*5) + "s";
      el.style.animationDuration = (7 + Math.random()*6) + "s";
      el.style.transform = `scale(${0.6+Math.random()*0.9})`;
      wrap.appendChild(el);
    }
  });
}

/* ===============================================================
   FONDO ANIMADO: PARALLAX SUAVE
=============================================================== */
function setupBackgroundParallax(){
  if(window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const root = document.documentElement;
  const motion = {
    targetX: 0,
    targetY: 0,
    currentX: 0,
    currentY: 0,
    frame: null
  };

  const setPixels = (name, value) => {
    root.style.setProperty(name, `${value}px`);
  };

  const setDegrees = (name, value) => {
    root.style.setProperty(name, `${value}deg`);
  };

  const setScalar = (name, value) => {
    root.style.setProperty(name, String(value));
  };

  const applyMotion = () => {
    const x = motion.currentX;
    const y = motion.currentY;

    setPixels("--px-far", x * -0.05);
    setPixels("--py-far", y * -0.035);
    setPixels("--px-mid", x * 0.08);
    setPixels("--py-mid", y * 0.055);
    setPixels("--px-near", x * 0.14);
    setPixels("--py-near", y * 0.10);
    setPixels("--px-balloons", x * 0.095);
    setPixels("--py-balloons", y * 0.065);

    // Paralaje propio por capa de montaña — separado de GSAP, mayor contraste de profundidad
    setPixels("--px-mtn-far",   x * -0.09);
    setPixels("--py-mtn-far",   y * -0.06);
    setPixels("--px-mtn-mid",   x * 0.14);
    setPixels("--py-mtn-mid",   y * 0.09);
    setPixels("--px-mtn-front", x * 0.24);
    setPixels("--py-mtn-front", y * 0.16);

    setDegrees("--rz-mtn-far",   x * -0.010 + y * -0.004);
    setDegrees("--rz-mtn-mid",   x * 0.014 + y * 0.005);
    setDegrees("--rz-mtn-front", x * 0.022 + y * 0.007);

    const lift = Math.min(Math.abs(y), 38);
    setScalar("--sc-mtn-far",   1 + lift * 0.00045);
    setScalar("--sc-mtn-mid",   1 + lift * 0.00065);
    setScalar("--sc-mtn-front", 1 + lift * 0.00085);
  };

  const tick = () => {
    motion.currentX += (motion.targetX - motion.currentX) * 0.08;
    motion.currentY += (motion.targetY - motion.currentY) * 0.08;
    applyMotion();

    const settledX = Math.abs(motion.targetX - motion.currentX) < 0.05;
    const settledY = Math.abs(motion.targetY - motion.currentY) < 0.05;

    if(settledX && settledY){
      motion.currentX = motion.targetX;
      motion.currentY = motion.targetY;
      applyMotion();
      motion.frame = null;
      return;
    }

    motion.frame = window.requestAnimationFrame(tick);
  };

  const start = () => {
    if(motion.frame == null){
      motion.frame = window.requestAnimationFrame(tick);
    }
  };

  const setTarget = (x, y) => {
    motion.targetX = x;
    motion.targetY = y;
    start();
  };

  const updateTarget = (clientX, clientY) => {
    const width = Math.max(window.innerWidth, 1);
    const height = Math.max(window.innerHeight, 1);

    setTarget(
      (clientX / width - 0.5) * 70,
      (clientY / height - 0.5) * 54
    );
  };

  window.addEventListener("pointermove", event => {
    updateTarget(event.clientX, event.clientY);
  }, { passive: true });

  window.addEventListener("pointerleave", () => {
    setTarget(0, 0);
  }, { passive: true });

  window.addEventListener("deviceorientation", event => {
    if(event.gamma == null || event.beta == null) return;

    const x = Math.max(-18, Math.min(18, event.gamma));
    const y = Math.max(-18, Math.min(18, event.beta - 45));

    setTarget(x * 1.8, y * 1.45);
  }, { passive: true });
}

/* ===============================================================
   ANIMACIÓN: SOBRE -> CARTA -> LIBRO
=============================================================== */
function launchSealSparks(wrap){
  if(!wrap || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const count = window.innerWidth < 520 ? 14 : 18;
  for(let i=0; i<count; i++){
    const spark = document.createElement("span");
    const angle = (Math.PI * 2 * i / count) + (Math.random() * 0.34 - 0.17);
    const distance = 36 + Math.random() * 54;
    const size = 4 + Math.random() * 4;

    spark.className = "seal-spark";
    spark.style.width = `${size}px`;
    spark.style.height = `${size}px`;
    spark.style.setProperty("--spark-x", `${Math.cos(angle) * distance}px`);
    spark.style.setProperty("--spark-y", `${Math.sin(angle) * distance}px`);
    spark.style.setProperty("--spark-rot", `${Math.round(80 + Math.random() * 220)}deg`);

    wrap.appendChild(spark);
    window.setTimeout(() => spark.remove(), 950);
  }
}

function setupEnvelope(){
  const wrap = $("#envelopeWrap");
  const flap = $("#envFlap");
  const seal = $("#envSeal");
  const letter = $("#letter");
  const scene1 = $("#scene-envelope");
  const scene2 = $("#scene-book");
  const front = wrap.querySelector(".env-front");
  const hint = wrap.querySelector(".envelope-hint");
  const canAnimate = !window.matchMedia("(prefers-reduced-motion: reduce)").matches && !gsap.__fallback;

  // Aparición sutil del sobre
  gsap.from(wrap, { opacity:0, y:36, scale:0.92, rotateX:7, duration:1.25, ease:"power3.out", delay:0.18 });
  // Protección: si el navegador carga GSAP pero no avanza la animación inicial
  // por throttling, bloqueo de scripts o vista previa del editor, evita que el
  // sobre quede invisible permanentemente.
  window.setTimeout(() => {
    if(wrap.dataset.opened) return;
    if(window.getComputedStyle(wrap).opacity === "0"){
      wrap.style.opacity = "1";
      wrap.style.transform = "";
    }
  }, 1800);
  // Latido del sello
  const sealPulse = canAnimate
    ? gsap.to(seal, { scale:1.055, y:-1, rotation:1.2, duration:1.55, repeat:-1, yoyo:true, ease:"sine.inOut" })
    : null;

  const open = () => {
    if(wrap.dataset.opened) return;
    wrap.dataset.opened = "1";
    wrap.classList.add("is-opening");
    scene1.classList.add("scene-opening");
    wrap.style.cursor = "default";
    if(sealPulse && sealPulse.kill) sealPulse.kill();
    window.setTimeout(() => launchSealSparks(wrap), canAnimate ? 250 : 0);

    const tl = gsap.timeline({
      onComplete: () => {
        // Cambiar de escena
        scene1.style.display = "none";
        scene1.classList.remove("scene-opening");
        scene1.style.opacity = "";
        scene1.style.filter = "";
        scene2.style.display = "flex";
        scene2.style.opacity = "0";
        animateBook();
      }
    });

    tl.to(hint, { opacity:0, y:8, duration:0.24, ease:"power2.out" }, 0)
      .to(wrap, { scale:1.025, y:-4, duration:0.26, ease:"power2.out" }, 0)
      .to(seal, { scale:0.88, y:5, rotation:-5, duration:0.14, ease:"power2.out" }, 0)
      .to(seal, { scale:1.25, y:-9, rotation:12, duration:0.28, ease:"back.out(2.8)" })
      .to(seal, { opacity:0, scale:0.32, y:-38, rotation:28, duration:0.42, ease:"power3.in" }, "-=0.03")
      .to(flap, {
        rotateX: -182,
        z: -24,
        duration: 1.05,
        ease: "power3.inOut",
        transformOrigin: "top center"
      }, "-=0.22")
      .to(front, { y:7, duration:0.72, ease:"sine.inOut" }, "-=0.88")
      .fromTo(letter,
        { opacity:0, y:22, scale:0.92, rotateX:10, transformOrigin:"50% 82%" },
        { opacity:1, y:-104, scale:1.02, rotateX:0, duration:0.95, ease:"power3.out", transformOrigin:"50% 82%" },
        "-=0.58")
      .to(letter, {
        y:-132,
        scaleX:1.18,
        scaleY:1.36,
        duration:0.58,
        ease:"power2.inOut"
      }, "-=0.12")
      .to(wrap, { y:-42, scale:1.08, rotateX:5, duration:0.52, ease:"power2.inOut" }, "-=0.12")
      .to(scene1, { opacity:0, filter:"blur(8px)", duration:0.55, ease:"power2.inOut" }, "+=0.04");
  };

  wrap.addEventListener("click", open);
  wrap.addEventListener("keydown", e => {
    if(e.key === "Enter" || e.key === " "){ e.preventDefault(); open(); }
  });
}

function animateBook(){
  const scene2 = $("#scene-book");
  const book = $("#book");
  gsap.fromTo(scene2,
    { opacity:0, filter:"blur(5px)" },
    { opacity:1, filter:"blur(0px)", duration:0.6, ease:"power2.out" }
  );

  // Entrada del libro (como si se abriera)
  gsap.fromTo(book,
    { opacity:0, rotateX: -46, y: 54, scale:0.94, transformOrigin: "center top" },
    { opacity:1, rotateX: 0, y:0, scale:1, duration: 1.08, ease:"power4.out" }
  );
  gsap.fromTo(".book-page",
    { clipPath:"inset(0 48% 0 48%)" },
    { clipPath:"inset(0 0% 0 0%)", duration:1.05, ease:"power3.out", delay:0.05 }
  );

  // Montañas origami: entrada propia por capas para que se sientan plegadas
  // desde la base del libro y no como un elemento plano más.
  // driftX2/driftY2: segundo ciclo de deriva con frecuencia diferente para movimiento orgánico compuesto
  const mountainLayers = [
    { sel: ".pe-mountains-far",   y: 34, scale: 0.92, rotateX: -16, delay: 0.28,
      driftX: -4,  driftY: -3.5, driftRotation: -0.6,  driftScale: 1.012, driftDuration: 8.4,
      driftX2: 2,  driftY2: -2,  driftDuration2: 12.8, innerX: 1.6, innerY: -1.3 },
    { sel: ".pe-mountains-mid",   y: 40, scale: 0.9,  rotateX: -20, delay: 0.42,
      driftX: 4,   driftY: -5.5, driftRotation: 0.5,   driftScale: 1.015, driftDuration: 7.2,
      driftX2: -3, driftY2: -3,  driftDuration2: 10.6, innerX: -2.2, innerY: -1.7 },
    { sel: ".pe-mountains-front", y: 46, scale: 0.88, rotateX: -24, delay: 0.56,
      driftX: -3,  driftY: -5,   driftRotation: -0.4,  driftScale: 1.010, driftDuration: 6.4,
      driftX2: 4,  driftY2: -2,  driftDuration2: 9.2, innerX: 2.8, innerY: -1.2 }
  ];

  mountainLayers.forEach((layer, i) => {
    const el = document.querySelector(layer.sel);
    if(!el) return;

    gsap.fromTo(el,
      {
        opacity: 0,
        y: layer.y,
        scale: layer.scale,
        rotateX: layer.rotateX,
        transformOrigin: "50% 100%"
      },
      {
        opacity: 1,
        y: 0,
        scale: 1,
        rotateX: 0,
        duration: 1.0,
        ease: "back.out(1.2)",
        delay: layer.delay,
        transformOrigin: "50% 100%"
      }
    );

    // Deriva compuesta en un solo timeline: evita que varias tweens compitan por x/y.
    gsap.timeline({
      repeat: -1,
      delay: 2.6 + i * 0.22,
      defaults: { ease: "sine.inOut", transformOrigin: "50% 100%" }
    })
      .to(el, {
        x: layer.driftX,
        y: layer.driftY,
        rotation: layer.driftRotation,
        scale: layer.driftScale,
        duration: layer.driftDuration * 0.42
      })
      .to(el, {
        x: layer.driftX2,
        y: layer.driftY2,
        rotation: layer.driftRotation * -0.55,
        scale: 1 + (layer.driftScale - 1) * 0.65,
        duration: layer.driftDuration2 * 0.38
      })
      .to(el, {
        x: layer.driftX * -0.55,
        y: layer.driftY * 0.38,
        rotation: layer.driftRotation * 0.35,
        scale: 1,
        duration: layer.driftDuration * 0.34
      })
      .to(el, {
        x: 0,
        y: 0,
        rotation: 0,
        scale: 1,
        duration: layer.driftDuration * 0.28
      });

    gsap.to(`${layer.sel} img`, {
      x: layer.innerX,
      y: layer.innerY,
      rotation: layer.driftRotation * -0.65,
      scale: 1 + (layer.driftScale - 1) * 0.75,
      duration: layer.driftDuration * 1.28,
      ease: "sine.inOut",
      repeat: -1,
      yoyo: true,
      delay: 2.9 + i * 0.22,
      transformOrigin: "50% 100%"
    });
  });

  const cloudLayers = [
    { sel: ".pe-cloud-1", entryX: -18, entryY: 16, entryRotation: -5, delay: 0.9, driftX: 9, driftY: -7, driftRotation: 2.2, driftScale: 1.035, duration: 5.8 },
    { sel: ".pe-cloud-2", entryX: 18, entryY: 18, entryRotation: 5, delay: 1.02, driftX: -8, driftY: -6, driftRotation: -2.0, driftScale: 1.03, duration: 6.4 },
    { sel: ".pe-cloud-3", entryX: 0, entryY: 14, entryRotation: -3, delay: 1.14, driftX: 5, driftY: -8, driftRotation: 1.6, driftScale: 1.045, duration: 5.2 }
  ];

  cloudLayers.forEach((cloud, i) => {
    const el = document.querySelector(cloud.sel);
    if(!el) return;

    gsap.fromTo(el,
      {
        opacity: 0,
        x: cloud.entryX,
        y: cloud.entryY,
        scale: 0.78,
        rotation: cloud.entryRotation,
        transformOrigin: "50% 58%"
      },
      {
        opacity: 1,
        x: 0,
        y: 0,
        scale: 1,
        rotation: 0,
        duration: 0.78,
        ease: "back.out(1.35)",
        delay: cloud.delay,
        transformOrigin: "50% 58%"
      }
    );

    gsap.to(cloud.sel, {
      x: cloud.driftX,
      y: cloud.driftY,
      rotation: cloud.driftRotation,
      scale: cloud.driftScale,
      duration: cloud.duration,
      ease: "sine.inOut",
      repeat: -1,
      yoyo: true,
      delay: 2.45 + i * 0.22,
      transformOrigin: "50% 58%"
    });

    gsap.to(`${cloud.sel} img`, {
      x: cloud.driftX * -0.28,
      y: cloud.driftY * 0.18,
      rotation: cloud.driftRotation * -0.55,
      scale: 1 + (cloud.driftScale - 1) * 0.55,
      duration: cloud.duration * 1.18,
      ease: "sine.inOut",
      repeat: -1,
      yoyo: true,
      delay: 2.72 + i * 0.18,
      transformOrigin: "50% 58%"
    });
  });

  // Entrada especial del banner: cae desde arriba con rebote elástico
  gsap.fromTo(".pe-banner",
    { opacity: 0, y: -22, scaleX: 0.90, scaleY: 0.65, transformOrigin: "50% 0%" },
    { opacity: 1, y: 0,   scaleX: 1,    scaleY: 1,
      duration: 0.95, ease: "elastic.out(1, 0.55)", delay: 0.82 }
  );
  // Balanceo continuo del banner (simula brisa suave)
  gsap.to(".pe-banner", {
    y: 4, rotation: 0.7, duration: 4.2, ease: "sine.inOut",
    repeat: -1, yoyo: true, delay: 2.8, transformOrigin: "50% 0%"
  });

  // Pop-up de elementos en orden coreografiado.
  // Las montañas y las nubes ya tienen coreografia aparte; el resto entra encima.
  const order = [
    // CIELO: estrellas, confeti (banner tiene su propia entrada arriba)
    ".pe-star-1", ".pe-star-2", ".pe-star-3",
    // Globos aerostáticos con canasta
    ".pe-hotair-1", ".pe-hotair-2", ".pe-hotair-3", ".pe-hotair-4",
    // Confeti suelto
    ".pe-confetti-1", ".pe-confetti-2", ".pe-confetti-3", ".pe-confetti-4",
    // ESCENA: oso central, plantas, cubos, sonajero, barco
    ".pe-bear-main",
    ".pe-plant-1", ".pe-plant-2",
    ".pe-blocks",
    ".pe-rattle",
    ".pe-boat"
  ];
  order.forEach((sel, i) => {
    const el = document.querySelector(sel);
    if(!el) return;
    gsap.to(el, {
      opacity:1,
      y: 0,
      scale: 1,
      x: sel.includes("bear-main") ? "-50%" : 0,
      duration: 0.55,
      ease: "back.out(1.6)",
      delay: 0.86 + i * 0.055
    });
  });

  // === Árboles low-poly: animación multi-capa (viento + respiración) ===
  // Árbol grande (plant-1): balanceo suave como brisa
  gsap.to(".pe-plant-1", {
    rotation: 2.5,
    duration: 3.8,
    ease: "sine.inOut",
    repeat: -1,
    yoyo: true,
    delay: 3.2,
    transformOrigin: "50% 100%"
  });
  // Árbol grande: pequeño movimiento vertical (raíces firmes, copa se eleva)
  gsap.to(".pe-plant-1", {
    y: -4,
    duration: 4.6,
    ease: "sine.inOut",
    repeat: -1,
    yoyo: true,
    delay: 3.5
  });
  // Árbol pequeño (plant-2): más nervioso (más ligero), fase opuesta
  gsap.to(".pe-plant-2", {
    rotation: -3,
    duration: 3.1,
    ease: "sine.inOut",
    repeat: -1,
    yoyo: true,
    delay: 3.4,
    transformOrigin: "50% 100%"
  });
  // Árbol pequeño: movimiento vertical independiente
  gsap.to(".pe-plant-2", {
    y: -3,
    duration: 3.9,
    ease: "sine.inOut",
    repeat: -1,
    yoyo: true,
    delay: 3.7
  });
  // Copa de los árboles: escala sutil (efecto respiración de la copa)
  gsap.to(".pe-plant-1 #tree-canopy, .pe-plant-1 #tree-large-lp #tree-canopy", {
    scale: 1.03,
    duration: 2.8,
    ease: "sine.inOut",
    repeat: -1,
    yoyo: true,
    delay: 3.6,
    transformOrigin: "50% 80%"
  });
  gsap.to(".pe-plant-2 #tree-sm-canopy, .pe-plant-2 #tree-small-lp #tree-sm-canopy", {
    scale: 1.04,
    duration: 2.4,
    ease: "sine.inOut",
    repeat: -1,
    yoyo: true,
    delay: 3.9,
    transformOrigin: "50% 80%"
  });
  // Activar clase CSS para animación continua
  setTimeout(() => {
    const p1 = document.querySelector(".pe-plant-1");
    const p2 = document.querySelector(".pe-plant-2");
    if (p1) p1.classList.add("tree-animated");
    if (p2) p2.classList.add("tree-animated");
  }, 4200);

  // Animación sutil constante del osito principal
  gsap.to(".pe-bear-main", {
    y: -5, duration: 2.6, ease:"sine.inOut",
    repeat:-1, yoyo:true, delay: 3
  });

  // Sonajero: sacudida con peso, pausa y rebote para que no parezca un giro plano.
  const rattleEl = document.querySelector(".pe-rattle");
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (rattleEl && !prefersReducedMotion) {
    setTimeout(() => rattleEl.classList.add("rattle-animated"), 3300);

    gsap.to(".pe-rattle", {
      keyframes: [
        { rotation: -8, x: -2, y: -3, duration: 0.16, ease: "sine.in" },
        { rotation: 10, x: 3, y: -5, duration: 0.14, ease: "sine.out" },
        { rotation: -5, x: -1, y: -2, duration: 0.12, ease: "sine.inOut" },
        { rotation: 2, x: 1, y: -1, duration: 0.22, ease: "back.out(2.4)" },
        { rotation: 1, x: 0, y: -3, duration: 0.95, ease: "sine.inOut" },
        { rotation: 0, x: 0, y: 0, duration: 0.9, ease: "sine.inOut" }
      ],
      repeat: -1,
      delay: 3.15,
      transformOrigin: "50% 88%"
    });
  }

  // Globos aerostáticos flotando suavemente (cada uno con timing distinto)
  gsap.to(".pe-hotair-1", { y:-10, duration:3.0, ease:"sine.inOut", repeat:-1, yoyo:true, delay:2.8});
  gsap.to(".pe-hotair-2", { y:-12, duration:2.6, ease:"sine.inOut", repeat:-1, yoyo:true, delay:3.0});
  gsap.to(".pe-hotair-3", { y:-9,  duration:3.2, ease:"sine.inOut", repeat:-1, yoyo:true, delay:2.9});
  gsap.to(".pe-hotair-4", { y:-11, duration:2.8, ease:"sine.inOut", repeat:-1, yoyo:true, delay:3.1});
  // Confeti girando ligero
  gsap.to(".pe-confetti-1, .pe-confetti-2, .pe-confetti-3, .pe-confetti-4", {
    rotation: 12, duration: 3, ease:"sine.inOut",
    repeat:-1, yoyo:true, stagger:0.4, delay:3.2
  });
  // === Barco origami: animación multi-capa ===
  // 1) Balanceo principal (cabeceo + traslación como sobre las olas)
  gsap.to(".pe-boat", {
    rotation: 5,
    duration: 3.2,
    ease: "sine.inOut",
    repeat: -1,
    yoyo: true,
    delay: 3.4,
    transformOrigin: "50% 88%"
  });
  // 2) Movimiento vertical de oleaje (fase distinta al balanceo)
  gsap.to(".pe-boat", {
    y: -7,
    duration: 2.6,
    ease: "sine.inOut",
    repeat: -1,
    yoyo: true,
    delay: 3.6
  });
  // 3) Pequeña deriva horizontal (el barco se mueve ligeramente a izquierda/derecha)
  gsap.to(".pe-boat", {
    x: -6,
    duration: 5.5,
    ease: "sine.inOut",
    repeat: -1,
    yoyo: true,
    delay: 3.8
  });
  // 4) Añadir clase para las animaciones CSS (bandera)
  const boatEl = document.querySelector(".pe-boat");
  if (boatEl) {
    setTimeout(() => boatEl.classList.add("boat-animated"), 3800);
  }

  // Entrada en cascada de los bloques de info y formulario
  gsap.fromTo(".book-eyebrow",
    { opacity:0, y:12, filter:"blur(4px)" },
    { opacity:1, y:0, filter:"blur(0px)", duration:0.65, ease:"power2.out", delay:1.25 }
  );
  gsap.fromTo(".book-title",
    { opacity:0, y:18, scale:0.98, filter:"blur(5px)" },
    { opacity:1, y:0, scale:1, filter:"blur(0px)", duration:0.78, ease:"power3.out", delay:1.42 }
  );
  gsap.fromTo(".book-divider",
    { opacity:0, y:8, scaleX:0.72 },
    { opacity:1, y:0, scaleX:1, duration:0.55, ease:"power2.out", delay:1.76 }
  );
  gsap.fromTo("#greeting",
    { opacity:0, y:18, scale:0.98, filter:"blur(4px)" },
    { opacity:1, y:0, scale:1, filter:"blur(0px)", duration:0.78, ease:"power3.out", delay:1.94 }
  );
  gsap.fromTo(".info-card",
    { opacity:0, y:22 },
    { opacity:1, y:0, duration:0.62, stagger:0.1, ease:"power2.out", delay:2.26 }
  );
  gsap.fromTo("#rsvpBox",
    { opacity:0, y:24, scale:0.985 },
    { opacity:1, y:0, scale:1, duration:0.72, ease:"power3.out", delay:2.66 }
  );
  gsap.fromTo(".book-footer-msg",
    { opacity:0, y:10 },
    { opacity:1, y:0, duration:0.52, ease:"power2.out", delay:3.06 }
  );
}

/* ===============================================================
   PERSONALIZACIÓN POR INVITADO
=============================================================== */
function confirmationStorageKey(telefono){
  return CONFIRMATION_STORAGE_PREFIX + encodeURIComponent(telefono || "demo");
}

function readStoredConfirmation(telefono){
  try{
    const raw = window.localStorage.getItem(confirmationStorageKey(telefono));
    if(!raw) return null;
    const payload = JSON.parse(raw);
    return payload && typeof payload === "object" ? payload : null;
  }catch(err){
    console.warn("No se pudo leer la confirmación local.", err);
    return null;
  }
}

function saveStoredConfirmation(payload){
  try{
    window.localStorage.setItem(confirmationStorageKey(payload.telefono), JSON.stringify(payload));
  }catch(err){
    console.warn("No se pudo guardar la confirmación local.", err);
  }
}

// Consulta al servidor (Google Sheet) si este invitado ya confirmó. Así el
// bloqueo de re-confirmación funciona desde cualquier dispositivo, no solo
// en el navegador donde se confirmó.
async function fetchServerConfirmation(telefono){
  if(!APPS_SCRIPT_URL || !telefono || telefono === "demo") return null;
  try{
    const url = APPS_SCRIPT_URL + (APPS_SCRIPT_URL.includes("?") ? "&" : "?")
      + "tipo=confirmacion&telefono=" + encodeURIComponent(telefono) + "&_=" + Date.now();
    const res = await fetch(url, { cache: "no-store" });
    if(!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    return (data && data.confirmacion) ? data.confirmacion : null;
  }catch(err){
    console.warn("No se pudo leer la confirmación del servidor.", err);
    return null;
  }
}

function truthyConfirmation(value){
  if(value === true || value === 1) return true;
  if(typeof value !== "string") return false;
  return ["true", "1", "si", "sí", "yes", "confirmado"].includes(value.trim().toLowerCase());
}

function normalizeAttendance(value){
  if(value == null) return "";
  const text = String(value).trim().toLowerCase();
  if(["si", "sí", "s", "yes", "y", "true"].includes(text)) return "Sí";
  if(["no", "n", "false"].includes(text)) return "No";
  return String(value).trim();
}

function getAllowedCompanions(invitado){
  const value = Number(invitado && invitado.acompanantesPermitidos);
  if(!Number.isFinite(value) || value < 0) return 0;
  return Math.floor(value);
}

function normalizeGuests(data){
  const source = data && data.invitados ? data.invitados : data;
  const normalized = {};

  if(Array.isArray(source)){
    source.forEach(item => {
      if(!item || typeof item !== "object") return;
      const key = String(item.telefono || item.codigo || item.id || "").trim();
      if(key) normalized[key] = item;
    });
    return normalized;
  }

  if(source && typeof source === "object"){
    Object.keys(source).forEach(key => {
      if(source[key] && typeof source[key] === "object"){
        normalized[key] = source[key];
      }
    });
  }

  return normalized;
}

async function loadGuestList(){
  const url = typeof INVITADOS_JSON_URL !== "undefined" ? INVITADOS_JSON_URL : "assets/data/invitados.json";
  const response = await fetch(url, { cache: "no-store" });
  if(!response.ok){
    throw new Error(`No se pudo cargar ${url}: ${response.status}`);
  }
  return normalizeGuests(await response.json());
}

function buildConfirmationFromGuest(invitado, telefono){
  const confirmation = invitado.confirmacion && typeof invitado.confirmacion === "object"
    ? invitado.confirmacion
    : {};
  const hasConfirmed = truthyConfirmation(invitado.yaConfirmo)
    || truthyConfirmation(invitado.yaHaConfirmado)
    || truthyConfirmation(invitado.confirmado)
    || Object.keys(confirmation).length > 0;

  if(!hasConfirmed) return null;

  const asistencia = normalizeAttendance(confirmation.asistencia || invitado.asistencia || "");
  const maxAllowed = getAllowedCompanions(invitado);
  let companions = Number(confirmation.acompanantesConfirmados || invitado.acompanantesConfirmados || 0);
  if(!Number.isFinite(companions)) companions = 0;
  companions = Math.max(0, Math.min(companions, maxAllowed));

  const totalFromData = Number(confirmation.totalPersonas || invitado.totalPersonas || 0);
  const totalPersonas = Number.isFinite(totalFromData) && totalFromData > 0
    ? totalFromData
    : (asistencia === "Sí" ? 1 + companions : 0);

  return {
    fechaConfirmacion: confirmation.fechaConfirmacion || invitado.fechaConfirmacion || "",
    telefono,
    nombre: invitado.nombre,
    asistencia,
    acompanantesConfirmados: companions,
    totalPersonas,
    comentario: confirmation.comentario || invitado.comentario || "",
    yaConfirmo: "Sí"
  };
}

function showGuestError(title, message){
  state.invitado = null;
  $("#guestName").textContent = title;
  $("#guestIntro").innerHTML = message;
  $("#companionLine").style.display = "none";
  $("#rsvpBox").style.display = "none";
}

async function loadGuest(){
  // La invitación espera URLs como:
  // invitacion(3).html?telefono=8090000000
  // Si no llega teléfono, usa el invitado "demo" para poder previsualizar.
  const tel = (getParam("telefono") || "").trim();
  let invitado = null;
  let key = tel;

  try{
    state.invitados = await loadGuestList();
  }catch(err){
    console.error(err);
    state.telefono = tel || "demo";
    showGuestError(
      "Invitado",
      "No pudimos cargar la lista de invitados. Por favor abre la invitación desde el enlace publicado o intenta de nuevo en unos segundos."
    );
    return;
  }

  if(tel && state.invitados[tel]){
    invitado = state.invitados[tel];
  } else if(!tel){
    // Modo demo si no se proporciona teléfono.
    invitado = state.invitados["demo"];
    key = "demo";
  }

  if(!invitado){
    // Teléfono no reconocido -> bloquear formulario
    state.telefono = tel;
    showGuestError(
      "Invitado",
      `No encontramos una invitación asociada al número <code>${escapeHtml(tel)}</code>. <br/>Por favor verifica con la familia de Eros para confirmar tu acceso.`
    );
    return;
  }

  state.telefono = key;
  state.invitado = invitado;

  // Prioridad: confirmación del servidor (válida en cualquier dispositivo),
  // luego la local, luego la precargada en el JSON.
  let serverConfirm = null;
  try { serverConfirm = await fetchServerConfirmation(key); } catch(_) {}
  state.confirmedPayload = serverConfirm
    || readStoredConfirmation(key)
    || buildConfirmationFromGuest(invitado, key);
  if(serverConfirm){ saveStoredConfirmation(serverConfirm); }

  $("#guestName").textContent = invitado.nombre;
  const maxAllowed = getAllowedCompanions(invitado);
  $("#guestIntro").textContent =
    "Qué ilusión abrir esta invitación para ti. Estamos preparando una tarde llena de ternura para celebrar la llegada de Eros Salvatore, y nos encantaría vivirla contigo.";

  if(maxAllowed === 0){
    $("#companionLine").style.display = "none";
  } else {
    $("#companionLine").style.display = "";
    const companionLabel = maxAllowed === 1 ? "acompañante" : "acompañantes";
    $("#companionLine").innerHTML =
      `Tu presencia será el mejor regalo; puedes venir con hasta <span class="accent" id="maxComp">${maxAllowed}</span> ${companionLabel}.`;
  }

  buildCompanionPills(maxAllowed);

  if(state.confirmedPayload){
    renderConfirmedState(state.confirmedPayload);
  }
}

function buildCompanionPills(max){
  // Genera opciones cerradas de 0..max para evitar valores inválidos
  // y mantener el estado sincronizado con la autorización del invitado.
  const row = $("#compRow");
  row.innerHTML = "";
  state.companions = 0;

  if(max === 0){
    $("#compField").style.display = "none";
    return;
  }
  $("#compField").style.display = "";
  for(let i=0; i<=max; i++){
    const b = document.createElement("button");
    b.type = "button";
    b.className = "comp-pill" + (i===0 ? " active" : "");
    b.dataset.val = i;
    b.textContent = i;
    b.addEventListener("click", () => {
      row.querySelectorAll(".comp-pill").forEach(p => p.classList.remove("active"));
      b.classList.add("active");
      state.companions = i;
    });
    row.appendChild(b);
  }
  $("#compInfo").textContent = `Puedes seleccionar entre 0 y ${max} acompañantes.`;
}

function formatConfirmationDate(value){
  if(!value) return "";
  const date = new Date(value);
  if(Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("es", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function appendSummaryRow(container, label, value){
  if(value === "" || value == null) return;

  const row = document.createElement("div");
  row.className = "confirmation-summary-row";

  const labelEl = document.createElement("span");
  labelEl.className = "confirmation-summary-label";
  labelEl.textContent = label;

  const valueEl = document.createElement("strong");
  valueEl.textContent = String(value);

  row.append(labelEl, valueEl);
  container.appendChild(row);
}

function disableRsvpControls(){
  $("#attendanceGroup").querySelectorAll("button").forEach(btn => {
    btn.disabled = true;
  });
  $("#compRow").querySelectorAll("button").forEach(btn => {
    btn.disabled = true;
  });

  const commentInput = $("#commentInput");
  if(commentInput) commentInput.disabled = true;
}

function renderConfirmedState(payload){
  const rsvp = $("#rsvpBox");
  const title = rsvp.querySelector("h3");
  const formMsg = $("#formMsg");
  const commentField = $("#commentInput").closest(".field");
  const canHaveCompanions = getAllowedCompanions(state.invitado) > 0;
  const attendanceText = normalizeAttendance(payload.asistencia) || "Confirmación recibida";

  rsvp.classList.add("is-confirmed");
  if(title) title.textContent = "Confirmación recibida";

  $("#attendanceGroup").style.display = "none";
  $("#compField").style.display = "none";
  if(commentField) commentField.style.display = "none";
  $("#submitBtn").style.display = "none";
  disableRsvpControls();

  let summary = $("#confirmationSummary");
  if(!summary){
    summary = document.createElement("div");
    summary.id = "confirmationSummary";
    summary.className = "confirmation-summary";
    rsvp.insertBefore(summary, formMsg);
  }
  summary.innerHTML = "";

  appendSummaryRow(summary, "Asistencia", attendanceText);

  if(canHaveCompanions && attendanceText === "Sí"){
    appendSummaryRow(summary, "Acompañantes", Number(payload.acompanantesConfirmados || 0));
    appendSummaryRow(summary, "Total de personas", Number(payload.totalPersonas || 1));
  }

  if(payload.comentario){
    appendSummaryRow(summary, "Comentario", payload.comentario);
  }

  appendSummaryRow(summary, "Fecha", formatConfirmationDate(payload.fechaConfirmacion));

  formMsg.className = "form-msg ok";
  formMsg.textContent = "Tu confirmación ya fue registrada. Para cambiarla, contacta a la familia de Eros.";
}

/* ===============================================================
   FORMULARIO RSVP
=============================================================== */
function setupRsvp(){
  // Centraliza los listeners del formulario para que el HTML no tenga
  // manejadores inline y la interacción viva completa en este archivo.
  const group = $("#attendanceGroup");
  const submitBtn = $("#submitBtn");

  if(state.confirmedPayload){
    return;
  }

  group.querySelectorAll(".att-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      group.querySelectorAll(".att-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      state.attendance = btn.dataset.val;

      // Si dice "No", oculta acompañantes
      const compF = $("#compField");
      if(state.attendance === "no"){
        compF.style.opacity = 0.35;
        compF.style.pointerEvents = "none";
      } else {
        compF.style.opacity = 1;
        compF.style.pointerEvents = "auto";
      }
    });
  });

  submitBtn.addEventListener("click", onSubmit);
}

async function onSubmit(){
  // Recolecta, normaliza y limita los datos antes de enviar.
  // El límite de acompañantes se recalcula aquí aunque la UI ya lo controle.
  const formMsg = $("#formMsg");
  const submitBtn = $("#submitBtn");
  formMsg.className = "form-msg";
  formMsg.textContent = "";

  // Validación
  if(!state.invitado){
    formMsg.textContent = "No hay un invitado asociado a este enlace.";
    formMsg.classList.add("error");
    return;
  }
  if(state.confirmedPayload){
    renderConfirmedState(state.confirmedPayload);
    return;
  }
  if(!state.attendance){
    formMsg.textContent = "Por favor indica si podrás asistir.";
    formMsg.classList.add("error");
    return;
  }

  let companions = state.attendance === "si" ? Number(state.companions || 0) : 0;
  const max = getAllowedCompanions(state.invitado);
  if(companions > max) companions = max;
  if(companions < 0)   companions = 0;

  state.comment = ($("#commentInput").value || "").trim().slice(0, 400);

  const payload = {
    fechaConfirmacion: new Date().toISOString(),
    telefono: state.telefono,
    nombre: state.invitado.nombre,
    asistencia: state.attendance === "si" ? "Sí" : "No",
    acompanantesConfirmados: companions,
    totalPersonas: state.attendance === "si" ? (1 + companions) : 0,
    comentario: state.comment,
    yaConfirmo: "Sí"
  };

  submitBtn.disabled = true;
  formMsg.textContent = "Enviando confirmación…";

  try{
    if(APPS_SCRIPT_URL){
      // Apps Script responde tras una redirección con CORS abierto, así que
      // se puede leer la respuesta. NO usar mode:"no-cors" (no guarda fiable).
      const body = new URLSearchParams();
      Object.keys(payload).forEach(k => body.append(k, payload[k]));
      const res = await fetch(APPS_SCRIPT_URL, { method: "POST", body });
      try {
        const data = await res.json();
        if(data && data.ok === false) throw new Error(data.error || "Error al guardar.");
      } catch(_) { /* respuesta no-JSON: continuar */ }
    } else {
      // Modo demo
      console.log("[DEMO] Datos que se enviarían a Google Sheets:", payload);
      await new Promise(r => setTimeout(r, 700));
    }
    state.confirmedPayload = payload;
    if(state.invitado){
      state.invitado.yaConfirmo = true;
      state.invitado.confirmacion = payload;
    }
    saveStoredConfirmation(payload);
    showThanks(payload);
  }catch(err){
    console.error(err);
    formMsg.textContent = "Ocurrió un problema. Inténtalo de nuevo en unos segundos.";
    formMsg.classList.add("error");
    submitBtn.disabled = false;
  }
}

function showThanks(payload){
  // Cierra el libro y muestra un mensaje adaptado a la respuesta del invitado.
  const scene2 = $("#scene-book");
  const scene3 = $("#scene-thanks");

  // Personalizar texto
  const firstName = (payload.nombre || "").split(" ")[0] || "";
  $("#thanksTitle").textContent =
    payload.asistencia === "Sí"
      ? `¡Gracias por confirmar, ${firstName}!`
      : `Gracias por avisarnos, ${firstName}`;
  $("#thanksText").textContent =
    payload.asistencia === "Sí"
      ? `Nos alegra mucho saber que nos acompañarás. Te esperamos el ${eventDateText()} a las ${EVENT.hora}.`
      : `Lamentamos que no puedas acompañarnos. Te mandamos un fuerte abrazo y te tendremos presente.`;

  gsap.to(scene2, {
    opacity:0, y:-20, duration:0.6, ease:"power2.inOut",
    onComplete: () => {
      scene2.style.display = "none";
      scene3.style.display = "flex";
      gsap.fromTo(scene3, { opacity:0, y:30 }, { opacity:1, y:0, duration:0.9, ease:"power3.out" });
      gsap.from(".thanks-bear", { scale:0.6, opacity:0, duration:0.9, delay:0.2, ease:"back.out(1.6)" });
      gsap.from(".thanks-flourish", { opacity:0, y:8, duration:0.6, delay:0.7 });
    }
  });

  // Confeti de estrellas, círculos y formas geométricas
  launchConfetti();
}

function launchConfetti(){
  // Confeti efímero: cada nodo se elimina al terminar su animación para
  // no acumular elementos en el DOM después de confirmar.
  const container = document.body;
  const icons = [
    // Estrella dorada
    {src:"assets/svg/confetti/star-gold.svg", width:14, height:14},
    // Estrella crema
    {src:"assets/svg/confetti/star-cream.svg", width:12, height:12},
    // Círculo azul bebé
    {src:"assets/svg/confetti/circle-blue.svg", width:14, height:14},
    // Círculo mint
    {src:"assets/svg/confetti/circle-mint.svg", width:12, height:12},
    // Triángulo (mini banderín) azul
    {src:"assets/svg/confetti/triangle-blue.svg", width:14, height:14},
    // Triángulo dorado
    {src:"assets/svg/confetti/triangle-gold.svg", width:12, height:12}
  ];
  for(let i=0;i<36;i++){
    const el = document.createElement("div");
    const icon = icons[i % icons.length];
    el.innerHTML = svgImg(icon.src, icon.width, icon.height);
    el.style.position = "fixed";
    el.style.left = (Math.random()*100) + "vw";
    el.style.top = "-20px";
    el.style.zIndex = 30;
    el.style.pointerEvents = "none";
    container.appendChild(el);
    gsap.to(el, {
      y: window.innerHeight + 60,
      x: (Math.random()-0.5) * 200,
      rotate: Math.random()*720 - 360,
      duration: 2.5 + Math.random()*2,
      ease: "power1.in",
      delay: Math.random()*0.6,
      onComplete: () => el.remove()
    });
  }
}

/* ===============================================================
   MESA DE REGALOS
=============================================================== */
const GIFTS_STORAGE_PREFIX = "eros.regalos.";

// Reservas hechas en ESTA sesión (para reflejar el bloqueo al instante,
// ya que la respuesta de Apps Script es opaca y el Sheet puede tardar).
const giftSessionReserved = {};

function giftsEnabled(){
  return typeof GIFTS_ENABLED === "undefined" ? true : !!GIFTS_ENABLED;
}

function giftsStorageKey(telefono){
  return GIFTS_STORAGE_PREFIX + encodeURIComponent(telefono || "demo");
}

function readMyGiftReservations(telefono){
  try{
    const raw = window.localStorage.getItem(giftsStorageKey(telefono));
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr.map(String) : []);
  }catch(err){
    console.warn("No se pudieron leer las reservas de regalos.", err);
    return new Set();
  }
}

function saveMyGiftReservations(telefono, set){
  try{
    window.localStorage.setItem(giftsStorageKey(telefono), JSON.stringify([...set]));
  }catch(err){
    console.warn("No se pudieron guardar las reservas de regalos.", err);
  }
}

function getGiftById(id){
  return state.regalos.find(g => String(g.id) === String(id)) || null;
}

// Unidades ya reservadas de un regalo: máximo entre el Sheet y el bloqueo
// manual del JSON, más lo reservado en esta misma sesión.
function giftReservedCount(gift){
  const fromSheet = Number(state.giftCounts[gift.id] || 0);
  const manual = Number(gift.reservadosManual || 0);
  const session = Number(giftSessionReserved[gift.id] || 0);
  const base = Math.max(Number.isFinite(fromSheet) ? fromSheet : 0,
                        Number.isFinite(manual) ? manual : 0);
  return base + (Number.isFinite(session) ? session : 0);
}

function giftAvailable(gift){
  const total = Number(gift.cantidadTotal || 0);
  return Math.max(0, total - giftReservedCount(gift));
}

async function fetchGiftCounts(){
  // Lee el conteo de reservas por idRegalo desde el Apps Script (doGet).
  // Si falla (sin red/CORS), se usa solo reservadosManual del JSON.
  if(!APPS_SCRIPT_URL) return {};
  try{
    const url = APPS_SCRIPT_URL + (APPS_SCRIPT_URL.includes("?") ? "&" : "?") + "tipo=regalos&_=" + Date.now();
    const res = await fetch(url, { cache: "no-store" });
    if(!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    const conteos = (data && (data.conteos || data.counts)) || {};
    const out = {};
    Object.keys(conteos).forEach(k => { out[String(k)] = Number(conteos[k]) || 0; });
    return out;
  }catch(err){
    console.warn("No se pudo leer el conteo de regalos (se usa el bloqueo manual del JSON).", err);
    return {};
  }
}

async function loadGiftCatalog(){
  const url = typeof REGALOS_JSON_URL !== "undefined" ? REGALOS_JSON_URL : "assets/data/regalos.json";
  const res = await fetch(url, { cache: "no-store" });
  if(!res.ok) throw new Error(`No se pudo cargar ${url}: ${res.status}`);
  const data = await res.json();
  const list = Array.isArray(data) ? data : (data.regalos || []);
  return list.filter(g => g && typeof g === "object" && g.id);
}

async function loadGifts(){
  const box = $("#giftsBox");
  if(!box) return;
  if(!giftsEnabled()){
    box.style.display = "none";
    return;
  }

  state.myGifts = readMyGiftReservations(state.telefono);

  try{
    const [catalog, counts] = await Promise.all([loadGiftCatalog(), fetchGiftCounts()]);
    state.regalos = catalog;
    state.giftCounts = counts;
  }catch(err){
    console.error(err);
    const grid = $("#giftsGrid");
    if(grid) grid.innerHTML = `<div class="gifts-loading">No se pudo cargar la mesa de regalos. Inténtalo de nuevo en unos segundos.</div>`;
    return;
  }

  renderGifts();
  setupGiftModal();
}

function giftStatusInfo(gift){
  if(state.myGifts && state.myGifts.has(String(gift.id))){
    return { cls: "badge--mine", text: "Lo reservaste tú ★" };
  }
  const avail = giftAvailable(gift);
  if(avail <= 0){
    return { cls: "badge--full", text: "Completo ✓" };
  }
  const total = Number(gift.cantidadTotal || 1);
  return {
    cls: "badge--ok",
    text: total > 1 ? `${avail} de ${total} disponibles` : "Disponible"
  };
}

function renderGifts(){
  const grid = $("#giftsGrid");
  if(!grid) return;
  if(!state.regalos.length){
    grid.innerHTML = `<div class="gifts-loading">Aún no hay regalos en la lista.</div>`;
    return;
  }

  grid.innerHTML = "";
  state.regalos.forEach(gift => {
    const status = giftStatusInfo(gift);
    const icon = gift.icono || "🎁";
    const card = document.createElement("button");
    card.type = "button";
    card.className = "gift-card" + (status.cls === "badge--full" ? " is-full" : "") +
                     (status.cls === "badge--mine" ? " is-mine" : "");
    card.dataset.id = gift.id;
    card.setAttribute("aria-label", `${gift.nombre} — ver detalle`);

    const media = gift.imagen
      ? `<span class="gift-emoji">${icon}</span><img src="${escapeHtml(gift.imagen)}" alt="" loading="lazy" onerror="this.remove()">`
      : `<span class="gift-emoji">${icon}</span>`;

    card.innerHTML = `
      <span class="gift-card-media">${media}</span>
      <span class="gift-card-info">
        <span class="gift-store-badge store-${escapeHtml(String(gift.tienda || "").toLowerCase())}">${escapeHtml(gift.tienda || "")}</span>
        <span class="gift-card-name">${escapeHtml(gift.nombre || "")}</span>
        <span class="gift-card-status ${status.cls}">${status.text}</span>
      </span>`;

    card.addEventListener("click", () => openGiftModal(gift.id));
    grid.appendChild(card);
  });
}

/* ===============================================================
   MODAL DE PREVISUALIZACIÓN / RESERVA
=============================================================== */
let activeGiftId = null;

function setupGiftModal(){
  if(setupGiftModal.done) return;
  setupGiftModal.done = true;

  const modal = $("#giftModal");
  if(!modal) return;
  $("#giftModalClose").addEventListener("click", closeGiftModal);
  $("#giftModalBackdrop").addEventListener("click", closeGiftModal);
  $("#giftModalReserve").addEventListener("click", () => {
    if(activeGiftId != null) reserveGift(activeGiftId);
  });
  document.addEventListener("keydown", e => {
    if(e.key === "Escape" && modal.classList.contains("is-open")) closeGiftModal();
  });
}

function openGiftModal(id){
  const gift = getGiftById(id);
  const modal = $("#giftModal");
  if(!gift || !modal) return;
  activeGiftId = id;

  const icon = gift.icono || "🎁";
  $("#giftModalMedia").innerHTML = gift.imagen
    ? `<span class="gift-emoji">${icon}</span><img src="${escapeHtml(gift.imagen)}" alt="" onerror="this.remove()">`
    : `<span class="gift-emoji gift-emoji-lg">${icon}</span>`;

  const store = $("#giftModalStore");
  store.textContent = gift.tienda || "";
  store.className = "gift-store-badge store-" + String(gift.tienda || "").toLowerCase();

  $("#giftModalName").textContent = gift.nombre || "";
  $("#giftModalDesc").textContent = gift.descripcion || "";

  const link = $("#giftModalLink");
  link.href = gift.url || "#";
  link.textContent = "Ver en " + (gift.tienda || "la tienda");

  $("#giftModalMsg").textContent = "";
  $("#giftModalMsg").className = "gift-modal-msg";

  updateGiftModalStatus(gift);

  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
}

function updateGiftModalStatus(gift){
  const status = giftStatusInfo(gift);
  const statusEl = $("#giftModalStatus");
  statusEl.className = "gift-modal-status gift-card-status " + status.cls;
  statusEl.textContent = status.text;

  const btn = $("#giftModalReserve");
  const mine = state.myGifts && state.myGifts.has(String(gift.id));
  const avail = giftAvailable(gift);

  if(!state.invitado){
    btn.disabled = true;
    btn.textContent = "Abre tu invitación para reservar";
  } else if(mine){
    btn.disabled = true;
    btn.textContent = "Ya lo reservaste ★";
  } else if(avail <= 0){
    btn.disabled = true;
    btn.textContent = "Regalo completo";
  } else {
    btn.disabled = false;
    btn.textContent = "Reservar este regalo";
  }
}

function closeGiftModal(){
  const modal = $("#giftModal");
  if(!modal) return;
  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden", "true");
  activeGiftId = null;
}

async function reserveGift(id){
  const gift = getGiftById(id);
  const msg = $("#giftModalMsg");
  const btn = $("#giftModalReserve");
  if(!gift) return;

  if(!state.invitado){
    msg.className = "gift-modal-msg error";
    msg.textContent = "Abre la invitación con tu enlace personal para poder reservar.";
    return;
  }
  if(state.myGifts.has(String(id))){
    msg.className = "gift-modal-msg ok";
    msg.textContent = "Ya tienes este regalo reservado.";
    return;
  }
  if(giftAvailable(gift) <= 0){
    msg.className = "gift-modal-msg error";
    msg.textContent = "Justo se acaba de completar. Elige otro detalle, por favor.";
    updateGiftModalStatus(gift);
    renderGifts();
    return;
  }

  btn.disabled = true;
  msg.className = "gift-modal-msg";
  msg.textContent = "Reservando…";

  const payload = {
    tipo: "regalo",
    fecha: new Date().toISOString(),
    idRegalo: gift.id,
    nombreRegalo: gift.nombre,
    telefono: state.telefono,
    nombreInvitado: state.invitado.nombre
  };

  try{
    if(APPS_SCRIPT_URL){
      const body = new URLSearchParams();
      Object.keys(payload).forEach(k => body.append(k, payload[k]));
      // Apps Script responde tras una redirección con CORS abierto: podemos leer
      // la respuesta y confirmar que se guardó. NO usar mode:"no-cors", que no
      // escribe de forma fiable.
      const res = await fetch(APPS_SCRIPT_URL, { method: "POST", body });
      let data = null;
      try { data = await res.json(); } catch(_) {}
      if(data && data.ok === false){
        throw new Error(data.error || "No se pudo registrar la reserva.");
      }
    } else {
      console.log("[DEMO] Reserva de regalo:", payload);
      await new Promise(r => setTimeout(r, 500));
    }

    giftSessionReserved[gift.id] = (giftSessionReserved[gift.id] || 0) + 1;
    state.myGifts.add(String(gift.id));
    saveMyGiftReservations(state.telefono, state.myGifts);

    // Reconciliar con el servidor para reflejar también lo que reservaron otros.
    try { state.giftCounts = await fetchGiftCounts(); } catch(_) {}

    msg.className = "gift-modal-msg ok";
    msg.textContent = "¡Reservado! Gracias por tu detalle con Eros 💛";
    updateGiftModalStatus(gift);
    renderGifts();
  }catch(err){
    console.error(err);
    msg.className = "gift-modal-msg error";
    msg.textContent = "No se pudo reservar. Inténtalo de nuevo en unos segundos.";
    btn.disabled = false;
  }
}

/* ===============================================================
   INIT
=============================================================== */
window.addEventListener("DOMContentLoaded", async () => {
  setEventInfo();
  setupBackgroundParallax();
  buildFloatingDecor();
  await loadGuest();
  setupRsvp();
  await loadGifts();
  setupEnvelope();
});
/* fin */
