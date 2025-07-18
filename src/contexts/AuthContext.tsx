"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { auth } from '@/lib/firebase';
import { User, onAuthStateChanged, signInAnonymously, signOut } from 'firebase/auth';

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

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user: User | null) => {
      if (user) {
        setUser({
          uid: user.uid,
          isAnonymous: user.isAnonymous,
          displayName: user.displayName,
        });
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleSignInAnonymously = async (): Promise<AuthUser | null> => {
    setLoading(true);
    try {
      const { user: firebaseUser } = await signInAnonymously(auth);
      const authUser = {
        uid: firebaseUser.uid,
        isAnonymous: firebaseUser.isAnonymous,
        displayName: firebaseUser.displayName,
      };
      setUser(authUser);
      setLoading(false);
      return authUser;
    } catch (error) {
      console.error("Anonymous Sign-In Error:", error);
      setUser(null);
      setLoading(false);
      return null;
    }
  };

  const handleSignOut = async (): Promise<void> => {
    setLoading(true);
    try {
      await signOut(auth);
      setUser(null);
      setLoading(false);
    } catch (error) {
      console.error("Sign-Out Error:", error);
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
