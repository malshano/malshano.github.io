function stopAllVideos() {
    document.querySelectorAll('.gig-card').forEach(function (card) {
        var v = card.querySelector('video');
        v.pause();
        v.muted = true;
        card.classList.remove('revealed');
        card.onclick = function () { revealCard(card); };
    });
}

function stopAllAudio() {
    document.querySelectorAll('.audio-section audio').forEach(function (a) {
        a.pause();
    });
}

function revealCard(card) {
    stopAllAudio();

    // Pause & re-blur all other cards
    document.querySelectorAll('.gig-card').forEach(function (other) {
        if (other !== card) {
            var v = other.querySelector('video');
            v.pause();
            v.muted = true;
            other.classList.remove('revealed');
            other.onclick = function () { revealCard(other); };
        }
    });

    card.classList.add('revealed');
    var video = card.querySelector('video');
    video.muted = false;
    video.play();

    // Clicking the revealed card toggles pause / play
    card.onclick = function () {
        if (video.paused) {
            video.play();
        } else {
            video.pause();
        }
    };
}

/* ================= CLUB STROBE =================
   Randomly flashes the blur on unrevealed gig cards, so the wall of blurred
   videos reads like a dark room being lit by a strobe. Timing is random per
   burst rather than a CSS loop, which would have every card pulsing in step. */

var lastStrobed = null;

var FLASHES_PER_BURST = 3;
var FLASH_MS = 85;        // how long a single flash stays lit
var GAP_MIN_MS = 95;      // dark gap between flashes, randomised per gap
var GAP_MAX_MS = 205;
var BURST_TAIL_MS = 160;  // dark beat after the last flash, before the pause

function clearStrobe(card) {
    var video = card.querySelector('video');
    clearTimeout(card.strobeTimer);
    card.strobeTimer = null;
    card.classList.remove('strobing', 'lit', 'cool');
    if (video) {
        video.classList.remove('strobing', 'lit');
    }
}

function fireStrobe(card) {
    var video = card.querySelector('video');
    if (!video || card.classList.contains('revealed') ||
        card.classList.contains('strobing')) {
        return;
    }

    card.classList.add('strobing');
    video.classList.add('strobing');

    var fired = 0;

    function lightOn() {
        // Alternate the rim colour so a burst reads pink / cyan / pink.
        if (fired % 2 === 1) {
            card.classList.add('cool');
        } else {
            card.classList.remove('cool');
        }
        card.classList.add('lit');
        video.classList.add('lit');
        card.strobeTimer = setTimeout(lightOff, FLASH_MS);
    }

    function lightOff() {
        card.classList.remove('lit');
        video.classList.remove('lit');
        fired++;

        if (fired < FLASHES_PER_BURST) {
            // Each gap is rolled separately, so the three hits land unevenly
            // instead of on a fixed beat.
            var gap = GAP_MIN_MS + Math.random() * (GAP_MAX_MS - GAP_MIN_MS);
            card.strobeTimer = setTimeout(lightOn, gap);
        } else {
            card.strobeTimer = setTimeout(function () {
                clearStrobe(card);
            }, BURST_TAIL_MS);
        }
    }

    lightOn();
}

function strobeOnce() {
    // Sweep up anything still lit from a previous burst first. Without this a
    // single dropped animationend would leave a card marked forever and stall
    // the whole sequence, since the next pick skips cards that are strobing.
    [].slice.call(document.querySelectorAll('.gig-card.strobing')).forEach(clearStrobe);

    // Prefer a card other than the one that just flashed.
    var dark = idleCards().filter(function (card) {
        return card !== lastStrobed;
    });
    if (!dark.length) {
        dark = idleCards();
    }
    if (!dark.length) {
        return;
    }

    lastStrobed = dark[Math.floor(Math.random() * dark.length)];
    fireStrobe(lastStrobed);
}

function idleCards() {
    // Skip cards mid-burst, otherwise most picks would be wasted on them.
    return [].slice.call(document.querySelectorAll('.gig-card:not(.revealed):not(.strobing)'));
}

function scheduleStrobe() {
    // Pause between bursts. Uneven so it feels live rather than metronomic.
    var delay = 1500 + Math.random() * 2000;

    setTimeout(function () {
        strobeOnce();
        scheduleStrobe();
    }, delay);
}

if (!window.matchMedia || !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    scheduleStrobe();
}


function stopOtherMixes(current) {
    document.querySelectorAll('.audio-section audio').forEach(function (a) {
        if (a !== current) { a.pause(); }
    });
}

document.querySelectorAll('.audio-section audio').forEach(function (audio) {
    audio.addEventListener('play', function () {
        stopAllVideos();
        stopOtherMixes(audio);
    });

    // Hide the browser's right-click "Save audio as..." entry. Together with
    // controlsList="nodownload" this removes the obvious ways to save a mix —
    // it is a deterrent, not protection, since the mp3 URL is still public.
    audio.addEventListener('contextmenu', function (e) {
        e.preventDefault();
    });
});


/* ================= MIX PLAYER =================
   Replaces the native <audio> controls with a custom transport and a live
   frequency visualiser. The canvas doubles as the scrub bar: bars left of the
   playhead are lit with the neon gradient, bars to the right stay dim. */

var AudioCtx = window.AudioContext || window.webkitAudioContext;
var sharedCtx = null;
var mixPlayers = [];
var vizFrame = null;
var BAR_MAX = 72;

function fmtTime(t) {
    if (!isFinite(t) || t < 0) { t = 0; }
    var m = Math.floor(t / 60);
    var s = Math.floor(t % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
}

/* Stable pseudo-waveform drawn when a track is idle, so the canvas never
   looks broken or empty before first play. Layered sines at unrelated
   frequencies give it an irregular, recorded-audio silhouette. */
function idleLevel(i) {
    var v = 0.36
        + 0.17 * Math.sin(i * 0.55)
        + 0.11 * Math.sin(i * 0.23 + 1.9)
        + 0.07 * Math.sin(i * 1.31 + 0.6);
    return Math.max(0.12, v);
}

function sizeMixCanvas(p) {
    var rect = p.canvas.getBoundingClientRect();
    if (!rect.width) { return; }

    var dpr = window.devicePixelRatio || 1;
    p.w = rect.width;
    p.h = rect.height;
    p.canvas.width = Math.round(rect.width * dpr);
    p.canvas.height = Math.round(rect.height * dpr);
    p.ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Fewer, chunkier bars on narrow screens so they stay readable.
    p.bars = Math.max(20, Math.min(BAR_MAX, Math.round(p.w / 11)));
    p.grad = null;
    drawMix(p);
}

function barGradient(p) {
    if (!p.grad) {
        var g = p.ctx2d.createLinearGradient(0, 0, p.w, 0);
        g.addColorStop(0, '#ff2e97');
        g.addColorStop(0.45, '#ff69b4');
        g.addColorStop(0.75, '#7c4dff');
        g.addColorStop(1, '#00e5ff');
        p.grad = g;
    }
    return p.grad;
}

function drawMix(p) {
    if (!p.w || !p.bars) { return; }

    var x = p.ctx2d;
    var bars = p.bars;
    var live = !p.audio.paused && p.analyser;

    x.clearRect(0, 0, p.w, p.h);
    if (live) { p.analyser.getByteFrequencyData(p.data); }

    var d = p.audio.duration;
    var progress = (d && isFinite(d)) ? p.audio.currentTime / d : 0;

    var gap = 3;
    var bw = (p.w - gap * (bars - 1)) / bars;
    if (bw <= 0) { return; }

    var lit = barGradient(p);
    var radius = Math.min(bw / 2, 2);

    for (var i = 0; i < bars; i++) {
        var lvl;
        if (live) {
            // Spread bars over the spectrum on a curve so bass doesn't swamp
            // the low end, and ignore the top ~30% which is mostly silent.
            var bin = Math.floor(Math.pow(i / bars, 1.55) * p.data.length * 0.7);
            var target = Math.pow(p.data[bin] / 255, 0.85);
            // Fast attack, slow release — reads as punchy rather than jittery.
            lvl = p.level[i] + (target - p.level[i]) * (target > p.level[i] ? 0.6 : 0.14);
        } else {
            // Idle draws are one-shot, so settle straight to the target
            // instead of easing — otherwise the bars render part-grown.
            lvl = idleLevel(i);
        }
        p.level[i] = lvl;

        var bh = Math.max(2, lvl * p.h * 0.92);
        var bx = i * (bw + gap);
        var by = (p.h - bh) / 2;

        x.fillStyle = ((i + 0.5) / bars <= progress) ? lit : 'rgba(255,255,255,0.13)';
        x.beginPath();
        if (x.roundRect) {
            x.roundRect(bx, by, bw, bh, radius);
        } else {
            x.rect(bx, by, bw, bh);
        }
        x.fill();
    }
}

function vizLoop() {
    var active = false;
    mixPlayers.forEach(function (p) {
        if (!p.audio.paused) {
            drawMix(p);
            active = true;
        }
    });
    vizFrame = active ? requestAnimationFrame(vizLoop) : null;
}

function startViz() {
    if (vizFrame === null) { vizFrame = requestAnimationFrame(vizLoop); }
}

/* Built lazily on first play: creating an AudioContext before a user gesture
   leaves it suspended, and createMediaElementSource may only run once per element. */
function ensureGraph(p) {
    if (p.analyser || !AudioCtx) { return; }
    try {
        if (!sharedCtx) { sharedCtx = new AudioCtx(); }
        var source = sharedCtx.createMediaElementSource(p.audio);
        var analyser = sharedCtx.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.7;
        source.connect(analyser);
        analyser.connect(sharedCtx.destination);
        p.analyser = analyser;
        p.data = new Uint8Array(analyser.frequencyBinCount);
    } catch (e) {
        // The visualiser is optional — playback still works without it.
        p.analyser = null;
    }
}

function setupMix(card) {
    var audio = card.querySelector('audio');
    var canvas = card.querySelector('.mix-viz');
    var btn = card.querySelector('.mix-play');
    var title = card.querySelector('.mix-head h3');
    if (!audio || !canvas || !btn || !canvas.getContext) { return null; }

    var ctx2d = canvas.getContext('2d');
    if (!ctx2d) { return null; }

    var p = {
        card: card,
        audio: audio,
        canvas: canvas,
        ctx2d: ctx2d,
        cur: card.querySelector('.mix-cur'),
        dur: card.querySelector('.mix-dur'),
        title: title ? title.textContent.trim() : 'mix',
        level: new Float32Array(BAR_MAX),
        analyser: null,
        data: null,
        grad: null,
        bars: 0,
        w: 0,
        h: 0
    };

    btn.addEventListener('click', function () {
        if (audio.paused) {
            ensureGraph(p);
            if (sharedCtx && sharedCtx.state === 'suspended') { sharedCtx.resume(); }
            var playing = audio.play();
            if (playing && playing.catch) { playing.catch(function () {}); }
        } else {
            audio.pause();
        }
    });

    audio.addEventListener('play', function () {
        card.classList.add('playing');
        btn.setAttribute('aria-label', 'Pause ' + p.title);
        document.querySelector('.audio-section').classList.add('mixes-live');
        startViz();
    });

    function onStop() {
        card.classList.remove('playing');
        btn.setAttribute('aria-label', 'Play ' + p.title);
        if (!document.querySelector('.mix-card.playing')) {
            document.querySelector('.audio-section').classList.remove('mixes-live');
        }
        drawMix(p);
    }
    audio.addEventListener('pause', onStop);
    audio.addEventListener('ended', onStop);

    audio.addEventListener('loadedmetadata', function () {
        p.dur.textContent = fmtTime(audio.duration);
    });

    audio.addEventListener('timeupdate', function () {
        p.cur.textContent = fmtTime(audio.currentTime);
        if (audio.paused) { drawMix(p); }
    });

    // The waveform is the scrub bar — click or drag anywhere along it to seek.
    var scrubbing = false;
    function scrub(e) {
        if (!audio.duration || !isFinite(audio.duration)) { return; }
        var rect = canvas.getBoundingClientRect();
        var frac = (e.clientX - rect.left) / rect.width;
        audio.currentTime = Math.min(1, Math.max(0, frac)) * audio.duration;
        drawMix(p);
    }
    canvas.addEventListener('pointerdown', function (e) {
        scrubbing = true;
        if (canvas.setPointerCapture) { canvas.setPointerCapture(e.pointerId); }
        scrub(e);
    });
    canvas.addEventListener('pointermove', function (e) {
        if (scrubbing) { scrub(e); }
    });
    canvas.addEventListener('pointerup', function () { scrubbing = false; });
    canvas.addEventListener('pointercancel', function () { scrubbing = false; });

    return p;
}

(function initMixPlayers() {
    var section = document.querySelector('.audio-section');
    if (!section) { return; }

    document.querySelectorAll('.mix-card').forEach(function (card) {
        var p = setupMix(card);
        if (p) { mixPlayers.push(p); }
    });
    if (!mixPlayers.length) { return; }

    // Reveal the custom UI first: the canvas needs layout before it can be sized.
    mixPlayers.forEach(function (p) { p.audio.removeAttribute('controls'); });
    section.classList.add('player-ready');

    mixPlayers.forEach(function (p) {
        sizeMixCanvas(p);
        if (p.audio.readyState >= 1) { p.dur.textContent = fmtTime(p.audio.duration); }
    });

    window.addEventListener('resize', function () {
        mixPlayers.forEach(sizeMixCanvas);
    });
})();
