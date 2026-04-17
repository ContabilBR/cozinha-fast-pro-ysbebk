import React, { useState } from "react";
import { View, Text, TextInput, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { Stack, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { apiPost } from "@/utils/api";
import { Plus } from "lucide-react-native";

export default function GestaoMesasScreen() {
  const COLORS = useColors();
  const insets = useSafeAreaInsets();
  const [numero, setNumero] = useState("");
  const [capacidade, setCapacidade] = useState("4");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const handleCreate = async () => {
    console.log("[GestaoMesas] handleCreate pressed", { numero, capacidade });
    const numVal = parseInt(numero, 10);
    const capVal = parseInt(capacidade, 10);
    if (!numero || isNaN(numVal) || numVal <= 0) { setFormError("Número da mesa inválido."); return; }
    if (!capacidade || isNaN(capVal) || capVal <= 0) { setFormError("Capacidade inválida."); return; }
    setSubmitting(true);
    setFormError("");
    try {
      console.log("[GestaoMesas] POST /api/mesas", { numero: numVal, capacidade: capVal });
      await apiPost("/api/mesas", { numero: numVal, capacidade: capVal });
      console.log("[GestaoMesas] Mesa criada com sucesso");
      router.back();
    } catch (e: any) {
      console.log("[GestaoMesas] Erro ao criar mesa", e);
      setFormError(e instanceof Error ? e.message : "Não foi possível criar a mesa.");
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle = { backgroundColor: COLORS.surfaceSecondary, borderRadius: 12, padding: 12, fontFamily: "Outfit_400Regular" as const, fontSize: 15, color: COLORS.text, borderWidth: 1, borderColor: COLORS.border };

  return (
    <>
      <Stack.Screen options={{ title: "Nova Mesa", headerTintColor: COLORS.primary, headerBackButtonDisplayMode: "minimal", headerStyle: { backgroundColor: COLORS.surface }, headerTitleStyle: { fontFamily: "Outfit_700Bold", color: COLORS.text } }} />
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: COLORS.background }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }} keyboardShouldPersistTaps="handled">
          <View style={{ backgroundColor: COLORS.surface, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: COLORS.border, gap: 16 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: COLORS.primaryMuted, alignItems: "center", justifyContent: "center" }}>
                <Plus size={18} color={COLORS.primary} />
              </View>
              <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 17, color: COLORS.text }}>Nova Mesa</Text>
            </View>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 13, color: COLORS.text }}>Número da Mesa *</Text>
                <TextInput value={numero} onChangeText={(t) => { setNumero(t); setFormError(""); }} placeholder="Ex: 1" placeholderTextColor={COLORS.textTertiary} keyboardType="number-pad" style={inputStyle} />
              </View>
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 13, color: COLORS.text }}>Capacidade *</Text>
                <TextInput value={capacidade} onChangeText={(t) => { setCapacidade(t); setFormError(""); }} placeholder="4" placeholderTextColor={COLORS.textTertiary} keyboardType="number-pad" style={inputStyle} />
              </View>
            </View>
            {formError ? <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 13, color: COLORS.danger }}>{formError}</Text> : null}
            <AnimatedPressable onPress={handleCreate} disabled={submitting} style={{ backgroundColor: COLORS.primary, borderRadius: 14, height: 50, alignItems: "center", justifyContent: "center", opacity: submitting ? 0.7 : 1 }}>
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 15, color: "#fff" }}>Adicionar Mesa</Text>}
            </AnimatedPressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}
