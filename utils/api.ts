import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

export const BACKEND_URL = "https://j74mf38wgua3d4qd5mqbjjvza88n2qcp.app.specular.dev";
export const AUTH_TOKEN_KEY = "cozinhafast_token";

export const getBearerToken = async (): Promise<string | null> => {
  try {
    if (Platform.OS === "web") {
      return localStorage.getItem(AUTH_TOKEN_KEY);
    }
    return await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
  } catch (error) {
    console.error("[API] Error retrieving bearer token:", error);
    return null;
  }
};

export const saveBearerToken = async (token: string): Promise<void> => {
  try {
    if (Platform.OS === "web") {
      localStorage.setItem(AUTH_TOKEN_KEY, token);
    } else {
      await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token);
    }
  } catch (error) {
    console.error("[API] Error saving bearer token:", error);
  }
};

export const deleteBearerToken = async (): Promise<void> => {
  try {
    if (Platform.OS === "web") {
      localStorage.removeItem(AUTH_TOKEN_KEY);
    } else {
      await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
    }
  } catch (error) {
    console.error("[API] Error deleting bearer token:", error);
  }
};

export const apiRequest = async <T = any>(
  path: string,
  options?: RequestInit
): Promise<T> => {
  const url = `${BACKEND_URL}${path}`;
  const token = await getBearerToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  console.log(`[API] ${options?.method ?? "GET"} ${path}`);

  const response = await fetch(url, { ...options, headers });

  if (!response.ok) {
    const text = await response.text();
    let message = text;
    try {
      const json = JSON.parse(text);
      message = json.message || json.error || text;
    } catch {
      // use raw text
    }
    console.error(`[API] Error ${response.status} on ${path}:`, message);
    throw new Error(message || `HTTP ${response.status}`);
  }

  return response.json();
};

export const apiGet = <T = any>(path: string): Promise<T> =>
  apiRequest<T>(path, { method: "GET" });

export const apiPost = <T = any>(path: string, data: any): Promise<T> =>
  apiRequest<T>(path, { method: "POST", body: JSON.stringify(data) });

export const apiPut = <T = any>(path: string, data: any): Promise<T> =>
  apiRequest<T>(path, { method: "PUT", body: JSON.stringify(data) });

export const apiPatch = <T = any>(path: string, data: any): Promise<T> =>
  apiRequest<T>(path, { method: "PATCH", body: JSON.stringify(data) });

export const apiDelete = <T = any>(path: string, data: any = {}): Promise<T> =>
  apiRequest<T>(path, { method: "DELETE", body: JSON.stringify(data) });

// Aliases kept for backward compat with existing screens
export const apiCall = apiRequest;
export const authenticatedApiCall = apiRequest;
export const authenticatedGet = apiGet;
export const authenticatedPost = apiPost;
export const authenticatedPut = apiPut;
export const authenticatedPatch = apiPatch;
export const authenticatedDelete = apiDelete;

export const isBackendConfigured = (): boolean => !!BACKEND_URL;
export const BEARER_TOKEN_KEY = AUTH_TOKEN_KEY;
