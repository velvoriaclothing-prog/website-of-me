(function initHeaderScroll() {
  const header = document.querySelector(".topbar");
  if (!header) return;

  const root = document.body;
  const scrollThreshold = 24;
  const deltaThreshold = 8;
  let lastScrollY = window.scrollY || window.pageYOffset || 0;
  let ticking = false;

  root.classList.add("header-scroll-enabled");

  function setHidden(hidden) {
    header.classList.toggle("hidden-header", hidden);
  }

  function updateHeader() {
    const currentScrollY = window.scrollY || window.pageYOffset || 0;
    const delta = currentScrollY - lastScrollY;

    if (currentScrollY <= scrollThreshold) {
      setHidden(false);
      lastScrollY = currentScrollY;
      ticking = false;
      return;
    }

    if (Math.abs(delta) < deltaThreshold) {
      ticking = false;
      return;
    }

    if (delta > 0 && currentScrollY > header.offsetHeight + scrollThreshold) {
      setHidden(true);
    } else if (delta < 0) {
      setHidden(false);
    }

    lastScrollY = currentScrollY;
    ticking = false;
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(updateHeader);
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("touchmove", onScroll, { passive: true });
  window.addEventListener("resize", () => {
    if ((window.scrollY || window.pageYOffset || 0) <= scrollThreshold) {
      setHidden(false);
    }
  });
})();
