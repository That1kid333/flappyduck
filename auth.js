// auth.js — Email/password + Google authentication
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth';
import { auth } from './firebase.js';
import { createUserProfile, getUserProfile } from './db.js';

// ── Auth state listener ──────────────────────────────────────────
// Returns unsubscribe function. callback(user | null)
export function watchAuthState(callback) {
  return onAuthStateChanged(auth, callback);
}

export function getCurrentUser() {
  return auth.currentUser;
}

// ── Sign Up ──────────────────────────────────────────────────────
export async function signUpWithEmail(email, password, displayName) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  const user = cred.user;

  // Set display name (email prefix if none given)
  const name = displayName || email.split('@')[0];
  await updateProfile(user, { displayName: name });

  // Create Firestore user profile
  await createUserProfile(user.uid, { email, displayName: name });

  return user;
}

// ── Sign In ──────────────────────────────────────────────────────
export async function signInWithEmail(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

// ── Google Sign-In ───────────────────────────────────────────────
export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  const cred = await signInWithPopup(auth, provider);
  const user = cred.user;

  // Create profile if first time
  const existing = await getUserProfile(user.uid);
  if (!existing) {
    await createUserProfile(user.uid, {
      email: user.email,
      displayName: user.displayName || user.email.split('@')[0],
    });
  }
  return user;
}

// ── Sign Out ─────────────────────────────────────────────────────
export async function signOut() {
  await firebaseSignOut(auth);
}
