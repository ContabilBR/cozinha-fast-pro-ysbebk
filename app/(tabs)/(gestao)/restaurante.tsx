import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ChevronLeft, CheckCircle } from "lucide-react-native";
import { useColors } from "@/hooks/useColors";
import { apiGet, apiPut } from "@/utils/api";

interface RestauranteData {
  nome: string;
  filial: string;
  endereco: string;
  cnpj: string;
}

export default function RestauranteScreen() {
  const COLORS = useColors();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  const [nome, setNome] = useState("");
  const [filial, setFilial] = useState("");
  const [endereco, setEndereco] = useState("");
  const [cnpj, setCnpj] = useState("");

  const handleBack = useCallback(() => {
    console.log("[RestauranteScreen] back pressed");
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)/(gestao)");
    }
  }, [router]);

  useEffect(() => {
    const fetchData = async () => {
      console.log("[RestauranteScreen] fetching GET /api/restaurante");
      try {
        const data = await apiGet<RestauranteData>("/api/restaurante");
        console.log("[RestauranteScreen] loaded restaurante data", data);
        setNome(data?.nome ?? "");
        setFilial(data?.filial ?? "");
        setEndereco(data?.endereco ?? "");
        setCnpj(data?.cnpj ?? "");
      } catch (err: any) {
        console.warn("[RestauranteScreen] GET /api/restaurante error:", err?.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleSave = async () => {
    console.log("[RestauranteScreen] save button pressed", { nome, filial, endereco, cnpj });
    if (!nome.trim()) {
      setSaveError("O nome do restaurante é obrigatório.");
      return;
    }
    setSaveError(null);
    setSaving(true);
    try {
      const payload: RestauranteData = {
        nome: nome.trim(),
        filial: filial.trim(),
        endereco: endereco.trim(),
        cnpj: cnpj.trim(),
      };
      console.log("[RestauranteScreen] PUT /api/restaurante", payload);
      await apiPut("/api/restaurante", payload);
      console.log("[RestauranteScreen] save success");
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
      }, 1500);
    } catch (err: any) {
      console.error("[RestauranteScreen] PUT /api/restaurante error:", err?.message);
      setSaveError(err?.message ?? "Erro ao salvar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: "Outfit_400Regular",
    fontSize: 15,
    color: COLORS.text,
  };

  const labelStyle = {
    fontFamily: "Outfit_600SemiBold",
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 6,
    marginLeft: 2,
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }} edges={["top", "left", "right"]}>
      {/* Nav bar */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 12,
          paddingVertical: 10,
          backgroundColor: COLORS.surface,
          borderBottomWidth: 1,
          borderBottomColor: COLORS.border,
        }}
      >
        <TouchableOpacity
          onPress={handleBack}
          style={{ width: 80, flexDirection: "row", alignItems: "center", gap: 2 }}
          activeOpacity={0.7}
        >
          <ChevronLeft size={20} color="#007AFF" />
          <Text style={{ fontFamily: "Outfit_500Medium", fontSize: 16, color: "#007AFF" }}>Voltar</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 17, color: COLORS.text }}>Restaurante</Text>
        </View>
        <View style={{ width: 80 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        {loading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={{ padding: 20, paddingBottom: 120, gap: 20 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Nome */}
            <View>
              <Text style={labelStyle}>Nome do Restaurante *</Text>
              <TextInput
                style={inputStyle}
                value={nome}
                onChangeText={(v) => { console.log("[RestauranteScreen] nome changed"); setNome(v); }}
                placeholder="Ex: CozinhaFast Pro"
                placeholderTextColor={COLORS.textTertiary}
                returnKeyType="next"
              />
            </View>

            {/* Filial */}
            <View>
              <Text style={labelStyle}>Filial</Text>
              <TextInput
                style={inputStyle}
                value={filial}
                onChangeText={(v) => { console.log("[RestauranteScreen] filial changed"); setFilial(v); }}
                placeholder="Ex: Unidade Centro"
                placeholderTextColor={COLORS.textTertiary}
                returnKeyType="next"
              />
            </View>

            {/* Endereço */}
            <View>
              <Text style={labelStyle}>Endereço</Text>
              <TextInput
                style={[inputStyle, { minHeight: 90, textAlignVertical: "top" }]}
                value={endereco}
                onChangeText={(v) => { console.log("[RestauranteScreen] endereco changed"); setEndereco(v); }}
                placeholder="Rua, número, bairro, cidade..."
                placeholderTextColor={COLORS.textTertiary}
                multiline
                returnKeyType="next"
              />
            </View>

            {/* CNPJ */}
            <View>
              <Text style={labelStyle}>CNPJ</Text>
              <TextInput
                style={inputStyle}
                value={cnpj}
                onChangeText={(v) => { console.log("[RestauranteScreen] cnpj changed"); setCnpj(v); }}
                placeholder="00.000.000/0000-00"
                placeholderTextColor={COLORS.textTertiary}
                keyboardType="numeric"
                returnKeyType="done"
              />
            </View>

            {/* Error */}
            {saveError ? (
              <View
                style={{
                  backgroundColor: "#FEE2E2",
                  borderRadius: 10,
                  padding: 14,
                  borderWidth: 1,
                  borderColor: "#FECACA",
                }}
              >
                <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 14, color: "#DC2626" }}>{saveError}</Text>
              </View>
            ) : null}

            {/* Save button */}
            <TouchableOpacity
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.8}
              style={{
                backgroundColor: COLORS.primary,
                borderRadius: 14,
                paddingVertical: 16,
                alignItems: "center",
                justifyContent: "center",
                opacity: saving ? 0.7 : 1,
                marginTop: 4,
              }}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 16, color: "#fff" }}>Salvar</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        )}
      </KeyboardAvoidingView>

      {/* Success Modal */}
      <Modal transparent visible={showSuccess} animationType="fade">
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.35)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <View
            style={{
              backgroundColor: COLORS.surface,
              borderRadius: 20,
              padding: 32,
              alignItems: "center",
              gap: 12,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.15,
              shadowRadius: 24,
              elevation: 10,
              minWidth: 240,
            }}
          >
            <CheckCircle size={48} color="#22C55E" />
            <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 17, color: COLORS.text, textAlign: "center" }}>
              Dados salvos com sucesso!
            </Text>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
