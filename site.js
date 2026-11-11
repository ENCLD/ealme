// Shared page behaviour: photo lightbox, scroll reveal and the diary filter.
// Each page keeps its own translations + setLanguage() inline.

window.addEventListener('DOMContentLoaded', () => {
    setupLightbox();
    setupReveal();
    setupDiaryFilter();
    setupCountUp();
    setupTabs();
});

function isEnglish() {
    return document.documentElement.lang === 'en';
}

function setupLightbox() {
    const images = Array.from(document.querySelectorAll(
        '.polaroid img, .day-photos img, .day-image, .avatar img, .project-card > img, .gallery-item img, .bento img, .browser-frame img'
    ));
    if (!images.length) return;

    const box = document.createElement('div');
    box.className = 'lightbox';
    box.innerHTML = `
        <button class="lightbox-btn close" aria-label="Lukk">&times;</button>
        <button class="lightbox-btn prev" aria-label="Forrige">&#8249;</button>
        <img alt="">
        <p class="lightbox-caption"></p>
        <button class="lightbox-btn next" aria-label="Neste">&#8250;</button>`;
    document.body.appendChild(box);

    const boxImg = box.querySelector('img');
    const boxCaption = box.querySelector('.lightbox-caption');
    let current = 0;

    function show(index) {
        current = (index + images.length) % images.length;
        const img = images[current];
        const caption = img.closest('figure')?.querySelector('figcaption');
        boxImg.src = img.src;
        boxImg.alt = img.alt;
        boxCaption.textContent = caption ? caption.textContent : (img.dataset.caption || img.alt);
        box.classList.add('open');
    }

    const close = () => box.classList.remove('open');

    images.forEach((img, i) => {
        img.style.cursor = 'zoom-in';
        img.addEventListener('click', () => show(i));
    });
    box.querySelector('.close').addEventListener('click', close);
    box.querySelector('.prev').addEventListener('click', e => { e.stopPropagation(); show(current - 1); });
    box.querySelector('.next').addEventListener('click', e => { e.stopPropagation(); show(current + 1); });
    box.addEventListener('click', e => { if (e.target === box) close(); });
    document.addEventListener('keydown', e => {
        if (!box.classList.contains('open')) return;
        if (e.key === 'Escape') close();
        if (e.key === 'ArrowLeft') show(current - 1);
        if (e.key === 'ArrowRight') show(current + 1);
    });
}

function setupReveal() {
    const targets = document.querySelectorAll('.reveal, .day-card, .project-card, .sn-flow, .video-section');
    targets.forEach(el => el.classList.add('reveal'));

    if (!('IntersectionObserver' in window)) {
        targets.forEach(el => el.classList.add('visible'));
        return;
    }

    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.12 });
    targets.forEach(el => observer.observe(el));
}

// "Filter navigator": live-filters diary entries by text, date or record number
function setupDiaryFilter() {
    const input = document.getElementById('diaryFilter');
    if (!input) return;

    const count = document.getElementById('diaryFilterCount');
    const empty = document.getElementById('diaryEmpty');
    const groups = Array.from(document.querySelectorAll('.week-group'));
    const total = document.querySelectorAll('.week-group .day-card').length;
    const placeholderNo = input.placeholder;

    function apply() {
        const query = input.value.trim().toLowerCase();
        let shown = 0;

        groups.forEach(group => {
            const heading = group.querySelector('.week-heading').textContent.toLowerCase();
            let groupHits = 0;

            group.querySelectorAll('.day-card').forEach(card => {
                const hit = !query || heading.includes(query) || card.textContent.toLowerCase().includes(query);
                card.style.display = hit ? '' : 'none';
                if (hit) groupHits++;
            });

            group.style.display = groupHits ? '' : 'none';
            shown += groupHits;
        });

        input.placeholder = isEnglish() ? input.dataset.placeholderEn : placeholderNo;
        count.textContent = isEnglish() ? `${shown} of ${total} entries` : `${shown} av ${total} innlegg`;
        empty.style.display = shown ? 'none' : 'block';
    }

    input.addEventListener('input', apply);
    document.getElementById('btn-no')?.addEventListener('click', apply);
    document.getElementById('btn-en')?.addEventListener('click', apply);
    apply();
}

// Animate numbers in [data-count] elements up from zero the first time they are seen.
// The final text is always restored exactly, so translations stay intact.
function setupCountUp() {
    const els = document.querySelectorAll('[data-count]');
    if (!els.length || !('IntersectionObserver' in window)) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    function run(el) {
        const original = el.innerHTML;
        const text = el.textContent;
        const match = text.match(/\d[\d\s\u00a0.,]*\d|\d/);
        if (!match) return;

        const english = isEnglish();
        const chunk = match[0];
        const normalised = english ? chunk.replace(/[,\s\u00a0]/g, '') : chunk.replace(/[\s\u00a0.]/g, '').replace(',', '.');
        const target = parseFloat(normalised);
        const decimals = (normalised.split('.')[1] || '').length;
        const format = new Intl.NumberFormat(english ? 'en-US' : 'nb-NO', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
            useGrouping: english ? chunk.includes(',') : /[\s\u00a0]/.test(chunk)
        });

        const start = performance.now();
        const duration = 1400;

        function frame(now) {
            const p = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - p, 3);
            if (p < 1) {
                el.textContent = text.replace(chunk, format.format(target * eased));
                requestAnimationFrame(frame);
            } else {
                el.innerHTML = original;
            }
        }
        requestAnimationFrame(frame);
    }

    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                run(entry.target);
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.6 });
    els.forEach(el => observer.observe(el));
}

// Form-section tabs: highlight the section currently in view
function setupTabs() {
    const links = Array.from(document.querySelectorAll('.sn-tabs a[href^="#"]'));
    if (!links.length) return;

    const sections = links.map(link => document.querySelector(link.getAttribute('href'))).filter(Boolean);

    function update() {
        let current = sections[0];
        sections.forEach(section => {
            if (section.getBoundingClientRect().top < 160) current = section;
        });
        links.forEach(link => {
            const active = link.getAttribute('href') === '#' + current.id;
            if (active && !link.classList.contains('active')) {
                link.parentElement.scrollTo({ left: link.offsetLeft - 20, behavior: 'smooth' });
            }
            link.classList.toggle('active', active);
        });
    }

    window.addEventListener('scroll', update, { passive: true });
    update();
}
