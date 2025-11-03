(() => {
  const API = "https://jared-hero2-backend.onrender.com";
  const c = document.getElementById("stage");
  const ctx = c.getContext("2d");

  let W = 0, H = 0, DPR = 1;
  let speechAudio = null;
  let recognition = null;
  let canListen = true;

  const state = {
    talk: false,
    thinking: false,
    message: "Hold to talk • Upload a photo",
    img: null,
    fullscreen: false,
  };

  // ====== Canvas Sizing ======
  function size() {
    DPR = Math.max(1, Math.min(2, devicePixelRatio || 1));
    W = c.clientWidth;
    H = c.clientHeight;
    c.width = Math.floor(W * DPR);
    c.height = Math.floor(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  addEventListener("resize", size, { passive: true });
  size();

  // ====== Rounded Rectangle Helper ======
  function rr(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // ====== Draw Button ======
  function button(x, y, w, h, t, a) {
    rr(x, y, w, h, 14);
    ctx.fillStyle = a ? "#12805f" : "#0f1b16";
    ctx.fill();
    ctx.strokeStyle = "#1b2a23";
    ctx.stroke();
    ctx.fillStyle = "#e9f3ee";
    ctx.font = "600 16px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(t, x + w / 2, y + h / 2);
  }

  // ====== Layout ======
  const ui = {
    talk: { x: 30, y: 0, w: 180, h: 52, l: "Hold to Talk" },
    full: { x: 0, y: 20, w: 130, h: 40, l: "Fullscreen" },
  };

  function layout() {
    const isMobile = window.innerWidth < 700;
    const bottomPadding = isMobile ? 140 : 100;
    ui.talk.y = H - bottomPadding;
    ui.full.y = 30;
    ui.full.x = isMobile ? W - ui.full.w - 24 : W - 160;
  }

  // ====== Background Grid ======
  function grid() {
    ctx.save();
    ctx.globalAlpha = 0.07;
    ctx.strokeStyle = "#6bc7ab22";
    const s = 64;
    ctx.beginPath();
    for (let x = 0; x < W; x += s) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
    }
    for (let y = 0; y < H; y += s) {
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  // ====== Upload Handler ======
  const hidden = document.createElement("input");
  hidden.type = "file";
  hidden.accept = "image/*";
  hidden.style.display = "none";
  document.body.appendChild(hidden);

  const uiCenter = document.getElementById("centerUI");
  const preview = document.getElementById("preview");
  const uploadBtn = document.getElementById("uploadBtn");
  const floatingTips = document.getElementById("floatingTips");
  uploadBtn.addEventListener("click", () => hidden.click());

  hidden.addEventListener("change", async () => {
    const f = hidden.files[0];
    if (!f) return;
    const u = URL.createObjectURL(f);
    preview.src = u;
    preview.style.display = "block";
    uiCenter.querySelector("h1").style.display = "none";
    uploadBtn.style.display = "none";

    // Floating tips
    const tips = [
      "Tip: Lighting helps AI read edges",
      "Tip: Keep shrubs visible",
      "Tip: Use landscape view",
    ];
    tips.forEach((text, i) => {
      const el = document.createElement("div");
      el.className = "tip";
      el.textContent = text;
      el.style.left = `${40 + i * 20}%`;
      el.style.animationDelay = `${i * 2}s`;
      floatingTips.appendChild(el);
    });

    // AI analyze
    state.thinking = true;
    try {
      const fd = new FormData();
      fd.append("file", f);
      const r = await fetch(`${API}/analyze-image`, { method: "POST", body: fd });
      const j = await r.json();
      state.message = j.summary || "No summary";
      state.thinking = false;
      await speak(state.message);
    } catch {
      state.thinking = false;
      state.message = "Analysis failed.";
    }
  });

  // ====== Voice Recognition ======
  if ("webkitSpeechRecognition" in window) {
    recognition = new webkitSpeechRecognition();
    recognition.continuous = false;
    recognition.lang = "en-US";
    recognition.interimResults = false;

    recognition.onstart = () => {
      state.message = "🎙️ Listening...";
      document.body.classList.add("listening");
    };
    recognition.onresult = async (event) => {
      const text = event.results[0][0].transcript;
      await sendToJared(text);
    };
    recognition.onerror = () => {
      state.message = "Mic error.";
      canListen = true;
      document.body.classList.remove("listening");
    };
    recognition.onend = () => {
      state.talk = false;
      canListen = true;
      document.body.classList.remove("listening");
    };
  } else {
    alert("Speech recognition not supported in this browser.");
  }

  // ====== Backend Communication ======
  async function sendToJared(text) {
    if (!canListen) return;
    canListen = false;
    try {
      state.thinking = true;
      const res = await fetch(`${API}/inference`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      state.message = data.content || "No response";
      await speak(state.message);
    } catch {
      state.message = "Jared unavailable.";
    } finally {
      state.thinking = false;
      canListen = true;
    }
  }

  async function speak(text) {
    try {
      if (!text) return;
      if (speechAudio) {
        speechAudio.pause();
        speechAudio = null;
      }
      const r = await fetch(`${API}/speak`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!r.ok) throw new Error("TTS failed");
      const b = await r.blob();
      const u = URL.createObjectURL(b);
      speechAudio = new Audio(u);
      speechAudio.onplay = () => {
        state.thinking = false;
        state.message = "🧠 Jared is speaking...";
        canListen = false;
      };
      speechAudio.onended = () => {
        canListen = true;
        state.message = "Hold to talk • Upload a photo";
      };
      speechAudio.play();
    } catch {
      canListen = true;
    }
  }

  // ====== Canvas Events ======
  c.addEventListener("pointerdown", (e) => {
    const x = e.clientX, y = e.clientY;
    if (
      x > ui.talk.x &&
      x < ui.talk.x + ui.talk.w &&
      y > ui.talk.y &&
      y < ui.talk.y + ui.talk.h
    ) {
      if (canListen) {
        state.talk = true;
        recognition && recognition.start();
      }
    } else if (
      x > ui.full.x &&
      x < ui.full.x + ui.full.w &&
      y > ui.full.y &&
      y < ui.full.y + ui.full.h
    ) {
      if (!document.fullscreenElement)
        document.body.requestFullscreen?.();
      else document.exitFullscreen?.();
      state.fullscreen = !state.fullscreen;
    }
  });
  c.addEventListener("pointerup", () => {
    if (state.talk) {
      state.talk = false;
      recognition && recognition.stop();
    }
  });

  // ====== Draw Loop ======
  function draw() {
    layout();
    ctx.clearRect(0, 0, W, H);
    grid();
    button(ui.talk.x, ui.talk.y, ui.talk.w, ui.talk.h, ui.talk.l, state.talk);
    button(ui.full.x, ui.full.y, ui.full.w, ui.full.h, ui.full.l, state.fullscreen);
  }
  function loop() {
    draw();
    requestAnimationFrame(loop);
  }
  loop();

  // ====== Pitch Deck ======
  document.getElementById("downloadDeck").addEventListener("click", () => {
    const blob = new Blob(["Pitch deck placeholder. Replace with your PDF."], {
      type: "application/pdf",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "WorkRockPro-PitchDeck.pdf";
    a.click();
    URL.revokeObjectURL(url);
  });
})();
