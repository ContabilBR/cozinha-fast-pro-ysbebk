import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { BACKEND_URL, apiCall } from "@/utils/api";

const TOKEN_KEY = "cozinhafast_token";
const USER_KEY = "cozinhafast_user";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  token?: string;
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
    localStorage.removeItem(USER_KEY);
  } else {
    await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
    await SecureStore.deleteItemAsync(USER_KEY).catch(() => {});
  }
}

function buildUserFromResponse(data: any, meData: any, token: string): AuthUser {
  const profile = meData?.profile || meData?.user?.profile;
  return {
    id: meData?.user?.id || data?.user?.id || "",
    email: meData?.user?.email || data?.user?.email || "",
    name: profile?.name || meData?.user?.name || data?.user?.name || "",
    role: profile?.role || meData?.user?.role || data?.user?.role || "",
    token,
  };
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
      const meData = await apiCall("/api/auth/me", { method: "GET" }, token);
      const profile = meData?.profile || meData?.user?.profile;
      const userData: AuthUser = {
        id: meData?.user?.id || meData?.id || "",
        email: meData?.user?.email || meData?.email || "",
        name: profile?.name || meData?.user?.name || meData?.name || "",
        role: profile?.role || meData?.user?.role || meData?.role || "",
        token,
      };
      console.log("[Auth] Session restored for:", userData.email, "role:", userData.role);
      setUser(userData);
    } catch (e) {
      console.error("[Auth] Session restore error:", e);
      await removeToken();
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    console.log("[Auth] Signing in with email:", email);
    let data: any;
    try {
      data = await apiCall("/api/auth/sign-in", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
    } catch (e: any) {
      console.error("[Auth] Login request failed:", e?.message);
      const msg: string = e?.message || "";
      if (msg === "Sem conexão com o servidor") {
        throw new Error("Sem conexão com o servidor");
      }
      if (msg.includes("401") || msg.includes("403") || msg.toLowerCase().includes("invalid") || msg.toLowerCase().includes("incorrect") || msg.toLowerCase().includes("unauthorized")) {
        throw new Error("E-mail ou senha incorretos");
      }
      throw new Error("Erro ao fazer login. Tente novamente.");
    }

    const token: string = data?.token || data?.session?.token || data?.session?.id || "";
    if (!token) {
      console.error("[Auth] No token in response:", JSON.stringify(data));
      throw new Error("Token não recebido. Tente novamente.");
    }

    let meData: any = {};
    try {
      meData = await apiCall("/api/auth/me", { method: "GET" }, token);
    } catch (e) {
      console.warn("[Auth] Could not fetch /api/auth/me, using sign-in data:", e);
    }

    const userData = buildUserFromResponse(data, meData, token);
    console.log("[Auth] Login successful for:", userData.email, "role:", userData.role);
    await storeToken(token);
    setUser(userData);
  };

  const signOut = async () => {
    console.log("[Auth] Signing out");
    try {
      const token = await getStoredToken();
      if (token) {
        await apiCall("/api/auth/sign-out", { method: "POST" }, token).catch(() => {});
      }
    } catch {}
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
