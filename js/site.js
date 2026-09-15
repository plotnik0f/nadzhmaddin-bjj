(function () {
  'use strict';

  // ── Отзывы ────────────────────────────────────────────────────────
  // Ответы Google Формы копятся в связанной Таблице, она публикуется как
  // CSV. Основной набор отзывов вшивается в страницу на сборке
  // (build-reviews.py) — это то, что видно без JS и в файле-визитке.
  // Здесь — только живое обновление уже опубликованного сайта, чтобы
  // новый отзыв появлялся без пересборки.
  var REVIEWS_CSV_URL = '';

  // Разбор CSV: значения бывают в кавычках, внутри — запятые и переносы строк.
  var parseCsv = function (text) {
    var rows = [], row = [], value = '', quoted = false;
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (quoted) {
        if (ch === '"') {
          if (text[i + 1] === '"') { value += '"'; i++; } else { quoted = false; }
        } else { value += ch; }
      } else if (ch === '"') {
        quoted = true;
      } else if (ch === ',') {
        row.push(value); value = '';
      } else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(value); rows.push(row); row = []; value = '';
      } else {
        value += ch;
      }
    }
    if (value !== '' || row.length) { row.push(value); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (c) { return c.trim(); }); });
  };

  var MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

  // «14.09.2026 23:41:09» из «Отметки времени» → 14 сентября 2026, 23:41
  var reviewDate = function (stamp) {
    var m = /(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\D+(\d{1,2}):(\d{2}))?/.exec(stamp || '');
    if (!m) return null;
    var two = function (n) { return (n < 10 ? '0' : '') + n; };
    var date = {
      iso: m[3] + '-' + two(+m[2]) + '-' + two(+m[1]),
      label: +m[1] + ' ' + MONTHS[m[2] - 1] + ' ' + m[3]
    };
    if (m[4]) {
      date.iso += 'T' + two(+m[4]) + ':' + m[5];
      date.label += ', ' + two(+m[4]) + ':' + m[5];
    }
    return date;
  };

  var renderReviews = function (rows) {
    var list = document.getElementById('reviews-list');
    if (!list || rows.length < 2) return;

    var header = rows[0].map(function (h) { return h.trim().toLowerCase(); });
    var nameIdx = -1;
    header.forEach(function (h, i) {
      if (nameIdx < 0 && (h.indexOf('обращат') >= 0 || h.indexOf('имя') >= 0)) nameIdx = i;
    });
    var modIdx = header.indexOf('публиковать');
    var stampIdx = 0;
    header.forEach(function (h, i) {
      if (h.indexOf('отметка') >= 0 || h.indexOf('timestamp') >= 0) stampIdx = i;
    });
    var skip = { 0: true };
    skip[stampIdx] = true;
    if (nameIdx >= 0) skip[nameIdx] = true;
    if (modIdx >= 0) skip[modIdx] = true;
    var rest = [];
    for (var i = 0; i < header.length; i++) if (!skip[i]) rest.push(i);
    if (nameIdx < 0) nameIdx = rest.shift();
    var textIdx = rest[rest.length - 1];
    if (nameIdx === undefined || textIdx === undefined) return;

    var made = document.createDocumentFragment(), count = 0;
    for (var r = rows.length - 1; r >= 1; r--) {
      var row = rows[r];
      var name = (row[nameIdx] || '').trim(), text = (row[textIdx] || '').trim();
      if (!name || !text) continue;
      if (modIdx >= 0) {
        var flag = (row[modIdx] || '').trim().toLowerCase();
        if (['да', 'yes', 'true', '1', '+'].indexOf(flag) < 0) continue;
      }
      var card = document.createElement('article');
      card.className = 'rounded-xl border border-line bg-paper p-6';
      var quote = document.createElement('p');
      quote.className = 'leading-relaxed text-ink2';
      // Текст пишут посторонние люди: только textContent, никакого innerHTML.
      quote.textContent = '«' + text + '»';
      var meta = document.createElement('div');
      meta.className = 'mt-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1';
      var who = document.createElement('p');
      who.className = 'text-sm font-medium text-ink';
      who.textContent = name;
      meta.appendChild(who);
      var date = reviewDate(row[stampIdx]);
      if (date) {
        var when = document.createElement('time');
        when.className = 'text-sm text-ink2';
        when.setAttribute('datetime', date.iso);
        when.textContent = date.label;
        meta.appendChild(when);
      }
      card.appendChild(quote); card.appendChild(meta);
      made.appendChild(card); count++;
    }
    if (!count) return;

    list.textContent = '';
    list.appendChild(made);
    // Карусель отзывов пересчитывает страницы на resize
    window.dispatchEvent(new Event('resize'));

    var heading = document.getElementById('reviews-heading');
    if (heading) heading.textContent = 'Что говорят ученики';
    var intro = document.getElementById('reviews-intro');
    if (intro) {
      intro.textContent = 'Отзывы приходят через форму, и я публикую их без правок. Тренировались у меня? Напишите пару строк.';
    }
  };

  // На file:// (файл, открытый из мессенджера) запрос к docs.google.com
  // всё равно отобьёт CORS — там работают вшитые на сборке отзывы.
  if (REVIEWS_CSV_URL && location.protocol.indexOf('http') === 0 && window.fetch) {
    fetch(REVIEWS_CSV_URL, { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.text() : Promise.reject(r.status); })
      .then(function (text) { renderReviews(parseCsv(text)); })
      .catch(function () { /* остаются отзывы, вшитые на сборке */ });
  }

  var yearEl = document.getElementById('year');
  if (yearEl) {
    yearEl.textContent = String(new Date().getFullYear());
  }

  // ── Мобильное меню ────────────────────────────────────────────────
  var toggle = document.getElementById('menu-toggle');
  var menu = document.getElementById('mobile-menu');

  if (toggle && menu) {
    var toggleLabel = toggle.querySelector('.sr-only');
    // Брейкпойнт lg берём через matchMedia: window.innerWidth считает вместе
    // с полосой прокрутки и на ~15 px расходится с CSS-медиазапросом.
    var wide = window.matchMedia('(min-width: 1024px)');

    var setMenu = function (open) {
      menu.hidden = !open;
      toggle.setAttribute('aria-expanded', String(open));
      if (toggleLabel) toggleLabel.textContent = open ? 'Закрыть меню' : 'Открыть меню';
    };

    toggle.addEventListener('click', function (event) {
      event.stopPropagation();
      setMenu(menu.hidden);
    });

    menu.addEventListener('click', function (event) {
      if (event.target.closest('a')) setMenu(false);
    });

    // Меню живёт внутри липкой шапки и на узком экране занимает почти его целиком.
    // Поэтому закрываем не только по ссылке, но и по клику мимо и при скролле —
    // иначе передумавший посетитель остаётся с панелью поверх страницы.
    document.addEventListener('click', function (event) {
      if (menu.hidden) return;
      if (!event.target.closest('#mobile-menu, #menu-toggle')) setMenu(false);
    });

    window.addEventListener('scroll', function () {
      if (!menu.hidden) setMenu(false);
    }, { passive: true });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && !menu.hidden) {
        setMenu(false);
        toggle.focus();
      }
    });

    wide.addEventListener('change', function (event) {
      if (event.matches && !menu.hidden) setMenu(false);
    });
  }

  // ── Карусели: фото сборов, групп и отзывы ─────────────────────────
  // Листание пальцем работает и без скрипта (scroll-snap в CSS). Здесь только
  // стрелки для мыши и счётчик «1 / 3». Страницы считаются по ширине прокрутки,
  // а не по числу слайдов: у отзывов на странице 1 карточка на телефоне и 4 на
  // компьютере, и между колонками есть отступ.
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  Array.prototype.forEach.call(document.querySelectorAll('[data-carousel]'), function (carousel) {
    var track = carousel.querySelector('.carousel-track');
    var count = carousel.querySelector('.carousel-count');
    if (!track) return;
    var isReviews = carousel.classList.contains('carousel--reviews');

    var gap = function () { return parseFloat(getComputedStyle(track).columnGap) || 0; };
    var step = function () { return Math.max(track.clientWidth + gap(), 1); };
    var pages = function () {
      return Math.max(1, Math.ceil((track.scrollWidth + gap()) / step() - 0.01));
    };
    var current = function () {
      return Math.min(Math.max(Math.round(track.scrollLeft / step()), 0), pages() - 1);
    };

    var makeButton = function (dir, label, path) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'carousel-btn';
      btn.dataset.dir = String(dir);
      btn.setAttribute('aria-label', label);
      btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">'
        + '<path d="' + path + '" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      btn.addEventListener('click', function () {
        var target = Math.min(Math.max(current() + dir, 0), pages() - 1) * step();
        track.scrollTo({
          left: Math.min(target, track.scrollWidth - track.clientWidth),
          behavior: reduceMotion ? 'auto' : 'smooth'
        });
      });
      carousel.appendChild(btn);
      return btn;
    };

    var videos = Array.prototype.slice.call(track.querySelectorAll('video'));
    var prevLabel = isReviews ? 'Предыдущие отзывы' : videos.length ? 'Предыдущий слайд' : 'Предыдущее фото';
    var nextLabel = isReviews ? 'Следующие отзывы' : videos.length ? 'Следующий слайд' : 'Следующее фото';
    var prev = makeButton(-1, prevLabel, 'M10 3L5 8l5 5');
    var next = makeButton(1, nextLabel, 'M6 3l5 5-5 5');

    var update = function () {
      var total = pages(), index = current();
      if (count) count.textContent = (index + 1) + ' / ' + total;
      prev.disabled = index === 0;
      next.disabled = index >= total - 1;
      carousel.toggleAttribute('data-single', total < 2);
      // Пролистали видео — останавливаем, чтобы звук не играл за кадром
      if (videos.length) {
        var box = track.getBoundingClientRect();
        videos.forEach(function (video) {
          // Видео на весь экран: его размеры уже не про карусель, не трогаем
          var fullscreen = document.fullscreenElement === video || document.webkitFullscreenElement === video || video.webkitDisplayingFullscreen;
          var r = video.getBoundingClientRect(), mid = r.left + r.width / 2;
          if (!video.paused && !fullscreen && (mid < box.left || mid > box.right)) video.pause();
        });
      }
    };

    var queued = false;
    track.addEventListener('scroll', function () {
      if (queued) return;
      queued = true;
      window.requestAnimationFrame(function () { queued = false; update(); });
    }, { passive: true });
    window.addEventListener('resize', update);
    update();

    // Слайды за правым краем браузер с loading="lazy" не грузит, пока их не
    // пролистают, — на медленном телефоне это пустой кадр на свайпе. Поэтому
    // включаем загрузку всех кадров, как только карусель подходит к экрану.
    if ('IntersectionObserver' in window) {
      var preload = new IntersectionObserver(function (entries) {
        if (!entries[0].isIntersecting) return;
        Array.prototype.forEach.call(track.querySelectorAll('img'), function (img) { img.loading = 'eager'; });
        preload.disconnect();
      }, { rootMargin: '600px 0px' });
      preload.observe(carousel);
    }
  });

  // ── Печать: раскрыть FAQ ──────────────────────────────────────────
  // Закрытый <details> не отрисовывает содержимое, поэтому CSS-правилом
  // его на бумаге не показать — только открыть перед печатью и вернуть после.
  var faqItems = Array.prototype.slice.call(document.querySelectorAll('.faq-item'));

  var expandForPrint = function () {
    faqItems.forEach(function (item) {
      if (!item.open) {
        item.dataset.wasClosed = 'true';
        item.open = true;
      }
    });
  };

  var restoreAfterPrint = function () {
    faqItems.forEach(function (item) {
      if (item.dataset.wasClosed === 'true') {
        item.open = false;
        delete item.dataset.wasClosed;
      }
    });
  };

  window.addEventListener('beforeprint', expandForPrint);
  window.addEventListener('afterprint', restoreAfterPrint);
  // Safari не шлёт beforeprint — там событие приходит через медиазапрос
  if (window.matchMedia) {
    window.matchMedia('print').addEventListener('change', function (event) {
      if (event.matches) expandForPrint();
      else restoreAfterPrint();
    });
  }

  // ── Подсветка активного пункта в шапке ────────────────────────────
  var navLinks = Array.prototype.slice.call(document.querySelectorAll('.nav-link'))
    // В querySelector идёт значение атрибута: любой href, не являющийся якорем,
    // бросит SyntaxError и оборвёт весь скрипт целиком.
    .filter(function (link) {
      return /^#[\w-]+$/.test(link.getAttribute('href') || '');
    });

  var sections = navLinks
    .map(function (link) { return document.querySelector(link.getAttribute('href')); })
    .filter(Boolean);

  if (sections.length && 'IntersectionObserver' in window) {
    var visible = new Set();

    var paint = function () {
      // Активным считаем самую верхнюю из видимых секций, а не последнюю запись
      // в батче: порядок записей не гарантирован, и на границе двух секций
      // подсветка иначе зависит от направления скролла.
      var top = null;
      visible.forEach(function (section) {
        if (!top || section.getBoundingClientRect().top < top.getBoundingClientRect().top) {
          top = section;
        }
      });
      navLinks.forEach(function (link) {
        link.dataset.active = String(!!top && link.getAttribute('href') === '#' + top.id);
      });
    };

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) visible.add(entry.target);
          else visible.delete(entry.target);
        });
        paint();
      },
      { rootMargin: '-45% 0px -50% 0px' }
    );

    sections.forEach(function (section) { observer.observe(section); });
  }
})();
