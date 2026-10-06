/* Trnzit — progressive enhancement only. Every page works without this file. */
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

  /* Disclosure menus (Solutions) */
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

  /* Count-up for figures in mock-ups (tabular figures keep width stable) */
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
  var revealables = $$('.reveal, [data-count], .mock__chart');
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

  /* Pricing: annual / monthly. The main switch sets every card; each card's own switch sets just that card. */
  var fmtPrice = function (v) {
    v = Number(v);
    var whole = v === Math.round(v);
    return '$' + v.toLocaleString('en-US', { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 });
  };
  var live = $('[data-billing-live]');
  var setCard = function (card, period) {
    $$('[data-price], [data-was]', card).forEach(function (el) { el.textContent = fmtPrice(el.getAttribute('data-' + period)); });
    $$('[data-per]', card).forEach(function (el) { el.textContent = period === 'annual' ? '/year' : '/month'; });
    $$('[data-plan-note]', card).forEach(function (el) { el.textContent = el.getAttribute('data-' + period + '-note'); });
    $$('[data-card-period]', card).forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-card-period') === period)); });
    $$('[data-plan-link]', card).forEach(function (a) { a.setAttribute('href', a.getAttribute('href').replace(/billing=(annual|monthly)/, 'billing=' + period)); });
  };
  var cards = $$('[data-plan-card]');
  cards.forEach(function (card) {
    $$('[data-card-period]', card).forEach(function (b) {
      b.addEventListener('click', function () {
        var period = b.getAttribute('data-card-period');
        setCard(card, period);
        var name = $('.plan__name', card);
        if (live && name) live.textContent = name.textContent + ': showing ' + period + ' prices.';
      });
    });
  });
  var toggle = $('[data-billing]');
  if (toggle) {
    var buttons = $$('button', toggle);
    buttons.forEach(function (b) {
      b.addEventListener('click', function () {
        var period = b.getAttribute('data-period');
        buttons.forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        cards.forEach(function (card) { setCard(card, period); });
        if (live) live.textContent = period === 'annual' ? 'Showing annual prices. Two months free.' : 'Showing monthly prices.';
      });
    });
  }

  /* Pre-select billing period from ?billing= on the sign-up form */
  var billingSelect = $('[data-billing-select]');
  if (billingSelect && window.URLSearchParams) {
    var billing = new URLSearchParams(window.location.search).get('billing');
    if (billing === 'annual' || billing === 'monthly') billingSelect.value = billing;
  }

  /* Platform sub-navigation: highlight current capability */
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

  /* Pre-select plan from ?plan= on the trial form */
  var planSelect = $('[data-plan-select]');
  if (planSelect && window.URLSearchParams) {
    var plan = new URLSearchParams(window.location.search).get('plan');
    if (plan && $('option[value="' + plan.replace(/[^a-z]/g, '') + '"]', planSelect)) planSelect.value = plan;
  }

  /* Contact / trial form: client-side validation. No endpoint is wired up yet. */
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
      var fields = $$('[required]', form);
      var firstBad = null;
      fields.forEach(function (f) { if (!check(f) && !firstBad) firstBad = f; });
      if (firstBad) { firstBad.focus(); return; }
      if (status) {
        status.hidden = false;
        status.textContent = 'Thank you. This form is not yet connected to a back end, so nothing has been sent. [PLACEHOLDER: connect form endpoint and confirmation copy]';
        status.focus();
      }
    });
  });
})();
