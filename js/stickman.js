(function () {
    /* ── ARM ANIMATION ──────────────────────────────────────────────────────
     * CSS transform-box on nested SVG <g> groups is unreliable, so we drive
     * arm rotation directly via the SVG `transform` attribute, which always
     * rotates around the local origin (0,0) = the shoulder / elbow joint.
     *
     * Arms counter-swing with the opposite leg:
     *   left arm forward  ↔  right leg forward  (and vice-versa)
     * Elbow bends more when upper arm is forward, less when back.
     */
    var armRafId  = null;
    var armT0     = null;
    var ARM_CYCLE = 520; // ms — matches full leg cycle (2 × 0.26 s half-period)

    /*
     * CSS inline style overrides everything (SVG attr, stylesheet rules).
     * transform-box: view-box lets us pin transform-origin to exact SVG viewport
     * coordinates, so the rotation is always around the shoulder joint (20, 16)
     * regardless of bounding-box size or nested transforms.
     * Whole sm-luarm / sm-ruarm groups (arm + forearm as one unit) swing ±28°.
     * Arms counter-swing with the opposite leg for natural running stride.
     */
    function startArmAnim() {
        var ls = document.getElementById('sm-lshoulder');
        var rs = document.getElementById('sm-rshoulder');
        if (!ls) return;

        armT0 = null;
        function tick(ts) {
            if (!armT0) armT0 = ts;
            var s = Math.sin((ts - armT0) / ARM_CYCLE * Math.PI * 2);
            var la =  (s * 28).toFixed(1);
            var ra = (-s * 28).toFixed(1);
            /* translate(20,16) keeps the shoulder pinned at its correct position;
               rotate(a) then spins the whole arm around that local origin. */
            ls.setAttribute('transform', 'translate(20,16) rotate(' + la + ')');
            rs.setAttribute('transform', 'translate(20,16) rotate(' + ra + ')');
            armRafId = requestAnimationFrame(tick);
        }
        armRafId = requestAnimationFrame(tick);
    }

    function stopArmAnim() {
        if (armRafId) { cancelAnimationFrame(armRafId); armRafId = null; }
        armT0 = null;
        var ls = document.getElementById('sm-lshoulder');
        var rs = document.getElementById('sm-rshoulder');
        if (ls) ls.setAttribute('transform', 'translate(20,16)');
        if (rs) rs.setAttribute('transform', 'translate(20,16)');
    }

    function runSequence() {
        var fallingA  = document.getElementById('falling-a');
        var wrap      = document.getElementById('stickman-wrap');
        var subtitle  = document.querySelector('.header-subtitle');
        if (!fallingA || !wrap || !subtitle) return;

        var aRect        = fallingA.getBoundingClientRect();
        var subRect      = subtitle.getBoundingClientRect();
        var headerRect   = document.querySelector('header').getBoundingClientRect();

        /*
         * "a" falls STRAIGHT DOWN (no X drift) to rest on top of the subtitle border.
         * With transform-origin: 0 0, translate(0, fallY) moves the element
         * centre purely in Y.  The rotated letter's bottom edge sits at roughly
         * (top-left Y + letter-height * 1.3) so we subtract that to land on the border.
         */
        var fallY = Math.round(subRect.top - aRect.top - aRect.height);
        fallingA.style.setProperty('--fall-y', fallY + 'px');

        /*
         * Stickman runs just above the subtitle — feet 3 px above its top border.
         * Horizontally centred on the falling "a" (which drops straight down).
         */
        var smW   = 40;
        var smH   = 53;
        var smLeft = Math.round(aRect.left - headerRect.left + aRect.width / 2 - smW / 2);
        var smTop  = Math.round(subRect.top - headerRect.top - smH - 3);

        wrap.style.left = smLeft + 'px';
        wrap.style.top  = smTop  + 'px';

        var offscreen = Math.round(window.innerWidth - (aRect.left + aRect.width / 2) + 80);
        wrap.style.setProperty('--sm-offscreen', offscreen + 'px');

        // ── Change RUN_IN_DELAY to control when the stickman starts running ──
        var RUN_IN_DELAY = 920;   // ms after the letter starts falling
        var RUN_DURATION = 900;   // must match the CSS sm-run-in duration (0.9s)

        // All subsequent steps are relative to RUN_IN_DELAY — change one number, everything follows.
        var arrive    = RUN_IN_DELAY + RUN_DURATION;
        var bendStart = arrive + 50;
        var standStart = bendStart + 400;
        var fixStart  = standStart + 450;
        var runOut    = fixStart + 3000;
        var cleanup   = runOut + 800;

        // 1 — letter swings then falls (1.3 s total)
        fallingA.className = 'letter-fallen';

        // 2 — stickman runs in; start arm swing
        setTimeout(function () {
            wrap.className = 'running-in';
            startArmAnim();
        }, RUN_IN_DELAY);

        // 3 — bend down to pick up; stop arm swing
        setTimeout(function () {
            stopArmAnim();
            wrap.className = 'bending-down';
        }, bendStart);

        // 4 — straighten up; letter rises back simultaneously
        setTimeout(function () {
            fallingA.style.transform       = 'translate(0px, ' + fallY + 'px) rotate(27deg)';
            fallingA.style.transformOrigin = '0 0';
            fallingA.className = '';
            fallingA.getBoundingClientRect();
            fallingA.className = 'letter-risen';
            wrap.className = 'standing-up';
        }, standStart);

        // 5 — 3-second fix with wrench
        setTimeout(function () {
            wrap.className = 'fixing';
        }, fixStart);

        // 6 — done fixing, run back off to the right; restart arm swing
        setTimeout(function () {
            wrap.className = 'running-out';
            startArmAnim();
        }, runOut);

        // 7 — reset for next loop
        setTimeout(function () {
            stopArmAnim();
            wrap.className = '';
            fallingA.className = '';
            fallingA.style.transform       = '';
            fallingA.style.transformOrigin = '';
            fallingA.style.removeProperty('--fall-y');
        }, cleanup);
    }

    // First run 3 s after load, then every 25 s
    setTimeout(function () {
        runSequence();
        setInterval(runSequence, 25000);
    }, 3000);
})();
