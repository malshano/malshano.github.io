(function () {
    var h1Name  = document.getElementById('h1-name');
    var header  = document.querySelector('header');
    if (!h1Name || !header) return;

    var SHOW_DURATION = 4500; // ms the video is visible (including fade)
    var FADE_MS       = 700;  // must match CSS transition duration
    var REPEAT_EVERY  = 22000; // ms between each video's repeat cycle

    // offsetX: px from centre of name text (negative = left, positive = right)
    // offsetY: px from centre of name text (negative = up,   positive = down)
    function makeSequence(videoId, offsetX, offsetY) {
        var vid = document.getElementById(videoId);
        if (!vid) return null;

        function position() {
            var nameRect   = h1Name.getBoundingClientRect();
            var headerRect = header.getBoundingClientRect();
            var jH  = vid.offsetHeight || 110;
            var jW  = vid.offsetWidth  || jH;
            var cx  = nameRect.left - headerRect.left + nameRect.width  / 2;
            var cy  = nameRect.top  - headerRect.top  + nameRect.height / 2;
            vid.style.left = Math.round(cx - jW / 2 + offsetX) + 'px';
            vid.style.top  = Math.round(cy - jH / 2 + offsetY) + 'px';
        }

        function play() {
            position();
            vid.currentTime = 0;
            vid.play().catch(function () {});
            vid.style.opacity = '1';
            setTimeout(function () {
                vid.style.opacity = '0';
                setTimeout(function () { vid.pause(); }, FADE_MS);
            }, SHOW_DURATION - FADE_MS);
        }

        window.addEventListener('resize', position, { passive: true });
        return play;
    }

    // ── Adjust placement here ──────────────────────────────────────────────
    // offsetX: negative moves left of centre, positive moves right of centre
    // offsetY: negative moves above centre,   positive moves below centre
    var playJetpack = makeSequence('jetpack-video', -10,  -40);
    var playSkijump = makeSequence('skijump-video', -155, -20);
    var playSurfing = makeSequence('surfing-video',   0,    0);
    // ───────────────────────────────────────────────────────────────────────

    if (playJetpack) {
        setTimeout(function () {
            playJetpack();
            setInterval(playJetpack, REPEAT_EVERY);
        }, 9000);
    }

    if (playSkijump) {
        setTimeout(function () {
            playSkijump();
            setInterval(playSkijump, REPEAT_EVERY);
        }, 3000);
    }

    if (playSurfing) {
        setTimeout(function () {
            playSurfing();
            setInterval(playSurfing, REPEAT_EVERY);
        }, 17000);
    }
})();
