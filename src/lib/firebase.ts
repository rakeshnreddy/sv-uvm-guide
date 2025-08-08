import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { firebaseConfigMock } from "./firebaseConfig.mock";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const hasValidConfig = Object.values(firebaseConfig).every(Boolean);

const app = getApps().length
  ? getApp()
  : initializeApp(hasValidConfig ? firebaseConfig : firebaseConfigMock);
const db = getFirestore(app);
const auth = getAuth(app);

if (!hasValidConfig) {
  console.warn(
    "Using mock Firebase configuration. Set NEXT_PUBLIC_FIREBASE_* env vars for production."
  );
}

export { db, auth };
