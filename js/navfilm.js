const nav = document.querySelector("nav");
const filmSection = document.querySelector("#film-scroll");

if(nav && filmSection){

    // Add the animated class initially
    nav.classList.add("animated");

    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if(entry.isIntersecting){
                nav.classList.add("visible");
            } else {
                nav.classList.remove("visible");
            }
        });
    }, { threshold: 0.3 });

    observer.observe(filmSection);
}