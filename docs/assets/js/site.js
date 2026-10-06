/* Trnznd: progressive enhancement only. Every page works without this file.
   Same behaviour as the Trnzit site (header, menus, reveals, forms), plus tabs. */
(function () {
  'use strict';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* Header shadow on scroll */
  var header = $('[data-header]');
  if (header) {
    var onScroll = function () { header.classList.toggle('is-scrolled', window.scrollY > 8); };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* Mobile navigation */
  var navToggle = $('[data-nav-toggle]');
  var nav = $('[data-nav]');
  function closeNav() {
    if (!nav || !navToggle) return;
    nav.classList.remove('is-open');
    navToggle.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('nav-open');
  }
  if (navToggle && nav) {
    navToggle.addEventListener('click', function () {
      var open = navToggle.getAttribute('aria-expanded') !== 'true';
      if (open && header) document.documentElement.style.setProperty('--nav-top', Math.max(0, header.getBoundingClientRect().bottom) + 'px');
      navToggle.setAttribute('aria-expanded', String(open));
      nav.classList.toggle('is-open', open);
      document.body.classList.toggle('nav-open', open);
    });
  }

  /* Disclosure menus (Resources) */
  $$('[data-menu-trigger]').forEach(function (btn) {
    var menu = document.getElementById(btn.getAttribute('aria-controls'));
    if (!menu) return;
    var set = function (open) { btn.setAttribute('aria-expanded', String(open)); menu.hidden = !open; };
    btn.addEventListener('click', function (e) { e.stopPropagation(); set(btn.getAttribute('aria-expanded') !== 'true'); });
    document.addEventListener('click', function (e) { if (!menu.contains(e.target)) set(false); });
    menu.addEventListener('focusout', function (e) { if (!btn.parentNode.contains(e.relatedTarget)) set(false); });
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    $$('[data-menu-trigger][aria-expanded="true"]').forEach(function (b) { b.setAttribute('aria-expanded', 'false'); document.getElementById(b.getAttribute('aria-controls')).hidden = true; b.focus(); });
    if (nav && nav.classList.contains('is-open')) { closeNav(); navToggle.focus(); }
  });
  window.matchMedia('(min-width: 1281px)').addEventListener('change', function (m) { if (m.matches) closeNav(); });

  /* Count-up for figures (tabular figures keep width stable) */
  function countUp(el) {
    var target = parseFloat(el.getAttribute('data-count'));
    var dec = parseInt(el.getAttribute('data-decimals') || '0', 10);
    var prefix = el.getAttribute('data-prefix') || '';
    var suffix = el.getAttribute('data-suffix') || '';
    var fmt = function (v) { return prefix + v.toLocaleString('en-GB', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + suffix; };
    if (reduce || isNaN(target)) { el.textContent = fmt(target); return; }
    var dur = 1400, start = null;
    var step = function (t) {
      if (!start) start = t;
      var p = Math.min((t - start) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(target * eased);
      if (p < 1) requestAnimationFrame(step); else el.textContent = fmt(target);
    };
    requestAnimationFrame(step);
  }

  /* Scroll reveals */
  var revealables = $$('.reveal, [data-count]');
  if ('IntersectionObserver' in window && !reduce) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var el = en.target;
        el.classList.add('is-visible');
        if (el.hasAttribute('data-count')) countUp(el);
        io.unobserve(el);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    revealables.forEach(function (el) { io.observe(el); });
  } else {
    revealables.forEach(function (el) { el.classList.add('is-visible'); if (el.hasAttribute('data-count')) countUp(el); });
  }

  /* Tabs: WAI-ARIA tabs pattern with arrow-key support */
  $$('[data-tabs]').forEach(function (wrap) {
    var tabs = $$('[role="tab"]', wrap);
    var panels = tabs.map(function (t) { return document.getElementById(t.getAttribute('aria-controls')); });
    var select = function (i, focus) {
      tabs.forEach(function (t, k) {
        var on = k === i;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        if (panels[k]) panels[k].hidden = !on;
      });
      if (focus) tabs[i].focus();
    };
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { select(i); });
      t.addEventListener('keydown', function (e) {
        var n = tabs.length, j = null;
        if (e.key === 'ArrowRight') j = (i + 1) % n;
        else if (e.key === 'ArrowLeft') j = (i - 1 + n) % n;
        else if (e.key === 'Home') j = 0;
        else if (e.key === 'End') j = n - 1;
        if (j !== null) { e.preventDefault(); select(j, true); }
      });
    });
    select(0);
  });

  /* Section sub-navigation (FAQ): highlight the group in view */
  var subLinks = $$('.subnav a');
  if (subLinks.length && 'IntersectionObserver' in window) {
    var map = {};
    subLinks.forEach(function (a) { map[a.getAttribute('href').slice(1)] = a; });
    var so = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        subLinks.forEach(function (a) { a.classList.remove('is-active'); a.removeAttribute('aria-current'); });
        var a = map[en.target.id];
        if (a) { a.classList.add('is-active'); a.setAttribute('aria-current', 'true'); }
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    Object.keys(map).forEach(function (id) { var s = document.getElementById(id); if (s) so.observe(s); });
  }

  /* Pre-select the enquiry type from ?type= on the contact form */
  var typeSelect = $('[data-type-select]');
  if (typeSelect && window.URLSearchParams) {
    var type = new URLSearchParams(window.location.search).get('type');
    if (type && $('option[value="' + type.replace(/[^a-z-]/g, '') + '"]', typeSelect)) typeSelect.value = type;
  }

  /* Group contact form: organisation details are required only for ZEND enquiries */
  if (typeSelect && $('[data-org-field]')) {
    var syncType = function () {
      var v = typeSelect.value, zend = v === 'access' || v === 'team';
      $$('[data-org-field]').forEach(function (f) {
        f.required = zend;
        if (!zend) { f.removeAttribute('aria-invalid'); var e = $('.error', f.closest('.field')); if (e) e.classList.remove('is-shown'); }
      });
      $$('[data-org-optional]').forEach(function (s) { s.hidden = zend; });
      $$('[data-type-note]').forEach(function (n) { n.hidden = n.getAttribute('data-type-note').split(' ').indexOf(v) < 0; });
    };
    typeSelect.addEventListener('change', syncType);
    syncType();
  }

  /* Forms: client-side validation. No endpoint is wired up yet. */
  $$('form[data-validate]').forEach(function (form) {
    var status = $('[data-form-status]', form);
    var check = function (field) {
      var wrap = field.closest('.field') || field.parentNode;
      var err = wrap && $('.error', wrap);
      var ok = field.checkValidity();
      field.setAttribute('aria-invalid', String(!ok));
      if (err) err.classList.toggle('is-shown', !ok);
      return ok;
    };
    $$('input, select, textarea', form).forEach(function (f) {
      f.addEventListener('blur', function () { if (f.value || f.getAttribute('aria-invalid')) check(f); });
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var firstBad = null;
      $$('[required]', form).forEach(function (f) { if (!check(f) && !firstBad) firstBad = f; });
      if (firstBad) { firstBad.focus(); return; }
      if (status) {
        status.hidden = false;
        status.textContent = 'Thank you. This form is not yet connected to a back end, so nothing has been sent. [PLACEHOLDER: connect form endpoint and confirmation copy]';
        status.focus();
      }
    });
  });
})();
