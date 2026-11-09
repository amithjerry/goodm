(() => {
  const options = document.querySelectorAll('input[name="storefront-feature"]');
  const summary = document.querySelector("#storefront-selection");
  if (!options.length || !summary) return;

  options.forEach((option) => {
    option.addEventListener("change", () => {
      const selected = [...options]
        .filter((item) => item.checked)
        .map((item) => item.value);

      if (!selected.length) {
        summary.textContent = "Choose a feature to start shaping your shop.";
      } else {
        summary.textContent = `${selected.length} feature${selected.length === 1 ? "" : "s"} selected: ${selected.join(", ")}.`;
      }

      option.closest(".storefront-feature").classList.toggle("is-selected", option.checked);
    });
  });
})();
