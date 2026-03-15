const filmSection = document.querySelector("#film-scroll");
const filmTrack = document.querySelector(".film-scroll-track");

if (filmSection && filmTrack) {

    const firstClone = filmTrack.children[0].cloneNode(true);
    filmTrack.appendChild(firstClone);

    const videos = filmTrack.children;
    const totalVideos = videos.length;

    const scrollLength = filmSection.offsetHeight - window.innerHeight;
    let currentIndex = 0;

    window.addEventListener("scroll", () => {

        const rect = filmSection.getBoundingClientRect();
        const scrollStart = -rect.top;

        let progress = scrollStart / scrollLength;
        progress = Math.max(0, Math.min(progress, 1));

        const targetIndex = Math.round(progress * (totalVideos - 1));

if (filmSection && filmTrack) {

    const videos = filmTrack.children;
    const totalVideos = videos.length;

    const scrollLength = filmSection.offsetHeight - window.innerHeight;
    let currentIndex = 0;

    window.addEventListener("scroll", () => {

        const rect = filmSection.getBoundingClientRect();
        const scrollStart = -rect.top;

        let progress = scrollStart / scrollLength;
        progress = Math.max(0, Math.min(progress, 1));

        let targetIndex = Math.round(progress * (totalVideos - 1));

        // STOP at the 4th video
        targetIndex = Math.min(targetIndex, 3);

        if (targetIndex !== currentIndex) {
            currentIndex = targetIndex;

            const targetX = currentIndex * window.innerWidth;
            filmTrack.style.transform = `translateX(-${targetX}px)`;
        }

    });
    }

    });
}