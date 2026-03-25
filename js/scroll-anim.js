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