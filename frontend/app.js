(function () {
  const apiBase = (typeof window !== "undefined" && window.__API_BASE__) || "";

  const form = document.getElementById("user-form");
  const refreshBtn = document.getElementById("refresh");
  const formStatus = document.getElementById("form-status");
  const rowsEl = document.getElementById("rows");
  const listError = document.getElementById("list-error");
  const countEl = document.getElementById("count");

  function apiUrl(path) {
    const base = apiBase.replace(/\/$/, "");
    return `${base}${path}`;
  }

  async function loadUsers() {
    listError.hidden = true;
    listError.textContent = "";
    try {
      const res = await fetch(apiUrl("/api/users"));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      renderRows(Array.isArray(data) ? data : []);
      countEl.textContent = `${data.length} total`;
    } catch (e) {
      listError.hidden = false;
      listError.textContent = "Could not load users. Check API URL and CORS settings.";
      console.error(e);
    }
  }

  function renderRows(users) {
    rowsEl.innerHTML = "";
    if (!users.length) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 4;
      td.className = "empty";
      td.textContent = "No users yet.";
      tr.appendChild(td);
      rowsEl.appendChild(tr);
      countEl.textContent = "0 total";
      return;
    }
    for (const u of users) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(String(u.id))}</td>
        <td>${escapeHtml(String(u.firstName ?? ""))}</td>
        <td>${escapeHtml(String(u.lastName ?? ""))}</td>
        <td>${escapeHtml(formatDate(u.createdAt))}</td>
      `;
      rowsEl.appendChild(tr);
    }
  }

  function escapeHtml(s) {
    return s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatDate(v) {
    if (!v) return "";
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return String(v);
    return d.toLocaleString();
  }

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    formStatus.textContent = "";
    const fd = new FormData(form);
    const firstName = String(fd.get("firstName") || "").trim();
    const lastName = String(fd.get("lastName") || "").trim();
    if (!firstName || !lastName) {
      formStatus.textContent = "Please enter first and last name.";
      return;
    }
    try {
      const res = await fetch(apiUrl("/api/users"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        formStatus.textContent = body.error || `Save failed (${res.status})`;
        return;
      }
      form.reset();
      formStatus.textContent = "Saved.";
      await loadUsers();
    } catch (e) {
      formStatus.textContent = "Network error. Is the API running and CORS configured?";
      console.error(e);
    }
  });

  refreshBtn.addEventListener("click", () => {
    loadUsers();
  });

  if (!apiBase) {
    formStatus.textContent = "Set window.__API_BASE__ in env-config.js (or deploy with CI).";
  }
  loadUsers();
})();
