// Nav: show background only when scrolled past its natural position
const nav = document.querySelector('nav');
const navOffsetTop = nav.offsetTop;

// ── NAV ANCHOR FIX FOR STICKY SECTIONS ────────────────────────────────────
// Sticky elements report getBoundingClientRect().top === 0 while stuck, so
// the browser skips scrolling to them ("already in view"). Also, offsetTop
// on sticky sections can vary depending on browser compositing state.
// Fix: snapshot natural section positions at load time (before any scrolling),
// then use a rAF-driven easing scroll that cannot be interrupted by scroll events.

// Snapshot natural positions before any scrolling/sticky transforms apply
const sectionNaturalTops = {};
document.querySelectorAll('section[id]').forEach(s => {
    sectionNaturalTops[s.id] = s.offsetTop;
});

let navRafId = null;
function navScrollTo(targetY) {
    // Cancel any in-progress nav scroll
    if (navRafId) { cancelAnimationFrame(navRafId); navRafId = null; }
    // Snap to current position to cancel any browser momentum/smooth-scroll
    window.scrollTo(0, window.scrollY);
    const start    = window.scrollY;
    const distance = targetY - start;
    if (Math.abs(distance) < 1) return;
    const duration = Math.min(800, Math.max(300, Math.abs(distance) * 0.3));
    let   startTime = null;
    function step(ts) {
        if (!startTime) startTime = ts;
        const p = Math.min((ts - startTime) / duration, 1);
        // ease-in-out cubic
        const ease = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
        window.scrollTo(0, start + distance * ease);
        if (p < 1) {
            navRafId = requestAnimationFrame(step);
        } else {
            navRafId = null;
            // Snap exactly to target in case of floating-point drift
            window.scrollTo(0, targetY);
        }
    }
    navRafId = requestAnimationFrame(step);
}

document.querySelectorAll('nav a[href^="#"]').forEach(link => {
    link.addEventListener('click', function (e) {
        const id = this.getAttribute('href').slice(1);
        const target = document.getElementById(id);
        if (!target) return;
        e.preventDefault();
        const naturalTop = sectionNaturalTops[id] ?? target.offsetTop;
        let targetY;
        if (id === 'about') {
            // Centre the section vertically in the viewport
            targetY = naturalTop - (window.innerHeight / 2) + (target.offsetHeight / 2);
        } else {
            targetY = naturalTop - nav.offsetHeight;
        }
        navScrollTo(Math.max(0, targetY));
    });
});

window.addEventListener('scroll', () => {
    nav.classList.toggle('nav-stuck', window.scrollY > navOffsetTop);
}, { passive: true });

// Scroll animation observer
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add("visible");
        }
    });
}, {
    threshold: 0.2
});

document.querySelectorAll(".animate").forEach(el => {
    observer.observe(el);
});

// Me section zoom on scroll
const homeSection = document.getElementById('home');
window.addEventListener('scroll', () => {
    const rect = homeSection.getBoundingClientRect();
    const vh = window.innerHeight;
    // progress: 0 = section centre at bottom of viewport, 1 = section centre at top
    const centre = rect.top + rect.height / 2;
    const progress = 1 - (centre / vh);
    // scale: zoom in from 0.85 → 1 as section scrolls in, back to 0.85 as it scrolls out
    const scale = 1 - 0.15 * Math.abs(progress - 0.5) * 2;
    const clamped = Math.max(0.85, Math.min(1, scale));
    homeSection.style.transform = `scale(${clamped})`;
}, { passive: true });