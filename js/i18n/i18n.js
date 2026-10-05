/* BelPhO English/Russian switch.
 *
 * Pages are authored in Russian. When English is selected, every element's
 * "template" (its direct text with child elements replaced by {0},{1},... and
 * digit runs by {#0},{#1},...) is looked up in a dictionary and rebuilt from
 * the translation, reusing the original child elements so links, formulas and
 * event handlers survive. tools/extract.py in the i18n workspace computes the
 * same templates offline; keep the two in sync.
 *
 * Language: ?lang=en|ru (remembered), else localStorage.lang, else the
 * browser's primary language (ru or be gives Russian, anything else English).
 */
(function () {
  'use strict';

  var script = document.currentScript;
  var root = (script && script.getAttribute('data-root')) || '/js/i18n/';
  var ver = (script && script.getAttribute('data-v')) || '';
  var pageDict = script && script.getAttribute('data-page');
  var catalog = script && script.getAttribute('data-catalog');
  // Pages that exist as separate language files (alumni profiles) name them here.
  var alt = {
    en: script && script.getAttribute('data-alt-en'),
    ru: script && script.getAttribute('data-alt-ru')
  };

  function stored() {
    try {
      var q = new URLSearchParams(location.search).get('lang');
      if (q === 'en' || q === 'ru') localStorage.setItem('lang', q);
      var v = localStorage.getItem('lang');
      if (v === 'en' || v === 'ru') return v;
    } catch (e) {}
    return null;
  }

  function detect() {
    // Crawlers index the original Russian pages; they often report en-US.
    if (/bot|crawl|spider|slurp|yandex|bingpreview|facebookexternalhit|lighthouse/i.test(navigator.userAgent)) return 'ru';
    var first = ((navigator.languages && navigator.languages[0]) || navigator.language || 'en').toLowerCase();
    return (first.indexOf('ru') === 0 || first.indexOf('be') === 0) ? 'ru' : 'en';
  }

  var lang = stored() || detect();
  var here = location.pathname;
  try { here = decodeURIComponent(here); } catch (e) {}
  if (alt[lang] && here !== alt[lang]) {
    location.replace(alt[lang] + location.hash);
    return;
  }
  document.documentElement.lang = lang;
  window.BELPHO_LANG = lang;

  var style = document.createElement('style');
  style.textContent =
    'html.i18n-wait body{visibility:hidden}' +
    '.i18n-switch{display:inline-flex;border:1px solid rgba(127,127,127,.45);border-radius:999px;overflow:hidden;vertical-align:middle;font:600 13px/1 system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif}' +
    '.i18n-switch button{border:0;margin:0;background:transparent;color:inherit;padding:6px 10px;cursor:pointer;font:inherit;opacity:.75}' +
    '.i18n-switch button[aria-pressed="true"]{background:#1f2937;color:#fff;opacity:1}' +
    'li.i18n-li{display:flex;align-items:center;list-style:none}' +
    '.i18n-float{position:fixed;top:10px;right:10px;z-index:9999;background:#fff;color:#111;box-shadow:0 2px 8px rgba(0,0,0,.15)}';
  document.head.appendChild(style);

  function makeSwitch() {
    var box = document.createElement('span');
    box.className = 'i18n-switch';
    box.setAttribute('role', 'group');
    box.setAttribute('aria-label', 'Language');
    box.setAttribute('data-no-i18n', '');
    ['en', 'ru'].forEach(function (l) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = l.toUpperCase();
      b.setAttribute('aria-pressed', l === lang ? 'true' : 'false');
      b.addEventListener('click', function () {
        try { localStorage.setItem('lang', l); } catch (e) {}
        if (alt[l]) { location.href = alt[l]; return; }
        var u = new URL(location.href);
        u.searchParams.delete('lang');
        location.href = u.toString();
      });
      box.appendChild(b);
    });
    return box;
  }

  function placeSwitch() {
    var slots = document.querySelectorAll('.i18n-slot');
    if (slots.length) {
      for (var j = 0; j < slots.length; j++) slots[j].appendChild(makeSwitch());
      return;
    }
    var lists = document.querySelectorAll('ul.nav-links');
    if (lists.length) {
      for (var i = 0; i < lists.length; i++) {
        var li = document.createElement('li');
        li.className = 'i18n-li';
        li.appendChild(makeSwitch());
        lists[i].appendChild(li);
      }
    } else {
      var s = makeSwitch();
      s.className += ' i18n-float';
      document.body.appendChild(s);
    }
  }

  function onReady(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  if (lang !== 'en') {
    onReady(placeSwitch);
    return;
  }

  document.documentElement.classList.add('i18n-wait');
  var reveal = function () { document.documentElement.classList.remove('i18n-wait'); };
  var failsafe = setTimeout(reveal, 2500);

  var WS = /[ \t\n\r\f]+/g;
  var NUM = /[0-9]+(?:[.,][0-9]+)*/g;
  var CYR = /[\u0400-\u04FF\u2116]/;
  var SKIP = {
    SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, SVG: 1, MATH: 1, CODE: 1, PRE: 1, TEXTAREA: 1,
    TEMPLATE: 1, 'MJX-CONTAINER': 1, IFRAME: 1, OBJECT: 1, CANVAS: 1, VIDEO: 1, AUDIO: 1
  };
  var ATTRS = ['title', 'alt', 'placeholder', 'aria-label', 'data-tooltip'];
  var D = {};

  function skipped(el) {
    return SKIP[el.nodeName.toUpperCase()] === 1 ||
      el.hasAttribute('data-no-i18n') || el.getAttribute('translate') === 'no';
  }

  function genNums(s, nums) {
    return s.replace(NUM, function (m) { nums.push(m); return '{#' + (nums.length - 1) + '}'; });
  }

  function enNum(n) {
    return /^[0-9]+,[0-9]+$/.test(n) ? n.replace(',', '.') : n;
  }

  function fill(tr, nums) {
    return tr.replace(/\{#(\d+)\}/g, function (m, i) { return nums[+i] !== undefined ? enNum(nums[+i]) : ''; });
  }

  function lookup(s) {
    var nums = [];
    var key = genNums(s.replace(WS, ' ').trim(), nums);
    var tr = D[key];
    return tr === undefined ? null : fill(tr, nums);
  }

  function translateAttrs(el) {
    for (var i = 0; i < ATTRS.length; i++) {
      var v = el.getAttribute(ATTRS[i]);
      if (v && CYR.test(v)) {
        var t = lookup(v);
        if (t !== null) el.setAttribute(ATTRS[i], t);
      }
    }
    if (el.nodeName === 'INPUT' && /^(button|submit|reset)$/.test(el.type) && CYR.test(el.value)) {
      var tv = lookup(el.value);
      if (tv !== null) el.value = tv;
    }
  }

  // Last resort for strings that scripts glue together from already translated
  // pieces (e.g. home-lab: "Ruler, Stopwatch и ещё 5").
  var RULES = [[/ и ещё ([0-9]+)/g, ' and $1 more']];

  function applyRules(el) {
    for (var c = el.firstChild; c; c = c.nextSibling) {
      if (c.nodeType !== 3 || !CYR.test(c.nodeValue)) continue;
      var v = c.nodeValue;
      for (var i = 0; i < RULES.length; i++) v = v.replace(RULES[i][0], RULES[i][1]);
      if (v !== c.nodeValue) c.nodeValue = v;
    }
  }

  function translateOwn(el) {
    var kids = [], nums = [], parts = [], raw = '';
    for (var c = el.firstChild; c; c = c.nextSibling) {
      if (c.nodeType === 3) {
        raw += c.nodeValue;
        parts.push(genNums(c.nodeValue, nums));
      } else if (c.nodeType === 1) {
        parts.push('{' + kids.length + '}');
        kids.push(c);
      }
    }
    if (!CYR.test(raw)) return;
    var key = parts.join('').replace(WS, ' ').trim();
    var tr = D[key];
    if (tr === undefined) { applyRules(el); return; }
    var lead = /^[ \t\n\r\f]/.test(raw) && el.firstChild.nodeType === 3 ? ' ' : '';
    var trail = /[ \t\n\r\f]$/.test(raw) && el.lastChild && el.lastChild.nodeType === 3 ? ' ' : '';
    var frag = document.createDocumentFragment();
    var used = [];
    var re = /\{(#?)(\d+)\}/g, last = 0, m, buf = lead;
    while ((m = re.exec(tr))) {
      buf += tr.slice(last, m.index);
      last = re.lastIndex;
      var i = +m[2];
      if (m[1]) {
        buf += nums[i] !== undefined ? enNum(nums[i]) : '';
      } else if (kids[i] && !used[i]) {
        if (buf) frag.appendChild(document.createTextNode(buf));
        buf = '';
        frag.appendChild(kids[i]);
        used[i] = 1;
      }
    }
    buf += tr.slice(last) + trail;
    if (buf) frag.appendChild(document.createTextNode(buf));
    for (var k = 0; k < kids.length; k++) if (!used[k]) frag.appendChild(kids[k]);
    while (el.firstChild) el.removeChild(el.firstChild);
    el.appendChild(frag);
  }

  function walk(el) {
    if (el.nodeType !== 1 || skipped(el)) return;
    translateAttrs(el);
    translateOwn(el);
    for (var c = el.firstElementChild; c; c = c.nextElementSibling) walk(c);
  }

  function translateHead() {
    if (CYR.test(document.title)) {
      var t = lookup(document.title);
      if (t !== null) document.title = t;
    }
    var metas = document.querySelectorAll('meta[name="description"],meta[property^="og:"],meta[name^="twitter:"]');
    for (var i = 0; i < metas.length; i++) {
      var p = metas[i].getAttribute('property');
      if (p === 'og:locale') { metas[i].setAttribute('content', 'en_US'); continue; }
      var v = metas[i].getAttribute('content');
      if (v && CYR.test(v)) {
        var tv = lookup(v);
        if (tv !== null) metas[i].setAttribute('content', tv);
      }
    }
  }

  // Units typed in Russian inside formulas (MathJax draws them as SVG <text>).
  // Single letters that are usually subscripts (к, н, т, г, л, ...) stay as they are.
  var UNITS = {
    'м': 'm', 'с': 's', 'см': 'cm', 'мм': 'mm', 'км': 'km', 'дм': 'dm', 'мкм': 'μm', 'нм': 'nm',
    'кг': 'kg', 'мг': 'mg', 'В': 'V', 'мВ': 'mV', 'кВ': 'kV', 'Н': 'N', 'мН': 'mN', 'кН': 'kN', 'МН': 'MN',
    'К': 'K', 'Дж': 'J', 'дж': 'J', 'кДж': 'kJ', 'МДж': 'MJ', 'Ом': 'Ω', 'ом': 'Ω', 'кОм': 'kΩ', 'МОм': 'MΩ',
    'А': 'A', 'мА': 'mA', 'мкА': 'μA', 'кА': 'kA', 'моль': 'mol', 'моля': 'mol', 'Па': 'Pa', 'кПа': 'kPa', 'ГПа': 'GPa',
    'мл': 'mL', 'Вт': 'W', 'кВт': 'kW', 'МВт': 'MW', 'Мвт': 'MW', 'мкВт': 'μW', 'нВт': 'nW',
    'час': 'h', 'ч': 'h', 'часа': 'h', 'мин': 'min', 'минуты': 'min', 'сек': 's', 'мс': 'ms', 'мкс': 'μs',
    'сут': 'day', 'суток': 'days', 'дней': 'days', 'год': 'yr', 'лет': 'yr',
    'град': 'deg', 'градусов': 'deg', 'рад': 'rad', 'радиан': 'rad', 'мрад': 'mrad', 'атм': 'atm', 'Торр': 'Torr',
    'эВ': 'eV', 'Эв': 'eV', 'кэВ': 'keV', 'Кл': 'C', 'Гц': 'Hz', 'кГц': 'kHz', 'Тл': 'T', 'мТл': 'mT',
    'Гн': 'H', 'мГн': 'mH', 'мкГн': 'μH', 'мкФ': 'μF', 'мкф': 'μF', 'пФ': 'pF', 'Ф': 'F',
    'кал': 'cal', 'Гкал': 'Gcal', 'ГКал': 'Gcal', 'дюйм': 'in', 'миль': 'mi', 'миля': 'mi', 'фунт': 'lb',
    'руб': 'rub', 'долларов': 'dollars', 'штук': 'pcs', 'или': 'or', 'где': 'where'
  };

  function translateMath(el) {
    if (!el.querySelectorAll) return;
    var ts = el.querySelectorAll('mjx-container text');
    for (var i = 0; i < ts.length; i++) {
      var u = UNITS[ts[i].textContent.trim()];
      if (u) {
        ts[i].textContent = u;
        ts[i].setAttribute('lengthAdjust', 'spacing');
      }
    }
  }

  function inSkipped(n) {
    for (var e = n; e && e !== document.body; e = e.parentNode) {
      if (e.nodeType === 1 && skipped(e)) return true;
    }
    return false;
  }

  var observer = new MutationObserver(function (records) {
    var seen = [];
    for (var i = 0; i < records.length; i++) {
      var r = records[i];
      var t = r.type === 'characterData' ? r.target.parentNode : r.target;
      if (!t || t.nodeType !== 1 || inSkipped(t)) continue;
      if (r.type === 'attributes') { translateAttrs(t); continue; }
      if (seen.indexOf(t) < 0) { seen.push(t); translateOwn(t); }
      for (var j = 0; r.addedNodes && j < r.addedNodes.length; j++) {
        if (r.addedNodes[j].nodeType === 1) { walk(r.addedNodes[j]); translateMath(r.addedNodes[j]); }
      }
    }
    observer.takeRecords();
  });

  function run() {
    translateHead();
    walk(document.body);
    translateMath(document.body);
    placeSwitch();
    observer.observe(document.body, {
      childList: true, subtree: true, characterData: true,
      attributes: true, attributeFilter: ATTRS
    });
    clearTimeout(failsafe);
    reveal();
  }

  function load(url) {
    return fetch(url, { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : {}; })
      .catch(function () { return {}; });
  }

  var urls = [root + 'shared.en.json' + (ver ? '?v=' + ver : '')];
  if (catalog) urls.push(root + 'catalog.en.json' + (ver ? '?v=' + ver : ''));
  if (pageDict) urls.push(pageDict);
  Promise.all(urls.map(load)).then(function (dicts) {
    for (var i = 0; i < dicts.length; i++) for (var k in dicts[i]) D[k] = dicts[i][k];
    onReady(run);
  });
})();
