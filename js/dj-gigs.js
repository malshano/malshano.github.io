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
    sizeCrowdCanvas(p);
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


/* ================= CROWD =================
   Tiny silhouettes that come out and dance around the card while a mix plays.

   They live on their own canvas stretched over the whole card, sitting behind
   the content and marked pointer-events:none, so the waveform underneath stays
   fully clickable for scrubbing. Their world is worked out from the real
   layout: every element that carries information (index, transport, title,
   tag, waveform, timestamps) becomes a keep-out block, and the crowd is only
   allowed in the gaps left over — the space right of the tag, the run between
   the two timestamps, the padding margins. Because the canvas is exactly the
   card and the card clips its overflow, nobody can wander outside it. */

var DANCER_H = 13;        // base silhouette height in CSS px
// Clearance a dancer needs above their feet. Has to cover a raised arm, which
// reaches about 1.1x their height — a tighter value lets the arms get cropped
// against whatever is above them on a big beat.
var HEADROOM = 20;
var ZONE_PAD = 3;         // breathing room kept around real content
var ZONE_MIN_W = 30;      // narrower than this and there is no room to move
var DANCER_MIN = 5;
var DANCER_MAX = 13;
var REDUCED_MOTION = !!(window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches);

/* Each dancer picks one of these and mostly sticks with it, which is what
   breaks up the unison — a card has ravers with their arms up next to someone
   barely nodding. Values are multipliers on the shared bass envelope. */
var DANCE_STYLES = [
    { bounce: 1.00, lean: 0.55, armBase: 0.75, armSwing: 0.55, knee: 1.00 }, // bounce
    { bounce: 0.45, lean: 1.55, armBase: 1.05, armSwing: 0.75, knee: 0.60 }, // sway
    { bounce: 1.30, lean: 0.40, armBase: 2.05, armSwing: 0.40, knee: 1.10 }, // arms up
    { bounce: 0.70, lean: 0.90, armBase: 0.60, armSwing: 1.05, knee: 1.45 }, // step-touch
    { bounce: 0.35, lean: 0.35, armBase: 0.45, armSwing: 0.30, knee: 0.40 }  // low-key nod
];

function rand(a, b) { return a + Math.random() * (b - a); }

/* Work out where the crowd is allowed to be, from the live layout rather than
   from hardcoded coordinates — so it stays correct when the title is long, the
   card reflows, or the breakpoint hides the index. Each element that carries
   information blocks off the box it occupies; what survives is a set of ledges
   the dancers can stand and walk on. Measuring the h3/tag/timestamps directly
   instead of their flex containers is what exposes the usable gaps, since the
   containers span the full width even when their text does not. */
var ZONE_BLOCKERS = ['.mix-index', '.mix-play', '.mix-viz',
                     '.mix-head h3', '.mix-tag', '.mix-cur', '.mix-dur'];

function computeZones(p) {
    var card = p.card;
    var cr = card.getBoundingClientRect();
    var w = cr.width;
    var h = cr.height;
    var blocks = [];

    ZONE_BLOCKERS.forEach(function (sel) {
        var el = card.querySelector(sel);
        if (!el) { return; }
        var r = el.getBoundingClientRect();
        if (!r.width || !r.height) { return; }
        blocks.push({
            x0: r.left - cr.left - ZONE_PAD,
            x1: r.right - cr.left + ZONE_PAD,
            y0: r.top - cr.top - ZONE_PAD,
            y1: r.bottom - cr.top + ZONE_PAD
        });
    });

    // Somewhere to stand: the card floor, plus the top edge of every block —
    // the crowd uses whatever ledges the layout happens to provide.
    var lines = [h - 2];
    blocks.forEach(function (b) { lines.push(b.y0); });

    var zones = [];
    lines.forEach(function (y) {
        // Needs to sit fully inside the card, or the crowd gets decapitated
        // against the top edge.
        if (y - HEADROOM < 2 || y > h - 1) { return; }

        var free = [[2, w - 2]];
        blocks.forEach(function (b) {
            // Only blocks that overlap the band a dancer's body occupies.
            if (b.y0 >= y || b.y1 <= y - HEADROOM) { return; }
            var next = [];
            free.forEach(function (iv) {
                if (b.x1 <= iv[0] || b.x0 >= iv[1]) { next.push(iv); return; }
                if (b.x0 > iv[0]) { next.push([iv[0], b.x0]); }
                if (b.x1 < iv[1]) { next.push([b.x1, iv[1]]); }
            });
            free = next;
        });

        free.forEach(function (iv) {
            if (iv[1] - iv[0] >= ZONE_MIN_W) {
                zones.push({ y: y, x0: iv[0], x1: iv[1] });
            }
        });
    });

    p.zones = zones;
}

/* Drop a dancer somewhere legal, favouring the roomier ledges so the crowd
   spreads out instead of piling into the first narrow gap. */
function placeDancer(p, d) {
    var zones = p.zones;
    if (!zones || !zones.length) { d.zone = null; return; }

    var total = 0;
    var i;
    for (i = 0; i < zones.length; i++) { total += zones[i].x1 - zones[i].x0; }

    var pick = Math.random() * total;
    d.zone = zones[zones.length - 1];
    for (i = 0; i < zones.length; i++) {
        pick -= zones[i].x1 - zones[i].x0;
        if (pick <= 0) { d.zone = zones[i]; break; }
    }
    d.x = rand(d.zone.x0, d.zone.x1);
}

function makeDancer(p) {
    var d = {
        x: 0,
        zone: null,
        phase: rand(0, Math.PI * 2),
        bob: rand(0, Math.PI * 2),
        speed: rand(0.62, 1.45),          // own tempo — nobody shares a clock
        half: Math.random() < 0.28,       // a few move at half time
        scale: rand(0.82, 1.15),
        style: Math.floor(Math.random() * DANCE_STYLES.length),
        cool: Math.random() < 0.34,       // cyan rim instead of pink
        delay: rand(0, 1.3),              // staggered arrival
        lift: 0,
        fade: 1,
        want: 1,
        mode: 'dance',
        timer: rand(0.8, 3.5),
        dir: Math.random() < 0.5 ? -1 : 1,
        walk: 0,
        walkPhase: rand(0, Math.PI * 2)
    };
    placeDancer(p, d);
    return d;
}

function buildDancers(p) {
    computeZones(p);

    var room = 0;
    (p.zones || []).forEach(function (z) { room += z.x1 - z.x0; });

    var n = Math.max(DANCER_MIN, Math.min(DANCER_MAX, Math.round(room / 90)));
    if (!p.zones || !p.zones.length) { n = 0; }

    var old = p.dancers || [];
    p.dancers = [];
    for (var i = 0; i < n; i++) {
        if (old[i]) {
            // Keep the person, re-seat them: the ledges just moved.
            placeDancer(p, old[i]);
            p.dancers.push(old[i]);
        } else {
            p.dancers.push(makeDancer(p));
        }
    }
}

/* Wander, mill about, change their minds, wander off to another part of the
   card. Each dancer runs its own countdown and re-decides independently, so
   the crowd never resolves into a pattern. */
function stepDancer(p, d, dt) {
    // Mid-hop: fade out, reappear somewhere else, fade back in.
    d.fade += (d.want - d.fade) * (1 - Math.exp(-7 * dt));
    if (!d.want && d.fade < 0.06) {
        placeDancer(p, d);
        d.dir = Math.random() < 0.5 ? -1 : 1;
        d.want = 1;
    }

    d.timer -= dt;
    if (d.timer <= 0) {
        if (d.mode === 'dance' && Math.random() < 0.5) {
            d.mode = 'walk';
            d.dir = Math.random() < 0.5 ? -1 : 1;
            d.timer = rand(0.5, 1.8);
            // Now and then they leave for a different part of the card.
            if (Math.random() < 0.22 && p.zones && p.zones.length > 1) { d.want = 0; }
        } else {
            d.mode = 'dance';
            // Only sometimes pick up a new move, so they read as people with
            // a habit rather than a reshuffle at every stop.
            if (Math.random() < 0.35) {
                d.style = Math.floor(Math.random() * DANCE_STYLES.length);
            }
            d.timer = rand(1.5, 5);
        }
    }

    var wantWalk = d.mode === 'walk' ? 1 : 0;
    d.walk += (wantWalk - d.walk) * (1 - Math.exp(-5 * dt));
    d.walkPhase += dt * 9 * d.walk;

    if (!d.zone) { return; }
    d.x += 26 * d.dir * d.walk * dt;
    // Turn at the edges of their ledge rather than walking over the content.
    if (d.x < d.zone.x0) { d.x = d.zone.x0; d.dir = 1; }
    if (d.x > d.zone.x1) { d.x = d.zone.x1; d.dir = -1; }
}

/* The crowd's own canvas: the size of the whole card, behind the content and
   click-through, so the waveform under it still takes scrubs normally. */
function makeCrowdCanvas(p) {
    if (REDUCED_MOTION) { return; }
    var c = document.createElement('canvas');
    c.className = 'mix-crowd';
    c.setAttribute('aria-hidden', 'true');
    // Appearance lives in css/dj.css, but these four are set here as well: they
    // are what stop a decorative canvas from becoming a 300x150 flex item and
    // wrecking the card. The css and js files are cached independently and
    // neither URL is fingerprinted, so a visitor can get this script with a
    // stale stylesheet — this keeps that combination merely dull, not broken.
    c.style.position = 'absolute';
    c.style.inset = '0';
    c.style.pointerEvents = 'none';
    c.style.zIndex = '0';
    p.card.insertBefore(c, p.card.firstChild);
    p.crowd = c;
    p.crowdCtx = c.getContext('2d');
}

function sizeCrowdCanvas(p) {
    if (!p.crowdCtx) { return; }

    var rect = p.card.getBoundingClientRect();
    if (!rect.width || !rect.height) { return; }

    var dpr = window.devicePixelRatio || 1;
    p.cw = rect.width;
    p.ch = rect.height;
    p.crowd.width = Math.round(rect.width * dpr);
    p.crowd.height = Math.round(rect.height * dpr);
    p.crowdCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

    buildDancers(p);
}

function dancersBusy(p) {
    if (!p.dancers) { return false; }
    for (var i = 0; i < p.dancers.length; i++) {
        if (p.dancers[i].lift > 0.004) { return true; }
    }
    return false;
}

/* Bass energy, 0..1. The low bins drive the bounce, so the crowd moves on the
   kick rather than on a timer. Bin 0 is DC-ish rumble, hence starting at 2. */
function bassLevel(p) {
    if (!p.analyser || !p.data) { return 0; }
    var n = Math.max(6, Math.floor(p.data.length * 0.09));
    var sum = 0;
    for (var i = 2; i < n; i++) { sum += p.data[i]; }
    return (sum / (n - 2)) / 255;
}

function easeOutBack(t) {
    var c = 1.9;
    var i = t - 1;
    return 1 + (c + 1) * i * i * i + c * i * i;
}

function drawCrowd(p) {
    if (REDUCED_MOTION || !p.crowdCtx) { return; }

    var now = (window.performance && performance.now) ? performance.now() : Date.now();
    // Clamped so a backgrounded tab resuming doesn't teleport the animation.
    var dt = p.lastT ? Math.min(0.05, (now - p.lastT) / 1000) : 0.016;
    p.lastT = now;

    var x2d = p.crowdCtx;
    x2d.clearRect(0, 0, p.cw, p.ch);
    if (!p.dancers || !p.dancers.length) { return; }

    var playing = !p.audio.paused;
    p.elapsed = playing ? p.elapsed + dt : 0;

    // Fast attack, slow release, same feel as the bars they dance to.
    var target = playing && p.analyser ? bassLevel(p) : 0;
    p.beat += (target - p.beat) * (target > p.beat ? 0.5 : 0.09);

    var t = now / 1000;

    var presence = 0;
    for (var i = 0; i < p.dancers.length; i++) {
        var dd = p.dancers[i];
        var wantUp = (playing && p.elapsed > dd.delay) ? 1 : 0;
        dd.lift += (wantUp - dd.lift) * (1 - Math.exp(-9 * dt));
        if (playing) { stepDancer(p, dd, dt); }
        if (dd.lift > presence) { presence = dd.lift; }
    }
    if (presence < 0.004) { return; }

    x2d.save();
    x2d.lineCap = 'round';
    x2d.lineJoin = 'round';

    for (var j = 0; j < p.dancers.length; j++) {
        var d = p.dancers[j];
        if (d.lift < 0.004 || !d.zone) { continue; }

        var st = DANCE_STYLES[d.style];
        var scale = d.scale;
        var h = DANCER_H * scale;
        var cx = d.x;
        // They rise out of their ledge; the clip below hides the part still
        // "under" it, so they climb into view instead of sliding on.
        var fy = d.zone.y + (1 - easeOutBack(Math.min(1, d.lift))) * (h + 8);

        var tempo = d.speed * (d.half ? 3.25 : 6.5);
        var dance = Math.sin(t * tempo + d.phase);
        var stride = Math.sin(d.walkPhase);
        // Blend the in-place move into the walk cycle as they set off.
        var swing = dance * (1 - d.walk) + stride * d.walk;

        var beat = p.beat * (1 - d.walk * 0.6);   // walkers bob less
        var bounce = beat * 3.6 * scale * st.bounce;
        var raise = Math.min(1, beat * 1.6) * (1 - d.walk);

        var hipY = fy - h * 0.42 - bounce;
        var shoY = fy - h * 0.72 - bounce;
        var headR = h * 0.13;
        var headY = fy - h * 0.88 - bounce - Math.sin(t * tempo * 2 + d.bob) * 0.5 * scale;
        var lean = swing * 1.6 * scale * st.lean;

        // Feet plant and lift alternately; walking widens the stride.
        var legOut = h * (0.17 + 0.1 * d.walk);
        var kneeLift = 2.6 * scale * st.knee;
        var lFootY = fy - Math.max(0, swing) * kneeLift;
        var rFootY = fy - Math.max(0, -swing) * kneeLift;

        // Arm angles from straight-down; a big kick throws them up. Walkers
        // swing their arms opposite their legs instead.
        var armLen = h * 0.36;
        var armBase = st.armBase * (1 - d.walk) + 0.35 * d.walk;
        var armSw = st.armSwing * (1 - d.walk) + 0.5 * d.walk;
        var lA = armBase + raise * 1.5 + swing * armSw;
        var rA = armBase + raise * 1.5 - swing * armSw;

        var path = new Path2D();
        path.moveTo(cx + lean, shoY);
        path.lineTo(cx, hipY);                                  // torso
        path.moveTo(cx, hipY);
        path.lineTo(cx - legOut, lFootY);                       // left leg
        path.moveTo(cx, hipY);
        path.lineTo(cx + legOut, rFootY);                       // right leg
        path.moveTo(cx + lean, shoY);
        path.lineTo(cx + lean - Math.sin(lA) * armLen,
                    shoY + Math.cos(lA) * armLen);              // left arm
        path.moveTo(cx + lean, shoY);
        path.lineTo(cx + lean + Math.sin(rA) * armLen,
                    shoY + Math.cos(rA) * armLen);              // right arm

        var head = new Path2D();
        head.arc(cx + lean * 1.3, headY, headR, 0, Math.PI * 2);

        var alpha = Math.min(1, d.lift) * d.fade * 0.82;

        // Confine this dancer to their own ledge, which both hides the tail of
        // the entrance and stops a big arm throw reaching into the content.
        x2d.save();
        x2d.beginPath();
        x2d.rect(d.zone.x0 - 1, d.zone.y - HEADROOM,
                 d.zone.x1 - d.zone.x0 + 2, HEADROOM);
        x2d.clip();

        // A scuff of shadow under the feet so they stand on something.
        x2d.globalAlpha = alpha * 0.4;
        x2d.fillStyle = 'rgba(0,0,0,0.7)';
        x2d.beginPath();
        x2d.ellipse(cx, fy + 0.5, h * 0.22, h * 0.05, 0, 0, Math.PI * 2);
        x2d.fill();

        // Two passes: a dark silhouette wide enough to carve the figure out of
        // the card gradient, then the neon rim on top.
        x2d.globalAlpha = alpha;
        x2d.strokeStyle = 'rgba(9,9,14,0.9)';
        x2d.fillStyle = 'rgba(9,9,14,0.9)';
        x2d.lineWidth = 3.4 * scale;
        x2d.stroke(path);
        x2d.stroke(head);
        x2d.fill(head);

        x2d.strokeStyle = d.cool ? '#48e8ff' : '#ff5fb0';
        x2d.lineWidth = 1.5 * scale;
        x2d.stroke(path);
        x2d.stroke(head);

        x2d.restore();
    }

    x2d.restore();
}

function vizLoop() {
    var active = false;
    mixPlayers.forEach(function (p) {
        // Keep painting for a moment after a pause so the crowd can duck back
        // down, rather than freezing mid-step until the next play.
        if (!p.audio.paused || dancersBusy(p)) {
            drawMix(p);       // refreshes p.data, which the crowd reads for the beat
            drawCrowd(p);
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
        h: 0,
        crowd: null,
        crowdCtx: null,
        cw: 0,
        ch: 0,
        zones: null,
        dancers: null,
        beat: 0,
        elapsed: 0,
        lastT: 0
    };

    makeCrowdCanvas(p);

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
