import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getStorage, type Storage } from "firebase-admin/storage";

function getServiceAccount() {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!json) throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY is not set");
  return JSON.parse(json);
}

const app: App = getApps().length
  ? getApps()[0]
  : initializeApp({
      credential: cert(getServiceAccount()),
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    });

export const adminAuth: Auth = getAuth(app);
export const adminDb: Firestore = getFirestore(app);
export const adminStorage: Storage = getStorage(app);
