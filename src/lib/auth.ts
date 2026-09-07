import {
  GoogleAuthProvider,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { auth } from "@/lib/firebase";

const googleProvider = new GoogleAuthProvider();

// Popup, not redirect -- confirmed by testing: signInWithRedirect reliably failed for this app's
// actual users (clicking the button sends you to Google, but coming back lands on the exact same
// "please log in" screen with no error). That's the known failure mode of redirect-based auth:
// it depends on session storage surviving a full-page round trip to accounts.google.com and back,
// which browsers' third-party-storage partitioning / tracking protection can silently break.
// signInWithPopup keeps the main page's context intact the whole time (the popup reports its
// result back directly), so it isn't exposed to that failure mode. The one tradeoff is a popup
// blocker could block it -- less likely here since it only ever opens from a real click, which
// popup blockers generally allow.
export async function signInWithGoogle(): Promise<void> {
  await signInWithPopup(auth, googleProvider);
}

// Fallback for when the Google popup itself is blocked (or the account has no Google credential
// at all). Requires the Email/Password provider to be enabled in the Firebase Console
// (Authentication -> Sign-in method) and a password to already be set for the admin account --
// see sendAdminPasswordResetEmail below for the one-time way to set one.
export async function signInWithEmailPassword(
  email: string,
  password: string
): Promise<void> {
  await signInWithEmailAndPassword(auth, email, password);
}

// One-time setup / recovery: emails a password-reset link to `email`. Works even for an account
// that has only ever signed in via Google before -- Firebase treats "email" as the identity, and
// completing this reset both creates a password credential for that same account and lets you
// pick the password, in one step (no separate "create account" needed).
export async function sendAdminPasswordResetEmail(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email);
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(auth);
}
