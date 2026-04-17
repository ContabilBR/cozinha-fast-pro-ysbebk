import React, { useState } from "react";
import { View, Text, TextInput, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { Stack, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { apiPost } from "@/utils/api";
import { Plus } from "lucide-react-native";

export default function GestaoCategorias() {
  const COLORS = useColors();
  const insets = useSafeAreaInsets();
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const handleCreate = async () => {
    console.log("[GestaoCategorias] handleCreate pressed", { nome, descricao });
    if (!nome.trim()) { setFormError("Nome é obrigatório."); return; }
    setSubmitting(true);
    setFormError("");
    try {
      console.log("[GestaoCategorias] POST /api/categorias", { nome: nome.trim(), descricao: descricao.trim() || undefined });
      await apiPost("/api/categorias", { nome: nome.trim(), descricao: descricao.trim() || undefined });
      console.log("[GestaoCategorias] Categoria criada com sucesso");
      router.back();
    } catch (e: any) {
      console.log("[GestaoCategorias] Erro ao criar categoria", e);
      setFormError(e instanceof Error ? e.message : "Não foi possível criar a categoria.");
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle = { backgroundColor: COLORS.surfaceSecondary, borderRadius: 12, padding: 12, fontFamily: "Outfit_400Regular" as const, fontSize: 15, color: COLORS.text, borderWidth: 1, borderColor: COLORS.border };

  return (
    <>
      <Stack.Screen options={{ title: "Nova Categoria", headerTintColor: COLORS.primary, headerBackButtonDisplayMode: "minimal", headerStyle: { backgroundColor: COLORS.surface }, headerTitleStyle: { fontFamily: "Outfit_700Bold", color: COLORS.text } }} />
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: COLORS.background }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }} keyboardShouldPersistTaps="handled">
          <View style={{ backgroundColor: COLORS.surface, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: COLORS.border, gap: 16 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: "#8B5CF618", alignItems: "center", justifyContent: "center" }}>
                <Plus size={18} color="#8B5CF6" />
              </View>
              <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 17, color: COLORS.text }}>Nova Categoria</Text>
            </View>
            <View style={{ gap: 6 }}>
              <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 13, color: COLORS.text }}>Nome *</Text>
              <TextInput value={nome} onChangeText={(t) => { setNome(t); setFormError(""); }} placeholder="Ex: Entradas" placeholderTextColor={COLORS.textTertiary} style={inputStyle} />
            </View>
            <View style={{ gap: 6 }}>
              <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 13, color: COLORS.text }}>Descrição</Text>
              <TextInput value={descricao} onChangeText={setDescricao} placeholder="Descrição opcional" placeholderTextColor={COLORS.textTertiary} multiline numberOfLines={3} style={[inputStyle, { minHeight: 80, textAlignVertical: "top" }]} />
            </View>
            {formError ? <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 13, color: COLORS.danger }}>{formError}</Text> : null}
            <AnimatedPressable onPress={handleCreate} disabled={submitting} style={{ backgroundColor: "#8B5CF6", borderRadius: 14, height: 50, alignItems: "center", justifyContent: "center", opacity: submitting ? 0.7 : 1 }}>
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 15, color: "#fff" }}>Adicionar Categoria</Text>}
            </AnimatedPressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}
