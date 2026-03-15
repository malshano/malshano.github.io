const filmSection = document.querySelector("#film-scroll");
const filmTrack = document.querySelector(".film-scroll-track");

if (filmSection && filmTrack) {

    const slides = filmTrack.children;
    const totalVideos = slides.length;

    const scrollLength = filmSection.offsetHeight - window.innerHeight;
    let currentIndex = 0;

    window.addEventListener("scroll", () => {

        const rect = filmSection.getBoundingClientRect();
        const scrollStart = -rect.top;

        let progress = scrollStart / scrollLength;
        progress = Math.max(0, Math.min(progress, 1));

        let targetIndex = Math.round(progress * (totalVideos - 1));

        // stop at last video
        targetIndex = Math.min(targetIndex, totalVideos - 1);

        if (targetIndex !== currentIndex) {

            currentIndex = targetIndex;

            const targetX = currentIndex * window.innerWidth;
            filmTrack.style.transform = `translateX(-${targetX}px)`;

        }

    });

}

const slides = document.querySelectorAll(".film-slide");

const observer = new IntersectionObserver((entries) => {

    entries.forEach(entry => {

        const video = entry.target.querySelector(".cinema-video");

        if(!video) return;

        if(entry.isIntersecting){
            video.play().catch(()=>{});
        } else {
            video.pause();
        }

    });

}, {
    threshold: 0.6
});

slides.forEach(slide => observer.observe(slide));