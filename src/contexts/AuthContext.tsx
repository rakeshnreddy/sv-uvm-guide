"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  onAuthStateChangedMock,
  signInAnonymouslyMock,
  signOutMock,
  getCurrentUserMock
} from '@/lib/firebaseAuth.mock'; // Using mock auth

// Define the shape of the user object provided by the context
interface AuthUser {
  uid: string;
  isAnonymous: boolean;
  displayName?: string | null;
  // Add any other user properties you need from your mock or real Firebase user
}

// Define the shape of the context value
interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  signInAnonymously: () => Promise<AuthUser | null>;
  signOut: () => Promise<void>;
}

// Create the context with a default undefined value to ensure it's used within a provider
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// AuthProvider component
interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps & { userId?: string }> = ({ children, userId }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userId) {
      // If a userId is passed from the server, we can assume the user is "signed in".
      // We can either fetch the user details or use a mock user.
      const mockUser = getCurrentUserMock();
      if (mockUser && mockUser.uid === userId) {
        setUser({
          uid: mockUser.uid,
          isAnonymous: mockUser.isAnonymous,
          displayName: mockUser.displayName,
        });
      }
    }
    setLoading(false);

    const unsubscribe = onAuthStateChangedMock((mockUser) => {
      if (mockUser) {
        setUser({
          uid: mockUser.uid,
          isAnonymous: mockUser.isAnonymous,
          displayName: mockUser.displayName,
        });
      } else {
        setUser(null);
      }
    });

    return () => unsubscribe();
  }, [userId]);

  const handleSignInAnonymously = async (): Promise<AuthUser | null> => {
    setLoading(true);
    try {
      const { user: mockUser } = await signInAnonymouslyMock();
      const authUser = {
        uid: mockUser.uid,
        isAnonymous: mockUser.isAnonymous,
        displayName: mockUser.displayName,
      };
      setUser(authUser);
      setLoading(false);
      return authUser;
    } catch (error) {
      console.error("Mock Anonymous Sign-In Error:", error);
      setUser(null); // Ensure user is null on error
      setLoading(false);
      return null;
    }
  };

  const handleSignOut = async (): Promise<void> => {
    setLoading(true);
    try {
      await signOutMock();
      setUser(null);
      setLoading(false);
    } catch (error) {
      console.error("Mock Sign-Out Error:", error);
      // Potentially keep user state or clear it depending on error handling strategy
      setLoading(false);
    }
  };

  const value = {
    user,
    loading,
    signInAnonymously: handleSignInAnonymously,
    signOut: handleSignOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Custom hook to use the AuthContext
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
