import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Platform } from "react-native";
import * as Linking from "expo-linking";
import { authClient, setBearerToken, clearAuthTokens, API_URL } from "@/lib/auth";

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  image?: string;
  role?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, name?: string) => Promise<void>;
  signInWithApple: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  fetchUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function openOAuthPopup(provider: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const popupUrl = `${window.location.origin}/auth-popup?provider=${provider}`;
    const width = 500;
    const height = 600;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      popupUrl,
      "oauth-popup",
      `width=${width},height=${height},left=${left},top=${top},scrollbars=yes`
    );

    if (!popup) {
      reject(new Error("Failed to open popup. Please allow popups."));
      return;
    }

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === "oauth-success" && event.data?.token) {
        window.removeEventListener("message", handleMessage);
        clearInterval(checkClosed);
        resolve(event.data.token);
      } else if (event.data?.type === "oauth-error") {
        window.removeEventListener("message", handleMessage);
        clearInterval(checkClosed);
        reject(new Error(event.data.error || "OAuth failed"));
      }
    };

    window.addEventListener("message", handleMessage);

    const checkClosed = setInterval(() => {
      if (popup.closed) {
        clearInterval(checkClosed);
        window.removeEventListener("message", handleMessage);
        reject(new Error("Authentication cancelled"));
      }
    }, 500);
  });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUser();

    const subscription = Linking.addEventListener("url", () => {
      console.log("[Auth] Deep link received, refreshing user session");
      fetchUser();
    });

    const intervalId = setInterval(() => {
      fetchUser();
    }, 5 * 60 * 1000);

    return () => {
      subscription.remove();
      clearInterval(intervalId);
    };
  }, []);

  const fetchUser = async () => {
    try {
      setLoading(true);
      const session = await authClient.getSession();
      console.log("[Auth] Session response:", JSON.stringify(session?.data?.user));
      if (session?.data?.user) {
        const rawUser = session.data.user as any;
        let role = rawUser.role || "";

        // Se role não veio na sessão, buscar do /api/auth/me
        if (!role && session.data.session?.token) {
          try {
            const meRes = await fetch(`${API_URL}/api/auth/me`, {
              headers: { Authorization: `Bearer ${session.data.session.token}` },
            });
            if (meRes.ok) {
              const me = await meRes.json();
              role = me.role || "";
              console.log("[Auth] Role fetched from /api/auth/me:", role);
            } else {
              console.warn("[Auth] /api/auth/me returned", meRes.status);
            }
          } catch (e) {
            console.warn("[Auth] Could not fetch /api/auth/me:", e);
          }
        }

        const authUser: AuthUser = {
          id: rawUser.id || "",
          email: rawUser.email || "",
          name: rawUser.name || "",
          image: rawUser.image || "",
          role,
        };
        console.log("[Auth] User fetched:", authUser.email, "role:", authUser.role);
        setUser(authUser);

        if (session.data.session?.token) {
          await setBearerToken(session.data.session.token);
        }
      } else {
        setUser(null);
        await clearAuthTokens();
      }
    } catch (error) {
      console.error("[Auth] Failed to fetch user:", error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    console.log("[Auth] signInWithEmail called for:", email);
    let result: any;
    try {
      result = await authClient.signIn.email({ email, password });
      console.log("[Auth] signIn.email result:", JSON.stringify(result));
    } catch (error: any) {
      const msg = error?.message || "Erro ao fazer login. Tente novamente.";
      console.error("[Auth] signIn.email threw exception:", msg);
      throw new Error(msg);
    }

    // Better Auth retorna erros no campo .error em vez de lançar exceção
    if (result?.error) {
      const errMsg = result.error?.message || "E-mail ou senha incorretos";
      console.error("[Auth] signIn.email returned error field:", errMsg, "code:", result.error?.code);
      throw new Error(errMsg);
    }

    // Aguardar um momento para a sessão ser estabelecida
    await new Promise(resolve => setTimeout(resolve, 500));
    await fetchUser();
  };

  const signUpWithEmail = async (email: string, password: string, name?: string) => {
    console.log("[Auth] signUpWithEmail called for:", email);
    try {
      await authClient.signUp.email({ email, password, name: name || "" });
      await fetchUser();
    } catch (error) {
      console.error("[Auth] Email sign up failed:", error);
      throw error;
    }
  };

  const signInWithSocial = async (provider: "google" | "apple") => {
    console.log("[Auth] signInWithSocial called for provider:", provider);
    if (Platform.OS === "web") {
      const token = await openOAuthPopup(provider);
      await setBearerToken(token);
      await fetchUser();
    } else {
      const { error } = await authClient.signIn.social({
        provider,
        callbackURL: "/auth-callback",
      });
      if (error) {
        throw new Error(error.message || "Social sign in failed");
      }
      await fetchUser();
    }
  };

  const signInWithGoogle = () => signInWithSocial("google");

  const signInWithApple = async () => {
    console.log("[Auth] signInWithApple called, platform:", Platform.OS);
    if (Platform.OS === "ios") {
      const AppleAuthentication = require("expo-apple-authentication");
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) {
        throw new Error("No identity token received from Apple");
      }
      const { error } = await authClient.signIn.social({
        provider: "apple",
        idToken: credential.identityToken,
      });
      if (error) {
        throw new Error(error.message || "Apple sign in failed");
      }
      await fetchUser();
    } else {
      await signInWithSocial("apple");
    }
  };

  const signOut = async () => {
    console.log("[Auth] signOut called");
    try {
      await authClient.signOut();
    } catch (error) {
      console.error("[Auth] Sign out failed (API):", error);
    } finally {
      setUser(null);
      await clearAuthTokens();
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signInWithEmail,
        signUpWithEmail,
        signInWithApple,
        signInWithGoogle,
        signOut,
        fetchUser,
      }}
    >
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
