import "react-native-reanimated";
import React, { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { SystemBars } from "react-native-edge-to-edge";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useColorScheme } from "react-native";
import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { WidgetProvider } from "@/contexts/WidgetContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import {
  useFonts,
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
} from "@expo-google-fonts/outfit";

SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  initialRouteName: "(tabs)",
};

function RootLayoutNav() {
  const { user, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    const inAuthScreen = segments[0] === "auth-screen";
    if (!user && !inAuthScreen) {
      console.log("[Layout] No user — redirecting to /auth-screen");
      router.replace("/auth-screen");
    } else if (user && inAuthScreen) {
      console.log("[Layout] User authenticated — redirecting to /(tabs)/");
      router.replace("/(tabs)/");
    }
  }, [user, isLoading, segments, router]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: "#1a1a2e", alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color="#e94560" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="auth-screen" options={{ headerShown: false }} />
      <Stack.Screen name="auth-popup" options={{ headerShown: false }} />
      <Stack.Screen name="auth-callback" options={{ headerShown: false }} />
      <Stack.Screen name="prato/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="prato/novo" options={{ headerShown: false }} />
      <Stack.Screen name="prato/editar/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="categoria/index" options={{ headerShown: false }} />
      <Stack.Screen name="mesa/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="usuario/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="usuario/novo" options={{ headerShown: false }} />
      <Stack.Screen name="comanda/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="comanda/nova" options={{ headerShown: false }} />
      <Stack.Screen name="pedido/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="pedido/novo" options={{ headerShown: false }} />
      <Stack.Screen name="order/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="order/new" options={{ headerShown: false }} />
      <Stack.Screen name="dish/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="dish/new" options={{ headerShown: false }} />
      <Stack.Screen name="user/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="user/new" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [fontsLoaded] = useFonts({
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <>
      <StatusBar style="auto" animated />
      <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
        <SafeAreaProvider>
          <WidgetProvider>
            <GestureHandlerRootView style={{ flex: 1 }}>
              <AuthProvider>
                <RootLayoutNav />
                <SystemBars style="auto" />
              </AuthProvider>
            </GestureHandlerRootView>
          </WidgetProvider>
        </SafeAreaProvider>
      </ThemeProvider>
    </>
  );
}
