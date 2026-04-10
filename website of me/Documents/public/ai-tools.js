async function loadTools() {
  const grid = document.getElementById("toolsGrid");
  const searchInput = document.getElementById("toolSearchInput");
  const filter = document.getElementById("toolFilter");

  try {
    const response = await fetch("/api/ai-tools");
    const tools = await response.json();
    const categories = [...new Set(tools.map((tool) => tool.category))];
    filter.innerHTML += categories.map((category) => `<option value="${category}">${category}</option>`).join("");

    function render() {
      const query = searchInput.value.trim().toLowerCase();
      const selected = filter.value;
      const filtered = tools.filter((tool) => {
        const queryMatch = !query || tool.name.toLowerCase().includes(query) || tool.description.toLowerCase().includes(query);
        const categoryMatch = !selected || tool.category === selected;
        return queryMatch && categoryMatch;
      });

      grid.innerHTML = filtered.map((tool) => `
        <article class="card">
          <span class="chip">${tool.category}</span>
          <h3>${tool.name}</h3>
          <p>${tool.description}</p>
          <a class="btn btn-secondary" href="${tool.url}" target="_blank" rel="noreferrer">Open tool</a>
        </article>
      `).join("");
    }

    searchInput.addEventListener("input", render);
    filter.addEventListener("change", render);
    render();
  } catch {
    grid.innerHTML = `<article class="empty-state">The AI tools directory could not be loaded right now.</article>`;
  }
}

loadTools();
