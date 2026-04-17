import "react-native-reanimated";
import React, { useEffect } from "react";
import { Stack, Redirect, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { SystemBars } from "react-native-edge-to-edge";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useColorScheme } from "react-native";
import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { WidgetProvider } from "@/contexts/WidgetContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import type { AuthUser } from "@/contexts/AuthContext";
import {
  useFonts,
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
} from "@expo-google-fonts/outfit";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { ChevronLeft } from "lucide-react-native";

SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  initialRouteName: "(tabs)",
};

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Redirect href="/auth-screen" />;

  return <>{children}</>;
}

function BackButton() {
  const router = useRouter();
  return (
    <AnimatedPressable
      onPress={() => { console.log("[Nav] Back button pressed"); router.back(); }}
      style={{ padding: 8, marginLeft: -4 }}
      accessibilityLabel="Voltar"
    >
      <ChevronLeft size={24} color="#E8521A" />
    </AnimatedPressable>
  );
}

const BACK_HEADER = {
  headerShown: true,
  headerLeft: () => <BackButton />,
  headerBackVisible: false,
} as const;

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
                <Stack screenOptions={{ headerShown: false }}>
                  <Stack.Screen name="auth-screen" options={{ headerShown: false }} />
                  <Stack.Screen name="auth-popup" options={{ headerShown: false }} />
                  <Stack.Screen name="auth-callback" options={{ headerShown: false }} />
                  <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                  <Stack.Screen name="(gestao)" options={{ headerShown: false }} />
                  <Stack.Screen
                    name="comanda/[id]"
                    options={{ ...BACK_HEADER, presentation: "card" }}
                  />
                  <Stack.Screen
                    name="comanda/nova"
                    options={{ ...BACK_HEADER, presentation: "card" }}
                  />
                  <Stack.Screen
                    name="mesa/[id]"
                    options={{ ...BACK_HEADER, presentation: "card" }}
                  />
                  <Stack.Screen
                    name="pedido/novo"
                    options={{ ...BACK_HEADER, presentation: "modal" }}
                  />
                  <Stack.Screen
                    name="pedido/[id]"
                    options={{ ...BACK_HEADER, presentation: "card" }}
                  />
                  <Stack.Screen
                    name="prato/[id]"
                    options={{ ...BACK_HEADER, presentation: "card" }}
                  />
                  <Stack.Screen
                    name="prato/novo"
                    options={{ ...BACK_HEADER, presentation: "modal" }}
                  />
                  <Stack.Screen
                    name="prato/editar/[id]"
                    options={{ ...BACK_HEADER, presentation: "card" }}
                  />
                  <Stack.Screen
                    name="categoria/index"
                    options={{ ...BACK_HEADER, presentation: "card" }}
                  />
                  <Stack.Screen
                    name="usuario/novo"
                    options={{ ...BACK_HEADER, presentation: "modal" }}
                  />
                  <Stack.Screen
                    name="usuario/[id]"
                    options={{ ...BACK_HEADER, presentation: "card" }}
                  />
                  <Stack.Screen
                    name="order/new"
                    options={{ ...BACK_HEADER, presentation: "modal" }}
                  />
                  <Stack.Screen
                    name="order/[id]"
                    options={{ ...BACK_HEADER, presentation: "card" }}
                  />
                  <Stack.Screen
                    name="dish/new"
                    options={{ ...BACK_HEADER, presentation: "modal" }}
                  />
                  <Stack.Screen
                    name="dish/[id]"
                    options={{ ...BACK_HEADER, presentation: "card" }}
                  />
                  <Stack.Screen
                    name="user/new"
                    options={{ ...BACK_HEADER, presentation: "modal" }}
                  />
                  <Stack.Screen
                    name="user/[id]"
                    options={{ ...BACK_HEADER, presentation: "card" }}
                  />
                </Stack>
                <SystemBars style="auto" />
              </AuthProvider>
            </GestureHandlerRootView>
          </WidgetProvider>
        </SafeAreaProvider>
      </ThemeProvider>
    </>
  );
}
