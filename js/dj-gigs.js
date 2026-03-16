// Click to remove blur, unmute and play; pause and re-mute all others
function revealCard(card) {
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
    card.onclick = null;
}
