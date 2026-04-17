import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Animated,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { ChefHat, Mail, Lock, Eye, EyeOff } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const DEMO_CREDENTIALS = [
  { role: "Administrador", email: "admin@cozinhafast.com" },
  { role: "Gerente", email: "gerente@cozinhafast.com" },
  { role: "Garçom", email: "garcom@cozinhafast.com" },
  { role: "Cozinheiro", email: "cozinheiro@cozinhafast.com" },
];

const ROLE_ROUTES: Record<string, string> = {
  garcom: "/(tabs)/(mesas)",
  admin: "/(tabs)/(dashboard)",
  administrador: "/(tabs)/(dashboard)",
  gerente: "/(tabs)/(dashboard)",
  cozinheiro: "/(tabs)/(cozinha)",
};

export default function AuthScreen() {
  const COLORS = useColors();
  const { user, loading, signInWithEmail, signInWithApple, signInWithGoogle } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [socialLoading, setSocialLoading] = useState<"apple" | "google" | null>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  useEffect(() => {
    if (!loading && user) {
      const role = (user.role as string) || "";
      const route = ROLE_ROUTES[role] || "/(tabs)/(mesas)";
      console.log("[AuthScreen] User authenticated, role:", role, "-> redirecting to:", route);
      router.replace(route as any);
    }
  }, [user, loading, router]);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError("Preencha e-mail e senha.");
      return;
    }
    console.log("[AuthScreen] Login button pressed for:", email);
    setError("");
    setSubmitting(true);
    try {
      await signInWithEmail(email.trim(), password);
      console.log("[AuthScreen] Login successful");
    } catch (e: any) {
      console.error("[AuthScreen] Login error:", e);
      const msg: string = e?.message || "";
      if (
        msg.toLowerCase().includes("invalid") ||
        msg.toLowerCase().includes("incorrect") ||
        msg.toLowerCase().includes("unauthorized") ||
        msg.toLowerCase().includes("credenciais") ||
        msg.toLowerCase().includes("inválid") ||
        msg.toLowerCase().includes("senha") ||
        msg.toLowerCase().includes("password") ||
        msg.includes("401") ||
        msg.includes("403")
      ) {
        setError("E-mail ou senha incorretos. Tente novamente.");
      } else {
        setError(msg || "Erro ao fazer login. Tente novamente.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleApple = async () => {
    console.log("[AuthScreen] Apple sign-in button pressed");
    setSocialLoading("apple");
    setError("");
    try {
      await signInWithApple();
    } catch (e: any) {
      console.error("[AuthScreen] Apple sign-in error:", e);
      if (e?.message !== "Authentication cancelled") {
        setError(e?.message || "Erro ao entrar com Apple.");
      }
    } finally {
      setSocialLoading(null);
    }
  };

  const handleGoogle = async () => {
    console.log("[AuthScreen] Google sign-in button pressed");
    setSocialLoading("google");
    setError("");
    try {
      await signInWithGoogle();
    } catch (e: any) {
      console.error("[AuthScreen] Google sign-in error:", e);
      if (e?.message !== "Authentication cancelled") {
        setError(e?.message || "Erro ao entrar com Google.");
      }
    } finally {
      setSocialLoading(null);
    }
  };

  const fillDemo = (cred: (typeof DEMO_CREDENTIALS)[0]) => {
    console.log("[AuthScreen] Demo credentials selected for:", cred.role);
    setEmail(cred.email);
    setPassword("123456");
    setError("");
  };

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.background }}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </View>
    );
  }

  const isAnySocialLoading = socialLoading !== null;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: COLORS.background }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: insets.top + 40,
          paddingBottom: insets.bottom + 32,
          paddingHorizontal: 24,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <Animated.View
          style={{
            alignItems: "center",
            marginBottom: 40,
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          }}
        >
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 24,
              backgroundColor: COLORS.primary,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 16,
            }}
          >
            <ChefHat size={40} color="#fff" strokeWidth={2} />
          </View>
          <Text
            style={{
              fontFamily: "Outfit_700Bold",
              fontSize: 32,
              color: COLORS.text,
              letterSpacing: -0.5,
            }}
          >
            CozinhaFast
          </Text>
          <Text
            style={{
              fontFamily: "Outfit_400Regular",
              fontSize: 15,
              color: COLORS.textSecondary,
              marginTop: 6,
              textAlign: "center",
            }}
          >
            Gestão inteligente para seu restaurante
          </Text>
        </Animated.View>

        {/* Form */}
        <Animated.View
          style={{
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          }}
        >
          <View
            style={{
              backgroundColor: COLORS.surface,
              borderRadius: 20,
              padding: 24,
              borderWidth: 1,
              borderColor: COLORS.border,
              gap: 16,
            }}
          >
            {/* Email */}
            <View style={{ gap: 6 }}>
              <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 14, color: COLORS.text }}>
                E-mail
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: COLORS.surfaceSecondary,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: COLORS.border,
                  paddingHorizontal: 14,
                  height: 52,
                  gap: 10,
                }}
              >
                <Mail size={18} color={COLORS.textSecondary} />
                <TextInput
                  value={email}
                  onChangeText={(t) => { setEmail(t); setError(""); }}
                  placeholder="seu@email.com"
                  placeholderTextColor={COLORS.textTertiary}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={{
                    flex: 1,
                    fontFamily: "Outfit_400Regular",
                    fontSize: 15,
                    color: COLORS.text,
                  }}
                />
              </View>
            </View>

            {/* Password */}
            <View style={{ gap: 6 }}>
              <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 14, color: COLORS.text }}>
                Senha
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: COLORS.surfaceSecondary,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: COLORS.border,
                  paddingHorizontal: 14,
                  height: 52,
                  gap: 10,
                }}
              >
                <Lock size={18} color={COLORS.textSecondary} />
                <TextInput
                  value={password}
                  onChangeText={(t) => { setPassword(t); setError(""); }}
                  placeholder="••••••••"
                  placeholderTextColor={COLORS.textTertiary}
                  secureTextEntry={!showPassword}
                  style={{
                    flex: 1,
                    fontFamily: "Outfit_400Regular",
                    fontSize: 15,
                    color: COLORS.text,
                  }}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} hitSlop={8}>
                  {showPassword
                    ? <EyeOff size={18} color={COLORS.textSecondary} />
                    : <Eye size={18} color={COLORS.textSecondary} />
                  }
                </TouchableOpacity>
              </View>
            </View>

            {/* Error */}
            {!!error && (
              <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 13, color: COLORS.danger }}>
                {error}
              </Text>
            )}

            {/* Submit */}
            <AnimatedPressable
              onPress={handleLogin}
              disabled={submitting || isAnySocialLoading}
              style={{
                backgroundColor: COLORS.primary,
                borderRadius: 14,
                height: 52,
                alignItems: "center",
                justifyContent: "center",
                marginTop: 4,
                opacity: submitting || isAnySocialLoading ? 0.7 : 1,
              }}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 16, color: "#fff" }}>
                  Entrar
                </Text>
              )}
            </AnimatedPressable>

            {/* Divider */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: COLORS.border }} />
              <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 12, color: COLORS.textSecondary }}>
                ou continue com
              </Text>
              <View style={{ flex: 1, height: 1, backgroundColor: COLORS.border }} />
            </View>

            {/* Apple Sign In — MUST be first per App Store guidelines */}
            <AnimatedPressable
              onPress={handleApple}
              disabled={submitting || isAnySocialLoading}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: COLORS.text,
                borderRadius: 14,
                height: 52,
                gap: 10,
                opacity: submitting || isAnySocialLoading ? 0.7 : 1,
              }}
            >
              {socialLoading === "apple" ? (
                <ActivityIndicator color={COLORS.background} />
              ) : (
                <>
                  <Text style={{ fontSize: 18, color: COLORS.background }}>
                  </Text>
                  <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 15, color: COLORS.background }}>
                    Entrar com Apple
                  </Text>
                </>
              )}
            </AnimatedPressable>

            {/* Google Sign In */}
            <AnimatedPressable
              onPress={handleGoogle}
              disabled={submitting || isAnySocialLoading}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: COLORS.surface,
                borderRadius: 14,
                height: 52,
                borderWidth: 1,
                borderColor: COLORS.border,
                gap: 10,
                opacity: submitting || isAnySocialLoading ? 0.7 : 1,
              }}
            >
              {socialLoading === "google" ? (
                <ActivityIndicator color={COLORS.primary} />
              ) : (
                <>
                  <Text style={{ fontSize: 18 }}>G</Text>
                  <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 15, color: COLORS.text }}>
                    Entrar com Google
                  </Text>
                </>
              )}
            </AnimatedPressable>
          </View>
        </Animated.View>

        {/* Demo credentials */}
        <Animated.View style={{ marginTop: 24, opacity: fadeAnim }}>
          <Text
            style={{
              fontFamily: "Outfit_600SemiBold",
              fontSize: 13,
              color: COLORS.textSecondary,
              textAlign: "center",
              marginBottom: 12,
              textTransform: "uppercase",
              letterSpacing: 0.8,
            }}
          >
            Credenciais de demonstração
          </Text>
          <View
            style={{
              backgroundColor: COLORS.surface,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: COLORS.border,
              overflow: "hidden",
            }}
          >
            {DEMO_CREDENTIALS.map((cred, i) => (
              <AnimatedPressable
                key={cred.role}
                onPress={() => fillDemo(cred)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  borderBottomWidth: i < DEMO_CREDENTIALS.length - 1 ? 1 : 0,
                  borderBottomColor: COLORS.divider,
                }}
              >
                <View style={{ gap: 2 }}>
                  <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 14, color: COLORS.text }}>
                    {cred.role}
                  </Text>
                  <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 12, color: COLORS.textSecondary }}>
                    {cred.email}
                  </Text>
                </View>
                <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 12, color: COLORS.primary }}>
                  Usar
                </Text>
              </AnimatedPressable>
            ))}
          </View>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
