(function initMobileNav() {
  const headers = [...document.querySelectorAll(".topbar")];
  if (!headers.length) return;

  document.body.classList.add("mobile-nav-enabled");

  headers.forEach((header) => {
    if (header.querySelector(".mobile-nav-toggle")) return;

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "mobile-nav-toggle";
    toggle.setAttribute("aria-label", "Toggle navigation menu");
    toggle.setAttribute("aria-expanded", "false");
    toggle.innerHTML = "<span></span>";

    const brand = header.querySelector(".brand");
    if (brand?.nextSibling) {
      header.insertBefore(toggle, brand.nextSibling);
    } else {
      header.appendChild(toggle);
    }

    function setOpen(open) {
      header.classList.toggle("nav-open", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    }

    toggle.addEventListener("click", () => {
      setOpen(!header.classList.contains("nav-open"));
    });

    header.addEventListener("click", (event) => {
      if (window.innerWidth > 960) return;
      if (event.target.closest("a") || event.target.closest("button[data-auth-action]")) {
        setOpen(false);
      }
    });

    window.addEventListener("resize", () => {
      if (window.innerWidth > 960) {
        setOpen(false);
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") setOpen(false);
    });
  });
})();
