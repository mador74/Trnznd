/* =========================================================================
   TRNZND — scroll-driven landing page
   Lenis smooth scroll + GSAP ScrollTrigger + scroll-scrubbed background video
   ========================================================================= */

import './style.css';
import './glass.css';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger);

// Mark JS-enabled so [data-reveal] elements start hidden only when JS can animate them.
document.documentElement.classList.add('js');

const isTouch = window.matchMedia('(hover: none), (max-width: 768px)').matches;
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* -------------------------------------------------------------------------
   Preloader
   ------------------------------------------------------------------------- */
const preloader = document.querySelector('.preloader');
function dismissPreloader() {
  if (!preloader) return;
  gsap.to(preloader, {
    autoAlpha: 0,
    duration: 0.7,
    delay: 0.15,
    onComplete: () => preloader.remove(),
  });
}

/* -------------------------------------------------------------------------
   Lenis smooth scroll (desktop). On touch we use native scroll for reliability.
   ------------------------------------------------------------------------- */
let lenis = null;
if (!isTouch && !reduceMotion) {
  lenis = new Lenis({
    duration: 1.1,
    smoothWheel: true,
    wheelMultiplier: 1,
  });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
}

// Smooth anchor navigation for [data-scroll] links.
document.querySelectorAll('a[data-scroll]').forEach((link) => {
  link.addEventListener('click', (e) => {
    const id = link.getAttribute('href');
    if (!id || !id.startsWith('#')) return;
    const target = document.querySelector(id);
    if (!target) return;
    e.preventDefault();
    if (lenis) lenis.scrollTo(target, { offset: 0, duration: 1.2 });
    else target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
  });
});

/* -------------------------------------------------------------------------
   Scroll-scrubbed background video
   Map overall page scroll progress -> video.currentTime.
   ------------------------------------------------------------------------- */
function setupVideoScrub() {
  const bgv = document.getElementById('bgv');
  if (!bgv || isTouch) return; // poster handles touch devices

  let duration = 0;
  let ready = false;
  let lastT = -1;

  const prime = () => {
    // Some browsers won't decode/seek a never-played video; nudge then pause.
    const p = bgv.play();
    if (p && typeof p.then === 'function') {
      p.then(() => bgv.pause()).catch(() => {});
    } else {
      try { bgv.pause(); } catch (_) {}
    }
  };

  bgv.addEventListener('loadedmetadata', () => {
    duration = bgv.duration || 0;
  });
  bgv.addEventListener('loadeddata', () => {
    ready = true;
    duration = bgv.duration || duration;
    prime();
    seek(ScrollTrigger.isInViewport ? 0 : 0);
  });

  function seek(progress) {
    if (!ready || !duration) return;
    const t = Math.min(duration - 0.05, Math.max(0, progress * (duration - 0.05)));
    // Only seek on a meaningful delta to avoid flooding the decoder.
    if (Math.abs(t - lastT) > 0.008) {
      try { bgv.currentTime = t; } catch (_) {}
      lastT = t;
    }
  }

  // Drive the video from whole-document scroll progress.
  ScrollTrigger.create({
    trigger: document.documentElement,
    start: 0,
    end: 'max',
    onUpdate: (self) => seek(self.progress),
    onRefresh: (self) => seek(self.progress),
  });

  // Expose for the hint that video is used, and force a first paint.
  if (bgv.readyState >= 2) {
    ready = true;
    duration = bgv.duration || 0;
    prime();
  }

  return bgv;
}
const bgVideo = setupVideoScrub();

/* -------------------------------------------------------------------------
   Generic reveal-on-enter
   ------------------------------------------------------------------------- */
function setupReveals() {
  gsap.utils.toArray('[data-reveal]').forEach((el) => {
    gsap.fromTo(
      el,
      { y: 36, autoAlpha: 0 },
      {
        y: 0,
        autoAlpha: 1,
        duration: 0.9,
        ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 82%', once: true },
      }
    );
  });
}

/* -------------------------------------------------------------------------
   Hero parallax / fade on scroll-away
   ------------------------------------------------------------------------- */
function setupHero() {
  const inner = document.querySelector('.hero__inner');
  if (!inner) return;
  gsap.to(inner, {
    yPercent: -16,
    autoAlpha: 0,
    ease: 'none',
    scrollTrigger: {
      trigger: '#home',
      start: 'top top',
      end: 'bottom top',
      scrub: true,
    },
  });
}

/* -------------------------------------------------------------------------
   Impact — pinned word-by-word reveal (skill recipe)
   ------------------------------------------------------------------------- */
function setupImpact() {
  const section = document.querySelector('#impact');
  if (!section) return;
  const pin = section.querySelector('.impact__pin');
  const words = [...section.querySelectorAll('.word')];

  function render(p) {
    words.forEach((word, i) => {
      const start = (i / words.length) * 0.72;
      const o = gsap.utils.clamp(0, 1, (p - start) / 0.12);
      word.style.opacity = 0.12 + o * 0.88;
      word.style.filter = `blur(${(1 - o) * 8}px)`;
      word.style.transform = `translateY(${(1 - o) * 18}px)`;
    });
  }

  render(0);

  ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: () => '+=' + window.innerHeight * 1.7,
    pin,
    scrub: 1,
    invalidateOnRefresh: true,
    onUpdate: (self) => render(self.progress),
  });
}

/* -------------------------------------------------------------------------
   Workflow — pinned one-card-at-a-time gallery (skill recipe)
   On touch/small screens it degrades to a stacked list (see CSS), no pin.
   ------------------------------------------------------------------------- */
function setupWorkflow() {
  const track = document.querySelector('#workflow-track');
  if (!track) return;
  const slides = [...track.querySelectorAll('.workflow-card')];
  const N = slides.length;
  if (isTouch || N === 0) return; // CSS handles the stacked mobile layout

  function render(p) {
    const pos = p * (N - 1);
    slides.forEach((el, i) => {
      const d = pos - i;
      const ad = Math.abs(d);
      const opacity = Math.max(0, 1 - ad / 0.6);
      el.style.opacity = opacity;
      el.style.transform = `translate(${-d * 130}px, -50%) scale(${1 - Math.min(ad, 1) * 0.06})`;
      el.style.filter = `blur(${Math.min(ad * 10, 14)}px)`;
      el.style.zIndex = String(100 - Math.round(ad * 10));
      el.style.pointerEvents = opacity > 0.6 ? 'auto' : 'none';
    });
  }

  render(0);

  ScrollTrigger.create({
    trigger: '#workflow',
    start: 'top top',
    end: () => '+=' + Math.max(1, N - 1) * window.innerHeight * 0.72,
    pin: '.workflow__pin',
    scrub: 1,
    invalidateOnRefresh: true,
    onUpdate: (self) => render(self.progress),
  });
}

/* -------------------------------------------------------------------------
   Subtle parallax on media figures
   ------------------------------------------------------------------------- */
function setupParallax() {
  if (reduceMotion) return;
  gsap.utils.toArray('[data-parallax] img').forEach((img) => {
    gsap.fromTo(
      img,
      { yPercent: -6 },
      {
        yPercent: 6,
        ease: 'none',
        scrollTrigger: {
          trigger: img.closest('[data-parallax]'),
          start: 'top bottom',
          end: 'bottom top',
          scrub: true,
        },
      }
    );
  });
}

/* -------------------------------------------------------------------------
   Nav state + cursor glow
   ------------------------------------------------------------------------- */
function setupChrome() {
  const nav = document.querySelector('.nav');
  ScrollTrigger.create({
    start: 'top -80',
    end: 'max',
    onUpdate: (self) => {
      nav.classList.toggle('is-scrolled', self.scroll() > 80);
    },
  });

  if (!isTouch) {
    const glow = document.querySelector('.motion-glow');
    if (glow) {
      window.addEventListener('pointermove', (e) => {
        glow.style.opacity = '1';
        glow.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0) translate(-50%, -50%)`;
      });
    }
  }
}

/* -------------------------------------------------------------------------
   Boot
   ------------------------------------------------------------------------- */
function init() {
  setupChrome();
  setupHero();
  setupReveals();
  setupImpact();
  setupWorkflow();
  setupParallax();
  ScrollTrigger.refresh();
}

init();

window.addEventListener('load', () => {
  dismissPreloader();
  ScrollTrigger.refresh();
});

// Keep layout math correct across resizes/orientation changes.
let resizeRAF;
window.addEventListener('resize', () => {
  cancelAnimationFrame(resizeRAF);
  resizeRAF = requestAnimationFrame(() => ScrollTrigger.refresh());
});

/* -------------------------------------------------------------------------
   Dev hooks (skill: Claude Preview verification)
   ------------------------------------------------------------------------- */
if (import.meta.env.DEV) {
  window.__lenis = lenis;
  window.__ST = ScrollTrigger;
  window.__bgv = bgVideo;
}
