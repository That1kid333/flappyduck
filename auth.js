// auth.js — Email/password + Google authentication
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
} from 'firebase/auth';
import { auth } from './firebase.js';
import { createUserProfile, getUserProfile } from './db.js';

// ── Auth state listener ──────────────────────────────────────────
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

  const name = displayName || email.split('@')[0];
  await updateProfile(user, { displayName: name });
  await createUserProfile(user.uid, { email, displayName: name });

  return user;
}

// ── Sign In ──────────────────────────────────────────────────────
export async function signInWithEmail(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

// ── Google Sign-In ───────────────────────────────────────────────
// Uses redirect on mobile (popups are blocked), popup on desktop.
export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);

  if (isMobile) {
    // Redirect flow — page reloads, result handled by handleGoogleRedirect()
    await signInWithRedirect(auth, provider);
    return null;
  }

  const cred = await signInWithPopup(auth, provider);
  await ensureProfile(cred.user);
  return cred.user;
}

// Call once on page load to capture the result after a Google redirect
export async function handleGoogleRedirect() {
  try {
    const result = await getRedirectResult(auth);
    if (result?.user) {
      await ensureProfile(result.user);
      return result.user;
    }
  } catch (err) {
    console.error('[Auth] Google redirect result error:', err);
  }
  return null;
}

async function ensureProfile(user) {
  const existing = await getUserProfile(user.uid);
  if (!existing) {
    await createUserProfile(user.uid, {
      email: user.email,
      displayName: user.displayName || user.email.split('@')[0],
    });
  }
}

// ── Sign Out ─────────────────────────────────────────────────────
export async function signOut() {
  await firebaseSignOut(auth);
}
