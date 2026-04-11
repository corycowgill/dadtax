// ============================================================
// DAD TAX ATTACK - Game Engine & Audio
// engine.js - Game logic, Boy AI, Particles, Chiptune Audio
// ============================================================

// ---- CONSTANTS ----
const FPS = 60;
const FRAME = 1 / FPS;
const GAME_TIME = 5 * 60; // 5 minutes in seconds
const TOTAL_SLICES = 8; // 4 per boy

const DAD_REACH_FRAMES = 25; // ~0.42s to reach
const DAD_EAT_FRAMES = 90;  // 1.5s eating
const DAD_BLOCKED_FRAMES = 90; // 1.5s recoil
const DAD_COOLDOWN_FRAMES = 48; // 0.8s cooldown

// Stamina system (player-controlled boys)
const STAMINA_MAX = 100;
const STAMINA_DRAIN_RATE = 2;      // ~0.83s full block at 60fps
const STAMINA_RECHARGE_RATE = 1;   // slower recharge than drain
const STAMINA_EXHAUSTED_THRESHOLD = 20; // must reach 20 before re-blocking after depletion

const RATINGS = [
  { min: 0, max: 1, label: "Salad Eater..." },
  { min: 2, max: 3, label: "Amateur Taxer" },
  { min: 4, max: 5, label: "Sneaky Dad" },
  { min: 6, max: 7, label: "Master Taxer!" },
  { min: 8, max: 8, label: "TAX KING!!" },
];

// ---- UTILITY ----
function rng(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function rngf(min, max) {
  return Math.random() * (max - min) + min;
}
function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

// ============================================================
// PARTICLE / POPUP SYSTEM
// ============================================================
function createParticle(x, y, type) {
  const base = { x, y, age: 0, maxAge: 30, alpha: 1 };
  switch (type) {
    case "crumb":
      return {
        ...base,
        vx: rngf(-3, 3),
        vy: rngf(-5, -1),
        gravity: 0.18,
        size: rng(2, 5),
        color: ["#F4A460", "#DAA520", "#CD853F", "#D2691E"][rng(0, 3)],
        maxAge: rng(25, 45),
        type: "crumb",
      };
    case "star":
      return {
        ...base,
        vx: rngf(-4, 4),
        vy: rngf(-4, 4),
        gravity: 0,
        size: rng(3, 7),
        color: "#FFD700",
        maxAge: rng(15, 25),
        type: "star",
        rotation: rngf(0, Math.PI * 2),
        rotSpeed: rngf(-0.2, 0.2),
      };
    case "heart":
      return {
        ...base,
        vx: rngf(-1, 1),
        vy: rngf(-2, -0.5),
        gravity: -0.02,
        size: rng(6, 10),
        color: "#FF6B6B",
        maxAge: rng(30, 50),
        type: "heart",
      };
    default:
      return base;
  }
}

function updateParticle(p) {
  p.age++;
  p.x += p.vx;
  p.y += p.vy;
  p.vy += p.gravity || 0;
  if (p.rotSpeed) p.rotation += p.rotSpeed;
  p.alpha = clamp(1 - p.age / p.maxAge, 0, 1);
  return p.age < p.maxAge;
}

function createPopup(x, y, text, color, size) {
  return {
    x,
    y,
    text,
    color: color || "#FFF",
    size: size || 16,
    age: 0,
    maxAge: 55,
    vy: -1.2,
    alpha: 1,
    scale: 0,
  };
}

function updatePopup(p) {
  p.age++;
  p.y += p.vy;
  p.vy *= 0.97;
  // Pop in, then fade
  if (p.age < 8) {
    p.scale = Math.min(1.3, p.age / 6);
  } else if (p.age < 14) {
    p.scale = 1.3 - (p.age - 8) * 0.05;
  } else {
    p.scale = 1;
  }
  if (p.age > p.maxAge - 15) {
    p.alpha = clamp((p.maxAge - p.age) / 15, 0, 1);
  }
  return p.age < p.maxAge;
}

// ============================================================
// BOY (Player-Controlled)
// ============================================================
function createBoy(name, side) {
  return {
    name,
    side, // "left" or "right"
    state: "idle", // idle, blocking
    slices: 4,
    stamina: STAMINA_MAX,
    staminaExhausted: false,
    // animation
    blockTimer: 0,
    indicator: "", // "!", ""
    bobPhase: rngf(0, Math.PI * 2),
  };
}

function updateBoyPlayer(boy, isBlocking) {
  boy.bobPhase += 0.05;

  if (boy.staminaExhausted) {
    boy.state = "idle";
    boy.indicator = "";
    boy.stamina = Math.min(STAMINA_MAX, boy.stamina + STAMINA_RECHARGE_RATE);
    if (boy.stamina >= STAMINA_EXHAUSTED_THRESHOLD) boy.staminaExhausted = false;
    return;
  }

  if (isBlocking && boy.stamina > 0) {
    boy.state = "blocking";
    boy.indicator = "!";
    boy.stamina = Math.max(0, boy.stamina - STAMINA_DRAIN_RATE);
    if (boy.stamina <= 0) {
      boy.staminaExhausted = true;
      boy.state = "idle";
      boy.indicator = "";
    }
  } else {
    boy.state = "idle";
    boy.indicator = "";
    boy.stamina = Math.min(STAMINA_MAX, boy.stamina + STAMINA_RECHARGE_RATE);
  }
}

// ============================================================
// DAD (Player)
// ============================================================
function createDad() {
  return {
    state: "idle", // idle, reaching, eating, blocked, cooldown
    stateTimer: 0,
    target: null, // "left" (Parker) or "right" (Brennan)
    reachProgress: 0, // 0-1
    bobPhase: 0,
  };
}

function updateDad(dad, input, boys, particles, popups, taxMeter, audioCallback) {
  dad.bobPhase += 0.04;

  switch (dad.state) {
    case "idle":
      if (input.left) {
        startReach(dad, "left");
      } else if (input.right) {
        startReach(dad, "right");
      }
      break;

    case "reaching":
      dad.stateTimer--;
      dad.reachProgress = 1 - dad.stateTimer / DAD_REACH_FRAMES;

      if (dad.stateTimer <= 0) {
        // Reached! Check if boy is blocking
        const targetBoy = dad.target === "left" ? boys[0] : boys[1];
        if (targetBoy.state === "blocking") {
          // BLOCKED!
          dad.state = "blocked";
          dad.stateTimer = DAD_BLOCKED_FRAMES;
          dad.reachProgress = 1;
          audioCallback("blocked");
          // Stars at interaction point
          const px = dad.target === "left" ? 120 : 280;
          for (let i = 0; i < 6; i++) particles.push(createParticle(px, 100, "star"));
          popups.push(createPopup(px, 80, "BLOCKED!", "#FF4444", 20));
        } else if (targetBoy.slices <= 0) {
          // No slices left
          dad.state = "blocked";
          dad.stateTimer = DAD_BLOCKED_FRAMES;
          popups.push(createPopup(dad.target === "left" ? 120 : 280, 80, "NO PIZZA!", "#888", 16));
          audioCallback("blocked");
        } else {
          // SUCCESS! Steal a slice
          targetBoy.slices--;
          const sliceType = dad.target === "left" ? "cheese" : "sausage";
          taxMeter.total++;
          taxMeter.slices.push(sliceType);

          dad.state = "eating";
          dad.stateTimer = DAD_EAT_FRAMES;
          dad.reachProgress = 1;
          audioCallback("grab");
          setTimeout(() => audioCallback("eat"), 300);

          // Crumbs
          const px = dad.target === "left" ? 140 : 260;
          for (let i = 0; i < 8; i++) particles.push(createParticle(px, 120, "crumb"));

          const label =
            sliceType === "cheese" ? "CHEESE!" : "SAUSAGE!";
          popups.push(createPopup(200, 70, "DAD TAX!", "#FFD700", 24));
          popups.push(createPopup(px, 100, label, "#FFA500", 16));

        }
      }
      break;

    case "eating":
      dad.stateTimer--;
      dad.reachProgress = Math.max(0, dad.reachProgress - 0.02);
      if (dad.stateTimer <= 0) {
        dad.state = "cooldown";
        dad.stateTimer = DAD_COOLDOWN_FRAMES;
        dad.reachProgress = 0;
      }
      break;

    case "blocked":
      dad.stateTimer--;
      dad.reachProgress = Math.max(0, dad.reachProgress - 0.025);
      if (dad.stateTimer <= 0) {
        dad.state = "cooldown";
        dad.stateTimer = 20;
        dad.reachProgress = 0;
      }
      break;

    case "cooldown":
      dad.stateTimer--;
      dad.reachProgress = 0;
      if (dad.stateTimer <= 0) {
        dad.state = "idle";
        dad.stateTimer = 0;
      }
      break;
  }
}

function startReach(dad, target) {
  dad.state = "reaching";
  dad.target = target;
  dad.stateTimer = DAD_REACH_FRAMES;
  dad.reachProgress = 0;
}

// ============================================================
// GAME ENGINE
// ============================================================
const GameEngine = (function () {
  let gameState = "MENU"; // MENU, PLAYING, GAME_OVER
  let timer = GAME_TIME;
  let dad;
  let boys;
  let particles;
  let popups;
  let taxMeter;
  let inputState;
  let boyInputState;
  let frameCount;
  let lastRating;
  let gameOverReason; // "time" or "allEaten"

  function init() {
    dad = createDad();
    boys = [createBoy("Parker", "left"), createBoy("Brennan", "right")];
    particles = [];
    popups = [];
    taxMeter = { total: 0, slices: [] };
    inputState = { left: false, right: false };
    boyInputState = { parkerBlocking: false, brennanBlocking: false };
    frameCount = 0;
    timer = GAME_TIME;
    lastRating = "";
    gameOverReason = "";
    gameState = "MENU";
  }

  function startGame() {
    dad = createDad();
    boys = [createBoy("Parker", "left"), createBoy("Brennan", "right")];
    particles = [];
    popups = [];
    taxMeter = { total: 0, slices: [] };
    inputState = { left: false, right: false };
    boyInputState = { parkerBlocking: false, brennanBlocking: false };
    frameCount = 0;
    timer = GAME_TIME;
    lastRating = "";
    gameOverReason = "";
    gameState = "PLAYING";
    AudioEngine.playMusic();
  }

  function resetGame() {
    AudioEngine.stopMusic();
    init();
  }

  function handleInput(keys, mouse, parkerBlock, brennanBlock) {
    if (gameState === "PLAYING") {
      inputState.left = (mouse && mouse.left) || false;
      inputState.right = (mouse && mouse.right) || false;
      boyInputState.parkerBlocking = parkerBlock || false;
      boyInputState.brennanBlocking = brennanBlock || false;
    }
    // Menu / game over: any player input to start
    if (gameState === "MENU" || gameState === "GAME_OVER") {
      if (parkerBlock || brennanBlock || (mouse && (mouse.left || mouse.right))) {
        startGame();
      }
    }
  }

  function update(dt) {
    if (gameState !== "PLAYING") return;

    frameCount++;

    // Timer
    timer -= dt;
    if (timer <= 0) {
      timer = 0;
      endGame("time");
      return;
    }

    // Check all slices eaten
    if (taxMeter.total >= TOTAL_SLICES) {
      endGame("allEaten");
      return;
    }

    // Update dad
    const audioFn = (type) => AudioEngine.playSFX(type);
    updateDad(dad, inputState, boys, particles, popups, taxMeter, audioFn);

    // Clear one-shot inputs
    inputState.left = false;
    inputState.right = false;

    // Update boys (player-controlled)
    updateBoyPlayer(boys[0], boyInputState.parkerBlocking);
    updateBoyPlayer(boys[1], boyInputState.brennanBlocking);

    // Update particles
    particles = particles.filter(updateParticle);

    // Update popups
    popups = popups.filter(updatePopup);
  }

  function endGame(reason) {
    gameState = "GAME_OVER";
    gameOverReason = reason;
    lastRating = getRating(taxMeter.total);
    AudioEngine.stopMusic();
    if (taxMeter.total >= 6) {
      AudioEngine.playSFX("victory");
    } else {
      AudioEngine.playSFX("game_over");
    }
  }

  function getRating(count) {
    for (const r of RATINGS) {
      if (count >= r.min && count <= r.max) return r.label;
    }
    return "";
  }

  function getState() {
    return gameState;
  }
  function getDad() {
    return dad;
  }
  function getBoys() {
    return boys;
  }
  function getParticles() {
    return particles;
  }
  function getPopups() {
    return popups;
  }
  function getTimer() {
    return timer;
  }
  function getTaxMeter() {
    return taxMeter;
  }
  function getTaxSlices() {
    return taxMeter.slices;
  }
  function getRatingLabel() {
    return lastRating;
  }
  function getGameOverReason() {
    return gameOverReason;
  }

  return {
    init,
    update,
    handleInput,
    getState,
    getDad,
    getBoys,
    getParticles,
    getPopups,
    getTimer,
    getTaxMeter,
    getTaxSlices,
    getRatingLabel,
    getGameOverReason,
    startGame,
    resetGame,
  };
})();

// ============================================================
// AUDIO ENGINE - Web Audio API Chiptune
// ============================================================
const AudioEngine = (function () {
  let ctx = null;
  let masterGain = null;
  let musicPlaying = false;
  let musicNodes = [];
  let musicInterval = null;

  function init() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.35;
    masterGain.connect(ctx.destination);
  }

  function ensureCtx() {
    if (!ctx) init();
    if (ctx.state === "suspended") ctx.resume();
  }

  // ---- INSTRUMENT HELPERS ----
  function playTone(freq, type, duration, volume, startTime) {
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(startTime);
    osc.stop(startTime + duration);
    return { osc, gain };
  }

  function playNoise(duration, volume, startTime) {
    if (!ctx) return;
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    src.connect(gain);
    gain.connect(masterGain);
    src.start(startTime);
    src.stop(startTime + duration);
    return { src, gain };
  }

  // ---- MUSIC: Italian Tarantella-inspired Chiptune ----
  // Notes as frequencies
  const N = {
    C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.00, A3: 220.00, Bb3: 233.08, B3: 246.94,
    C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.00, A4: 440.00, Bb4: 466.16, B4: 493.88,
    C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.00,
    R: 0, // rest
  };

  // Melody: Italian tarantella-style in A minor / C major
  // Fast 6/8 feel at 160 BPM (each beat = 0.375s, eighth = 0.125s at true 160)
  const TEMPO = 160;
  const EIGHTH = 60 / TEMPO / 2; // ~0.1875s

  // Melody pattern - catchy pizza parlor tune (2 bars = 12 eighths each bar for 6/8)
  const melodyA = [
    // Bar 1: Upbeat tarantella figure
    N.A4, N.B4, N.C5, N.E5, N.D5, N.C5,
    N.B4, N.A4, N.G4, N.A4, N.B4, N.C5,
    // Bar 2:
    N.D5, N.E5, N.D5, N.C5, N.B4, N.A4,
    N.G4, N.A4, N.B4, N.A4, N.R, N.A4,
    // Bar 3: Higher excitement
    N.C5, N.D5, N.E5, N.G5, N.E5, N.D5,
    N.C5, N.D5, N.E5, N.C5, N.B4, N.A4,
    // Bar 4: Resolution
    N.B4, N.C5, N.D5, N.C5, N.B4, N.A4,
    N.G4, N.F4, N.E4, N.A4, N.R, N.A4,
  ];

  const melodyB = [
    // Bar 5: Contrast section in C
    N.C5, N.E5, N.G5, N.E5, N.C5, N.E5,
    N.D5, N.F5, N.A5, N.F5, N.D5, N.F5,
    // Bar 6:
    N.E5, N.D5, N.C5, N.B4, N.A4, N.G4,
    N.A4, N.B4, N.C5, N.D5, N.E5, N.D5,
    // Bar 7: Build
    N.C5, N.C5, N.E5, N.E5, N.G5, N.G5,
    N.A5, N.G5, N.E5, N.C5, N.D5, N.E5,
    // Bar 8: Big finish
    N.F5, N.E5, N.D5, N.C5, N.B4, N.A4,
    N.A4, N.C5, N.E5, N.A4, N.R, N.R,
  ];

  const fullMelody = melodyA.concat(melodyB);

  // Bass pattern (plays on beats 1 and 4 of each 6/8 bar)
  const bassPattern = [
    // A minor section (bars 1-4)
    N.A3, N.E3, N.A3, N.E3,
    N.D3, N.A3, N.G3, N.E3,
    N.A3, N.E3, N.C4, N.G3,
    N.D3, N.E3, N.A3, N.A3,
    // C major section (bars 5-8)
    N.C3, N.G3, N.D3, N.A3,
    N.E3, N.G3, N.A3, N.E3,
    N.C3, N.E3, N.G3, N.C3,
    N.F3, N.E3, N.A3, N.A3,
  ];

  let melodyIndex = 0;
  let bassIndex = 0;
  let eigthCount = 0;

  function scheduleMusic() {
    if (!ctx || !musicPlaying) return;
    const now = ctx.currentTime;
    const noteTime = EIGHTH;

    // Melody
    const mNote = fullMelody[melodyIndex % fullMelody.length];
    if (mNote > 0) {
      playTone(mNote, "square", noteTime * 0.85, 0.13, now);
    }
    melodyIndex++;

    // Bass: every 3 eighths (on beats 1 and 4 in 6/8)
    if (eigthCount % 3 === 0) {
      const bNote = bassPattern[bassIndex % bassPattern.length];
      if (bNote > 0) {
        playTone(bNote, "triangle", noteTime * 3 * 0.9, 0.18, now);
      }
      bassIndex++;
    }

    // Percussion pattern (6/8 groove)
    const beatInBar = eigthCount % 6;
    if (beatInBar === 0) {
      // Kick on beat 1
      playTone(60, "triangle", 0.08, 0.2, now);
    } else if (beatInBar === 3) {
      // Kick on beat 4
      playTone(55, "triangle", 0.06, 0.15, now);
    }
    if (beatInBar === 0 || beatInBar === 2 || beatInBar === 3 || beatInBar === 5) {
      // Hi-hat
      playNoise(0.04, 0.06, now);
    }
    if (beatInBar === 1 || beatInBar === 4) {
      // Snare-ish
      playNoise(0.07, 0.09, now);
      playTone(180, "square", 0.03, 0.05, now);
    }

    eigthCount++;
  }

  function playMusic() {
    ensureCtx();
    if (musicPlaying) return;
    musicPlaying = true;
    melodyIndex = 0;
    bassIndex = 0;
    eigthCount = 0;
    musicInterval = setInterval(scheduleMusic, EIGHTH * 1000);
  }

  function stopMusic() {
    musicPlaying = false;
    if (musicInterval) {
      clearInterval(musicInterval);
      musicInterval = null;
    }
  }

  // ---- SOUND EFFECTS ----
  function playSFX(type) {
    ensureCtx();
    const now = ctx.currentTime;

    switch (type) {
      case "grab": {
        // Ascending bright notes
        playTone(440, "square", 0.08, 0.15, now);
        playTone(554, "square", 0.08, 0.15, now + 0.07);
        playTone(659, "square", 0.08, 0.15, now + 0.14);
        playTone(880, "square", 0.12, 0.18, now + 0.21);
        break;
      }
      case "eat": {
        // Crunchy chomps
        for (let i = 0; i < 4; i++) {
          const t = now + i * 0.12;
          playNoise(0.06, 0.12, t);
          playTone(120 + i * 30, "sawtooth", 0.04, 0.06, t);
        }
        break;
      }
      case "blocked": {
        // Descending buzz
        playTone(300, "sawtooth", 0.12, 0.15, now);
        playTone(200, "sawtooth", 0.12, 0.15, now + 0.1);
        playTone(120, "sawtooth", 0.18, 0.12, now + 0.2);
        playNoise(0.15, 0.1, now + 0.05);
        break;
      }
      case "alert": {
        // Sharp beeps
        playTone(880, "square", 0.06, 0.12, now);
        playTone(1100, "square", 0.06, 0.12, now + 0.08);
        break;
      }
      case "game_over": {
        // Sad descending
        playTone(440, "triangle", 0.3, 0.15, now);
        playTone(392, "triangle", 0.3, 0.15, now + 0.3);
        playTone(330, "triangle", 0.3, 0.15, now + 0.6);
        playTone(262, "triangle", 0.5, 0.12, now + 0.9);
        break;
      }
      case "victory": {
        // Triumphant ascending fanfare
        playTone(523, "square", 0.15, 0.15, now);
        playTone(659, "square", 0.15, 0.15, now + 0.15);
        playTone(784, "square", 0.15, 0.15, now + 0.3);
        playTone(1047, "square", 0.3, 0.18, now + 0.45);
        // Harmony
        playTone(392, "triangle", 0.15, 0.1, now + 0.15);
        playTone(523, "triangle", 0.15, 0.1, now + 0.3);
        playTone(659, "triangle", 0.3, 0.12, now + 0.45);
        // Celebration noise
        for (let i = 0; i < 5; i++) {
          playNoise(0.04, 0.06, now + 0.5 + i * 0.08);
        }
        break;
      }
    }
  }

  return {
    init,
    playMusic,
    stopMusic,
    playSFX,
  };
})();

// Initialize engine on load
GameEngine.init();
