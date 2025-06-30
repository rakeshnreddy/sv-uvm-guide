// This is a mock Firebase configuration.
// When you set up your actual Firebase project, replace this with the real config.

export const firebaseConfigMock = {
  apiKey: "MOCK_API_KEY",
  authDomain: "mock-project-id.firebaseapp.com",
  projectId: "mock-project-id",
  storageBucket: "mock-project-id.appspot.com",
  messagingSenderId: "MOCK_MESSAGING_SENDER_ID",
  appId: "MOCK_APP_ID",
  measurementId: "MOCK_MEASUREMENT_ID" // Optional, for Analytics
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
