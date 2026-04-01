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

// When any audio mix starts playing, stop all gig videos
document.querySelectorAll('.audio-section audio').forEach(function (audio) {
    audio.addEventListener('play', stopAllVideos);
});
