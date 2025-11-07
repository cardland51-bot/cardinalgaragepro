// ========= ELEMENTS =========
const el = {
  fileInput: document.getElementById("fileInput"),
  btnUpload: document.getElementById("btnUpload"),
  btnAnalyze: document.getElementById("btnAnalyze"),
  previewImage: document.getElementById("previewImage"),
  previewPlaceholder: document.getElementById("previewPlaceholder"),
  btnToggleJared: document.getElementById("btnToggleJared"),
  estSummary: document.getElementById("estSummary"),
  estPrice: document.getElementById("estPrice"),
  systemNote: document.getElementById("systemNote")
};

let jaredEnabled = false;
let imageBase64 = null;

// ========= HELPERS =========
function setNote(msg) {
  if (el.systemNote) el.systemNote.textContent = msg;
}
function setLoading(isLoading) {
  if (!el.btnAnalyze) return;
  el.btnAnalyze.disabled = isLoading;
  el.btnAnalyze.textContent = isLoading ? "Working…" : "🔍 Analyze";
}

// ========= TOGGLE JARED =========
function wireJaredToggle() {
  if (!el.btnToggleJared) return;
  el.btnToggleJared.addEventListener("click", () => {
    jaredEnabled = !jaredEnabled;
    el.btnToggleJared.textContent = jaredEnabled ? "🔊 Jared: ON" : "🔇 Jared: OFF";
    setNote(jaredEnabled ? "Jared is online." : "Jared is offline.");
  });
}

// ========= UPLOAD =========
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
    setNote("Photo loaded. Ready when you are.");
    const reader = new FileReader();
    reader.onloadend = () => (imageBase64 = reader.result.split(",")[1]);
    reader.readAsDataURL(file);
  });
}

// ========= ANALYZE (placeholder only) =========
function wireAnalyze() {
  if (!el.btnAnalyze) return;
  el.btnAnalyze.addEventListener("click", async () => {
    setLoading(true);
    setNote("Analyzing locally...");
    await new Promise(r => setTimeout(r, 1000)); // fake delay
    el.estSummary.textContent = "Cardinal_AI is being trained currently.";
    el.estPrice.textContent = "$—";
    setNote("Analysis complete.");
    if (jaredEnabled) speakLocal("Analysis complete. Yard loaded successfully.");
    setLoading(false);
  });
}

// ========= SPEECH =========
function speakLocal(text) {
  const utter = new SpeechSynthesisUtterance(text);
  utter.rate = 1;
  speechSynthesis.speak(utter);
}

// ========= INIT =========
window.addEventListener("DOMContentLoaded", () => {
  wireUpload();
  wireAnalyze();
  wireJaredToggle();
  setNote("Ready — Jared toggle available.");
});



