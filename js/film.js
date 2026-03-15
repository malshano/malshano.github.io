// -------------------------------
// Scroll-controlled horizontal video slider with seamless looping
// -------------------------------

const filmSection = document.querySelector("#film-scroll");
const filmTrack = document.querySelector(".film-scroll-track");

if (filmSection && filmTrack) {
    const slides = Array.from(filmTrack.querySelectorAll(".film-slide"));
    const totalVideos = slides.length;
    let currentIndex = 0;

    const scrollLength = filmSection.offsetHeight - window.innerHeight;
    const scrollSegments = totalVideos + 1; // extra segment loops back to first

    // Build a map of slide IDs for hash navigation
    const slideIdToIndex = {};
    slides.forEach((slide, i) => { if (slide.id) slideIdToIndex[slide.id] = i; });

    // Scroll the page to center on a specific slide index
    function scrollToSlide(index, smooth = true) {
        const progress = (index + 0.5) / scrollSegments;
        const targetScroll = filmSection.offsetTop + progress * scrollLength;
        window.scrollTo({ top: targetScroll, behavior: smooth ? "smooth" : "instant" });
    }

    function applySlide(index, animate) {
        const loopingBack = currentIndex === totalVideos - 1 && index === 0;
        currentIndex = index;
        filmTrack.style.transition = (animate && !loopingBack) ? "transform 0.6s ease" : "none";
        filmTrack.style.transform = `translateX(-${currentIndex * window.innerWidth}px)`;
        slides.forEach(slide => {
            const vid = slide.querySelector("video");
            if (vid) vid.pause();
        });
        const currentVideo = slides[currentIndex].querySelector("video");
        if (currentVideo) currentVideo.play().catch(() => {});
    }

    function updateSlider(animate) {
        const rect = filmSection.getBoundingClientRect();
        let progress = -rect.top / scrollLength;
        progress = Math.max(0, Math.min(progress, 1));

        // Map scroll progress across one extra segment, then wrap back to 0
        let targetIndex = Math.floor(progress * scrollSegments);
        if (targetIndex >= totalVideos) targetIndex = 0;

        if (targetIndex !== currentIndex) {
            applySlide(targetIndex, animate);
        }
    }

    // -------------------------------
    // Touch swipe support
    // -------------------------------
    let touchStartX = 0;
    let touchStartY = 0;

    const filmWrapper = filmSection.querySelector(".film-scroll-wrapper");

    filmWrapper.addEventListener("touchstart", (e) => {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
    }, { passive: true });

    filmWrapper.addEventListener("touchmove", (e) => {
        const dx = touchStartX - e.touches[0].clientX;
        const dy = touchStartY - e.touches[0].clientY;
        // Prevent vertical page scroll when swiping horizontally
        if (Math.abs(dx) > Math.abs(dy)) e.preventDefault();
    }, { passive: false });

    filmWrapper.addEventListener("touchend", (e) => {
        const dx = touchStartX - e.changedTouches[0].clientX;
        const dy = touchStartY - e.changedTouches[0].clientY;
        if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
            const newIndex = (currentIndex + (dx > 0 ? 1 : -1) + totalVideos) % totalVideos;
            scrollToSlide(newIndex);
        }
    });

    // -------------------------------
    // Mouse drag support (desktop)
    // -------------------------------
    let mouseStartX = 0;
    let isDragging = false;

    filmWrapper.addEventListener("mousedown", (e) => {
        mouseStartX = e.clientX;
        isDragging = true;
        filmWrapper.style.cursor = "grabbing";
    });

    window.addEventListener("mouseup", (e) => {
        if (!isDragging) return;
        isDragging = false;
        filmWrapper.style.cursor = "";
        const dx = mouseStartX - e.clientX;
        if (Math.abs(dx) > 50) {
            const newIndex = (currentIndex + (dx > 0 ? 1 : -1) + totalVideos) % totalVideos;
            scrollToSlide(newIndex);
        }
    });

    // If URL hash matches a slide ID, scroll to show that slide
    const hash = window.location.hash.slice(1);
    if (hash && slideIdToIndex[hash] !== undefined) {
        scrollToSlide(slideIdToIndex[hash], false);
    }

    // Initialize transform on load (handles any initial scroll position)
    updateSlider(false);

    window.addEventListener("scroll", () => updateSlider(true));
}

// -------------------------------
// Intersection Observer: Auto-play/Pause videos and YouTube iframes
// -------------------------------

const slides = document.querySelectorAll(".film-slide");

/**
 * IntersectionObserver callback
 * Plays HTML5 video or YouTube iframe when slide is mostly visible (threshold 0.6)
 * Pauses videos when slide is not visible
 */
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
}, { threshold: 0.6 }); // slide must be 60% visible to trigger

slides.forEach(slide => observer.observe(slide));

// -------------------------------
// YouTube Iframe API
// -------------------------------

let ytPlayer;

/**
 * Called by YouTube Iframe API when ready
 * Initializes the YouTube player for the embedded video
 */
function onYouTubeIframeAPIReady() {
    ytPlayer = new YT.Player("yt-film3");
}

// -------------------------------
// Unmute all HTML5 videos on first user interaction
// -------------------------------

/**
 * Some browsers block autoplay with sound until user interacts
 * This listener un-mutes all videos on first click and plays them
 */
document.body.addEventListener("click", () => {
    const videos = document.querySelectorAll(".cinema-video");
    videos.forEach(v => {
        v.muted = false;
        v.play().catch(()=>{});
    });
}, { once: true }); // only trigger on first click