// --- DOM Elements ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const startMenu        = document.getElementById('start-menu');
const inGameUI         = document.getElementById('in-game-ui');
const gameOverMenu     = document.getElementById('game-over-menu');
const initialsScreen   = document.getElementById('initials-screen');
const leaderboardScreen= document.getElementById('leaderboard-screen');

const scoreDisplay     = document.getElementById('score-display');
const finalScoreDisplay= document.getElementById('final-score');
const bestScoreDisplay = document.getElementById('best-score');
const initialsScoreVal = document.getElementById('initials-score-val');
const leaderboardBody  = document.getElementById('leaderboard-body');

const startBtn           = document.getElementById('start-btn');
const restartBtn         = document.getElementById('restart-btn');
const menuBtn            = document.getElementById('menu-btn');
const leaderboardBtn     = document.getElementById('leaderboard-btn');
const submitInitialsBtn  = document.getElementById('submit-initials-btn');
const closeLeaderboardBtn= document.getElementById('close-leaderboard-btn');
const duckOptions        = document.querySelectorAll('.duck-option');

const slotEls = [
  document.getElementById('slot-0'),
  document.getElementById('slot-1'),
  document.getElementById('slot-2'),
];

// --- Leaderboard ---
const LEADERBOARD_KEY = 'flappyDuckLeaderboard';
const MAX_ENTRIES = 10;
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

let leaderboard = JSON.parse(localStorage.getItem(LEADERBOARD_KEY) || '[]');
let initialsLetters = [0, 0, 0]; // indices into ALPHABET
let activeSlot = 0;              // which slot is "focused"
let pendingScore = 0;
let newEntryIndex = -1;          // index of the just-submitted entry

function isLeaderboardScore(s) {
  if (leaderboard.length < MAX_ENTRIES) return true;
  return s > leaderboard[leaderboard.length - 1].score;
}

function getBestScore() {
  return leaderboard.length > 0 ? leaderboard[0].score : 0;
}

function saveLeaderboardEntry(initials, score) {
  leaderboard.push({ initials, score });
  leaderboard.sort((a, b) => b.score - a.score);
  if (leaderboard.length > MAX_ENTRIES) leaderboard = leaderboard.slice(0, MAX_ENTRIES);
  newEntryIndex = leaderboard.findIndex(e => e.initials === initials && e.score === score);
  localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(leaderboard));
}

function renderLeaderboard() {
  leaderboardBody.innerHTML = '';
  if (leaderboard.length === 0) {
    leaderboardBody.innerHTML = `<tr><td colspan="3" class="lb-empty">NO SCORES YET<br>BE THE FIRST!</td></tr>`;
    return;
  }
  leaderboard.forEach((entry, i) => {
    const tr = document.createElement('tr');
    if (i === newEntryIndex) tr.classList.add('new-entry');
    tr.innerHTML = `
      <td class="lb-rank">${i + 1}</td>
      <td class="lb-name">${entry.initials}</td>
      <td class="lb-score">${entry.score}</td>
    `;
    leaderboardBody.appendChild(tr);
  });
}

// --- Initials Entry ---
function updateSlotDisplay() {
  slotEls.forEach((el, i) => {
    el.textContent = ALPHABET[initialsLetters[i]];
    el.style.borderColor = (i === activeSlot) ? '#fff' : '#ffaa00';
    el.style.transform   = (i === activeSlot) ? 'scale(1.12)' : 'scale(1)';
  });
}

function cycleInitial(slot, dir) {
  initialsLetters[slot] = (initialsLetters[slot] + dir + 26) % 26;
  updateSlotDisplay();
}

// Arrow buttons
document.querySelectorAll('.arrow-up').forEach(btn => {
  btn.addEventListener('click', () => {
    const slot = parseInt(btn.getAttribute('data-slot'));
    cycleInitial(slot, 1);
  });
});
document.querySelectorAll('.arrow-down').forEach(btn => {
  btn.addEventListener('click', () => {
    const slot = parseInt(btn.getAttribute('data-slot'));
    cycleInitial(slot, -1);
  });
});

// Clicking a slot focuses it
slotEls.forEach((el, i) => {
  el.addEventListener('click', () => {
    activeSlot = i;
    updateSlotDisplay();
  });
});

// Keyboard controls on initials screen
window.addEventListener('keydown', (e) => {
  if (gameState !== 'INITIALS') return;

  if (e.code === 'ArrowUp')    { e.preventDefault(); cycleInitial(activeSlot,  1); }
  if (e.code === 'ArrowDown')  { e.preventDefault(); cycleInitial(activeSlot, -1); }
  if (e.code === 'ArrowRight' || e.code === 'Tab') {
    e.preventDefault();
    activeSlot = Math.min(2, activeSlot + 1);
    updateSlotDisplay();
  }
  if (e.code === 'ArrowLeft') {
    e.preventDefault();
    activeSlot = Math.max(0, activeSlot - 1);
    updateSlotDisplay();
  }
  if (e.code === 'Enter') {
    e.preventDefault();
    submitInitials();
  }
  // Letter keys directly set the current slot
  if (e.key.length === 1 && e.key.match(/[a-zA-Z]/)) {
    initialsLetters[activeSlot] = ALPHABET.indexOf(e.key.toUpperCase());
    updateSlotDisplay();
    if (activeSlot < 2) { activeSlot++; updateSlotDisplay(); }
  }
});

function submitInitials() {
  const initials = initialsLetters.map(i => ALPHABET[i]).join('');
  saveLeaderboardEntry(initials, pendingScore);
  showLeaderboard();
}

submitInitialsBtn.addEventListener('click', submitInitials);

// --- Game State & Constants ---
let gameState = 'START'; // START, PLAYING, GAMEOVER, INITIALS, LEADERBOARD
let score = 0;
let frames = 0;

// Canvas resizing
function resize() {
  canvas.width  = canvas.clientWidth;
  canvas.height = canvas.clientHeight;
}
window.addEventListener('resize', resize);
resize();

// --- Assets ---
const images = {};
let selectedDuckKey = 'mallard_duck.png';

function loadImage(name, src) {
  const img = new Image();
  img.src = src;
  images[name] = img;
}

loadImage('mallard', '/mallard_duck.png');
loadImage('white',   '/white_duck.png');
loadImage('rubber',  '/rubber_duck.png');
loadImage('tree',    '/tree_obstacle.png');
loadImage('bg',      '/lake_background.png');

// Map filename -> loaded image key
const duckKeyMap = {
  'mallard_duck.png': 'mallard',
  'white_duck.png':   'white',
  'rubber_duck.png':  'rubber'
};

// --- Character Selection ---
duckOptions.forEach(option => {
  option.addEventListener('click', () => {
    duckOptions.forEach(opt => opt.classList.remove('selected'));
    option.classList.add('selected');
    selectedDuckKey = option.getAttribute('data-duck');
  });
});

// --- Entities ---

const background = {
  x: 0, y: 0, width: 0, height: 0, speed: 1,
  draw() {
    if (!images.bg.complete) return;
    const ratio = images.bg.width / images.bg.height;
    this.height = canvas.height;
    this.width  = canvas.height * ratio;
    ctx.drawImage(images.bg, this.x,               this.y, this.width, this.height);
    ctx.drawImage(images.bg, this.x + this.width,  this.y, this.width, this.height);
  },
  update() {
    if (gameState === 'PLAYING') {
      this.x = (this.x - this.speed) % this.width;
    }
  }
};

const duck = {
  x: 50, y: 150, width: 75, height: 75,
  gravity: 0.4, velocity: 0, jump: -7.5, radius: 15,
  draw() {
    const imgKey = duckKeyMap[selectedDuckKey];
    const img = images[imgKey];
    if (!img || !img.complete) return;
    ctx.save();
    ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
    let rotation = Math.min(Math.PI / 4, Math.max(-Math.PI / 4, this.velocity * 0.1));
    ctx.rotate(rotation);
    const scale = Math.min(this.width / img.width, this.height / img.height);
    ctx.drawImage(img, -img.width * scale / 2, -img.height * scale / 2, img.width * scale, img.height * scale);
    ctx.restore();
  },
  update() {
    this.velocity += this.gravity;
    this.y += this.velocity;
    if (this.y + this.height >= canvas.height) { this.y = canvas.height - this.height; setGameOver(); }
    if (this.y <= 0) { this.y = 0; this.velocity = 0; }
  },
  flap()  { this.velocity = this.jump; },
  reset() { this.y = canvas.height / 2; this.velocity = 0; }
};

const trees = {
  items: [], width: 130, gap: 220, dx: 3.5,
  draw() {
    const img = images.tree;
    if (!img || !img.complete) return;
    for (let i = 0; i < this.items.length; i++) {
      let p = this.items[i];
      const scale = this.width / img.width;
      const drawnHeight = img.height * scale;
      const trunkSy = Math.floor(img.height / 2);
      const trunkSh = 10;

      // Top tree (flipped)
      ctx.save();
      ctx.translate(p.x + this.width / 2, p.topHeight);
      ctx.scale(1, -1);
      ctx.drawImage(img, -this.width / 2, 0, this.width, drawnHeight);
      if (drawnHeight < p.topHeight) {
        ctx.drawImage(img, 0, trunkSy, img.width, trunkSh,
                      -this.width / 2, drawnHeight - 1, this.width, p.topHeight - drawnHeight + 2);
      }
      ctx.restore();

      // Bottom tree
      ctx.save();
      ctx.translate(p.x + this.width / 2, canvas.height - p.bottomHeight);
      ctx.drawImage(img, -this.width / 2, 0, this.width, drawnHeight);
      if (drawnHeight < p.bottomHeight) {
        ctx.drawImage(img, 0, trunkSy, img.width, trunkSh,
                      -this.width / 2, drawnHeight - 1, this.width, p.bottomHeight - drawnHeight + 2);
      }
      ctx.restore();
    }
  },
  update() {
    if (frames % 120 === 0) {
      const minHeight = 50;
      const maxHeight = canvas.height - this.gap - minHeight;
      const topHeight = Math.floor(Math.random() * (maxHeight - minHeight + 1) + minHeight);
      this.items.push({ x: canvas.width, y: 0, topHeight, bottomHeight: canvas.height - this.gap - topHeight, passed: false });
    }
    for (let i = 0; i < this.items.length; i++) {
      let p = this.items[i];
      p.x -= this.dx;

      const duckHitbox   = { left: duck.x + 20, right: duck.x + duck.width - 20, top: duck.y + 20, bottom: duck.y + duck.height - 20 };
      const treePadding  = 30;

      if (duckHitbox.right > p.x + treePadding && duckHitbox.left < p.x + this.width - treePadding && duckHitbox.top < p.y + p.topHeight) setGameOver();
      if (duckHitbox.right > p.x + treePadding && duckHitbox.left < p.x + this.width - treePadding && duckHitbox.bottom > canvas.height - p.bottomHeight) setGameOver();

      if (p.x + this.width < duck.x && !p.passed) {
        score++;
        scoreDisplay.innerText = score;
        p.passed = true;
      }
      if (p.x + this.width < 0) { this.items.shift(); i--; }
    }
  },
  reset() { this.items = []; }
};

// --- Game Logic ---
function draw() {
  ctx.fillStyle = '#70c5ce';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  background.draw();
  trees.draw();
  duck.draw();
}

function update() {
  background.update();
  if (gameState === 'PLAYING') {
    duck.update();
    trees.update();
    frames++;
  }
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

// --- Screen helpers ---
function hideAll() {
  [startMenu, inGameUI, gameOverMenu, initialsScreen, leaderboardScreen]
    .forEach(s => s.classList.remove('active'));
}

// --- Control Functions ---
function startGame() {
  gameState = 'PLAYING';
  score = 0;
  frames = 0;
  scoreDisplay.innerText = score;
  duck.reset();
  trees.reset();
  hideAll();
  inGameUI.classList.add('active');
}

function setGameOver() {
  if (gameState !== 'PLAYING') return; // prevent double trigger
  gameState = 'GAMEOVER';

  const best = getBestScore();
  finalScoreDisplay.innerText = score;
  bestScoreDisplay.innerText  = Math.max(best, score);

  hideAll();
  gameOverMenu.classList.add('active');

  // Check if this score makes the leaderboard
  if (score > 0 && isLeaderboardScore(score)) {
    // Short delay so game-over shows briefly, then transition to initials
    setTimeout(() => {
      pendingScore = score;
      initialsLetters = [0, 0, 0];
      activeSlot = 0;
      updateSlotDisplay();
      initialsScoreVal.innerText = score;
      hideAll();
      gameState = 'INITIALS';
      initialsScreen.classList.add('active');
    }, 900);
  }
}

function showMenu() {
  gameState = 'START';
  newEntryIndex = -1;
  hideAll();
  startMenu.classList.add('active');
  duck.reset();
  trees.reset();
  score = 0;
  frames = 0;
}

function showLeaderboard(fromGameOver = false) {
  gameState = 'LEADERBOARD';
  renderLeaderboard();
  hideAll();
  leaderboardScreen.classList.add('active');
}

// --- Button Wiring ---
startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);
menuBtn.addEventListener('click', showMenu);
leaderboardBtn.addEventListener('click', () => {
  newEntryIndex = -1;
  showLeaderboard();
});
closeLeaderboardBtn.addEventListener('click', () => {
  newEntryIndex = -1;
  showMenu();
});

// --- Input (flap) ---
function handleInput(e) {
  if (e.type === 'touchstart' && e.target === canvas) e.preventDefault();
  if (gameState === 'PLAYING') duck.flap();
}

canvas.addEventListener('mousedown', handleInput);
canvas.addEventListener('touchstart', handleInput, { passive: false });
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && gameState === 'PLAYING') {
    e.preventDefault();
    handleInput(e);
  }
});

// --- Boot ---
showMenu();
loop();
