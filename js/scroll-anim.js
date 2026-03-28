// Nav: show background only when scrolled past its natural position
const nav = document.querySelector('nav');
const navOffsetTop = nav.offsetTop;

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