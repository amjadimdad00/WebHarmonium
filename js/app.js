// ====== CONFIG & GLOBALS ======
const sampleURL = "/audio/harmonium-sample.wav";

const DOM = {
  mainScreen: document.getElementById("mainScreen"),
  loadHarmoniumBtn: document.getElementById("loadHarmoniumBtn"),
  keyboardContainer: document.getElementById("keyboard-container"),
  volumeRange: document.getElementById("myRange"),
  volumeLevel: document.getElementById("volumeLevel"),
  octave: document.getElementById("octave"),
  stack: document.getElementById("stack"),
  transpose: document.getElementById("transpose"),
  rootNote: document.getElementById("rootNote"),
  useReverb: document.getElementById("useReverb"),
};

let keys = [];
let audioCtx = null,
  gainNode = null,
  reverbNode = null;
let audioBuffer = null;
let useReverb = true;
let sourceNodes = [],
  sourceNodeState = [];
let notation = "";
let currentOctave = 3,
  stackCount = 0,
  rootKey = 62;
let middleC = 60;
let loop = true,
  loopStart = 0.5,
  loopEnd = 7.5;
const octaveMap = [-36, -24, -12, 0, 12, 24, 36];
const baseKeyNames = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];
let keyMap = [],
  baseKeyMap = [];

// ====== KEYBOARD & SWARAM ======
const keyboardMap = {
  s: 53,
  S: 53,
  a: 54,
  A: 54,
  "`": 55,
  1: 56,
  q: 57,
  Q: 57,
  2: 58,
  w: 59,
  W: 59,
  e: 60,
  E: 60,
  4: 61,
  r: 62,
  R: 62,
  5: 63,
  t: 64,
  T: 64,
  y: 65,
  Y: 65,
  7: 66,
  u: 67,
  U: 67,
  8: 68,
  i: 69,
  I: 69,
  9: 70,
  o: 71,
  O: 71,
  p: 72,
  P: 72,
  "-": 73,
  "[": 74,
  "=": 75,
  "]": 76,
  "\\": 77,
  "'": 78,
  ";": 79,
};
const swaramMap = {
  s: "Ṃ",
  S: "Ṃ",
  a: "Ṃ",
  A: "Ṃ",
  "`": "P̣",
  1: "Ḍ",
  q: "Ḍ",
  Q: "Ḍ",
  2: "Ṇ",
  w: "Ṇ",
  W: "Ṇ",
  e: "S",
  E: "S",
  4: "R",
  r: "R",
  R: "R",
  5: "G",
  t: "G",
  T: "G",
  y: "M",
  Y: "M",
  7: "M",
  u: "P",
  U: "P",
  8: "D",
  i: "D",
  I: "D",
  9: "N",
  o: "N",
  O: "N",
  p: "Ṡ",
  P: "Ṡ",
  "-": "Ṙ",
  "[": "Ṙ",
  "=": "Ġ",
  "]": "Ġ",
  "\\": "Ṁ",
  "'": "Ṁ",
  ";": "Ṗ",
  ",": ",",
};

// ====== INIT APP ======
function loadApp() {
  DOM.loadHarmoniumBtn.addEventListener("click", initHarmonium);
  setupControls();
  registerServiceWorker();
}

// ====== AUDIO ======
function initAudio() {
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  gainNode = audioCtx.createGain();
  gainNode.gain.value = DOM.volumeRange.value / 100;
  DOM.volumeLevel.innerText = DOM.volumeRange.value + "%";
  gainNode.connect(audioCtx.destination);

  reverbNode = audioCtx.createConvolver();
  fetch("/audio/reverb.wav")
    .then((res) => res.arrayBuffer())
    .then((buf) => audioCtx.decodeAudioData(buf))
    .then((decoded) => {
      reverbNode.buffer = decoded;
      reverbNode.connect(audioCtx.destination);
      updateReverbState(useReverb);
    });

  return loadSample(sampleURL);
}

function loadSample(url) {
  return fetch(url)
    .then((r) => r.arrayBuffer())
    .then((buf) => audioCtx.decodeAudioData(buf))
    .then((decoded) => {
      audioBuffer = decoded;
    });
}

// ====== INIT HARMONIUM ======
function initHarmonium() {
  if (!audioCtx) initAudio().then(() => renderHarmonium());
  else renderHarmonium();
}

function renderHarmonium() {
  const transpose = parseInt(DOM.transpose.innerText || 0);
  let startKey = middleC - 124 + (rootKey - middleC);

  for (let i = 0; i < 128; i++) {
    baseKeyMap[i] = startKey++;
    keyMap[i] = baseKeyMap[i] + transpose;
    sourceNodes[i] = null;
    sourceNodeState[i] = 0;
  }

  DOM.loadHarmoniumBtn.style.display = "none";
  DOM.mainScreen.style.display = "block";
  DOM.mainScreen.removeAttribute("aria-hidden");
  DOM.keyboardContainer.style.display = "flex";

  renderKeyboard();
  attachKeyboardListeners();
}

// ====== KEYBOARD RENDER ======
const whiteKeyWidth = 40,
  whiteKeyHeight = 150,
  blackKeyWidth = 25,
  blackKeyHeight = 100;
const octavePattern = [
  "white",
  "black",
  "white",
  "black",
  "white",
  "white",
  "black",
  "white",
  "black",
  "white",
  "black",
  "white",
];

function pressKey(keyEl, note) {
  if (!keyEl) return;
  keyEl.classList.add("active");
  keyEl.setAttribute("aria-pressed", "true");
  noteOn(note);
}
function releaseKey(keyEl, note) {
  if (!keyEl) return;
  keyEl.classList.remove("active");
  keyEl.setAttribute("aria-pressed", "false");
  noteOff(note);
}

function renderKeyboard() {
  keys = [];
  const svg = DOM.keyboardContainer.querySelector("#keyboard");
  svg.innerHTML = "";
  let x = 0;

  for (let octave = 0; octave < 7; octave++) {
    for (let i = 0; i < 12; i++) {
      const type = octavePattern[i],
        keyNote = i + 12 * octave + 48;
      if (type === "white") {
        const rect = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "rect",
        );
        rect.setAttribute("class", "white");
        rect.setAttribute("x", x);
        rect.setAttribute("y", 0);
        rect.setAttribute("width", whiteKeyWidth);
        rect.setAttribute("height", whiteKeyHeight);
        rect.dataset.note = keyNote;
        rect.setAttribute("role", "button");
        rect.setAttribute("aria-pressed", "false");
        svg.appendChild(rect);
        keys.push(rect);
        x += whiteKeyWidth;
      }
    }
  }

  x = 0;
  for (let octave = 0; octave < 7; octave++) {
    for (let i = 0; i < 12; i++) {
      const type = octavePattern[i],
        keyNote = i + 12 * octave + 48;
      if (type === "black") {
        const rect = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "rect",
        );
        rect.setAttribute("class", "black");
        rect.setAttribute("x", x + whiteKeyWidth * 0.7);
        rect.setAttribute("y", 0);
        rect.setAttribute("width", blackKeyWidth);
        rect.setAttribute("height", blackKeyHeight);
        rect.dataset.note = keyNote;
        rect.setAttribute("role", "button");
        rect.setAttribute("aria-pressed", "false");
        svg.appendChild(rect);
        keys.push(rect);
      }
      if (type === "white") x += whiteKeyWidth;
    }
  }

  const activeTouches = {};
  keys.forEach((keyEl) => {
    const note = parseInt(keyEl.dataset.note);
    keyEl.addEventListener("mousedown", () => pressKey(keyEl, note));
    keyEl.addEventListener("mouseup", () => releaseKey(keyEl, note));
    keyEl.addEventListener("mouseleave", () => releaseKey(keyEl, note));
    keyEl.addEventListener("touchstart", (e) => {
      e.preventDefault();
      pressKey(keyEl, note);
    });
    keyEl.addEventListener("touchend", (e) => {
      e.preventDefault();
      releaseKey(keyEl, note);
    });
    keyEl.addEventListener("touchcancel", (e) => {
      e.preventDefault();
      releaseKey(keyEl, note);
    });
  });

  svg.addEventListener("touchmove", (e) => {
    e.preventDefault();
    for (let t of e.touches) {
      const target = document.elementFromPoint(t.clientX, t.clientY);
      if (!target || !target.dataset.note) continue;
      const note = parseInt(target.dataset.note);
      keys.forEach((k) => releaseKey(k, parseInt(k.dataset.note)));
      pressKey(target, note);
    }
  });
}

// ====== NOTE HANDLING ======
function createSource(idx) {
  const src = audioCtx.createBufferSource();
  src.buffer = audioBuffer;
  src.loop = loop;
  src.loopStart = loopStart;
  src.detune.value = keyMap[idx] * 100;
  src.connect(gainNode);
  return src;
}
function noteOn(note) {
  playStack(note, currentOctave);
}
function noteOff(note) {
  stopStack(note, currentOctave);
}
function playStack(note, octave) {
  for (let c = 0; c <= stackCount; c++) {
    let i = note + octaveMap[octave + c];
    if (i >= sourceNodes.length) continue;
    if (!sourceNodeState[i]) {
      sourceNodes[i] = createSource(i);
      sourceNodes[i].start();
      sourceNodeState[i] = 1;
    }
  }
}
function stopStack(note, octave) {
  for (let c = 0; c <= stackCount; c++) {
    let i = note + octaveMap[octave + c];
    if (i >= sourceNodes.length) continue;
    if (sourceNodeState[i]) {
      sourceNodes[i].stop();
      sourceNodes[i] = null;
      sourceNodeState[i] = 0;
    }
  }
}

// ====== CONTROLS ======
function setupControls() {
  DOM.volumeRange.addEventListener("input", () => {
    gainNode.gain.value = DOM.volumeRange.value / 100;
    DOM.volumeLevel.innerText = DOM.volumeRange.value + "%";
  });
  DOM.useReverb.addEventListener("change", (e) =>
    updateReverbState(e.target.checked),
  );
}
function updateReverbState(state) {
  useReverb = state;
  if (useReverb) gainNode.connect(reverbNode);
  else
    try {
      gainNode.disconnect(reverbNode);
    } catch (err) {}
}
function shiftOctave(delta) {
  currentOctave = Math.min(Math.max(currentOctave + delta, 0), 6);
  DOM.octave.innerText = currentOctave;
}
function changeStack(delta) {
  stackCount = Math.min(Math.max(stackCount + delta, 0), 6 - currentOctave);
  DOM.stack.innerText = stackCount;
}
function shiftSemitone(delta) {
  let val = parseInt(DOM.transpose.innerText || 0) + delta;
  if (val >= -11 && val <= 11) {
    DOM.transpose.innerText = val;
    DOM.rootNote.innerText = baseKeyNames[val >= 0 ? val % 12 : val + 12];
    initHarmonium();
  }
}

// ====== KEYBOARD ======
function attachKeyboardListeners() {
  window.addEventListener("keydown", handleKey);
  window.addEventListener("keyup", handleKey);
}
function handleKey(e) {
  const note = keyboardMap[e.key];
  if (!note) return;
  const keyEl = keys.find((k) => parseInt(k.dataset.note) === note);
  if (e.type === "keydown" && !e.repeat) pressKey(keyEl, note);
  else if (e.type === "keyup") releaseKey(keyEl, note);
  updateNotation(e);
}
function updateNotation(e) {
  if (e.type !== "keyup") return;
  const k = e.key;
  if (k === "Backspace" && notation.length) notation = notation.slice(0, -1);
  else if (k === "Delete") notation = "";
  else if (k === "Enter") {
    console.log(notation);
    notation = "";
  } else if (k === "Tab") notation += ",";
  else if (swaramMap[k]) notation += swaramMap[k];
}

// ====== SERVICE WORKER ======
function registerServiceWorker() {
  if ("serviceWorker" in navigator)
    navigator.serviceWorker
      .register("/serviceworker.js")
      .then(() => console.log("Service worker registered"));
}

// ===== INIT =====
loadApp();
