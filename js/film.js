// -----------------------------------------------
// Film scroll slider – optimised & conflict-free
// -----------------------------------------------

const filmSection = document.querySelector("#film-scroll");
const filmTrack   = document.querySelector(".film-scroll-track");

if (filmSection && filmTrack) {
    const slides        = Array.from(filmTrack.querySelectorAll(".film-slide"));
    const totalVideos   = slides.length;
    const scrollSegments = totalVideos + 1; // extra segment for loop-back
    let   currentIndex  = 0;
    let   rafPending    = false;

    // Recomputed each time so window resize doesn't break things
    function getScrollLength() {
        return filmSection.offsetHeight - window.innerHeight;
    }

    // Slide ID → index for hash navigation
    const slideIdToIndex = {};
    slides.forEach((slide, i) => { if (slide.id) slideIdToIndex[slide.id] = i; });

    // Navigation dots
    const dots = Array.from(filmSection.querySelectorAll(".film-dot"));
    function updateDots(index) {
        dots.forEach((d, i) => d.classList.toggle("active", i === index));
    }
    dots.forEach((dot, i) => dot.addEventListener("click", () => scrollToSlide(i)));

    // Scroll the page to centre on a slide
    function scrollToSlide(index, smooth = true) {
        const progress     = (index + 0.5) / scrollSegments;
        const targetScroll = filmSection.offsetTop + progress * getScrollLength();
        window.scrollTo({ top: targetScroll, behavior: smooth ? "smooth" : "instant" });
    }

    // Play/pause HTML5 cinema videos
    function setVideos(index) {
        slides.forEach((slide, i) => {
            const vid = slide.querySelector("video.cinema-video");
            if (!vid) return;
            if (i === index) {
                vid.play().catch(() => {});
            } else {
                vid.pause();
            }
        });
    }

    // YouTube player (controlled via API, not iframe src autoplay)
    let ytPlayer;
    const ytSlideIndex = slides.findIndex(s => s.id === "film3NTNU");

    // Must be global so the YouTube iframe API can call it
    window.onYouTubeIframeAPIReady = function () {
        ytPlayer = new YT.Player("yt-film3", {
            events: {
                onReady() {
                    if (currentIndex !== ytSlideIndex) ytPlayer.pauseVideo();
                }
            }
        });
    };

    function setYouTube(index) {
        if (!ytPlayer || typeof ytPlayer.playVideo !== "function") return;
        if (index === ytSlideIndex) {
            ytPlayer.playVideo();
        } else {
            ytPlayer.pauseVideo();
        }
    }

    // Apply a slide change: move track, update media, update dots
    function applySlide(index, animate) {
        const loopingBack = currentIndex === totalVideos - 1 && index === 0;
        currentIndex = index;

        if (animate && !loopingBack) {
            filmTrack.classList.remove("no-transition");
        } else {
            filmTrack.classList.add("no-transition");
            void filmTrack.offsetWidth; // force reflow so transition re-enables cleanly
        }

        filmTrack.style.transform = `translateX(-${currentIndex * window.innerWidth}px)`;

        setVideos(currentIndex);
        setYouTube(currentIndex);
        updateDots(currentIndex);

        // Re-enable transition after instant jump
        if (!animate || loopingBack) {
            requestAnimationFrame(() => filmTrack.classList.remove("no-transition"));
        }
    }

    function updateSlider(animate) {
        const scrollLength = getScrollLength();
        const rect = filmSection.getBoundingClientRect();
        let progress = -rect.top / scrollLength;
        progress = Math.max(0, Math.min(progress, 1));

        let targetIndex = Math.floor(progress * scrollSegments);
        if (targetIndex >= totalVideos) targetIndex = 0;

        if (targetIndex !== currentIndex) {
            applySlide(targetIndex, animate);
        }
    }

    // rAF-throttled scroll — prevents jank from firing every pixel
    window.addEventListener("scroll", () => {
        if (rafPending) return;
        rafPending = true;
        requestAnimationFrame(() => {
            updateSlider(true);
            updateFilmNav();
            rafPending = false;
        });
    }, { passive: true });

    // Recalculate track position on resize
    let resizeTimer;
    window.addEventListener("resize", () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            filmTrack.classList.add("no-transition");
            filmTrack.style.transform = `translateX(-${currentIndex * window.innerWidth}px)`;
            requestAnimationFrame(() => filmTrack.classList.remove("no-transition"));
        }, 100);
    });

    // Keyboard left/right arrow navigation
    window.addEventListener("keydown", (e) => {
        if (!filmSection.getBoundingClientRect().height) return;
        const rect = filmSection.getBoundingClientRect();
        const inView = rect.top < window.innerHeight && rect.bottom > 0;
        if (!inView) return;
        if (e.key === "ArrowRight") scrollToSlide((currentIndex + 1) % totalVideos);
        if (e.key === "ArrowLeft")  scrollToSlide((currentIndex - 1 + totalVideos) % totalVideos);
    });

    // Touch swipe
    let touchStartX = 0, touchStartY = 0;
    const filmWrapper = filmSection.querySelector(".film-scroll-wrapper");

    // Floating film-nav — only show once the regular nav has scrolled off-screen
    const filmNav = filmWrapper.querySelector(".film-nav");
    function updateFilmNav() {
        const sectionTop = filmSection.getBoundingClientRect().top;
        filmNav?.classList.toggle("visible", sectionTop <= 0);
    }

    filmWrapper.addEventListener("touchstart", e => {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
    }, { passive: true });

    filmWrapper.addEventListener("touchmove", e => {
        const dx = touchStartX - e.touches[0].clientX;
        const dy = touchStartY - e.touches[0].clientY;
        if (Math.abs(dx) > Math.abs(dy)) e.preventDefault();
    }, { passive: false });

    filmWrapper.addEventListener("touchend", e => {
        const dx = touchStartX - e.changedTouches[0].clientX;
        const dy = touchStartY - e.changedTouches[0].clientY;
        if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
            const newIndex = (currentIndex + (dx > 0 ? 1 : -1) + totalVideos) % totalVideos;
            scrollToSlide(newIndex);
        }
    });

    // Carousel arrow buttons
    const prevBtn = filmWrapper.querySelector(".film-arrow-prev");
    const nextBtn = filmWrapper.querySelector(".film-arrow-next");
    if (prevBtn) prevBtn.addEventListener("click", () => scrollToSlide((currentIndex - 1 + totalVideos) % totalVideos));
    if (nextBtn) nextBtn.addEventListener("click", () => scrollToSlide((currentIndex + 1) % totalVideos));

    // Mouse drag
    let mouseStartX = 0, isDragging = false;

    filmWrapper.addEventListener("mousedown", e => {
        mouseStartX = e.clientX;
        isDragging  = true;
        filmWrapper.style.cursor = "grabbing";
    });

    window.addEventListener("mouseup", e => {
        if (!isDragging) return;
        isDragging = false;
        filmWrapper.style.cursor = "";
        const dx = mouseStartX - e.clientX;
        if (Math.abs(dx) > 50) {
            const newIndex = (currentIndex + (dx > 0 ? 1 : -1) + totalVideos) % totalVideos;
            scrollToSlide(newIndex);
        }
    });

    // Unmute only the currently playing video on first interaction
    document.body.addEventListener("click", () => {
        const vid = slides[currentIndex]?.querySelector("video.cinema-video");
        if (vid) { vid.muted = false; vid.play().catch(() => {}); }
    }, { once: true });

    // Hash navigation
    const hash = window.location.hash.slice(1);
    if (hash && slideIdToIndex[hash] !== undefined) {
        scrollToSlide(slideIdToIndex[hash], false);
    }

    // Initialise
    updateSlider(false);
    updateFilmNav();
}
