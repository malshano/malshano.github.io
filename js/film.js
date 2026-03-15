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

        const htmlVideo = entry.target.querySelector("video.cinema-video");
        const iframe = entry.target.querySelector("iframe");

        if(entry.isIntersecting){

            if(htmlVideo){
                htmlVideo.play().catch(()=>{});
            }

            if(iframe && ytPlayer){
                ytPlayer.playVideo();
            }

        } else {

            if(htmlVideo){
                htmlVideo.pause();
            }

            if(iframe && ytPlayer){
                ytPlayer.pauseVideo();
            }

        }

    });

}, { threshold: 0.6 });

slides.forEach(slide => observer.observe(slide));

let ytPlayer;

function onYouTubeIframeAPIReady() {
    ytPlayer = new YT.Player("yt-film3");
}


document.body.addEventListener("click", () => {
    const videos = document.querySelectorAll(".cinema-video");
    videos.forEach(v => {
        v.muted = false;
        v.play().catch(()=>{});
    });
}, { once: true }); // only first click needed