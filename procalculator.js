// ========= CONFIG =========
const CONFIG = {
  API_BASE: "https://cardinalgarageprobe1.onrender.com", // your backend
  ROUTES: {
    inference: "/inference",
    speak: "/speak",
    train: "/train-collect"
  }
};

// ========= ELEMENTS =========
const el = {
  fileInput: document.getElementById("fileInput"),
  btnUpload: document.getElementById("btnUpload"),
  btnAnalyze: document.getElementById("btnAnalyze"),
  btnSpeak: document.getElementById("btnSpeak"),

  previewFrame: document.getElementById("previewFrame"),
  previewPlaceholder: document.getElementById("previewPlaceholder"),
  previewImage: document.getElementById("previewImage"),

  estPrice: document.getElementById("estPrice"),
  estUpsell: document.getElementById("estUpsell"),
  estSummary: document.getElementById("estSummary"),

  closeBar: document.getElementById("closeBar"),
  upsellBar: document.getElementById("upsellBar"),
  riskBar: document.getElementById("riskBar"),
  closeVal: document.getElementById("closeVal"),
  upsellVal: document.getElementById("upsellVal"),
  riskVal: document.getElementById("riskVal"),

  systemNote: document.getElementById("systemNote"),

  // Widgets
  mowingBody: document.getElementById("mowingBody"),
  landBody: document.getElementById("landBody"),
  btnMowEstimate: document.getElementById("btnMowEstimate"),
  btnLandEstimate: document.getElementById("btnLandEstimate"),

  // Mystery flags
  mysteryBtns: document.querySelectorAll(".mystery-btn"),

  // Garage
  garageBody: document.getElementById("garageBody"),
  btnGarage: document.getElementById("btnGarage"),
  btnFounder: document.getElementById("btnFounder"),
  btnContact: document.getElementById("btnContact"),

  // Modal
  modalBackdrop: document.getElementById("modalBackdrop"),
  modalTitle: document.getElementById("modalTitle"),
  modalBody: document.getElementById("modalBody"),
  modalClose: document.getElementById("modalClose")
};

// ========= STATE =========
const STATE = {
  lastSummary: "",
  lastPayload: null,
  hasImage: false
};

// ========= UPLOAD / PREVIEW =========
function wireUpload() {
  if (!el.btnUpload || !el.fileInput) return;

  el.btnUpload.addEventListener("click", () => el.fileInput.click());

  el.fileInput.addEventListener("change", () => {
    const file = el.fileInput.files[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    el.previewImage.src = url;
    el.previewImage.classList.remove("hidden");
    el.previewPlaceholder.classList.add("hidden");
    STATE.hasImage = true;

    setNote("Photo loaded. Click Analyze Now to run your backend logic.");
    logEvent("photo_selected", { name: file.name, size: file.size });

fetch("https://cardinalgarageprobe1.onrender.com/inference", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    mode: "landscaping",     // or "mowing", depending on your UI
    photoSummary: "front yard with shrubs",  // (you can fill this from AI later)
    inputs: { areaSqFt: 1200, shrubCount: 8, bedSize: "medium" },
    notes: "customer wants fresh mulch"
  })
})
.then(res => res.json())
.then(data => {
  console.log("AI result:", data);
  // here you display data.price, data.summary, etc.
})
.catch(err => console.error("Inference error:", err));

    
  });
}

// ========= INIT =========
window.addEventListener("DOMContentLoaded", () => {
  wireUpload();
  wireAnalyze();
  wireSpeak();
  wireWidgets();
  wireGarage();
  logEvent("page_load", { page: "pro_calculator" });
});

// ========= ANALYZE =========
function wireAnalyze() {
  if (!el.btnAnalyze) return;
  el.btnAnalyze.addEventListener("click", async () => {
    const mode = "landscaping";
    const payload = {
      mode,
      service: mode,
      inputs: {
        areaSqFt: numOrNull(document.querySelector('#mowArea')?.value),
        shrubCount: numOrNull(document.querySelector('#landShrubs')?.value),
        bedSize: document.querySelector('#landBeds')?.value || "",
        material: document.querySelector('#landMaterial')?.value || ""
      },
      notes: "",
      photoSummary: STATE.hasImage ? "Photo uploaded for analysis." : "No photo yet",
      meta: { source: "pro_calculator_console" }
    };

    setNote("Analyzing via /inference…");
    setLoading(true);
    try {
      const res = await fetch(CONFIG.API_BASE + CONFIG.ROUTES.inference, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error("Inference failed");
      const data = await res.json();
      applyInferenceResult(data, "analyze_click");
    } catch (err) {
      console.error(err);
      setNote("Analysis failed. Check backend or network.");
      logEvent("analyze_error", { error: String(err) });
    } finally {
      setLoading(false);
    }
  });
  
// ========= PRICE NORMALIZATION =========
function normalizePrice(p) {
  if (p === null || p === undefined) return null;
  if (typeof p === "number" && isFinite(p)) return Math.round(p);
  const s = String(p).replace(/[^\d.]/g, "");
  const n = Number(s);
  return isFinite(n) ? Math.round(n) : null;
}

// ========= PHOTO ANALYSIS =========
// ========= PHOTO ANALYSIS =========
async function analyzePhoto(photoFile, userNotes) {
  try {
    // Build the form data to send to your backend
    const formData = new FormData();
    formData.append("image", photoFile);                 // actual photo
    formData.append("mode", "landscaping");              // or "mowing"
    formData.append("notes", userNotes || "");

    // Send it to your backend /inference route
    const resp = await fetch(`${CONFIG.API_BASE}/inference`, {
      method: "POST",
      body: formData
    });

    // If backend fails, throw an error
    if (!resp.ok) throw new Error("AI inference failed");

    // Read backend JSON (price, upsell, risk, etc.)
    const data = await resp.json();

    // Apply results directly to the calculator
    applyResult(data);

    // Optional confirmation in console
    console.log("✅ AI photo analysis result:", data);

  } catch (err) {
    console.error("❌ AI photo analysis failed:", err);
    tip("AI photo analysis unavailable, using fallback estimate.", true);
  }
}

// ========= UPLOAD HANDLER =========
el.photoInput.onchange = () => {
  const photoFile = el.photoInput.files[0];
  if (!photoFile) return;

  // Optional message while analyzing
  tip("Analyzing photo… please wait.");

  // Call the async analysis function
  analyzePhoto(photoFile, userNotes);
};


// ========= FALLBACK SUMMARY (if no photo or error) =========


// ========= APPLY RESULT =========
function applyInferenceResult(data, source) {
  const price = normalizePrice(data.price);
  const upsellText = data.upsell || "—";
  const summary = (data.summary || "").toString().trim() || buildFallbackSummary(price, upsellText);
  const closePct = clampPct(data.closePct ?? 0);
  const upsellPct = clampPct(data.upsellPct ?? 0);
  const riskPct = clampPct(data.riskPct ?? 0);

  el.estPrice.textContent = price ? `$${price}` : "$—";
  el.estUpsell.textContent = upsellText;
  el.estSummary.textContent = summary;

  setBar(el.closeBar, el.closeVal, closePct);
  setBar(el.upsellBar, el.upsellVal, upsellPct);
  setBar(el.riskBar, el.riskVal, riskPct);

  STATE.lastSummary = summary;
  STATE.lastPayload = { price, upsellText, closePct, upsellPct, riskPct };

  setNote("Live result shown. Backend fully controls these numbers.");
  logEvent("inference_result", { source, raw: data, mapped: STATE.lastPayload });
}

// ========= SPEAK =========
function wireSpeak() {
  if (!el.btnSpeak) return;
  el.btnSpeak.addEventListener("click", async () => {
    const text = STATE.lastSummary || "No estimate yet. Upload a photo or run a calculator first.";
    try {
      await speakViaBackend(text);
    } catch (err) {
      console.warn(err);
      setNote("Voice temporarily unavailable.");
    }
  });
}

async function speakViaBackend(text) {
  logEvent("speak_request", { text });
  const res = await fetch(CONFIG.API_BASE + CONFIG.ROUTES.speak, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ voice: "alloy", text })
  });
  if (!res.ok) throw new Error("speak endpoint error");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  await audio.play();
}

// ========= WIDGETS =========
function wireWidgets() {
  document.querySelectorAll(".widget-header").forEach(btn => {
    btn.addEventListener("click", () => {
      const targetSel = btn.getAttribute("data-target");
      const body = document.querySelector(targetSel);
      if (!body) return;
      const open = body.classList.contains("open");
      document.querySelectorAll(".widget-body").forEach(b => b.classList.remove("open"));
      if (!open) body.classList.add("open");
    });
  });

  el.mysteryBtns.forEach(btn => {
    btn.addEventListener("click", () => btn.classList.toggle("active"));
  });

  if (el.btnMowEstimate) {
    el.btnMowEstimate.addEventListener("click", async () => {
      const body = {
        type: "mowing",
        inputs: {
          areaSqFt: numOrNull(document.getElementById("mowArea").value),
          terrain: valOrNull(document.getElementById("mowTerrain").value),
          access: valOrNull(document.getElementById("mowAccess").value),
          visit: valOrNull(document.getElementById("mowVisit").value)
        },
        meta: { source: "mowing_widget" }
      };
      await runWidgetInference(body, "mowing_widget");
    });
  }

  if (el.btnLandEstimate) {
    el.btnLandEstimate.addEventListener("click", async () => {
      const flags = [];
      el.mysteryBtns.forEach(btn => {
        if (btn.classList.contains("active")) {
          const f = btn.getAttribute("data-flag");
          if (f) flags.push(f);
        }
      });
      const body = {
        type: "landscaping",
        inputs: {
          beds: numOrNull(document.getElementById("landBeds").value),
          material: valOrNull(document.getElementById("landMaterial").value),
          shrubs: numOrNull(document.getElementById("landShrubs").value),
          detail: valOrNull(document.getElementById("landDetail").value),
          flags
        },
        meta: { source: "landscaping_widget" }
      };
      await runWidgetInference(body, "landscaping_widget");
    });
  }
}

async function runWidgetInference(payload, source) {
  setNote("Sending to /inference…");
  setLoading(true);
  logEvent("widget_inference_start", { source, payload });
  try {
    const res = await fetch(CONFIG.API_BASE + CONFIG.ROUTES.inference, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error("inference failed");
    const data = await res.json();
    applyInferenceResult(data, source);
  } catch (err) {
    console.error(err);
    setNote("Widget request failed. Check backend.");
    logEvent("widget_inference_error", { source, error: String(err) });
  } finally {
    setLoading(false);
  }
}

// ========= GARAGE / MODAL =========
function wireGarage() {
  if (el.btnGarage) {
    el.btnGarage.addEventListener("click", () => {
      if (!el.garageBody) return;
      const open = el.garageBody.classList.contains("open");
      document.querySelectorAll(".widget-body").forEach(b => b.classList.remove("open"));
      if (!open) el.garageBody.classList.add("open");
      logEvent("garage_open", {});
    });
  }

  if (el.btnFounder) {
    el.btnFounder.addEventListener("click", () => {
      showModal("Founder’s Black Book", "Reserved capsule for lifetime partners.");
      logEvent("founder_modal_open", {});
    });
  }

  if (el.btnContact) {
    el.btnContact.addEventListener("click", () => {
      showModal("Contact Cardinal Garage Pro", "Hook up your CRM or contact form here.");
      logEvent("contact_click", {});
    });
  }

  if (el.modalClose) el.modalClose.addEventListener("click", hideModal);
  if (el.modalBackdrop) {
    el.modalBackdrop.addEventListener("click", e => {
      if (e.target === el.modalBackdrop) hideModal();
    });
  }
}

function showModal(title, body) {
  el.modalTitle.textContent = title;
  el.modalBody.textContent = body;
  el.modalBackdrop.classList.remove("hidden");
}

function hideModal() {
  el.modalBackdrop.classList.add("hidden");
}

// ========= HELPERS =========
function setBar(barEl, labelEl, pct) {
  const v = clampPct(pct);
  if (barEl) barEl.style.width = v + "%";
  if (labelEl) labelEl.textContent = v + "%";
}

function clampPct(n) {
  n = Number(n || 0);
  if (!isFinite(n)) n = 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function valOrNull(v) {
  if (!v) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function numOrNull(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return isFinite(n) ? n : null;
}

let noteTimer = null;
function setNote(msg) {
  if (!el.systemNote) return;
  el.systemNote.textContent = msg;
  if (noteTimer) clearTimeout(noteTimer);
  noteTimer = setTimeout(() => {
    el.systemNote.textContent = "Tip: Backend fully controls pricing and output.";
  }, 5000);
}

function setLoading(isLoading) {
  el.btnAnalyze.disabled = isLoading;
  el.btnMowEstimate && (el.btnMowEstimate.disabled = isLoading);
  el.btnLandEstimate && (el.btnLandEstimate.disabled = isLoading);
  el.btnAnalyze.textContent = isLoading ? "Working…" : "🔍 Analyze Now";
}

async function logEvent(event, payload) {
  try {
    await fetch(CONFIG.API_BASE + CONFIG.ROUTES.train, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event,
        t: Date.now(),
        payload: payload || {},
        source: "pro_calculator_frontend"
      })
    });
  } catch {
    // silent fail
  }
}







