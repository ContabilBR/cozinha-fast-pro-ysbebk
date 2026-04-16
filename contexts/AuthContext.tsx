import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { BACKEND_URL } from "@/utils/api";

const TOKEN_KEY = "cozinhafast_token";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function storeToken(token: string) {
  if (Platform.OS === "web") {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  }
}

async function getStoredToken(): Promise<string | null> {
  try {
    if (Platform.OS === "web") {
      return localStorage.getItem(TOKEN_KEY);
    } else {
      return await SecureStore.getItemAsync(TOKEN_KEY);
    }
  } catch {
    return null;
  }
}

async function removeToken() {
  if (Platform.OS === "web") {
    localStorage.removeItem(TOKEN_KEY);
  } else {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    restoreSession();
  }, []);

  const restoreSession = async () => {
    console.log("[Auth] Restoring session...");
    try {
      const token = await getStoredToken();
      if (!token) {
        console.log("[Auth] No stored token found");
        setUser(null);
        return;
      }
      const response = await fetch(`${BACKEND_URL}/api/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) {
        console.log("[Auth] Token validation failed, status:", response.status);
        await removeToken();
        setUser(null);
        return;
      }
      const data = await response.json();
      const userData: AuthUser = data.user || data;
      console.log("[Auth] Session restored for:", userData.email, "role:", userData.role);
      setUser(userData);
    } catch (e) {
      console.error("[Auth] Session restore error:", e);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    console.log("[Auth] Signing in with email:", email);
    const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.error("[Auth] Login failed, status:", response.status, text.slice(0, 200));
      throw new Error("E-mail ou senha incorretos.");
    }
    const data = await response.json();
    const token: string = data.token;
    const userData: AuthUser = data.user;
    console.log("[Auth] Login successful for:", userData.email, "role:", userData.role);
    await storeToken(token);
    setUser(userData);
  };

  const signOut = async () => {
    console.log("[Auth] Signing out");
    await removeToken();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signInWithEmail, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
