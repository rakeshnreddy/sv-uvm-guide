// Mock Firebase Authentication service

interface MockUser {
  uid: string;
  isAnonymous: boolean;
  displayName?: string | null;
  email?: string | null;
  // Add other user properties as needed
}

let currentMockUser: MockUser | null = null;
const listeners: Array<(user: MockUser | null) => void> = [];

// Simulate onAuthStateChanged
export const onAuthStateChangedMock = (callback: (user: MockUser | null) => void): (() => void) => {
  // Immediately call with current user state
  callback(currentMockUser);

  listeners.push(callback);

  // Return an unsubscribe function
  return () => {
    const index = listeners.indexOf(callback);
    if (index > -1) {
      listeners.splice(index, 1);
    }
  };
};

const notifyListeners = () => {
  listeners.forEach(listener => listener(currentMockUser));
};

// Simulate signInAnonymously
export const signInAnonymouslyMock = (): Promise<{ user: MockUser }> => {
  return new Promise((resolve) => {
    setTimeout(() => { // Simulate network delay
      if (!currentMockUser) { // Only sign in if not already signed in for this mock
        currentMockUser = {
          uid: `mock-anon-uid-${Date.now()}`,
          isAnonymous: true,
          displayName: "Anonymous User"
        };
        console.log("Firebase Auth Mock: Signed in anonymously.", currentMockUser);
        notifyListeners();
      }
      resolve({ user: currentMockUser! });
    }, 500);
  });
};

// Simulate signOut
export const signOutMock = (): Promise<void> => {
  return new Promise((resolve) => {
    setTimeout(() => { // Simulate network delay
      if (currentMockUser) {
        console.log("Firebase Auth Mock: Signed out.", currentMockUser);
        currentMockUser = null;
        notifyListeners();
      }
      resolve();
    }, 300);
  });
};

// Simulate getCurrentUser
export const getCurrentUserMock = (): MockUser | null => {
  return currentMockUser;
};

// This mock setup means you'd import these functions instead of the actual Firebase ones.
// e.g., import { signInAnonymouslyMock as signInAnonymously } from '@/lib/firebaseAuth.mock';

console.log("Using MOCK Firebase Authentication service.");
