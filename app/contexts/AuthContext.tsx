'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, UserRole } from '@/app/types';
import { userStorage } from '@/app/lib/user-storage';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (userData: { firstName: string; lastName: string; email: string; password: string }) => Promise<void>;
  signOut: () => void;
  updateUserRole: (role: UserRole) => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

           useEffect(() => {
    // Check for existing user session
    const savedUser = userStorage.getCurrentUser();
    if (savedUser) {
      setUser(savedUser);
    }
    setLoading(false);
  }, []);

     const signIn = async (email: string, password: string) => {
       setLoading(true);
       try {
         // Validate email format
         if (!userStorage.validateEmail(email)) {
           throw new Error('Please enter a valid email address');
         }

         // Authenticate user using storage service
         const authenticatedUser = userStorage.authenticateUser(email, password);
         
         setUser(authenticatedUser);
         userStorage.setCurrentUser(authenticatedUser);
       } catch (error) {
         console.error('Sign in error:', error);
         throw error;
       } finally {
         setLoading(false);
       }
     };

  const signUp = async (userData: { firstName: string; lastName: string; email: string; password: string }) => {
    setLoading(true);
    try {
      // Validate email format
      if (!userStorage.validateEmail(userData.email)) {
        throw new Error('Please enter a valid email address');
      }

      // Validate password strength
      const passwordValidation = userStorage.validatePassword(userData.password);
      if (!passwordValidation.isValid) {
        throw new Error(`Password requirements not met: ${passwordValidation.errors.join(', ')}`);
      }

      // Check if email already exists
      if (userStorage.isEmailRegistered(userData.email)) {
        throw new Error('Email already registered. Please use a different email or sign in.');
      }

      // Create new user using storage service
      const newUser = userStorage.createUser(userData);
      
      setUser(newUser);
      userStorage.setCurrentUser(newUser);
    } catch (error) {
      console.error('Sign up error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signOut = () => {
    setUser(null);
    userStorage.clearCurrentUser();
  };

  const updateUserRole = (role: UserRole) => {
    if (user) {
      const updatedUser = { ...user, role };
      setUser(updatedUser);
      userStorage.setCurrentUser(updatedUser);
      userStorage.updateUser(updatedUser);
    }
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    signIn,
    signUp,
    signOut,
    updateUserRole,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
} 