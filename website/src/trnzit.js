/* =========================================================================
   TRNZIT — product-led treasury platform site
   Shares brand tokens (style.css) + glass system (glass.css).
   Motion is intentionally lighter than the ZEND cinematic page:
   reveal-on-enter, subtle parallax, nav chrome, cursor glow, count-ups.
   No scroll-scrubbed video, no heavy pins.
   ========================================================================= */

import './style.css';
import './glass.css';
import './trnzit.css';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger);
document.documentElement.classList.add('js');

const isTouch = window.matchMedia('(hover: none), (max-width: 768px)').matches;
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- Preloader ---------- */
const preloader = document.querySelector('.preloader');
function dismissPreloader() {
  if (!preloader) return;
  gsap.to(preloader, { autoAlpha: 0, duration: 0.6, delay: 0.1, onComplete: () => preloader.remove() });
}

/* ---------- Lenis smooth scroll (desktop) ---------- */
let lenis = null;
if (!isTouch && !reduceMotion) {
  lenis = new Lenis({ duration: 1.1, smoothWheel: true, wheelMultiplier: 1 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
}

/* ---------- Smooth anchor navigation ---------- */
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

/* ---------- Reveal on enter ---------- */
function setupReveals() {
  gsap.utils.toArray('[data-reveal]').forEach((el) => {
    gsap.fromTo(
      el,
      { y: 34, autoAlpha: 0 },
      {
        y: 0,
        autoAlpha: 1,
        duration: 0.85,
        ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 85%', once: true },
      }
    );
  });
}

/* ---------- Subtle parallax on product mockups ---------- */
function setupParallax() {
  if (reduceMotion || isTouch) return;
  gsap.utils.toArray('[data-parallax]').forEach((el) => {
    gsap.fromTo(
      el,
      { yPercent: 4 },
      {
        yPercent: -4,
        ease: 'none',
        scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true },
      }
    );
  });
}

/* ---------- Count-up numbers (stats + hero balance) ---------- */
function setupCountUps() {
  gsap.utils.toArray('[data-countup]').forEach((el) => {
    const to = parseFloat(el.getAttribute('data-to')) || 0;
    const prefix = el.getAttribute('data-prefix') || '';
    const suffix = el.getAttribute('data-suffix') || '';
    const obj = { v: 0 };
    const render = () => {
      el.textContent = prefix + Math.round(obj.v).toLocaleString('en-US') + suffix;
    };
    if (reduceMotion) { obj.v = to; render(); return; }
    ScrollTrigger.create({
      trigger: el,
      start: 'top 90%',
      once: true,
      onEnter: () => gsap.to(obj, { v: to, duration: 1.4, ease: 'power2.out', onUpdate: render }),
    });
  });
}

/* ---------- Nav state + cursor glow ---------- */
function setupChrome() {
  const nav = document.querySelector('.nav');
  ScrollTrigger.create({
    start: 'top -80',
    end: 'max',
    onUpdate: (self) => nav.classList.toggle('is-scrolled', self.scroll() > 80),
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

/* ---------- Boot ---------- */
function init() {
  setupChrome();
  setupReveals();
  setupParallax();
  setupCountUps();
  ScrollTrigger.refresh();
}
init();

window.addEventListener('load', () => {
  dismissPreloader();
  ScrollTrigger.refresh();
});

let resizeRAF;
window.addEventListener('resize', () => {
  cancelAnimationFrame(resizeRAF);
  resizeRAF = requestAnimationFrame(() => ScrollTrigger.refresh());
});

if (import.meta.env.DEV) {
  window.__lenis = lenis;
  window.__ST = ScrollTrigger;
}
