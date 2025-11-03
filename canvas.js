(() => {
  const API = "https://jared-hero2-backend.onrender.com";
  const c = document.getElementById("stage");
  const ctx = c.getContext("2d");

  let W = 0, H = 0, DPR = 1;
  let speechAudio = null;
  let recognition = null;
  let canListen = true; // ✅ new control flag to prevent overlap

  const state = {
    talk: false,
    thinking: false,
    message: "Hold to talk • Upload a photo",
    img: null,
    fullscreen: false,
  };

  // ====== Canvas sizing and layout ======
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

  const ui = {
    talk: { x: 20, y: 0, w: 180, h: 52, l: "Hold to Talk" },
    up: { x: 210, y: 0, w: 140, h: 52, l: "Upload Photo" },
    full: { x: 0, y: 20, w: 130, h: 40, l: "Fullscreen" },
  };

  function layout() {
    ui.talk.y = H - 80;
    ui.up.y = H - 80;
    ui.full.x = W - 150;
  }

  function bubble(txt) {
    if (!txt) return;
    const pad = 14, maxW = Math.min(520, W - 40);
    ctx.save();
    ctx.font = "15px system-ui";
    const words = txt.split(/\s+/);
    const lines = [""];
    let i = 0;
    for (const w of words) {
      const t = (lines[i] ? lines[i] + " " : "") + w;
      if (ctx.measureText(t).width > maxW) {
        lines[++i] = w;
      } else {
        lines[i] = t;
      }
    }
    const tw = maxW + pad * 2,
      th = lines.length * 20 + pad * 2,
      x = 20,
      y = H - th - 110;
    rr(x, y, tw, th, 14);
    ctx.fillStyle = "#0e1914";
    ctx.fill();
    ctx.strokeStyle = "#1b2a23";
    ctx.stroke();
    ctx.fillStyle = "#dff1ea";
    lines.forEach((ln, j) => ctx.fillText(ln, x + pad, y + pad + 18 * j));
    ctx.restore();
  }

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

  // ====== Upload handler ======
  const hidden = document.createElement("input");
  hidden.type = "file";
  hidden.accept = "image/*";
  hidden.style.display = "none";
  document.body.appendChild(hidden);

  hidden.addEventListener("change", async () => {
    const f = hidden.files[0];
    if (!f) return;
    const u = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => {
      state.img = img;
      URL.revokeObjectURL(u);
    };
    img.src = u;

    state.thinking = true;
    try {
      const fd = new FormData();
      fd.append("file", f);
      const r = await fetch(`${API}/analyze-image`, { method: "POST", body: fd });
      const j = await r.json();
      state.message = j.summary || "No summary";
      await speak(state.message);
    } catch {
      state.message = "Analysis failed.";
    }
    state.thinking = false;
  });

  // ====== Voice Recognition ======
  if ("webkitSpeechRecognition" in window) {
    recognition = new webkitSpeechRecognition();
    recognition.continuous = false;
    recognition.lang = "en-US";
    recognition.interimResults = false;

    recognition.onstart = () => {
      state.message = "🎙️ Listening...";
      console.log("🎙️ Listening...");
    };
    recognition.onresult = async (event) => {
      const text = event.results[0][0].transcript;
      console.log("🗣️ You said:", text);
      await sendToJared(text);
    };
    recognition.onerror = (e) => {
      console.error("Speech recognition error:", e);
      state.message = "Mic error.";
      canListen = true;
    };
    recognition.onend = () => {
      state.talk = false;
      canListen = true;
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
      console.log("🤖 Jared says:", data.content);
      state.message = data.content || "No response";
      await speak(state.message);
    } catch (err) {
      console.error("Error sending to Jared:", err);
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
      speechAudio.play();
      speechAudio.onended = () => {
        canListen = true; // ✅ Allow next talk after speech finishes
      };
    } catch (err) {
      console.error("Speech error:", err);
      canListen = true;
    }
  }

  // ====== Canvas Button Controls ======
  c.addEventListener("pointerdown", (e) => {
    const x = e.clientX, y = e.clientY;
    if (
      x > ui.talk.x && x < ui.talk.x + ui.talk.w &&
      y > ui.talk.y && y < ui.talk.y + ui.talk.h
    ) {
      if (canListen) {
        state.talk = true;
        recognition && recognition.start();
      }
    } else if (
      x > ui.up.x && x < ui.up.x + ui.up.w &&
      y > ui.up.y && y < ui.up.y + ui.up.h
    ) {
      hidden.click();
    } else if (
      x > ui.full.x && x < ui.full.x + ui.full.w &&
      y > ui.full.y && y < ui.full.y + ui.full.h
    ) {
      if (!document.fullscreenElement) {
        document.body.requestFullscreen?.();
        state.fullscreen = true;
      } else {
        document.exitFullscreen?.();
        state.fullscreen = false;
      }
    }
  });

  c.addEventListener("pointerup", () => {
    if (state.talk) {
      state.talk = false;
      recognition && recognition.stop();
    }
  });

  // ====== Drawing Loop ======
  function draw() {
    layout();
    ctx.clearRect(0, 0, W, H);
    grid();

    if (state.img) {
      const iw = state.img.width, ih = state.img.height;
      const sc = Math.min((W - 40) / iw, (H - 220) / ih);
      const pw = iw * sc, ph = ih * sc;
      const px = (W - pw) / 2, py = 40;
      rr(px - 6, py - 6, pw + 12, ph + 12, 14);
      ctx.fillStyle = "#0e1914";
      ctx.fill();
      ctx.strokeStyle = "#1b2a23";
      ctx.stroke();
      ctx.drawImage(state.img, px, py, pw, ph);
      if (state.thinking) {
        ctx.fillStyle = "rgba(0,0,0,.45)";
        ctx.fillRect(px, py, pw, ph);
        ctx.fillStyle = "#dff1ea";
        ctx.font = "600 16px system-ui";
        ctx.textAlign = "center";
        ctx.fillText("Analyzing…", px + pw / 2, py + ph / 2);
      }
    }

    bubble(state.message);
    button(ui.talk.x, ui.talk.y, ui.talk.w, ui.talk.h, ui.talk.l, state.talk);
    button(ui.up.x, ui.up.y, ui.up.w, ui.up.h, ui.up.l, false);
    button(ui.full.x, ui.full.y, ui.full.w, ui.full.h, ui.full.l, state.fullscreen);
  }

  function loop() {
    draw();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // ====== Pitch Deck Download Placeholder ======
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
