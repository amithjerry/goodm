(() => {
  const grid = document.querySelector(".work-grid");
  if (!grid) return;

  const storageKey = "amith.portfolio.projects";
  const visualNames = ["one", "two", "three", "four", "five", "six", "seven", "eight"];
  const categoryNames = {
    ecommerce: "E-commerce",
    creative: "Creative portfolio",
    saas: "SaaS dashboard",
    interiors: "Interior design",
    restaurant: "Restaurant",
    booking: "Travel booking",
    business: "Business website",
    blog: "Editorial blog"
  };
  const cards = new Map(
    [...grid.querySelectorAll(".project-card[data-project-id]")]
      .map((card) => {
        const defaultVisual = visualNames.findIndex((name) => card.querySelector(`.project-visual.visual-${name}`) !== null) + 1;
        if (defaultVisual) card.dataset.defaultVisual = String(defaultVisual);
        return [card.dataset.projectId, card];
      })
  );
  const defaultProjects = [...cards.values()].map((card) => ({
    id: card.dataset.projectId,
    title: card.querySelector(".project-meta h3").textContent.trim(),
    summary: card.querySelector(".project-meta p").textContent.trim(),
    category: card.dataset.category,
    pagePath: card.getAttribute("href"),
    label: card.querySelector(".project-label").textContent.trim(),
    visual: Number(card.dataset.defaultVisual)
  }));

  function createCard(project) {
    const card = document.createElement("a");
    card.className = "project-card is-visible";
    card.dataset.reveal = "";

    const visual = document.createElement("div");
    visual.className = "project-visual";
    visual.setAttribute("role", "img");
    const label = document.createElement("span");
    label.className = "project-label";
    const artTitle = document.createElement("span");
    artTitle.className = "project-custom-title";
    const artType = document.createElement("span");
    artType.className = "project-custom-type";
    visual.append(label, artTitle, artType);

    const meta = document.createElement("div");
    meta.className = "project-meta";
    const text = document.createElement("div");
    const title = document.createElement("h3");
    const summary = document.createElement("p");
    text.append(title, summary);
    const number = document.createElement("span");
    number.className = "project-number";
    meta.append(text, number);
    card.append(visual, meta);
    grid.append(card);
    return card;
  }

  function render(projects) {
    const orderedCards = [];

    projects.forEach((project, index) => {
      const card = cards.get(project.id) || createCard(project);
      cards.set(project.id, card);
      card.href = project.pagePath;
      card.dataset.category = project.category;
      card.setAttribute("aria-label", `View the ${project.title} ${categoryNames[project.category]} concept`);

      const visual = card.querySelector(".project-visual");
      const visualName = visualNames[project.visual - 1] || visualNames[0];
      if (card.dataset.defaultVisual && Number(card.dataset.defaultVisual) !== project.visual
        && !visual.querySelector(".project-custom-title")) {
        const label = visual.querySelector(".project-label");
        visual.replaceChildren(label);
        const artTitle = document.createElement("span");
        artTitle.className = "project-custom-title";
        const artType = document.createElement("span");
        artType.className = "project-custom-type";
        visual.append(artTitle, artType);
      }
      visual.classList.remove(...visualNames.map((name) => `visual-${name}`));
      visual.classList.add(`visual-${visualName}`);
      visual.setAttribute("aria-label", `${project.title}: ${project.summary}`);

      visual.querySelector(".project-label").textContent = project.label;
      const artTitle = visual.querySelector(".project-custom-title");
      if (artTitle) artTitle.textContent = project.title;
      const artType = visual.querySelector(".project-custom-type");
      if (artType) artType.textContent = categoryNames[project.category];
      card.querySelector(".project-meta h3").textContent = project.title;
      card.querySelector(".project-meta p").textContent = project.summary;
      card.querySelector(".project-number").textContent = `${String(index + 1).padStart(2, "0")} / ${String(projects.length).padStart(2, "0")}`;
      orderedCards.push(card);
    });

    cards.forEach((card, id) => {
      if (!projects.some((project) => project.id === id)) {
        card.remove();
        cards.delete(id);
      }
    });
    orderedCards.forEach((card) => grid.append(card));
  }

  function readProjects() {
    const saved = localStorage.getItem(storageKey);
    if (!saved) return defaultProjects.map((project) => ({ ...project }));
    const projects = JSON.parse(saved);
    if (!Array.isArray(projects)) throw new Error("Saved work tiles must be a list.");
    return projects;
  }

  let projects;
  try {
    projects = readProjects();
    render(projects);
  } catch (error) {
    const status = document.querySelector("#work-status");
    if (status) {
      status.textContent = `Unable to load saved work tiles: ${error.message}`;
      status.hidden = false;
    }
    projects = defaultProjects.map((project) => ({ ...project }));
    render(projects);
  }

  window.PORTFOLIO_PROJECTS = {
    get() {
      return projects.map((project) => ({ ...project }));
    },
    save(nextProjects) {
      localStorage.setItem(storageKey, JSON.stringify(nextProjects));
      projects = nextProjects.map((project) => ({ ...project }));
      render(projects);
      return this.get();
    }
  };
})();
