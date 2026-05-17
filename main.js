import { watchAuthState, signUpWithEmail, signInWithEmail, signInWithGoogle, signOut, handleGoogleRedirect } from './auth.js';
import { submitScore, fetchGlobalLeaderboard, fetchPersonalScores, isGlobalLeaderboardScore } from './db.js';

// --- DOM Elements ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const startMenu         = document.getElementById('start-menu');
const inGameUI          = document.getElementById('in-game-ui');
const gameOverMenu      = document.getElementById('game-over-menu');
const initialsScreen    = document.getElementById('initials-screen');
const leaderboardScreen = document.getElementById('leaderboard-screen');

const scoreDisplay      = document.getElementById('score-display');
const finalScoreDisplay = document.getElementById('final-score');
const bestScoreDisplay  = document.getElementById('best-score');
const initialsScoreVal  = document.getElementById('initials-score-val');
const leaderboardBody   = document.getElementById('leaderboard-body');

const startBtn            = document.getElementById('start-btn');
const startLeaderboardBtn = document.getElementById('start-leaderboard-btn');
const restartBtn          = document.getElementById('restart-btn');
const menuBtn             = document.getElementById('menu-btn');
const leaderboardBtn      = document.getElementById('leaderboard-btn');
const submitInitialsBtn   = document.getElementById('submit-initials-btn');
const closeLeaderboardBtn = document.getElementById('close-leaderboard-btn');
const duckOptions         = document.querySelectorAll('.duck-option');

const slotEls = [
  document.getElementById('slot-0'),
  document.getElementById('slot-1'),
  document.getElementById('slot-2'),
];

// User pill
const userPillName = document.getElementById('user-pill-name');
const userPillBtn  = document.getElementById('user-pill-btn');

// Leaderboard tabs / loading
const tabGlobal        = document.getElementById('tab-global');
const tabPersonal      = document.getElementById('tab-personal');
const lbLoading        = document.getElementById('lb-loading');
const lbPersonalLocked = document.getElementById('lb-personal-locked');
const lbSigninBtn      = document.getElementById('lb-signin-btn');

// Start menu auth nudge
const startAuthNudge = document.getElementById('start-auth-nudge');
const startAuthLink  = document.getElementById('start-auth-link');

// Game over guest CTA
const guestSaveCta  = document.getElementById('guest-save-cta');
const guestSignupBtn = document.getElementById('guest-signup-btn');

// Auth overlay
const authOverlay    = document.getElementById('auth-overlay');
const authCloseBtn   = document.getElementById('auth-close-btn');
const authTabs       = document.querySelectorAll('.auth-tab');

const signupEmail     = document.getElementById('signup-email');
const signupName      = document.getElementById('signup-name');
const signupPassword  = document.getElementById('signup-password');
const signupError     = document.getElementById('signup-error');
const signupSubmitBtn = document.getElementById('signup-submit-btn');
const googleSignupBtn = document.getElementById('google-signup-btn');

const loginEmail     = document.getElementById('login-email');
const loginPassword  = document.getElementById('login-password');
const loginError     = document.getElementById('login-error');
const loginSubmitBtn = document.getElementById('login-submit-btn');
const googleLoginBtn = document.getElementById('google-login-btn');

// --- State ---
let currentUser = null;
let gameState = 'START';
let score = 0;
let frames = 0;
let activeLeaderboardTab = 'global';

// --- Local fallback leaderboard ---
const LEADERBOARD_KEY = 'flappyDuckLeaderboard';
const MAX_ENTRIES = 10;
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

let localLeaderboard = JSON.parse(localStorage.getItem(LEADERBOARD_KEY) || '[]');
let initialsLetters = [0, 0, 0];
let activeSlot = 0;
let pendingScore = 0;
let newEntryIndex = -1;

// ── Auth State ───────────────────────────────────────────────────────────────

watchAuthState(user => {
  currentUser = user;
  updateUserPill();
  if (startAuthNudge) startAuthNudge.style.display = user ? 'none' : '';
});

function updateUserPill() {
  if (currentUser) {
    userPillName.textContent = '🦆 ' + (currentUser.displayName || currentUser.email);
    userPillBtn.textContent = 'Sign Out';
  } else {
    userPillName.textContent = '👤 Guest';
    userPillBtn.textContent = 'Sign In';
  }
}

userPillBtn.addEventListener('click', () => {
  if (currentUser) signOut();
  else openAuthModal('login');
});

if (startAuthLink) startAuthLink.addEventListener('click', () => openAuthModal('signup'));

// ── Auth Modal ───────────────────────────────────────────────────────────────

function openAuthModal(tab = 'signup') {
  authOverlay.style.display = 'flex';
  switchAuthTab(tab);
}

function closeAuthModal() {
  authOverlay.style.display = 'none';
  signupError.style.display = 'none';
  loginError.style.display = 'none';
  signupEmail.value = '';
  signupPassword.value = '';
  signupName.value = '';
  loginEmail.value = '';
  loginPassword.value = '';
}

authCloseBtn.addEventListener('click', closeAuthModal);
authOverlay.addEventListener('click', e => { if (e.target === authOverlay) closeAuthModal(); });

function switchAuthTab(tab) {
  authTabs.forEach(t => t.classList.toggle('active', t.dataset.authTab === tab));
  document.querySelectorAll('.auth-panel').forEach(p => {
    p.classList.toggle('active', p.id === `auth-panel-${tab}`);
  });
}

authTabs.forEach(t => t.addEventListener('click', () => switchAuthTab(t.dataset.authTab)));

signupSubmitBtn.addEventListener('click', async () => {
  const email = signupEmail.value.trim();
  const password = signupPassword.value;
  const name = signupName.value.trim();
  signupError.style.display = 'none';
  signupSubmitBtn.disabled = true;
  try {
    await signUpWithEmail(email, password, name);
    closeAuthModal();
  } catch (err) {
    signupError.textContent = friendlyAuthError(err.code);
    signupError.style.display = '';
  } finally {
    signupSubmitBtn.disabled = false;
  }
});

loginSubmitBtn.addEventListener('click', async () => {
  const email = loginEmail.value.trim();
  const password = loginPassword.value;
  loginError.style.display = 'none';
  loginSubmitBtn.disabled = true;
  try {
    await signInWithEmail(email, password);
    closeAuthModal();
  } catch (err) {
    loginError.textContent = friendlyAuthError(err.code);
    loginError.style.display = '';
  } finally {
    loginSubmitBtn.disabled = false;
  }
});

async function doGoogleSignIn(errorEl) {
  errorEl.style.display = 'none';
  try {
    const user = await signInWithGoogle();
    if (user) closeAuthModal(); // null = redirect in progress, modal stays hidden by redirect
  } catch (err) {
    console.error('[Auth] Google sign-in error:', err);
    errorEl.textContent = friendlyAuthError(err.code);
    errorEl.style.display = '';
  }
}

googleSignupBtn.addEventListener('click', () => doGoogleSignIn(signupError));
googleLoginBtn.addEventListener('click',  () => doGoogleSignIn(loginError));

if (guestSignupBtn) guestSignupBtn.addEventListener('click', () => openAuthModal('signup'));
if (lbSigninBtn)    lbSigninBtn.addEventListener('click', () => openAuthModal('login'));

function friendlyAuthError(code) {
  const map = {
    'auth/email-already-in-use': 'That email is already taken.',
    'auth/invalid-email': 'Invalid email address.',
    'auth/weak-password': 'Password must be at least 6 characters.',
    'auth/user-not-found': 'No account with that email.',
    'auth/wrong-password': 'Incorrect password.',
    'auth/invalid-credential': 'Email or password is incorrect.',
    'auth/too-many-requests': 'Too many attempts. Try again later.',
  };
  return map[code] || 'Something went wrong. Please try again.';
}

// ── Local Leaderboard Helpers (offline fallback) ─────────────────────────────

function isLocalLeaderboardScore(s) {
  if (localLeaderboard.length < MAX_ENTRIES) return true;
  return s > localLeaderboard[localLeaderboard.length - 1].score;
}

function getBestScore() {
  return localLeaderboard.length > 0 ? localLeaderboard[0].score : 0;
}

function saveLocalEntry(initials, s) {
  localLeaderboard.push({ initials, score: s });
  localLeaderboard.sort((a, b) => b.score - a.score);
  if (localLeaderboard.length > MAX_ENTRIES) localLeaderboard = localLeaderboard.slice(0, MAX_ENTRIES);
  newEntryIndex = localLeaderboard.findIndex(e => e.initials === initials && e.score === s);
  localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(localLeaderboard));
}

// ── Initials Entry ───────────────────────────────────────────────────────────

function updateSlotDisplay() {
  slotEls.forEach((el, i) => {
    el.textContent = ALPHABET[initialsLetters[i]];
    el.style.borderColor = i === activeSlot ? '#fff' : '#ffaa00';
    el.style.transform   = i === activeSlot ? 'scale(1.12)' : 'scale(1)';
  });
}

function cycleInitial(slot, dir) {
  initialsLetters[slot] = (initialsLetters[slot] + dir + 26) % 26;
  updateSlotDisplay();
}

document.querySelectorAll('.arrow-up').forEach(btn => {
  btn.addEventListener('click', () => cycleInitial(parseInt(btn.dataset.slot), 1));
});
document.querySelectorAll('.arrow-down').forEach(btn => {
  btn.addEventListener('click', () => cycleInitial(parseInt(btn.dataset.slot), -1));
});

slotEls.forEach((el, i) => {
  el.addEventListener('click', () => { activeSlot = i; updateSlotDisplay(); });
});

window.addEventListener('keydown', e => {
  if (gameState !== 'INITIALS') return;
  if (e.code === 'ArrowUp')   { e.preventDefault(); cycleInitial(activeSlot, 1); }
  if (e.code === 'ArrowDown') { e.preventDefault(); cycleInitial(activeSlot, -1); }
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
  if (e.code === 'Enter') { e.preventDefault(); submitInitials(); }
  if (e.key.length === 1 && e.key.match(/[a-zA-Z]/)) {
    initialsLetters[activeSlot] = ALPHABET.indexOf(e.key.toUpperCase());
    updateSlotDisplay();
    if (activeSlot < 2) { activeSlot++; updateSlotDisplay(); }
  }
});

async function submitInitials() {
  const initials = initialsLetters.map(i => ALPHABET[i]).join('');

  if (currentUser && navigator.onLine) {
    try {
      await submitScore({
        uid: currentUser.uid,
        displayName: currentUser.displayName || currentUser.email,
        initials,
        score: pendingScore,
      });
    } catch {
      saveLocalEntry(initials, pendingScore);
    }
  } else {
    saveLocalEntry(initials, pendingScore);
  }

  showLeaderboard();
}

submitInitialsBtn.addEventListener('click', submitInitials);

// ── Canvas / Resize ──────────────────────────────────────────────────────────

function resize() {
  canvas.width  = canvas.clientWidth;
  canvas.height = canvas.clientHeight;
}
window.addEventListener('resize', resize);
resize();

// ── Assets ───────────────────────────────────────────────────────────────────

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

const duckKeyMap = {
  'mallard_duck.png': 'mallard',
  'white_duck.png':   'white',
  'rubber_duck.png':  'rubber',
};

duckOptions.forEach(option => {
  option.addEventListener('click', () => {
    duckOptions.forEach(opt => opt.classList.remove('selected'));
    option.classList.add('selected');
    selectedDuckKey = option.getAttribute('data-duck');
  });
});

// ── Entities ─────────────────────────────────────────────────────────────────

const background = {
  x: 0, y: 0, width: 0, height: 0, speed: 1,
  draw() {
    if (!images.bg.complete) return;
    const ratio = images.bg.width / images.bg.height;
    this.height = canvas.height;
    this.width  = canvas.height * ratio;
    ctx.drawImage(images.bg, this.x,              this.y, this.width, this.height);
    ctx.drawImage(images.bg, this.x + this.width, this.y, this.width, this.height);
  },
  update() {
    if (gameState === 'PLAYING') this.x = (this.x - this.speed) % this.width;
  },
};

const duck = {
  x: 50, y: 150, width: 75, height: 75,
  gravity: 0.4, velocity: 0, jump: -7.5, radius: 15,
  draw() {
    const img = images[duckKeyMap[selectedDuckKey]];
    if (!img || !img.complete) return;
    ctx.save();
    ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
    ctx.rotate(Math.min(Math.PI / 4, Math.max(-Math.PI / 4, this.velocity * 0.1)));
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
  reset() { this.y = canvas.height / 2; this.velocity = 0; },
};

const trees = {
  items: [], width: 130, gap: 220, dx: 3.5,
  draw() {
    const img = images.tree;
    if (!img || !img.complete) return;
    for (const p of this.items) {
      const scale = this.width / img.width;
      const drawnHeight = img.height * scale;
      const trunkSy = Math.floor(img.height / 2);
      const trunkSh = 10;

      ctx.save();
      ctx.translate(p.x + this.width / 2, p.topHeight);
      ctx.scale(1, -1);
      ctx.drawImage(img, -this.width / 2, 0, this.width, drawnHeight);
      if (drawnHeight < p.topHeight) {
        ctx.drawImage(img, 0, trunkSy, img.width, trunkSh,
                      -this.width / 2, drawnHeight - 1, this.width, p.topHeight - drawnHeight + 2);
      }
      ctx.restore();

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
      const p = this.items[i];
      p.x -= this.dx;

      const dh = { left: duck.x + 20, right: duck.x + duck.width - 20, top: duck.y + 20, bottom: duck.y + duck.height - 20 };
      const tp = 30;

      if (dh.right > p.x + tp && dh.left < p.x + this.width - tp && dh.top < p.topHeight) setGameOver();
      if (dh.right > p.x + tp && dh.left < p.x + this.width - tp && dh.bottom > canvas.height - p.bottomHeight) setGameOver();

      if (p.x + this.width < duck.x && !p.passed) {
        score++;
        scoreDisplay.innerText = score;
        p.passed = true;
      }
      if (p.x + this.width < 0) { this.items.splice(i, 1); i--; }
    }
  },
  reset() { this.items = []; },
};

// ── Game Loop ─────────────────────────────────────────────────────────────────

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

// ── Screen Helpers ────────────────────────────────────────────────────────────

function hideAll() {
  [startMenu, inGameUI, gameOverMenu, initialsScreen, leaderboardScreen]
    .forEach(s => s.classList.remove('active'));
}

// ── Game Flow ─────────────────────────────────────────────────────────────────

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

async function setGameOver() {
  if (gameState !== 'PLAYING') return;
  gameState = 'GAMEOVER';

  finalScoreDisplay.innerText = score;
  bestScoreDisplay.innerText  = Math.max(getBestScore(), score);

  if (guestSaveCta) guestSaveCta.style.display = (!currentUser && score > 0) ? '' : 'none';

  hideAll();
  gameOverMenu.classList.add('active');

  if (score <= 0) return;

  // Check if score qualifies for leaderboard (Firebase or local fallback)
  let qualifies = false;
  if (currentUser && navigator.onLine) {
    qualifies = await isGlobalLeaderboardScore(score).catch(() => isLocalLeaderboardScore(score));
  } else {
    qualifies = isLocalLeaderboardScore(score);
  }

  if (qualifies) {
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

async function showLeaderboard() {
  gameState = 'LEADERBOARD';
  hideAll();
  leaderboardScreen.classList.add('active');
  await renderLeaderboard();
}

// ── Leaderboard ───────────────────────────────────────────────────────────────

async function renderLeaderboard() {
  const isGlobal = activeLeaderboardTab === 'global';
  tabGlobal.classList.toggle('active', isGlobal);
  tabPersonal.classList.toggle('active', !isGlobal);
  lbPersonalLocked.style.display = 'none';
  leaderboardBody.innerHTML = '';

  if (!isGlobal) {
    if (!currentUser) {
      lbPersonalLocked.style.display = '';
      return;
    }
    await renderPersonalScores();
    return;
  }

  await renderGlobalScores();
}

async function renderGlobalScores() {
  lbLoading.style.display = '';

  if (navigator.onLine) {
    try {
      const entries = await fetchGlobalLeaderboard(10);
      lbLoading.style.display = 'none';
      if (entries.length === 0) {
        leaderboardBody.innerHTML = `<tr><td colspan="3" class="lb-empty">NO SCORES YET<br>BE THE FIRST!</td></tr>`;
        return;
      }
      entries.forEach((entry, i) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="lb-rank">${i + 1}</td>
          <td class="lb-name">${entry.initials || entry.displayName?.slice(0, 3).toUpperCase() || '???'}</td>
          <td class="lb-score">${entry.score}</td>
        `;
        leaderboardBody.appendChild(tr);
      });
      return;
    } catch { /* fallthrough to local */ }
  }

  // Offline fallback
  lbLoading.style.display = 'none';
  if (localLeaderboard.length === 0) {
    leaderboardBody.innerHTML = `<tr><td colspan="3" class="lb-empty">NO SCORES YET<br>BE THE FIRST!</td></tr>`;
    return;
  }
  localLeaderboard.forEach((entry, i) => {
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

async function renderPersonalScores() {
  lbLoading.style.display = '';
  try {
    const entries = await fetchPersonalScores(currentUser.uid, 10);
    lbLoading.style.display = 'none';
    if (entries.length === 0) {
      leaderboardBody.innerHTML = `<tr><td colspan="3" class="lb-empty">NO SCORES YET<br>PLAY SOME GAMES!</td></tr>`;
      return;
    }
    entries.forEach((entry, i) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="lb-rank">${i + 1}</td>
        <td class="lb-name">${entry.initials || '???'}</td>
        <td class="lb-score">${entry.score}</td>
      `;
      leaderboardBody.appendChild(tr);
    });
  } catch (err) {
    // Log so Firestore prints the index-creation link in the browser console
    console.error('[Flappy Duck] Personal scores query failed:', err);
    lbLoading.style.display = 'none';
    leaderboardBody.innerHTML = `<tr><td colspan="3" class="lb-empty">INDEX MISSING<br>CHECK CONSOLE</td></tr>`;
  }
}

tabGlobal.addEventListener('click', async () => {
  activeLeaderboardTab = 'global';
  await renderLeaderboard();
});
tabPersonal.addEventListener('click', async () => {
  activeLeaderboardTab = 'personal';
  await renderLeaderboard();
});

// ── Button Wiring ─────────────────────────────────────────────────────────────

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);
menuBtn.addEventListener('click', showMenu);
startLeaderboardBtn.addEventListener('click', () => { newEntryIndex = -1; showLeaderboard(); });
leaderboardBtn.addEventListener('click', () => { newEntryIndex = -1; showLeaderboard(); });
closeLeaderboardBtn.addEventListener('click', () => { newEntryIndex = -1; showMenu(); });

// ── Input ─────────────────────────────────────────────────────────────────────

function handleInput(e) {
  if (e.type === 'touchstart' && e.target === canvas) e.preventDefault();
  if (gameState === 'PLAYING') duck.flap();
}

canvas.addEventListener('mousedown', handleInput);
canvas.addEventListener('touchstart', handleInput, { passive: false });
window.addEventListener('keydown', e => {
  if (e.code === 'Space' && gameState === 'PLAYING') { e.preventDefault(); handleInput(e); }
});

// ── Boot ──────────────────────────────────────────────────────────────────────
// Handle Google redirect result (mobile sign-in returns here after redirect)
handleGoogleRedirect().then(user => { if (user) closeAuthModal(); });

showMenu();
loop();
