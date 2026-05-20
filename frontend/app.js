(function () {
  let apiBase =
    typeof window !== "undefined" && window.__API_BASE__ !== undefined && window.__API_BASE__ !== null
      ? String(window.__API_BASE__).trim()
      : "";
  if (!apiBase && typeof location !== "undefined") {
    const h = location.hostname;
    const p = location.port;
    if ((h === "localhost" || h === "127.0.0.1") && p === "8080") {
      apiBase = "http://localhost:7071";
    }
  }

  const form = document.getElementById("user-form");
  const formStatus = document.getElementById("form-status");
  const listEl = document.getElementById("user-list");
  const listError = document.getElementById("list-error");
  const countEl = document.getElementById("count");
  const attendeePanel = document.getElementById("attendee-counts");
  const attendingInputs = form.querySelectorAll('input[name="isAttending"]');

  const modal = document.getElementById("edit-modal");
  const editForm = document.getElementById("edit-form");
  const editFormStatus = document.getElementById("edit-form-status");
  const editAttendeePanel = document.getElementById("edit-attendee-counts");
  const editModalTitle = document.getElementById("edit-modal-title");
  const editAttendingInputs = editForm.querySelectorAll('input[name="isAttending"]');

  let usersCache = [];
  let editingId = null;

  function apiUrl(path) {
    const base = apiBase.replace(/\/$/, "");
    return `${base}${path}`;
  }

  function displayName(u) {
    return String(u.fullName ?? "").trim();
  }

  function isAttendingValue(u) {
    return u.isAttending === true || u.isAttending === 1;
  }

  function totalAttendees(u) {
    return (
      Number(u.attendeesAbove10 ?? u.attendeesAbove16 ?? 0) +
      Number(u.attendeesBetween5And10 ?? u.attendeesAge6To16 ?? 0) +
      Number(u.attendeesBelow5 ?? u.attendeesBelow6 ?? 0)
    );
  }

  function sumAllAttendees(users) {
    return users.reduce((sum, u) => {
      if (!isAttendingValue(u)) return sum;
      return sum + totalAttendees(u);
    }, 0);
  }

  function updateCountBadge(users) {
    countEl.textContent = String(sumAllAttendees(users));
  }

  function updateAttendeePanelFor(formEl, panelEl) {
    const selected = formEl.querySelector('input[name="isAttending"]:checked');
    const show = selected && selected.value === "yes";
    panelEl.hidden = !show;
    panelEl.querySelectorAll("input[type='number']").forEach((el) => {
      el.required = show;
      if (!show) el.value = "";
    });
  }

  function parseCount(fd, name) {
    const raw = fd.get(name);
    const n = raw === "" || raw === null ? 0 : Number(raw);
    if (!Number.isInteger(n) || n < 0) return null;
    return n;
  }

  function buildPayload(fd) {
    const fullName = String(fd.get("fullName") || "").trim();
    const attendingChoice = fd.get("isAttending");

    if (!fullName) return { error: "Please enter your name." };
    if (attendingChoice !== "yes" && attendingChoice !== "no") {
      return { error: "Please select Yes or No for attending." };
    }

    const isAttending = attendingChoice === "yes";
    const payload = { fullName, isAttending };

    if (isAttending) {
      const attendeesAbove10 = parseCount(fd, "attendeesAbove10");
      const attendeesBetween5And10 = parseCount(fd, "attendeesBetween5And10");
      const attendeesBelow5 = parseCount(fd, "attendeesBelow5");
      if (
        attendeesAbove10 === null ||
        attendeesBetween5And10 === null ||
        attendeesBelow5 === null
      ) {
        return { error: "Attendee counts must be whole numbers 0 or greater." };
      }
      const total = attendeesAbove10 + attendeesBetween5And10 + attendeesBelow5;
      if (total < 1) {
        return { error: "Enter at least one attendee in your group." };
      }
      payload.attendeesAbove10 = attendeesAbove10;
      payload.attendeesBetween5And10 = attendeesBetween5And10;
      payload.attendeesBelow5 = attendeesBelow5;
    }

    return { payload };
  }

  function fillForm(formEl, panelEl, u) {
    formEl.fullName.value = displayName(u);
    const attending = isAttendingValue(u);
    formEl.querySelector(`input[name="isAttending"][value="${attending ? "yes" : "no"}"]`).checked = true;
    formEl.attendeesAbove10.value = attending
      ? String(u.attendeesAbove10 ?? u.attendeesAbove16 ?? 0)
      : "";
    formEl.attendeesBetween5And10.value = attending
      ? String(u.attendeesBetween5And10 ?? u.attendeesAge6To16 ?? 0)
      : "";
    formEl.attendeesBelow5.value = attending
      ? String(u.attendeesBelow5 ?? u.attendeesBelow6 ?? 0)
      : "";
    updateAttendeePanelFor(formEl, panelEl);
  }

  attendingInputs.forEach((el) => {
    el.addEventListener("change", () => updateAttendeePanelFor(form, attendeePanel));
  });

  editAttendingInputs.forEach((el) => {
    el.addEventListener("change", () => updateAttendeePanelFor(editForm, editAttendeePanel));
  });

  async function loadUsers() {
    listError.hidden = true;
    listError.textContent = "";
    try {
      const res = await fetch(apiUrl("/api/users"));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      usersCache = Array.isArray(data) ? data : [];
      renderRows(usersCache);
    } catch (e) {
      listError.hidden = false;
      const msg = e && e.message ? e.message : String(e);
      listError.textContent = `Could not load responses (${msg}). Check API URL, CORS, and the API terminal for errors.`;
      console.error(e);
    }
  }

  function initialsFromName(name) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "?";
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }

  function attendanceSummary(u) {
    if (!isAttendingValue(u)) return "Not Attending";
    return `Attending · ${totalAttendees(u)}`;
  }

  function openEditModal(user) {
    editingId = user.id != null ? String(user.id) : null;
    editModalTitle.textContent = displayName(user);
    editFormStatus.textContent = "";
    fillForm(editForm, editAttendeePanel, user);
    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
    editForm.fullName.focus();
  }

  function closeEditModal() {
    editingId = null;
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
    editFormStatus.textContent = "";
  }

  function renderRows(users) {
    listEl.innerHTML = "";
    updateCountBadge(users);
    if (!users.length) {
      const li = document.createElement("li");
      li.className = "user-list-empty";
      li.textContent = "No responses yet. Be the first to submit.";
      listEl.appendChild(li);
      return;
    }
    for (const u of users) {
      const name = displayName(u);
      const li = document.createElement("li");
      const attending = isAttendingValue(u);
      li.className = "user-card";
      li.innerHTML = `
        <button type="button" class="user-card-btn" data-id="${escapeHtml(String(u.id))}">
          <span class="user-avatar" aria-hidden="true">${escapeHtml(initialsFromName(name))}</span>
          <span class="user-card-body">
            <span class="user-card-name">${escapeHtml(name)}</span>
            <span class="user-card-meta">
              <span class="pill ${attending ? "pill-yes" : "pill-no"}">${attending ? "Yes" : "No"}</span>
              · ${escapeHtml(attendanceSummary(u))}
            </span>
          </span>
          <span class="user-card-chevron" aria-hidden="true">›</span>
        </button>
      `;
      listEl.appendChild(li);
    }

    listEl.querySelectorAll(".user-card-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        const user = usersCache.find((x) => String(x.id) === id);
        if (user) openEditModal(user);
      });
    });
  }

  function escapeHtml(s) {
    return s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    formStatus.textContent = "";
    const built = buildPayload(new FormData(form));
    if (built.error) {
      formStatus.textContent = built.error;
      return;
    }
    try {
      const res = await fetch(apiUrl("/api/users"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(built.payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        formStatus.textContent = body.error || `Submit failed (${res.status})`;
        return;
      }
      form.reset();
      updateAttendeePanelFor(form, attendeePanel);
      formStatus.textContent = "Submitted. Thank you!";
      await loadUsers();
    } catch (e) {
      const msg = e && e.message ? e.message : String(e);
      formStatus.textContent = `Request failed (${msg}). Is the API running on ${apiUrl("") || "(same origin)"}?`;
      console.error(e);
    }
  });

  editForm.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    if (!editingId) return;
    editFormStatus.textContent = "";
    const built = buildPayload(new FormData(editForm));
    if (built.error) {
      editFormStatus.textContent = built.error;
      return;
    }
    try {
      const res = await fetch(apiUrl(`/api/users/${editingId}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(built.payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        editFormStatus.textContent = body.error || `Update failed (${res.status})`;
        return;
      }
      closeEditModal();
      await loadUsers();
    } catch (e) {
      const msg = e && e.message ? e.message : String(e);
      editFormStatus.textContent = `Request failed (${msg}).`;
      console.error(e);
    }
  });

  modal.querySelectorAll("[data-modal-close]").forEach((el) => {
    el.addEventListener("click", closeEditModal);
  });

  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape" && !modal.hidden) closeEditModal();
  });

  if (!apiBase) {
    formStatus.textContent = "Set window.__API_BASE__ in env-config.js (or deploy with CI).";
  }
  updateAttendeePanelFor(form, attendeePanel);
  loadUsers();
})();
