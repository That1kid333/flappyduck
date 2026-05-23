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
// Always tries popup first (works on mobile browsers when triggered by user tap).
// Falls back to redirect only if the popup is actually blocked by the browser.
export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();

  try {
    const cred = await signInWithPopup(auth, provider);
    // ensureProfile is non-fatal — user is authenticated even if Firestore write fails
    ensureProfile(cred.user).catch(err => console.warn('[Auth] ensureProfile failed:', err));
    return cred.user;
  } catch (err) {
    if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
      // User closed the popup — not an error, just return null
      return null;
    }
    if (err.code === 'auth/popup-blocked') {
      // Popup was blocked by the browser — fall back to redirect
      await signInWithRedirect(auth, provider);
      return null;  // page will redirect; result captured in handleGoogleRedirect()
    }
    throw err;
  }
}

// Call once on page load to capture the result after a Google redirect fallback
export async function handleGoogleRedirect() {
  try {
    const result = await getRedirectResult(auth);
    if (result?.user) {
      ensureProfile(result.user).catch(err => console.warn('[Auth] ensureProfile failed:', err));
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
      email:       user.email,
      displayName: user.displayName || user.email?.split('@')[0] || 'Duck',
    });
  }
}

// ── Sign Out ─────────────────────────────────────────────────────
export async function signOut() {
  await firebaseSignOut(auth);
}
