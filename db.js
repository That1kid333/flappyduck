// db.js — Firestore leaderboard and user profile operations
import {
  collection, addDoc, getDocs, getDoc, setDoc, doc,
  query, orderBy, limit, serverTimestamp, where,
} from 'firebase/firestore';
import { db } from './firebase.js';

const LEADERBOARD_COL        = 'leaderboard';
const LEADERBOARD_WEEKLY_COL = 'leaderboard_weekly';
const LEADERBOARD_DAILY_COL  = 'leaderboard_daily';
const USERS_COL              = 'users';

// ── Time helpers ─────────────────────────────────────────────────
export function getDailyKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function getWeekKey() {
  const d = new Date();
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

// ── User Profiles ────────────────────────────────────────────────
export async function createUserProfile(uid, data) {
  await setDoc(doc(db, USERS_COL, uid), {
    email:       data.email,
    displayName: data.displayName,
    bestScore:   0,
    gamesPlayed: 0,
    createdAt:   serverTimestamp(),
  });
}

export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, USERS_COL, uid));
  return snap.exists() ? snap.data() : null;
}

export async function updateUserProfile(uid, data) {
  await setDoc(doc(db, USERS_COL, uid), data, { merge: true });
}

// ── Score submission ─────────────────────────────────────────────
// Submits to global + weekly. Pass isDaily=true to also write daily collection.
export async function submitScore({ uid, displayName, initials, score, isDaily = false }) {
  const base = { uid, displayName, initials, score, createdAt: serverTimestamp() };

  // Global all-time leaderboard
  await addDoc(collection(db, LEADERBOARD_COL), base);

  // Weekly leaderboard
  await addDoc(collection(db, LEADERBOARD_WEEKLY_COL), { ...base, weekKey: getWeekKey() });

  // Daily leaderboard (only for daily challenge)
  if (isDaily) {
    await addDoc(collection(db, LEADERBOARD_DAILY_COL), { ...base, date: getDailyKey() });
  }

  // Update personal best in user profile
  const profile = await getUserProfile(uid);
  const updates = { gamesPlayed: (profile?.gamesPlayed || 0) + 1 };
  if (score > (profile?.bestScore || 0)) updates.bestScore = score;
  await updateUserProfile(uid, updates);
}

// ── Leaderboard reads ────────────────────────────────────────────
export async function fetchGlobalLeaderboard(topN = 10) {
  const q = query(
    collection(db, LEADERBOARD_COL),
    orderBy('score', 'desc'),
    limit(topN)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function fetchWeeklyLeaderboard(topN = 10) {
  const q = query(
    collection(db, LEADERBOARD_WEEKLY_COL),
    where('weekKey', '==', getWeekKey()),
    orderBy('score', 'desc'),
    limit(topN)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function fetchDailyLeaderboard(topN = 10) {
  const q = query(
    collection(db, LEADERBOARD_DAILY_COL),
    where('date', '==', getDailyKey()),
    orderBy('score', 'desc'),
    limit(topN)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function fetchPersonalScores(uid, topN = 10) {
  const q = query(
    collection(db, LEADERBOARD_COL),
    where('uid', '==', uid),
    orderBy('score', 'desc'),
    limit(topN)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ── Utility ──────────────────────────────────────────────────────
export async function isGlobalLeaderboardScore(score, topN = 10) {
  const board = await fetchGlobalLeaderboard(topN);
  if (board.length < topN) return true;
  return score > board[board.length - 1].score;
}
