import Constants from "expo-constants";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { BEARER_TOKEN_KEY } from "@/lib/auth";

const FALLBACK_URL = "https://j74mf38wgua3d4qd5mqbjjvza88n2qcp.app.specular.dev";
export const BACKEND_URL: string =
  (Constants.expoConfig?.extra?.backendUrl as string | undefined) || FALLBACK_URL;

export const isBackendConfigured = (): boolean => {
  return !!BACKEND_URL && BACKEND_URL.length > 0;
};

/** Extract a human-readable message from any thrown value */
export function getErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}

export const getBearerToken = async (): Promise<string | null> => {
  try {
    if (Platform.OS === "web") {
      return localStorage.getItem(BEARER_TOKEN_KEY);
    } else {
      return await SecureStore.getItemAsync(BEARER_TOKEN_KEY);
    }
  } catch (error) {
    console.error("[API] Error retrieving bearer token:", getErrorMessage(error));
    return null;
  }
};

export const apiCall = async <T = any>(
  endpoint: string,
  options?: RequestInit,
  explicitToken?: string
): Promise<T> => {
  const url = `${BACKEND_URL}${endpoint}`;
  console.log("[API]", options?.method ?? "GET", url);

  const storedToken = explicitToken ?? (await getBearerToken());

  const fetchOptions: RequestInit = {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers as Record<string, string> || {}),
      ...(storedToken ? { Authorization: `Bearer ${storedToken}` } : {}),
    },
  };

  let response: Response;
  try {
    response = await fetch(url, fetchOptions);
  } catch (networkError) {
    const msg = getErrorMessage(networkError);
    console.error("[API] Network error for", url, ":", msg);
    throw new Error("Sem conexão com o servidor");
  }

  const text = await response.text().catch(() => "");
  let data: any;
  try { data = JSON.parse(text); } catch { data = text; }

  if (!response.ok) {
    const preview = text.slice(0, 200);
    console.error("[API] HTTP", response.status, "for", url, ":", preview);
    const message = (typeof data === "object" && data !== null)
      ? (data.message || data.error || `HTTP ${response.status}`)
      : `HTTP ${response.status}`;
    throw new Error(message);
  }

  return data as T;
};

export const apiGet = async <T = any>(endpoint: string): Promise<T> => {
  return apiCall<T>(endpoint, { method: "GET" });
};

export const apiPost = async <T = any>(endpoint: string, data: any): Promise<T> => {
  return apiCall<T>(endpoint, {
    method: "POST",
    body: JSON.stringify(data),
  });
};

export const apiPut = async <T = any>(endpoint: string, data: any): Promise<T> => {
  return apiCall<T>(endpoint, {
    method: "PUT",
    body: JSON.stringify(data),
  });
};

export const apiPatch = async <T = any>(endpoint: string, data: any): Promise<T> => {
  return apiCall<T>(endpoint, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
};

export const apiDelete = async <T = any>(endpoint: string, data: any = {}): Promise<T> => {
  return apiCall<T>(endpoint, {
    method: "DELETE",
    body: JSON.stringify(data),
  });
};

export const authenticatedApiCall = async <T = any>(
  endpoint: string,
  options?: RequestInit
): Promise<T> => {
  const token = await getBearerToken();
  if (!token) {
    throw new Error("Authentication token not found. Please sign in.");
  }
  return apiCall<T>(endpoint, {
    ...options,
    headers: {
      ...options?.headers,
      Authorization: `Bearer ${token}`,
    },
  });
};

export const authenticatedGet = async <T = any>(endpoint: string): Promise<T> => {
  return authenticatedApiCall<T>(endpoint, { method: "GET" });
};

export const authenticatedPost = async <T = any>(endpoint: string, data: any): Promise<T> => {
  return authenticatedApiCall<T>(endpoint, {
    method: "POST",
    body: JSON.stringify(data),
  });
};

export const authenticatedPut = async <T = any>(endpoint: string, data: any): Promise<T> => {
  return authenticatedApiCall<T>(endpoint, {
    method: "PUT",
    body: JSON.stringify(data),
  });
};

export const authenticatedPatch = async <T = any>(endpoint: string, data: any): Promise<T> => {
  return authenticatedApiCall<T>(endpoint, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
};

export const authenticatedDelete = async <T = any>(endpoint: string, data: any = {}): Promise<T> => {
  return authenticatedApiCall<T>(endpoint, {
    method: "DELETE",
    body: JSON.stringify(data),
  });
};
