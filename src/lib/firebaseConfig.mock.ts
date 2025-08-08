// This is a mock Firebase configuration.
// When you set up your actual Firebase project, replace this with the real config.

export const firebaseConfigMock = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "MOCK_API_KEY",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "mock-project-id.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "mock-project-id",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "mock-project-id.appspot.com",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "MOCK_MESSAGING_SENDER_ID",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "MOCK_APP_ID",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "MOCK_MEASUREMENT_ID" // Optional, for Analytics
};

// In a real setup, you would initialize Firebase like this:
// import { initializeApp, getApps, getApp } from "firebase/app";
// import { getAuth } from "firebase/auth";
// import { getFirestore } from "firebase/firestore";

// let firebaseApp;
// if (!getApps().length) {
//   firebaseApp = initializeApp(firebaseConfig);
// } else {
//   firebaseApp = getApp();
// }

// export const auth = getAuth(firebaseApp);
// export const db = getFirestore(firebaseApp);

console.log("Using MOCK Firebase configuration. Replace with actual Firebase setup later.");

// For now, we'll export mock objects or functions directly from service files.
// This file mainly serves as a placeholder for the real config.
