// static/script.js
// Defensive, robust front-end loader for collections + modal

(() => {
  "use strict";

  // state
  let collections = [];
  let currentFilter = "all";
  let isLoaded = false;

  // DOM references (queried lazily so script can be loaded anywhere)
  function $(sel) { return document.querySelector(sel); }
  function $all(sel) { return Array.from(document.querySelectorAll(sel)); }

  // DOM elements - find them once when DOM is ready
  let grid, chips, yearSpan;
  let modal, modalClose, modalCategory, modalTitle, modalEra, modalBody, modalTags, modalImage, modalImageWrap;
  let heroExplore, heroAbout, navToggle, drawer;
  let sigSlides, sigDots, tabButtons, tabPanels;
  let contactForm, contactName, contactEmail, contactMessage, contactSubmit, contactStatus;
  let heroMediaEl;

  // placeholder image for missing images
  const PLACEHOLDER = "/static/placeholder.png"; // create or place a placeholder file

  function initDomRefs() {
    grid = document.getElementById("collectionGrid");
    chips = $all(".chip");
    yearSpan = document.getElementById("yearSpan");

    modal = document.getElementById("detailModal");
    modalClose = document.getElementById("modalClose");
    modalCategory = document.getElementById("modalCategory");
    modalTitle = document.getElementById("modalTitle");
    modalEra = document.getElementById("modalEra");
    modalBody = document.getElementById("modalBody");
    modalTags = document.getElementById("modalTags");
    modalImage = document.getElementById("modalImage");
    modalImageWrap = document.getElementById("modalImageWrap");

    heroExplore = document.getElementById("heroExplore");
    heroAbout = document.getElementById("heroAbout");
    navToggle = document.getElementById("navToggle");
    drawer = document.getElementById("drawer");

    sigSlides = $all(".sig-slide");
    sigDots = $all(".dot");
    tabButtons = $all(".tab");
    tabPanels = $all(".tab-panel");

    contactForm = document.getElementById("contactForm");
    contactName = document.getElementById("contactName");
    contactEmail = document.getElementById("contactEmail");
    contactMessage = document.getElementById("contactMessage");
    contactSubmit = document.getElementById("contactSubmit");
    contactStatus = document.getElementById("contactStatus");

    heroMediaEl = document.querySelector(".hero-media");
  }

  // safe addEvent helper
  function safeAdd(el, event, fn) {
    if (!el) return;
    el.addEventListener(event, fn);
  }

  // IntersectionObserver reveal
  function setupReveal() {
    if ("IntersectionObserver" in window) {
      const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("reveal-visible");
            revealObserver.unobserve(entry.target);
          }
        });
      }, { threshold: 0.15 });
      $all(".reveal").forEach((el) => revealObserver.observe(el));
    } else {
      $all(".reveal, .reveal-card").forEach((el) => el.classList.add("reveal-visible"));
    }
  }

  // year
  function setYear() {
    if (yearSpan) yearSpan.textContent = new Date().getFullYear();
  }

  // Fetch collections
  async function loadCollections() {
    if (!grid) return;
    grid.innerHTML = `<p style="color:#b3adbb;font-size:0.9rem;">Loading collections...</p>`;
    try {
      const res = await fetch("/api/collections");
      if (!res.ok) {
        throw new Error(`Failed to load collections: ${res.status}`);
      }
      const data = await res.json();
      collections = Array.isArray(data) ? data : [];
      isLoaded = true;
      renderCollections(currentFilter || "all");
      console.info("Collections loaded:", collections.length);
    } catch (err) {
      console.error("loadCollections error:", err);
      grid.innerHTML = `<p style="color:#b46a3c;font-size:0.9rem;">Unable to load collections. Please try refreshing.</p>`;
    }
  }

  // Render cards
  function renderCollections(filter = "all") {
    if (!grid) return;
    if (!isLoaded) {
      console.warn("renderCollections called before isLoaded");
      return;
    }
    grid.innerHTML = "";

    const filtered = filter === "all" ? collections : collections.filter(i => i.category === filter);
    if (!filtered.length) {
      grid.innerHTML = `<p style="color:#b3adbb;font-size:0.9rem;">No collections in this category yet.</p>`;
      return;
    }

    filtered.forEach((item) => {
      const card = document.createElement("article");
      card.className = "card reveal-card";

      const imageURL = (item.image_url && item.image_url !== "null") ? item.image_url : null;
      const bannerStyle = imageURL
        ? `background-image: url('${imageURL}'); background-size: cover; background-position: center;`
        : `background-image: ${item.banner || 'linear-gradient(135deg,#101010,#2f2f2f)'};`;

      card.innerHTML = `
        <div class="card-banner ${imageURL ? "card-banner-photo" : ""}" style="${bannerStyle}">
          <div class="card-badge">${item.badge || ""}</div>
        </div>
        <div class="card-body">
          <div class="card-title">${escapeHtml(item.title || "")}</div>
          <div class="card-meta">${escapeHtml(item.era || "")} · ${escapeHtml(item.origin || "")}</div>
          <div class="card-tags">${(item.tags || []).map(t => `<span class="card-tag">${escapeHtml(t)}</span>`).join("")}</div>
          <div class="card-footnote">Tap to open collection details</div>
        </div>
      `;

      // attach click handler that closes over `item`
      card.addEventListener("click", () => {
        try {
          openModal(item);
        } catch (e) {
          console.error("openModal error for item", item && item.id, e);
        }
      });

      grid.appendChild(card);
    });
  }

  // simple html escaper
  function escapeHtml(s = "") {
    return String(s).replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }

  // Open/close modal
  function openModal(item) {
    if (!modal) return;
    modalCategory && (modalCategory.textContent = (item.category || "").toUpperCase());
    modalTitle && (modalTitle.textContent = item.title || "");
    modalEra && (modalEra.textContent = `${item.era || ""} · ${item.origin || ""}`);
    modalBody && (modalBody.textContent = item.description || "");
    if (modalTags) modalTags.innerHTML = (item.tags || []).map(t => `<span>${escapeHtml(t)}</span>`).join("");

    if (modalImage) {
      const src = (item.image_url && item.image_url !== "null") ? item.image_url : PLACEHOLDER;
      modalImage.src = src;
      if (modalImageWrap) modalImageWrap.style.display = "block";
    } else {
      if (modalImageWrap) modalImageWrap.style.display = "none";
    }

    document.body.classList.add("modal-open");
    modal.classList.remove("hidden");
  }

  function closeModal() {
    if (!modal) return;
    modal.classList.add("hidden");
    document.body.classList.remove("modal-open");
    if (modalImage) modalImage.src = "";
  }

  // attach chip handlers
  function setupChips() {
    if (!chips || !chips.length) return;
    chips.forEach(chip => {
      chip.addEventListener("click", () => {
        chips.forEach(c => c.classList.remove("chip-active"));
        chip.classList.add("chip-active");
        currentFilter = chip.getAttribute("data-filter") || "all";
        renderCollections(currentFilter);
      });
    });
  }

  // attach modal close handlers
  function setupModalEvents() {
    safeAdd(modalClose, "click", closeModal);
    safeAdd(modal, "click", (e) => {
      if (e.target === modal || e.target.classList.contains("modal-backdrop")) closeModal();
    });
  }

  // hero buttons
  function smoothScrollTo(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth" });
  }
  function setupHero() {
    safeAdd(heroExplore, "click", () => smoothScrollTo("collections"));
    safeAdd(heroAbout, "click", () => smoothScrollTo("about"));
  }

  // drawer
  function setupDrawer() {
    safeAdd(navToggle, "click", () => {
      if (!drawer) return;
      const isVisible = getComputedStyle(drawer).display === "flex";
      drawer.style.display = isVisible ? "none" : "flex";
    });
    if (drawer) {
      drawer.querySelectorAll("a").forEach(link => link.addEventListener("click", () => drawer.style.display = "none"));
    }
  }

  // signature slides
  let currentSlide = 0;
  function setSlide(index) {
    if (!sigSlides.length) return;
    currentSlide = index;
    sigSlides.forEach((slide, i) => slide.classList.toggle("sig-slide-active", i === index));
    sigDots.forEach((dot, i) => dot.classList.toggle("dot-active", i === index));
  }
  function setupSlides() {
    sigDots.forEach(dot => safeAdd(dot, "click", () => {
      const n = Number(dot.getAttribute("data-slide"));
      setSlide(isNaN(n) ? 0 : n);
    }));
    if (sigSlides.length) setInterval(() => setSlide((currentSlide+1) % sigSlides.length), 6000);
  }

  // tabs
  function setupTabs() {
    tabButtons.forEach(btn => btn.addEventListener("click", () => {
      const tab = btn.getAttribute("data-tab");
      tabButtons.forEach(b => b.classList.remove("tab-active"));
      btn.classList.add("tab-active");
      tabPanels.forEach(panel => panel.classList.toggle("tab-panel-active", panel.getAttribute("data-panel") === tab));
    }));
  }

  // hero parallax
  function setupParallax() {
    window.addEventListener("scroll", () => {
      if (!heroMediaEl) return;
      const y = window.scrollY || window.pageYOffset;
      const offset = Math.min(y * 0.2, 120);
      heroMediaEl.style.transform = `translateY(${offset * 0.3}px)`;
    });
  }

  // contact form
  function setupContactForm() {
    if (!contactForm) return;
    contactForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!contactName.value.trim() || !contactEmail.value.trim() || !contactMessage.value.trim()) {
        if (contactStatus) { contactStatus.textContent = "Please fill in all fields."; contactStatus.style.color = "#b46a3c"; }
        return;
      }
      contactSubmit.disabled = true;
      contactSubmit.textContent = "Sending…";
      contactStatus.textContent = "";
      try {
        const res = await fetch("/api/contact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: contactName.value.trim(),
            email: contactEmail.value.trim(),
            message: contactMessage.value.trim()
          })
        });
        if (!res.ok) throw new Error("Failed");
        if (contactStatus) { contactStatus.textContent = "Request sent. We’ll get back to you soon."; contactStatus.style.color = "#c2a76b"; }
        contactForm.reset();
      } catch (err) {
        console.error(err);
        if (contactStatus) { contactStatus.textContent = "Something went wrong. Please try again."; contactStatus.style.color = "#b46a3c"; }
      } finally {
        contactSubmit.disabled = false;
        contactSubmit.textContent = "Send Request";
      }
    });
  }

  // utility: safe init sequence
  function init() {
    initDomRefs();
    setupReveal();
    setYear();
    setupChips();
    setupModalEvents();
    setupHero();
    setupDrawer();
    setupSlides();
    setupTabs();
    setupParallax();
    setupContactForm();

    // load collections (fires renderCollections when done)
    loadCollections().catch(e => console.error("loadCollections top-level:", e));
  }

  // run init when DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();
