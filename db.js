// db.js — Firestore leaderboard and user profile operations
import {
  collection, addDoc, getDocs, getDoc, setDoc, doc,
  query, orderBy, limit, serverTimestamp, where,
} from 'firebase/firestore';
import { db } from './firebase.js';

const LEADERBOARD_COL = 'leaderboard';
const USERS_COL       = 'users';
const MAX_GLOBAL      = 100;

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

// ── Leaderboard Writes ───────────────────────────────────────────
export async function submitScore({ uid, displayName, initials, score }) {
  // Add score entry
  await addDoc(collection(db, LEADERBOARD_COL), {
    uid,
    displayName,
    initials,
    score,
    createdAt: serverTimestamp(),
  });

  // Update personal best in user profile if this is their top score
  const profile = await getUserProfile(uid);
  const updates = { gamesPlayed: (profile?.gamesPlayed || 0) + 1 };
  if (score > (profile?.bestScore || 0)) {
    updates.bestScore = score;
  }
  await updateUserProfile(uid, updates);
}

// ── Leaderboard Reads ────────────────────────────────────────────
export async function fetchGlobalLeaderboard(topN = 10) {
  const q = query(
    collection(db, LEADERBOARD_COL),
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
// Check if a score would make the global top-N board
export async function isGlobalLeaderboardScore(score, topN = 10) {
  const board = await fetchGlobalLeaderboard(topN);
  if (board.length < topN) return true;
  return score > board[board.length - 1].score;
}
