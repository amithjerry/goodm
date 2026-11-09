(() => {
  const contactForm = document.querySelector("#contact-form");
  const status = document.querySelector("#contact-status");
  const dialog = document.querySelector("#admin-dialog");
  if (!contactForm || !status || !dialog) return;

  const inquiryList = document.querySelector("#admin-inquiries");
  const projectList = document.querySelector("#admin-project-list");
  const projectForm = document.querySelector("#admin-project-form");
  const adminContent = document.querySelector("#admin-content");
  const logoutButton = document.querySelector("#admin-logout");
  const adminStatus = document.querySelector("#admin-status");
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

  async function apiRequest(path, options = {}) {
    const response = await fetch(path, {
      ...options,
      credentials: "same-origin",
      headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...options.headers }
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || `Request failed (${response.status}).`);
    return result;
  }

  function makeButton(text, className, action) {
    const button = document.createElement("button");
    button.className = className;
    button.type = "button";
    button.textContent = text;
    button.addEventListener("click", action);
    return button;
  }

  async function loadInquiries() {
    inquiryList.replaceChildren();
    const { enquiries: records } = await apiRequest("/api/admin/enquiries");
    if (!records.length) {
      const empty = document.createElement("p");
      empty.className = "admin-empty";
      empty.textContent = "No enquiries have been received yet.";
      inquiryList.append(empty);
      return;
    }

    records.forEach((record) => {
      const article = document.createElement("article");
      article.className = "admin-inquiry";
      const heading = document.createElement("div");
      heading.className = "admin-inquiry-heading";
      const name = document.createElement("h4");
      name.textContent = record.name;
      const date = document.createElement("time");
      date.dateTime = record.createdAt;
      date.textContent = new Date(record.createdAt).toLocaleString();
      heading.append(name, date);
      const email = document.createElement("a");
      email.href = `mailto:${encodeURIComponent(record.email)}?subject=${encodeURIComponent(`Website enquiry from ${record.name}`)}`;
      email.textContent = record.email;
      const message = document.createElement("p");
      message.textContent = record.message;
      const remove = makeButton("Delete enquiry", "admin-button admin-button-quiet", async () => {
        if (!window.confirm("Permanently delete this enquiry from the server?")) return;
        try {
          await apiRequest(`/api/admin/enquiries/${encodeURIComponent(record.id)}`, { method: "DELETE" });
          await loadInquiries();
          adminStatus.textContent = "Enquiry permanently deleted.";
        } catch (error) {
          adminStatus.textContent = `Unable to delete enquiry: ${error.message}`;
        }
      });
      article.append(heading, email, message, remove);
      inquiryList.append(article);
    });
  }

  function loadProjects() {
    projectList.replaceChildren();
    window.PORTFOLIO_PROJECTS.get().forEach((project) => {
      const row = document.createElement("article");
      row.className = "admin-project-row";
      const details = document.createElement("div");
      const title = document.createElement("h4");
      title.textContent = project.title;
      const description = document.createElement("p");
      description.textContent = `${categoryNames[project.category]} · ${project.summary}`;
      details.append(title, description);
      const actions = document.createElement("div");
      actions.className = "admin-row-actions";
      actions.append(
        makeButton("Edit", "admin-button admin-button-quiet", () => editProject(project)),
        makeButton("Delete", "admin-button admin-button-danger", () => {
          if (!window.confirm(`Remove "${project.title}" from this browser's Selected work?`)) return;
          try {
            window.PORTFOLIO_PROJECTS.save(window.PORTFOLIO_PROJECTS.get().filter((item) => item.id !== project.id));
            loadProjects();
            adminStatus.textContent = "Work tile removed from this browser.";
          } catch (error) {
            adminStatus.textContent = `Unable to remove the work tile: ${error.message}`;
          }
        })
      );
      row.append(details, actions);
      projectList.append(row);
    });
  }

  async function openDashboard() {
    dialog.showModal();
    adminContent.hidden = true;
    logoutButton.hidden = true;
    adminStatus.textContent = "Signing in…";
    try {
      await apiRequest("/api/admin/session", {
        method: "POST",
        body: JSON.stringify({ password: "admin" })
      });
      await showDashboard();
    } catch (error) {
      adminStatus.textContent = `Unable to open the admin dashboard: ${error.message}`;
    }
  }

  async function importLegacyInquiries() {
    const storageKey = "amith.portfolio.inquiries";
    const saved = localStorage.getItem(storageKey);
    if (!saved) return 0;
    const records = JSON.parse(saved);
    if (!Array.isArray(records)) throw new Error("Old browser enquiries are not in the expected format.");
    let imported = 0;
    for (const record of records) {
      const result = await apiRequest("/api/admin/enquiries/import", {
        method: "POST",
        body: JSON.stringify(record)
      });
      if (result.imported) imported += 1;
    }
    localStorage.removeItem(storageKey);
    return imported;
  }

  async function showDashboard() {
    adminContent.hidden = false;
    logoutButton.hidden = false;
    const issues = [];
    let imported = 0;
    try {
      imported = await importLegacyInquiries();
    } catch (error) {
      issues.push(`Unable to migrate old browser enquiries: ${error.message}`);
    }
    try {
      await loadInquiries();
    } catch (error) {
      issues.push(`Unable to load server enquiries: ${error.message}`);
    }
    try {
      loadProjects();
    } catch (error) {
      issues.push(`Unable to load work tiles: ${error.message}`);
    }
    adminStatus.textContent = issues.join(" ")
      || (imported
        ? `${imported} existing browser ${imported === 1 ? "enquiry was" : "enquiries were"} moved to server storage.`
        : "Enquiries are stored on the server until you delete them. Work tile edits remain local to this browser.");
  }

  function editProject(project) {
    projectForm.elements.id.value = project.id;
    projectForm.elements.title.value = project.title;
    projectForm.elements.summary.value = project.summary;
    projectForm.elements.category.value = project.category;
    projectForm.elements.pagePath.value = project.pagePath;
    projectForm.elements.visual.value = String(project.visual);
    projectForm.elements.label.value = project.label;
    document.querySelector("#admin-project-form-title").textContent = "Edit work tile";
    projectForm.hidden = false;
    projectForm.scrollIntoView({ behavior: "smooth", block: "nearest" });
    projectForm.elements.title.focus();
  }

  function startNewProject() {
    projectForm.reset();
    projectForm.elements.id.value = "";
    projectForm.elements.visual.value = "1";
    document.querySelector("#admin-project-form-title").textContent = "Add a work tile";
    projectForm.hidden = false;
    projectForm.scrollIntoView({ behavior: "smooth", block: "nearest" });
    projectForm.elements.title.focus();
  }

  contactForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const values = new FormData(contactForm);
    const name = String(values.get("name") || "").trim();
    const email = String(values.get("email") || "").trim();
    const message = String(values.get("message") || "").trim();

    if (name === "admin" && email === "admin" && message === "admin") {
      contactForm.reset();
      status.textContent = "";
      await openDashboard();
      return;
    }
    if (!contactForm.reportValidity()) return;

    status.textContent = "Sending your enquiry…";
    try {
      await apiRequest("/api/enquiries", {
        method: "POST",
        body: JSON.stringify({ name, email, message })
      });
      contactForm.reset();
      status.textContent = "Thanks—your enquiry has been saved. I'll be in touch.";
    } catch (error) {
      status.textContent = `Unable to send your enquiry: ${error.message}`;
    }
  });

  document.querySelector("#admin-close").addEventListener("click", () => dialog.close());
  document.querySelector("#admin-logout").addEventListener("click", async () => {
    try {
      await apiRequest("/api/admin/session", { method: "DELETE" });
      dialog.close();
      adminContent.hidden = true;
      logoutButton.hidden = true;
      adminStatus.textContent = "";
    } catch (error) {
      adminStatus.textContent = `Unable to sign out: ${error.message}`;
    }
  });
  document.querySelector("#admin-refresh").addEventListener("click", async () => {
    try {
      await loadInquiries();
      loadProjects();
      adminStatus.textContent = "Enquiries refreshed from the server.";
    } catch (error) {
      adminStatus.textContent = `Unable to refresh browser data: ${error.message}`;
    }
  });
  document.querySelector("#admin-add-project").addEventListener("click", startNewProject);
  document.querySelector("#admin-cancel-project").addEventListener("click", () => {
    projectForm.hidden = true;
    projectForm.reset();
  });

  projectForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!projectForm.reportValidity()) return;
    const values = new FormData(projectForm);
    const existingId = String(values.get("id") || "");
    const title = String(values.get("title") || "").trim();
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "project";
    const project = {
      id: existingId || `${slug}-${crypto.randomUUID().slice(0, 8)}`,
      title,
      summary: String(values.get("summary") || "").trim(),
      category: String(values.get("category") || ""),
      pagePath: String(values.get("pagePath") || "").trim(),
      visual: Number(values.get("visual")),
      label: String(values.get("label") || "").trim()
    };

    if (!Object.hasOwn(categoryNames, project.category) || !Number.isInteger(project.visual) || project.visual < 1 || project.visual > 8) {
      adminStatus.textContent = "Choose a valid website type and tile style.";
      return;
    }
    if (!/^projects\/[a-z0-9]+(-[a-z0-9]+)*\.html$/.test(project.pagePath)) {
      adminStatus.textContent = "Choose a valid case-study page inside the projects folder.";
      return;
    }
    if (!existingId && window.PORTFOLIO_PROJECTS.get().some((item) => item.id === project.id)) {
      project.id = `${slug}-${crypto.randomUUID().slice(0, 8)}`;
    }

    try {
      const projects = window.PORTFOLIO_PROJECTS.get();
      const updated = existingId
        ? projects.map((item) => item.id === existingId ? project : item)
        : [...projects, project];
      window.PORTFOLIO_PROJECTS.save(updated);
      projectForm.hidden = true;
      projectForm.reset();
      loadProjects();
      adminStatus.textContent = existingId
        ? "Work tile updated in this browser."
        : "Work tile added in this browser.";
    } catch (error) {
      adminStatus.textContent = `Unable to save the work tile in this browser: ${error.message}`;
    }
  });
})();
