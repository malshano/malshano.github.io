// ---------------- SCROLL CONTROLLED HORIZONTAL VIDEO SWIPE ----------------
const filmSection = document.querySelector("#film-scroll");
const filmTrack = document.querySelector(".film-scroll-track");

if(filmSection && filmTrack){
    const totalVideos = filmTrack.children.length;
    const scrollLength = filmSection.offsetHeight - window.innerHeight;

    window.addEventListener("scroll", () => {
        const rect = filmSection.getBoundingClientRect();
        const scrollStart = -rect.top; // how far we scrolled into section
        const percent = Math.min(Math.max(scrollStart / scrollLength, 0), 0.5);
        const maxTranslate = filmTrack.scrollWidth - window.innerWidth;

        // move track horizontally
        filmTrack.style.transform = `translateX(-${percent * maxTranslate}px)`;
    });
}

// Jump to a specific video via URL hash
window.addEventListener("load", () => {
    const hash = window.location.hash;
    if(hash){
        const el = document.querySelector(hash);
        if(el){
            el.scrollIntoView({behavior:"smooth"});
        }
    }
});