import { watchAuthState, signUpWithEmail, signInWithEmail, signInWithGoogle, signOut, handleGoogleRedirect } from './auth.js';
import { submitScore, fetchGlobalLeaderboard, fetchWeeklyLeaderboard, fetchDailyLeaderboard, fetchPersonalScores, isGlobalLeaderboardScore, getUserProfile, updateUserProfile } from './db.js';
import { playFlap, playScore, playDeath, playAchievement, playClick, isSoundEnabled, setSoundEnabled } from './audio.js';
import { ACHIEVEMENTS, checkScoreAchievements, tryEarn, loadEarned } from './achievements.js';

// ── DOM ───────────────────────────────────────────────────────────────────────
const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');

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
const dailyBtn            = document.getElementById('daily-btn');
const startLeaderboardBtn = document.getElementById('start-leaderboard-btn');
const restartBtn          = document.getElementById('restart-btn');
const menuBtn             = document.getElementById('menu-btn');
const leaderboardBtn      = document.getElementById('leaderboard-btn');
const shareBtn            = document.getElementById('share-btn');
const submitInitialsBtn   = document.getElementById('submit-initials-btn');
const closeLeaderboardBtn = document.getElementById('close-leaderboard-btn');
const duckOptions         = document.querySelectorAll('.duck-option');
const diffBtns            = document.querySelectorAll('.diff-btn');

const slotEls = [
  document.getElementById('slot-0'),
  document.getElementById('slot-1'),
  document.getElementById('slot-2'),
];

const userPillName = document.getElementById('user-pill-name');
const userPillBtn  = document.getElementById('user-pill-btn');
const soundBtn     = document.getElementById('sound-btn');

const tabGlobal        = document.getElementById('tab-global');
const tabWeekly        = document.getElementById('tab-weekly');
const tabDaily         = document.getElementById('tab-daily');
const tabPersonal      = document.getElementById('tab-personal');
const lbLoading        = document.getElementById('lb-loading');
const lbPersonalLocked = document.getElementById('lb-personal-locked');
const lbSigninBtn      = document.getElementById('lb-signin-btn');

const startAuthNudge = document.getElementById('start-auth-nudge');
const startAuthLink  = document.getElementById('start-auth-link');
const guestSaveCta   = document.getElementById('guest-save-cta');
const guestSignupBtn = document.getElementById('guest-signup-btn');

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

const profileOverlay        = document.getElementById('profile-overlay');
const profileCloseBtn       = document.getElementById('profile-close-btn');
const profileDuckImg        = document.getElementById('profile-duck-img');
const profileDisplayName    = document.getElementById('profile-display-name');
const profileEmailEl        = document.getElementById('profile-email');
const profileBestScore      = document.getElementById('profile-best-score');
const profileGamesPlayed    = document.getElementById('profile-games-played');
const profileInitialsInput  = document.getElementById('profile-initials-input');
const profileInitialsSave   = document.getElementById('profile-initials-save-btn');
const profileInitialsMsg    = document.getElementById('profile-initials-msg');
const profileNameInput      = document.getElementById('profile-name-input');
const profileNameSave       = document.getElementById('profile-name-save-btn');
const profileNameMsg        = document.getElementById('profile-name-msg');
const profileSignoutBtn     = document.getElementById('profile-signout-btn');
const profileAchievements   = document.getElementById('profile-achievements');

const useSavedInitialsBtn   = document.getElementById('use-saved-initials-btn');
const savedInitialsPreview  = document.getElementById('saved-initials-preview');

const achievementToast      = document.getElementById('achievement-toast');
const achievementToastEmoji = document.getElementById('achievement-toast-emoji');
const achievementToastName  = document.getElementById('achievement-toast-name');

const beatenBanner  = document.getElementById('beaten-banner');
const beatenClose   = document.getElementById('beaten-close');
const dailyBadge    = document.getElementById('daily-badge');
const diffBadge     = document.getElementById('difficulty-badge');

// ── State ─────────────────────────────────────────────────────────────────────
let currentUser          = null;
let gameState            = 'START';
let score                = 0;
let frames               = 0;
let activeLeaderboardTab = 'global';
let isDailyChallenge     = false;
let difficulty           = localStorage.getItem('flappyDuckDifficulty') || 'normal';

// Difficulty presets: { gap, dx }
const DIFF = {
  easy:   { gap: 280, dx: 2.5, label: 'EASY',   color: '#4ade80' },
  normal: { gap: 220, dx: 3.5, label: 'NORMAL',  color: '#ffaa00' },
  hard:   { gap: 155, dx: 5.2, label: 'HARD',    color: '#f87171' },
};

// Seeded RNG (Mulberry32) for daily challenge
let treeRandom = () => Math.random();

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function getDailySeed() {
  const d = new Date();
  return parseInt(
    `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
  );
}

// ── Storage keys ──────────────────────────────────────────────────────────────
const LEADERBOARD_KEY  = 'flappyDuckLeaderboard';
const INITIALS_KEY     = 'flappyDuckInitials';
const DUCK_KEY         = 'flappyDuckSelectedDuck';
const PENDING_KEY      = 'flappyDuckPendingScores';
const TOP10_KEY        = 'flappyDuckWasInTop10';
const MAX_ENTRIES = 10;
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

let localLeaderboard = JSON.parse(localStorage.getItem(LEADERBOARD_KEY) || '[]');
let initialsLetters  = [0, 0, 0];
let activeSlot       = 0;
let pendingScore     = 0;
let newEntryIndex    = -1;

// ── Night mode: pre-generate stable star positions ────────────────────────────
const STARS = Array.from({ length: 35 }, () => ({
  x: Math.random(),
  y: Math.random() * 0.55,
  r: Math.random() * 1.4 + 0.4,
}));

// ── Saved initials helpers ────────────────────────────────────────────────────
function getSavedInitials() {
  return localStorage.getItem(INITIALS_KEY) || null;
}

function persistInitials(initials) {
  localStorage.setItem(INITIALS_KEY, initials);
  if (currentUser && navigator.onLine) {
    updateUserProfile(currentUser.uid, { preferredInitials: initials }).catch(() => {});
  }
}

function refreshUseSavedBtn() {
  const saved = getSavedInitials();
  if (saved && useSavedInitialsBtn) {
    savedInitialsPreview.textContent = saved;
    useSavedInitialsBtn.style.display = '';
  } else if (useSavedInitialsBtn) {
    useSavedInitialsBtn.style.display = 'none';
  }
}

if (useSavedInitialsBtn) {
  useSavedInitialsBtn.addEventListener('click', () => {
    const saved = getSavedInitials();
    if (!saved) return;
    saved.split('').forEach((ch, i) => {
      initialsLetters[i] = Math.max(0, ALPHABET.indexOf(ch.toUpperCase()));
    });
    updateSlotDisplay();
    submitInitials();
  });
}

// ── Toast / notification ──────────────────────────────────────────────────────
let toastTimer = null;

function showAchievementToast(achievement) {
  achievementToastEmoji.textContent = achievement.emoji;
  achievementToastName.textContent  = achievement.name;
  achievementToast.style.display = 'flex';
  achievementToast.classList.add('toast-in');
  playAchievement();
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    achievementToast.classList.remove('toast-in');
    achievementToast.style.display = 'none';
  }, 3200);
}

// Queue multiple achievements and show them sequentially
function showAchievements(list) {
  if (!list.length) return;
  let i = 0;
  function next() {
    if (i >= list.length) return;
    showAchievementToast(list[i++]);
    setTimeout(next, 3600);
  }
  next();
}

// ── "You've been beaten" ──────────────────────────────────────────────────────
async function checkBeaten() {
  if (!currentUser || !navigator.onLine) return;
  if (localStorage.getItem(TOP10_KEY) !== 'true') return;
  try {
    const board = await fetchGlobalLeaderboard(10);
    if (board.length < 10) return;
    const lowestTop = board[9].score;
    const profile   = await getUserProfile(currentUser.uid);
    if (profile?.bestScore && profile.bestScore < lowestTop) {
      beatenBanner.style.display = 'flex';
      localStorage.setItem(TOP10_KEY, 'false');
    }
  } catch { /* non-critical */ }
}

beatenClose.addEventListener('click', () => { beatenBanner.style.display = 'none'; });

// ── Haptic feedback ───────────────────────────────────────────────────────────
function haptic(ms = 12) {
  if (navigator.vibrate) navigator.vibrate(ms);
}

// ── Offline score queue ───────────────────────────────────────────────────────
function queueOfflineScore(data) {
  const q = JSON.parse(localStorage.getItem(PENDING_KEY) || '[]');
  q.push({ ...data, queuedAt: Date.now() });
  localStorage.setItem(PENDING_KEY, JSON.stringify(q));
}

async function flushPendingScores() {
  if (!currentUser || !navigator.onLine) return;
  const all  = JSON.parse(localStorage.getItem(PENDING_KEY) || '[]');
  const mine = all.filter(s => s.uid === currentUser.uid);
  if (!mine.length) return;
  const rest = all.filter(s => s.uid !== currentUser.uid);
  let synced = 0;
  for (const s of mine) {
    try { await submitScore(s); synced++; } catch { rest.push(s); }
  }
  localStorage.setItem(PENDING_KEY, JSON.stringify(rest));
  if (synced) showGenericToast(`${synced} offline score${synced > 1 ? 's' : ''} synced! 🌐`);
}

function showGenericToast(msg) {
  achievementToastEmoji.textContent = '🌐';
  achievementToastName.textContent  = msg;
  achievementToast.style.display = 'flex';
  achievementToast.classList.add('toast-in');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    achievementToast.classList.remove('toast-in');
    achievementToast.style.display = 'none';
  }, 3000);
}

window.addEventListener('online', flushPendingScores);

// ── Share score ───────────────────────────────────────────────────────────────
async function shareScore(s) {
  const text = `I scored ${s} in Flappy Duck! 🦆 Can you beat me?`;
  const url  = 'https://flappyduckdemo.netlify.app/';

  if (navigator.share) {
    // Try with screenshot first, fallback to text-only
    try {
      const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
      const file = new File([blob], 'flappy-duck.png', { type: 'image/png' });
      await navigator.share({ title: 'Flappy Duck', text, files: [file], url });
    } catch {
      try { await navigator.share({ title: 'Flappy Duck', text, url }); } catch { /* cancelled */ }
    }
  } else {
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      showGenericToast('Score link copied! 📋');
    } catch {
      showGenericToast('Share not supported on this browser');
    }
  }
  // Achievement for sharing
  const a = tryEarn('share');
  if (a) showAchievements([a]);
}

shareBtn.addEventListener('click', () => shareScore(score));

// ── Auth state ────────────────────────────────────────────────────────────────
watchAuthState(async user => {
  currentUser = user;
  updateUserPill();
  if (startAuthNudge) startAuthNudge.style.display = user ? 'none' : '';

  if (user && navigator.onLine) {
    try {
      const profile = await getUserProfile(user.uid);
      if (profile?.preferredInitials) {
        localStorage.setItem(INITIALS_KEY, profile.preferredInitials);
        refreshUseSavedBtn();
      }
    } catch { /* non-critical */ }
    flushPendingScores();
  }
});

function updateUserPill() {
  if (currentUser) {
    userPillName.textContent = '🦆 ' + (currentUser.displayName || currentUser.email);
    userPillBtn.textContent  = 'Profile';
  } else {
    userPillName.textContent = '👤 Guest';
    userPillBtn.textContent  = 'Sign In';
  }
}

userPillBtn.addEventListener('click', () => {
  if (currentUser) openProfileModal();
  else openAuthModal('login');
});

if (startAuthLink) startAuthLink.addEventListener('click', () => openAuthModal('signup'));

// ── Sound toggle ──────────────────────────────────────────────────────────────
soundBtn.textContent = isSoundEnabled() ? '🔊' : '🔇';
soundBtn.addEventListener('click', () => {
  const on = !isSoundEnabled();
  setSoundEnabled(on);
  soundBtn.textContent = on ? '🔊' : '🔇';
  if (on) playClick();
});

// ── Difficulty ────────────────────────────────────────────────────────────────
function applyDifficulty(diff) {
  difficulty = diff;
  localStorage.setItem('flappyDuckDifficulty', diff);
  diffBtns.forEach(b => b.classList.toggle('active', b.dataset.diff === diff));
  trees.gap = DIFF[diff].gap;
  trees.dx  = DIFF[diff].dx;
}

diffBtns.forEach(b => {
  b.addEventListener('click', () => { applyDifficulty(b.dataset.diff); playClick(); });
});

applyDifficulty(difficulty);

// ── Auth Modal ────────────────────────────────────────────────────────────────
function openAuthModal(tab = 'signup') {
  authOverlay.style.display = 'flex';
  switchAuthTab(tab);
}

function closeAuthModal() {
  authOverlay.style.display = 'none';
  signupError.style.display = 'none';
  loginError.style.display  = 'none';
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
  const pw    = signupPassword.value;
  const name  = signupName.value.trim();
  signupError.style.display = 'none';
  signupSubmitBtn.disabled = true;
  try {
    await signUpWithEmail(email, pw, name);
    closeAuthModal();
  } catch (err) {
    signupError.textContent   = friendlyAuthError(err.code);
    signupError.style.display = '';
  } finally { signupSubmitBtn.disabled = false; }
});

loginSubmitBtn.addEventListener('click', async () => {
  const email = loginEmail.value.trim();
  const pw    = loginPassword.value;
  loginError.style.display = 'none';
  loginSubmitBtn.disabled = true;
  try {
    await signInWithEmail(email, pw);
    closeAuthModal();
  } catch (err) {
    loginError.textContent   = friendlyAuthError(err.code);
    loginError.style.display = '';
  } finally { loginSubmitBtn.disabled = false; }
});

async function doGoogleSignIn(errorEl) {
  errorEl.style.display = 'none';
  try {
    const user = await signInWithGoogle();
    if (user) closeAuthModal();
  } catch (err) {
    console.error('[Auth] Google sign-in error:', err);
    errorEl.textContent   = friendlyAuthError(err.code);
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
    'auth/invalid-email':        'Invalid email address.',
    'auth/weak-password':        'Password must be at least 6 characters.',
    'auth/user-not-found':       'No account with that email.',
    'auth/wrong-password':       'Incorrect password.',
    'auth/invalid-credential':   'Email or password is incorrect.',
    'auth/too-many-requests':    'Too many attempts. Try again later.',
  };
  return map[code] || 'Something went wrong. Please try again.';
}

// ── Profile Modal ─────────────────────────────────────────────────────────────
async function openProfileModal() {
  profileOverlay.style.display = 'flex';
  profileInitialsMsg.style.display = 'none';
  profileNameMsg.style.display     = 'none';

  // Populate from live Firebase Auth user — no mock data
  profileDisplayName.textContent = currentUser.displayName || currentUser.email;
  profileEmailEl.textContent     = currentUser.email || '—';
  profileDuckImg.src             = '/' + selectedDuckKey;
  profileNameInput.value         = currentUser.displayName || '';

  const saved = getSavedInitials();
  profileInitialsInput.value = saved || '';

  // Load Firestore stats
  profileBestScore.textContent   = '…';
  profileGamesPlayed.textContent = '…';
  if (navigator.onLine) {
    try {
      const profile = await getUserProfile(currentUser.uid);
      profileBestScore.textContent   = profile?.bestScore   ?? 0;
      profileGamesPlayed.textContent = profile?.gamesPlayed ?? 0;
      if (profile?.preferredInitials && !saved) {
        profileInitialsInput.value = profile.preferredInitials;
      }
    } catch {
      profileBestScore.textContent   = '—';
      profileGamesPlayed.textContent = '—';
    }
  } else {
    profileBestScore.textContent   = '—';
    profileGamesPlayed.textContent = '—';
  }

  // Render achievements
  renderProfileAchievements();
}

function renderProfileAchievements() {
  const earned = loadEarned();
  profileAchievements.innerHTML = '';
  ACHIEVEMENTS.forEach(a => {
    const div = document.createElement('div');
    div.className = 'profile-achievement' + (earned.includes(a.id) ? ' earned' : ' locked');
    div.innerHTML = `<span class="ach-emoji">${earned.includes(a.id) ? a.emoji : '🔒'}</span>
                     <span class="ach-name">${a.name}</span>`;
    div.title = a.desc;
    profileAchievements.appendChild(div);
  });
}

function closeProfileModal() {
  profileOverlay.style.display = 'none';
}

profileCloseBtn.addEventListener('click', closeProfileModal);
profileOverlay.addEventListener('click', e => { if (e.target === profileOverlay) closeProfileModal(); });
profileSignoutBtn.addEventListener('click', () => { signOut(); closeProfileModal(); });

profileInitialsSave.addEventListener('click', () => {
  const raw = profileInitialsInput.value.replace(/[^a-zA-Z]/g, '').toUpperCase().padEnd(3, 'A').slice(0, 3);
  profileInitialsInput.value    = raw;
  persistInitials(raw);
  refreshUseSavedBtn();
  profileInitialsMsg.textContent   = '✓ Saved!';
  profileInitialsMsg.style.display = '';
  setTimeout(() => { profileInitialsMsg.style.display = 'none'; }, 2000);
});

profileNameSave.addEventListener('click', async () => {
  const name = profileNameInput.value.trim();
  if (!name) return;
  profileNameSave.disabled = true;
  try {
    const { updateProfile } = await import('firebase/auth');
    await updateProfile(currentUser, { displayName: name });
    await updateUserProfile(currentUser.uid, { displayName: name });
    profileDisplayName.textContent = name;
    userPillName.textContent       = '🦆 ' + name;
    profileNameMsg.textContent     = '✓ Saved!';
    profileNameMsg.style.display   = '';
    setTimeout(() => { profileNameMsg.style.display = 'none'; }, 2000);
  } catch {
    profileNameMsg.textContent     = 'Could not save. Try again.';
    profileNameMsg.style.display   = '';
  } finally { profileNameSave.disabled = false; }
});

// ── Local leaderboard helpers (offline fallback) ──────────────────────────────
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

// ── Initials Entry ────────────────────────────────────────────────────────────
function updateSlotDisplay() {
  slotEls.forEach((el, i) => {
    el.textContent       = ALPHABET[initialsLetters[i]];
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
  if (e.key.length === 1 && /[a-zA-Z]/.test(e.key)) {
    initialsLetters[activeSlot] = ALPHABET.indexOf(e.key.toUpperCase());
    updateSlotDisplay();
    if (activeSlot < 2) { activeSlot++; updateSlotDisplay(); }
  }
});

async function submitInitials() {
  const initials = initialsLetters.map(i => ALPHABET[i]).join('');
  persistInitials(initials);
  refreshUseSavedBtn();

  const scoreData = {
    uid:         currentUser?.uid,
    displayName: currentUser?.displayName || currentUser?.email || 'Guest',
    initials,
    score:       pendingScore,
    isDaily:     isDailyChallenge,
  };

  if (currentUser && navigator.onLine) {
    try {
      await submitScore(scoreData);
      // Flag if they made top 10
      const board = await fetchGlobalLeaderboard(10);
      if (board.some(e => e.uid === currentUser.uid)) {
        localStorage.setItem(TOP10_KEY, 'true');
      }
    } catch {
      queueOfflineScore(scoreData);
    }
  } else if (currentUser) {
    queueOfflineScore(scoreData);
  } else {
    saveLocalEntry(initials, pendingScore);
  }

  // Achievement: daily done
  if (isDailyChallenge) {
    const a = tryEarn('daily_done');
    if (a) setTimeout(() => showAchievements([a]), 500);
  }

  showLeaderboard();
}

submitInitialsBtn.addEventListener('click', submitInitials);

// ── Canvas / Resize ───────────────────────────────────────────────────────────
function resize() {
  canvas.width  = canvas.clientWidth;
  canvas.height = canvas.clientHeight;
}
window.addEventListener('resize', resize);
resize();

// ── Assets ────────────────────────────────────────────────────────────────────
const images = {};
let selectedDuckKey = localStorage.getItem(DUCK_KEY) || 'mallard_duck.png';

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

// Apply saved duck on load
duckOptions.forEach(opt => {
  opt.classList.toggle('selected', opt.getAttribute('data-duck') === selectedDuckKey);
  opt.addEventListener('click', () => {
    duckOptions.forEach(o => o.classList.remove('selected'));
    opt.classList.add('selected');
    selectedDuckKey = opt.getAttribute('data-duck');
    localStorage.setItem(DUCK_KEY, selectedDuckKey);
    playClick();
  });
});

// ── Entities ──────────────────────────────────────────────────────────────────
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
  gravity: 0.4, velocity: 0, jump: -7.5,
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
  flap()  { this.velocity = this.jump; playFlap(); haptic(12); },
  reset() { this.y = canvas.height / 2; this.velocity = 0; },
};

const trees = {
  items: [],
  gap: DIFF[difficulty].gap,
  dx:  DIFF[difficulty].dx,
  width: 130,
  draw() {
    const img = images.tree;
    if (!img || !img.complete) return;
    for (const p of this.items) {
      const scale = this.width / img.width;
      const dh    = img.height * scale;
      const tSy   = Math.floor(img.height / 2);
      const tSh   = 10;

      ctx.save();
      ctx.translate(p.x + this.width / 2, p.topHeight);
      ctx.scale(1, -1);
      ctx.drawImage(img, -this.width / 2, 0, this.width, dh);
      if (dh < p.topHeight)
        ctx.drawImage(img, 0, tSy, img.width, tSh, -this.width / 2, dh - 1, this.width, p.topHeight - dh + 2);
      ctx.restore();

      ctx.save();
      ctx.translate(p.x + this.width / 2, canvas.height - p.bottomHeight);
      ctx.drawImage(img, -this.width / 2, 0, this.width, dh);
      if (dh < p.bottomHeight)
        ctx.drawImage(img, 0, tSy, img.width, tSh, -this.width / 2, dh - 1, this.width, p.bottomHeight - dh + 2);
      ctx.restore();
    }
  },
  update() {
    if (frames % 120 === 0) {
      const min = 50, max = canvas.height - this.gap - min;
      const topH = Math.floor(treeRandom() * (max - min + 1) + min);
      this.items.push({ x: canvas.width, y: 0, topHeight: topH, bottomHeight: canvas.height - this.gap - topH, passed: false });
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
        playScore();
      }
      if (p.x + this.width < 0) { this.items.splice(i, 1); i--; }
    }
  },
  reset() { this.items = []; },
};

// ── Night mode ────────────────────────────────────────────────────────────────
function drawNightOverlay() {
  if (score < 12) return;
  const intensity = Math.min(1, (score - 12) / 35);
  const alpha     = intensity * 0.58;
  ctx.fillStyle   = `rgba(5, 5, 50, ${alpha})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Stars fade in
  if (intensity > 0.25) {
    const starAlpha = ((intensity - 0.25) / 0.75) * 0.85;
    ctx.fillStyle = `rgba(255, 255, 255, ${starAlpha})`;
    for (const s of STARS) {
      ctx.beginPath();
      ctx.arc(s.x * canvas.width, s.y * canvas.height, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// ── Game loop ─────────────────────────────────────────────────────────────────
function draw() {
  ctx.fillStyle = '#70c5ce';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  background.draw();
  trees.draw();
  duck.draw();
  drawNightOverlay();
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

// ── Screen helpers ────────────────────────────────────────────────────────────
function hideAll() {
  [startMenu, inGameUI, gameOverMenu, initialsScreen, leaderboardScreen]
    .forEach(s => s.classList.remove('active'));
}

// ── Game flow ─────────────────────────────────────────────────────────────────
function startGame(daily = false) {
  isDailyChallenge = daily;
  treeRandom = daily ? mulberry32(getDailySeed()) : () => Math.random();

  gameState = 'PLAYING';
  score = 0;
  frames = 0;
  scoreDisplay.innerText = score;
  duck.reset();
  trees.reset();
  hideAll();
  inGameUI.classList.add('active');

  dailyBadge.style.display = daily ? '' : 'none';
  const d = DIFF[difficulty];
  diffBadge.textContent  = difficulty !== 'normal' ? d.label : '';
  diffBadge.style.color  = d.color;
}

async function setGameOver() {
  if (gameState !== 'PLAYING') return;
  gameState = 'GAMEOVER';
  playDeath();
  haptic([30, 20, 60]);

  finalScoreDisplay.innerText = score;
  bestScoreDisplay.innerText  = Math.max(getBestScore(), score);
  if (guestSaveCta) guestSaveCta.style.display = (!currentUser && score > 0) ? '' : 'none';

  hideAll();
  gameOverMenu.classList.add('active');

  // Check achievements
  if (score > 0) {
    const newAchievements = checkScoreAchievements(score, difficulty);
    if (newAchievements.length) showAchievements(newAchievements);
  }

  if (score <= 0) return;

  let qualifies = false;
  if (currentUser && navigator.onLine) {
    qualifies = await isGlobalLeaderboardScore(score).catch(() => isLocalLeaderboardScore(score));
  } else {
    qualifies = isLocalLeaderboardScore(score);
  }

  if (qualifies) {
    setTimeout(() => {
      pendingScore = score;
      activeSlot   = 0;
      const saved  = getSavedInitials();
      if (saved) {
        saved.split('').forEach((ch, i) => { initialsLetters[i] = Math.max(0, ALPHABET.indexOf(ch.toUpperCase())); });
      } else {
        initialsLetters = [0, 0, 0];
      }
      updateSlotDisplay();
      refreshUseSavedBtn();
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
  await checkBeaten();
  await renderLeaderboard();
}

// ── Leaderboard rendering ─────────────────────────────────────────────────────
const LB_TABS = [
  { id: 'tab-global',   tab: 'global'   },
  { id: 'tab-weekly',   tab: 'weekly'   },
  { id: 'tab-daily',    tab: 'daily'    },
  { id: 'tab-personal', tab: 'personal' },
];

async function renderLeaderboard() {
  LB_TABS.forEach(({ id, tab }) => {
    document.getElementById(id)?.classList.toggle('active', tab === activeLeaderboardTab);
  });
  lbPersonalLocked.style.display = 'none';
  leaderboardBody.innerHTML = '';

  if (activeLeaderboardTab === 'personal') {
    if (!currentUser) { lbPersonalLocked.style.display = ''; return; }
    await renderPersonalScores();
    return;
  }
  await renderPublicBoard();
}

async function renderPublicBoard() {
  lbLoading.style.display = '';
  let entries = [];

  if (navigator.onLine) {
    try {
      if (activeLeaderboardTab === 'global')  entries = await fetchGlobalLeaderboard(10);
      if (activeLeaderboardTab === 'weekly')  entries = await fetchWeeklyLeaderboard(10);
      if (activeLeaderboardTab === 'daily')   entries = await fetchDailyLeaderboard(10);
    } catch (err) {
      console.error('[Flappy Duck] Leaderboard query failed:', err);
    }
  }

  lbLoading.style.display = 'none';

  // Offline fallback for global
  if (!entries.length && activeLeaderboardTab === 'global' && localLeaderboard.length) {
    localLeaderboard.forEach((entry, i) => {
      const tr = document.createElement('tr');
      if (i === newEntryIndex) tr.classList.add('new-entry');
      tr.innerHTML = `<td class="lb-rank">${i + 1}</td><td class="lb-name">${entry.initials}</td><td class="lb-score">${entry.score}</td>`;
      leaderboardBody.appendChild(tr);
    });
    return;
  }

  if (!entries.length) {
    leaderboardBody.innerHTML = `<tr><td colspan="3" class="lb-empty">NO SCORES YET<br>BE THE FIRST!</td></tr>`;
    return;
  }

  entries.forEach((entry, i) => {
    const tr = document.createElement('tr');
    if (currentUser && entry.uid === currentUser.uid) tr.classList.add('my-entry');
    tr.innerHTML = `
      <td class="lb-rank">${i + 1}</td>
      <td class="lb-name">${entry.initials || entry.displayName?.slice(0, 3).toUpperCase() || '???'}</td>
      <td class="lb-score">${entry.score}</td>`;
    leaderboardBody.appendChild(tr);
  });
}

async function renderPersonalScores() {
  lbLoading.style.display = '';
  try {
    const entries = await fetchPersonalScores(currentUser.uid, 10);
    lbLoading.style.display = 'none';
    if (!entries.length) {
      leaderboardBody.innerHTML = `<tr><td colspan="3" class="lb-empty">NO SCORES YET<br>PLAY SOME GAMES!</td></tr>`;
      return;
    }
    entries.forEach((entry, i) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td class="lb-rank">${i + 1}</td><td class="lb-name">${entry.initials || '???'}</td><td class="lb-score">${entry.score}</td>`;
      leaderboardBody.appendChild(tr);
    });
  } catch (err) {
    console.error('[Flappy Duck] Personal scores query failed:', err);
    lbLoading.style.display = 'none';
    leaderboardBody.innerHTML = `<tr><td colspan="3" class="lb-empty">INDEX MISSING<br>CHECK CONSOLE</td></tr>`;
  }
}

[tabGlobal, tabWeekly, tabDaily, tabPersonal].forEach(tab => {
  tab?.addEventListener('click', async () => {
    activeLeaderboardTab = tab.dataset.tab;
    await renderLeaderboard();
  });
});

// ── Button wiring ─────────────────────────────────────────────────────────────
startBtn.addEventListener('click',  () => startGame(false));
dailyBtn.addEventListener('click',  () => startGame(true));
restartBtn.addEventListener('click', () => startGame(isDailyChallenge));
menuBtn.addEventListener('click', showMenu);
startLeaderboardBtn.addEventListener('click', () => { newEntryIndex = -1; showLeaderboard(); });
leaderboardBtn.addEventListener('click', () => { newEntryIndex = -1; showLeaderboard(); });
closeLeaderboardBtn.addEventListener('click', () => { newEntryIndex = -1; showMenu(); });

// ── Input (flap) ──────────────────────────────────────────────────────────────
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
refreshUseSavedBtn();
handleGoogleRedirect().then(user => { if (user) closeAuthModal(); });
showMenu();
loop();
