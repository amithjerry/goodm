document.documentElement.classList.add("js");

const menuToggle = document.querySelector(".menu-toggle");
const navLinks = document.querySelector(".nav-links");

function closeMenu() {
  if (!menuToggle || !navLinks) return;
  menuToggle.setAttribute("aria-expanded", "false");
  menuToggle.setAttribute("aria-label", "Open navigation menu");
  navLinks.classList.remove("open");
  document.body.classList.remove("menu-open");
}

if (menuToggle && navLinks) {
  menuToggle.addEventListener("click", () => {
    const isOpen = menuToggle.getAttribute("aria-expanded") === "true";
    menuToggle.setAttribute("aria-expanded", String(!isOpen));
    menuToggle.setAttribute("aria-label", isOpen ? "Open navigation menu" : "Close navigation menu");
    navLinks.classList.toggle("open", !isOpen);
    document.body.classList.toggle("menu-open", !isOpen);
  });

  navLinks.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeMenu));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && menuToggle.getAttribute("aria-expanded") === "true") {
      closeMenu();
      menuToggle.focus();
    }
  });
}

const year = document.querySelector("#year");
if (year) year.textContent = new Date().getFullYear();

const configuredEmail = window.PORTFOLIO_CONFIG?.contactEmail?.trim() || "";
const placeholderEmail = !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(configuredEmail)
  || /yourdomain\.com|example\.com|replace-me/i.test(configuredEmail);
document.querySelectorAll("[data-contact-link]").forEach((link) => {
  if (placeholderEmail) {
    link.removeAttribute("href");
    link.setAttribute("aria-disabled", "true");
    return;
  }
  link.href = `mailto:${configuredEmail}`;
  if (link.classList.contains("contact-email")) {
    const arrow = link.querySelector("span");
    link.textContent = `${configuredEmail} `;
    if (arrow) {
      arrow.setAttribute("aria-hidden", "true");
      link.append(arrow);
    }
  }
});

const revealElements = document.querySelectorAll("[data-reveal]");
if ("IntersectionObserver" in window) {
  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  revealElements.forEach((element) => revealObserver.observe(element));
} else {
  revealElements.forEach((element) => element.classList.add("is-visible"));
}
