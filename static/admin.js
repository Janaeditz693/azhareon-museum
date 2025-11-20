/* admin.js — wrapped to run once after DOM is ready and defensive about missing elements */
(function () {
  if (window.__az_admin_initialized) return;
  window.__az_admin_initialized = true;

  document.addEventListener("DOMContentLoaded", () => {
    try {
      // ----- state -----
      let adminCollections = [];
      let editingId = null;

      // ----- DOM refs (look up AFTER DOMContentLoaded) -----
      const $ = (sel) => document.querySelector(sel);
      const $$ = (sel) => Array.from(document.querySelectorAll(sel));

      // table / form refs
      const collectionsTableBody = document.getElementById("collectionsTableBody");
      const collectionsCountLabel = document.getElementById("collectionsCountLabel");
      const contactsTableBody = document.getElementById("contactsTableBody");
      const contactsCountLabel = document.getElementById("contactsCountLabel");

      const colId = document.getElementById("colId");
      const colCategory = document.getElementById("colCategory");
      const colTitle = document.getElementById("colTitle");
      const colEra = document.getElementById("colEra");
      const colOrigin = document.getElementById("colOrigin");
      const colBadge = document.getElementById("colBadge");
      const colBanner = document.getElementById("colBanner");
      const colTags = document.getElementById("colTags");
      const colDescription = document.getElementById("colDescription");

      const colImageUrl = document.getElementById("colImageUrl");
      const colImageFile = document.getElementById("colImageFile");
      const colImagePreview = document.getElementById("colImagePreview");

      const adminStatus = document.getElementById("adminStatus");
      const btnSaveCollection = document.getElementById("btnSaveCollection");
      const btnNewCollection = document.getElementById("btnNewCollection");
      const btnDeleteCollection = document.getElementById("btnDeleteCollection");

      // View toggle
      const btnAdminCollections = document.getElementById("btnAdminCollections");
      const btnAdminContacts = document.getElementById("btnAdminContacts");
      const adminCollectionsView = document.getElementById("adminCollectionsView");
      const adminContactsView = document.getElementById("adminContactsView");

      // If any critical DOM node is missing, warn and bail for safety (prevents further exceptions)
      if (!collectionsTableBody || !collectionsCountLabel || !adminStatus) {
        console.warn("admin.js: critical DOM nodes missing. Aborting admin init.");
        // still try to fetch in background, but skip some UI wiring
      }

      // ----- Helpers -----
      function setStatus(message, color = "#b5afc8") {
        if (adminStatus) {
          adminStatus.textContent = message;
          adminStatus.style.color = color;
        } else {
          console.log("status:", message);
        }
      }

      function collectionFromForm() {
        const tags = (colTags && colTags.value
          ? colTags.value
          : ""
        )
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean);

        return {
          id: colId ? colId.value.trim() : "",
          title: colTitle ? colTitle.value.trim() : "",
          category: colCategory ? colCategory.value.trim() : "",
          era: colEra ? colEra.value.trim() : "",
          origin: colOrigin ? colOrigin.value.trim() : "",
          description: colDescription ? colDescription.value.trim() : "",
          banner: colBanner ? colBanner.value.trim() : "",
          badge: colBadge ? colBadge.value.trim() : "",
          tags,
          image_url: colImageUrl && colImageUrl.value.trim() ? colImageUrl.value.trim() : null,
        };
      }

      function fillForm(col) {
        if (!col) return;
        if (colId) colId.value = col.id || "";
        if (colCategory) colCategory.value = col.category || "";
        if (colTitle) colTitle.value = col.title || "";
        if (colEra) colEra.value = col.era || "";
        if (colOrigin) colOrigin.value = col.origin || "";
        if (colBadge) colBadge.value = col.badge || "";
        if (colBanner) colBanner.value = col.banner || "";
        if (colTags) colTags.value = (col.tags || []).join(", ");
        if (colDescription) colDescription.value = col.description || "";
        if (colImageUrl) colImageUrl.value = col.image_url || "";

        if (colImagePreview) {
          if (col.image_url) {
            colImagePreview.src = col.image_url;
            colImagePreview.style.display = "block";
          } else {
            colImagePreview.style.display = "none";
          }
        }
      }

      function resetForm() {
        editingId = null;
        if (colId) colId.value = "";
        if (colCategory) colCategory.value = "";
        if (colTitle) colTitle.value = "";
        if (colEra) colEra.value = "";
        if (colOrigin) colOrigin.value = "";
        if (colBadge) colBadge.value = "";
        if (colBanner) colBanner.value = "";
        if (colTags) colTags.value = "";
        if (colDescription) colDescription.value = "";
        if (colImageUrl) colImageUrl.value = "";
        if (colImagePreview) {
          colImagePreview.style.display = "none";
          colImagePreview.src = "";
        }
        if (colImageFile) colImageFile.value = "";
        setStatus("Ready to create new collection.");
      }

      // ----- API calls -----
      async function fetchCollections() {
        try {
          const res = await fetch("/api/admin/collections");
          if (!res.ok) throw new Error("Failed to load collections");
          adminCollections = await res.json();
          renderCollectionsTable();
          setStatus("Collections loaded.");
        } catch (err) {
          console.error("fetchCollections error:", err);
          setStatus("Error loading collections.", "#b46a3c");
        }
      }

      async function fetchContacts() {
        try {
          const res = await fetch("/api/admin/contacts");
          if (!res.ok) throw new Error("Failed to load contacts");
          const contacts = await res.json();
          renderContactsTable(contacts);
          setStatus("Contacts loaded.");
        } catch (err) {
          console.error("fetchContacts error:", err);
          setStatus("Error loading contacts.", "#b46a3c");
        }
      }

      async function saveCollection(e) {
        if (e && typeof e.preventDefault === "function") e.preventDefault();
        const col = collectionFromForm();

        if (!col.id || !col.title) {
          setStatus("ID and Title are required.", "#b46a3c");
          return;
        }

        if (btnSaveCollection) btnSaveCollection.disabled = true;
        setStatus("Saving…");

        try {
          const method = editingId ? "PUT" : "POST";
          const url = editingId
            ? `/api/admin/collections/${encodeURIComponent(editingId)}`
            : "/api/admin/collections";

          const res = await fetch(url, {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(col),
          });

          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.detail || "Save failed");
          }

          await fetchCollections();
          editingId = col.id;
          setStatus("Collection saved.", "#c2a76b");
        } catch (err) {
          console.error("saveCollection error:", err);
          setStatus(err.message || "Error saving collection.", "#b46a3c");
        } finally {
          if (btnSaveCollection) btnSaveCollection.disabled = false;
        }
      }

      async function deleteCollection() {
        if (!editingId) {
          setStatus("Select a collection row first.", "#b46a3c");
          return;
        }
        if (!confirm(`Delete collection "${editingId}"?`)) return;

        if (btnDeleteCollection) btnDeleteCollection.disabled = true;
        setStatus("Deleting…");

        try {
          const res = await fetch(`/api/admin/collections/${encodeURIComponent(editingId)}`, {
            method: "DELETE",
          });
          if (!res.ok) throw new Error("Delete failed");
          await fetchCollections();
          resetForm();
          setStatus("Collection deleted.", "#c2a76b");
        } catch (err) {
          console.error("deleteCollection error:", err);
          setStatus("Error deleting collection.", "#b46a3c");
        } finally {
          if (btnDeleteCollection) btnDeleteCollection.disabled = false;
        }
      }

      // ----- Image upload -----
      async function uploadImageFile(file) {
        if (!file) return;
        setStatus("Uploading image…");

        const formData = new FormData();
        formData.append("file", file);

        try {
          const res = await fetch("/api/admin/upload-image", {
            method: "POST",
            body: formData,
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.detail || "Upload failed");
          }
          const data = await res.json();
          if (colImageUrl) colImageUrl.value = data.url;
          if (colImagePreview) {
            colImagePreview.src = data.url;
            colImagePreview.style.display = "block";
          }
          setStatus("Image uploaded.", "#c2a76b");
        } catch (err) {
          console.error("uploadImageFile error:", err);
          setStatus(err.message || "Error uploading image.", "#b46a3c");
        }
      }

      if (colImageFile) {
        colImageFile.addEventListener("change", () => {
          const file = colImageFile.files && colImageFile.files[0];
          if (file) {
            uploadImageFile(file);
          }
        });
      }

      // ----- Rendering -----
      function renderCollectionsTable() {
        if (!collectionsTableBody) return;
        collectionsTableBody.innerHTML = "";
        adminCollections.forEach((col) => {
          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td>${escapeHtml(col.id)}</td>
            <td>${escapeHtml(col.title)}</td>
            <td>${escapeHtml(col.category)}</td>
            <td>${escapeHtml(col.era)}</td>
          `;
          tr.addEventListener("click", () => {
            editingId = col.id;
            fillForm(col);
            setStatus(`Editing "${col.id}"`);
          });
          collectionsTableBody.appendChild(tr);
        });

        if (collectionsCountLabel) collectionsCountLabel.textContent = `${adminCollections.length} collections`;
      }

      function renderContactsTable(contacts) {
        if (!contactsTableBody || !contacts) return;
        contactsTableBody.innerHTML = "";
        contacts.forEach((c) => {
          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td style="white-space:nowrap;">${escapeHtml(c.timestamp)}</td>
            <td>${escapeHtml(c.name)}</td>
            <td>${escapeHtml(c.email)}</td>
            <td>${escapeHtml(c.message)}</td>
          `;
          contactsTableBody.appendChild(tr);
        });
        if (contactsCountLabel) contactsCountLabel.textContent = `${contacts.length} messages`;
      }

      // small helper to avoid XSS in table cells
      function escapeHtml(str = "") {
        return String(str)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;");
      }

      // ----- View switching -----
      if (btnAdminCollections) {
        btnAdminCollections.addEventListener("click", () => {
          btnAdminCollections.classList.add("active");
          if (btnAdminContacts) btnAdminContacts.classList.remove("active");
          if (adminCollectionsView) adminCollectionsView.classList.remove("hidden-admin");
          if (adminContactsView) adminContactsView.classList.add("hidden-admin");
          setStatus("Collections view.");
        });
      }

      if (btnAdminContacts) {
        btnAdminContacts.addEventListener("click", () => {
          btnAdminContacts.classList.add("active");
          if (btnAdminCollections) btnAdminCollections.classList.remove("active");
          if (adminCollectionsView) adminCollectionsView.classList.add("hidden-admin");
          if (adminContactsView) adminContactsView.classList.remove("hidden-admin");
          fetchContacts();
        });
      }

      // ----- Form buttons -----
      const collectionForm = document.getElementById("collectionForm");
      if (collectionForm) collectionForm.addEventListener("submit", saveCollection);
      if (btnNewCollection) btnNewCollection.addEventListener("click", resetForm);
      if (btnDeleteCollection) btnDeleteCollection.addEventListener("click", deleteCollection);

      // ----- Init -----
      resetForm();
      fetchCollections();
    } catch (e) {
      console.error("admin.js init error:", e);
    }
  });
})();
