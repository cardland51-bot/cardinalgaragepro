/* ========= CONFIG ========= */
const CONFIG = {
  // ⬇️ Set this to your live backend on Render
  API_BASE: "https://jared-hero2-backend.onrender.com",

  // Endpoints you already control in the backend
  ROUTES: {
    calculate: "/calculate", // expects JSON; you control logic + response
    speak: "/speak"          // POST { voice, text } -> audio blob
  },
  voice: "alloy"             // or whatever your backend expects
};

/* ========= ELEMENTS ========= */
const el = {
  serviceGrid: document.getElementById("serviceGrid"),
  service: document.getElementById("service"),
  bedSize: document.getElementById("bedSize"),
  areaSqFt: document.getElementById("areaSqFt"),
  shrubCount: document.getElementById("shrubCount"),
  material: document.getElementById("material"),
  mowingFreq: document.getElementById("mowingFreq"),
  btnCalculate: document.getElementById("btnCalculate"),
  btnReset: document.getElementById("btnReset"),

  price: document.getElementById("price"),
  upsell: document.getElementById("upsell"),
  closeBar: document.getElementById("closeBar"),
  upsellBar: document.getElementById("upsellBar"),
  riskBar: document.getElementById("riskBar"),
  closeVal: document.getElementById("closeVal"),
  upsellVal: document.getElementById("upsellVal"),
  riskVal: document.getElementById("riskVal"),

  btnSpeak: document.getElementById("btnSpeak"),
  note: document.getElementById("note")
};

/* ========= STATE ========= */
const STATE = {
  lastSummary: ""
};

/* ========= INIT ========= */
window.addEventListener("load", () => {
  // Service selection
  el.serviceGrid.addEventListener("click", (e) => {
    const btn = e.target.closest(".chip");
    if (!btn) return;
    [...el.serviceGrid.querySelectorAll(".chip")].forEach(c => c.classList.remove("active"));
    btn.classList.add("active");
    el.service.value = btn.dataset.service || "";
  });

  // Calculate
  el.btnCalculate.addEventListener("click", onCalculate);
  el.btnReset.addEventListener("click", resetForm);
  el.btnSpeak.addEventListener("click", () => speak(STATE.lastSummary || makeFallbackSpeech()));
});

/* ========= HANDLERS ========= */
async function onCalculate(){
  const service = (el.service.value || "").trim();
  if (!service) { flashNote("Pick a service first."); return; }

  const payload = {
    service,
    inputs: {
      bedSize: valueOrNull(el.bedSize.value),
      areaSqFt: numOrNull(el.areaSqFt.value),
      shrubCount: numOrNull(el.shrubCount.value),
      material: valueOrNull(el.material.value),
      mowingFreq: valueOrNull(el.mowingFreq.value)
    }
  };

  try {
    setCalculating(true);

    const resp = await fetch(CONFIG.API_BASE + CONFIG.ROUTES.calculate, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!resp.ok) throw new Error("Calculate request failed");
    const data = await resp.json();

    // EXPECTED (but your backend controls this):
    // { price, upsell, summary, closePct, upsellPct, riskPct }
    const price = safeText(data.price, "$—");
    const upsell = safeText(data.upsell, "—");
    const summary = safeText(data.summary, buildSummaryFrom(price, upsell));

    const closePct = clampPct(data.closePct ?? 0);
    const upsellPct = clampPct(data.upsellPct ?? 0);
    const riskPct = clampPct(data.riskPct ?? 0);

    // Update UI
    el.price.textContent = fmtPrice(price);
    el.upsell.textContent = `Upsell potential: ${fmtUpsell(upsell)}`;
    setBar(el.closeBar, el.closeVal, closePct);
    setBar(el.upsellBar, el.upsellVal, upsellPct);
    setBar(el.riskBar, el.riskVal, riskPct);

    // Save & auto-speak (price + potential)
    STATE.lastSummary = summary;
    await speak(summary);

  } catch (err) {
    console.error(err);
    flashNote("Calculation failed. Check backend and try again.");
  } finally {
    setCalculating(false);
  }
}

/* ========= BACKEND TTS ========= */
async function speak(text){
  if (!text) return;
  try{
    const resp = await fetch(CONFIG.API_BASE + CONFIG.ROUTES.speak, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ voice: CONFIG.voice, text })
    });
    if (!resp.ok) throw new Error("TTS failed");
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    await audio.play();
  }catch(err){
    console.warn("TTS unavailable:", err);
    flashNote("Voice temporarily unavailable.");
  }
}

/* ========= HELPERS ========= */
function setCalculating(busy){
  el.btnCalculate.disabled = busy;
  el.btnCalculate.textContent = busy ? "Calculating…" : "Calculate";
}

function resetForm(){
  [...document.querySelectorAll(".chip")].forEach(c => c.classList.remove("active"));
  document.getElementById("calcForm").reset();
  el.price.textContent = "$—";
  el.upsell.textContent = "Upsell potential: —";
  setBar(el.closeBar, el.closeVal, 0);
  setBar(el.upsellBar, el.upsellVal, 0);
  setBar(el.riskBar, el.riskVal, 0);
  STATE.lastSummary = "";
}

function setBar(barEl, labelEl, pct){
  barEl.style.width = pct + "%";
  labelEl.textContent = pct + "%";
}

function clampPct(n){
  n = Number(n ?? 0);
  if (Number.isNaN(n)) n = 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function valueOrNull(v){ return (v && v.trim()) ? v.trim() : null; }
function numOrNull(v){
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function safeText(v, fallback=""){
  if (v === null || v === undefined) return fallback;
  const s = String(v).trim();
  return s.length ? s : fallback;
}

function fmtPrice(p){
  // Accept "$480", "480", 480 — display as-is if already prefixed
  const s = String(p).trim();
  if (s.startsWith("$")) return s;
  const n = Number(s);
  return Number.isFinite(n) ? `$${n.toFixed(0)}` : s;
}
function fmtUpsell(u){
  const s = String(u).trim();
  if (!s) return "—";
  if (/^\$?\d+(\.\d+)?$/.test(s)){
    // just a number: turn into money with plus
    const n = s.startsWith("$") ? s.slice(1) : s;
    const num = Number(n);
    return Number.isFinite(num) ? `+$${num.toFixed(0)}` : s;
  }
  return s; // allow custom backend wording
}

function buildSummaryFrom(price, upsell){
  const p = fmtPrice(price);
  const u = fmtUpsell(upsell);
  if (u && u !== "—") {
    return `Estimate ${p}. Upsell potential ${u}.`;
  }
  return `Estimate ${p}.`;
}

let noteTimer = null;
function flashNote(msg){
  el.note.textContent = msg;
  clearTimeout(noteTimer);
  noteTimer = setTimeout(() => el.note.textContent = "Tip: Your backend controls all inputs and pricing logic. Frontend just sends JSON and speaks what you return.", 4500);
}
