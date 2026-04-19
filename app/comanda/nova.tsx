import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
  FlatList,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { apiGet, apiPost } from "@/utils/api";
import { Users, ChevronDown, Lock, Check } from "lucide-react-native";

interface ApiMesa {
  id: string;
  numero: number;
  capacidade: number;
  status: string;
}

interface ApiGarcom {
  id: string;
  nome?: string;
  name?: string;
  email: string;
  role?: string;
}

function isDisponivel(status: string): boolean {
  return status === "disponivel" || status === "livre" || status === "free" || status === "available";
}

function getGarcomName(g: ApiGarcom): string {
  return g.nome || g.name || g.email || "";
}

export default function NovaComandaScreen() {
  const COLORS = useColors();
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ mesa_id?: string }>();

  const isGarcom = (user as any)?.role === "garcom";
  const hasMesaParam = !!params.mesa_id;
  const isLockedMode = isGarcom && hasMesaParam;

  const [mesas, setMesas] = useState<ApiMesa[]>([]);
  const [garcons, setGarcons] = useState<ApiGarcom[]>([]);
  const [selectedMesaId, setSelectedMesaId] = useState<string>(params.mesa_id ?? "");
  const [selectedGarcomId, setSelectedGarcomId] = useState<string>((user as any)?.id ?? "");
  const [showMesaPicker, setShowMesaPicker] = useState(false);
  const [showGarcomModal, setShowGarcomModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const fetchData = useCallback(async () => {
    console.log("[NovaComanda] GET /api/mesas e /api/usuarios/garcons");
    try {
      const [mesasRes, garConsRes] = await Promise.all([
        apiGet<any>("/api/mesas"),
        apiGet<any>("/api/usuarios/garcons"),
      ]);
      const allMesas: ApiMesa[] = Array.isArray(mesasRes) ? mesasRes : (mesasRes.mesas || []);
      const livres = allMesas.filter((m) => isDisponivel(m.status));
      console.log("[NovaComanda] Encontradas", livres.length, "mesas disponíveis");
      setMesas(livres);

      const rawList = Array.isArray(garConsRes)
        ? garConsRes
        : (garConsRes.garcons || garConsRes.usuarios || garConsRes.users || []);
      const garcomList: ApiGarcom[] = rawList;
      console.log("[NovaComanda] Encontrados", garcomList.length, "garçons");
      setGarcons(garcomList);

      // If current user not in list, pre-select them anyway by ID
      if (user && !(garcomList as ApiGarcom[]).find((g) => g.id === (user as any).id)) {
        console.log("[NovaComanda] Usuário atual não está na lista de garçons, mantendo seleção pelo ID");
      }
    } catch (e) {
      console.error("[NovaComanda] Erro ao carregar dados:", e);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (isLockedMode && user) {
      setSelectedGarcomId((user as any).id ?? "");
    }
  }, [isLockedMode, user]);

  const selectedMesa = mesas.find((m) => m.id === selectedMesaId);
  const selectedGarcom = garcons.find((g) => g.id === selectedGarcomId);

  // Display name for selected garçom — fall back to current user name if not in list
  const currentUserName = user?.nome || (user as any)?.name || (user as any)?.email || "Você";
  const selectedGarcomDisplay = selectedGarcom
    ? getGarcomName(selectedGarcom)
    : (selectedGarcomId === (user as any)?.id ? currentUserName : "Selecionar garçom");

  const handleSubmit = async () => {
    if (!selectedMesaId) { setError("Selecione uma mesa."); return; }
    console.log("[NovaComanda] Abrir comanda pressionado — mesa:", selectedMesaId, "garcom:", selectedGarcomId);
    setError("");
    setSubmitting(true);
    try {
      const garcomId = selectedGarcomId || (user as any)?.id || "";
      const payload: any = {
        mesa_id: selectedMesaId,
        garcom_id: garcomId,
        status: "aberta",
        total: 0,
      };
      console.log("[NovaComanda] POST /api/comandas", payload);
      const res = await apiPost<any>("/api/comandas", payload);
      const comandaId = res?.comanda?.id || res?.id;
      console.log("[NovaComanda] Comanda criada:", comandaId);
      if (comandaId) {
        router.replace(`/comanda/${comandaId}`);
      } else {
        router.back();
      }
    } catch (e: any) {
      console.error("[NovaComanda] Erro ao criar comanda:", e instanceof Error ? e.message : String(e));
      setError("Não foi possível abrir a comanda. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle = {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
  };

  const readonlyStyle = {
    ...inputStyle,
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        {/* Nav bar */}
        <View style={{
          flexDirection: "row",
          alignItems: "center",
          height: 56,
          paddingHorizontal: 16,
          borderBottomWidth: 1,
          borderBottomColor: COLORS.border,
          backgroundColor: COLORS.surface,
        }}>
          <AnimatedPressable
            onPress={() => { console.log("[NovaComanda] Botão voltar pressionado"); router.back(); }}
            style={{ flexDirection: "row", alignItems: "center", zIndex: 1, paddingVertical: 8, paddingRight: 8 }}
          >
            <Ionicons name="chevron-back" size={26} color="#007AFF" />
            <Text style={{ color: "#007AFF", fontSize: 17, fontWeight: "500" }}>Voltar</Text>
          </AnimatedPressable>
          <Text style={{
            position: "absolute",
            left: 0,
            right: 0,
            textAlign: "center",
            fontSize: 17,
            fontWeight: "700",
            color: COLORS.text,
            height: 56,
            lineHeight: 56,
          }}>
            Nova Comanda
          </Text>
        </View>

        {loading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator color={COLORS.primary} size="large" />
            <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 14, color: COLORS.textSecondary, marginTop: 12 }}>
              Carregando mesas e garçons...
            </Text>
          </View>
        ) : (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 20, gap: 20, paddingBottom: 48 }}
            keyboardShouldPersistTaps="handled"
          >

            {/* Mesa */}
            <View style={{ gap: 8 }}>
              <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 17, color: COLORS.text }}>Mesa</Text>

              {isLockedMode ? (
                <View style={readonlyStyle}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: COLORS.primaryMuted, alignItems: "center", justifyContent: "center" }}>
                      <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 16, color: COLORS.primary }}>
                        {selectedMesa?.numero ?? "?"}
                      </Text>
                    </View>
                    <View>
                      <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 14, color: COLORS.text }}>
                        Mesa {selectedMesa?.numero ?? params.mesa_id}
                      </Text>
                      {selectedMesa && (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                          <Users size={11} color={COLORS.textSecondary} />
                          <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 12, color: COLORS.textSecondary }}>
                            {selectedMesa.capacidade} lugares
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <Lock size={14} color={COLORS.textTertiary} />
                </View>
              ) : (
                <>
                  <AnimatedPressable
                    onPress={() => { console.log("[NovaComanda] Seletor de mesa alternado"); setShowMesaPicker((v) => !v); }}
                    style={inputStyle}
                  >
                    <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 15, color: selectedMesa ? COLORS.text : COLORS.textTertiary }}>
                      {selectedMesa ? `Mesa ${selectedMesa.numero} (${selectedMesa.capacidade} lugares)` : "Selecionar mesa disponível"}
                    </Text>
                    <ChevronDown size={16} color={COLORS.textSecondary} />
                  </AnimatedPressable>
                  {showMesaPicker && (
                    <View style={{ backgroundColor: COLORS.surface, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, overflow: "hidden" }}>
                      {mesas.length === 0 ? (
                        <View style={{ padding: 16 }}>
                          <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 14, color: COLORS.textSecondary }}>Nenhuma mesa disponível no momento</Text>
                        </View>
                      ) : (
                        mesas.map((mesa) => (
                          <AnimatedPressable
                            key={mesa.id}
                            onPress={() => { console.log("[NovaComanda] Mesa selecionada:", mesa.numero); setSelectedMesaId(mesa.id); setShowMesaPicker(false); setError(""); }}
                            style={{ padding: 14, borderBottomWidth: 1, borderBottomColor: COLORS.divider, backgroundColor: selectedMesaId === mesa.id ? COLORS.primaryMuted : "transparent", flexDirection: "row", alignItems: "center", gap: 10 }}
                          >
                            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: COLORS.primaryMuted, alignItems: "center", justifyContent: "center" }}>
                              <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 16, color: COLORS.primary }}>{mesa.numero}</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 14, color: COLORS.text }}>Mesa {mesa.numero}</Text>
                              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                                <Users size={11} color={COLORS.textSecondary} />
                                <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 12, color: COLORS.textSecondary }}>{mesa.capacidade} lugares</Text>
                              </View>
                            </View>
                            {selectedMesaId === mesa.id && <Check size={16} color={COLORS.primary} />}
                          </AnimatedPressable>
                        ))
                      )}
                    </View>
                  )}
                </>
              )}
            </View>

            {/* Garçom */}
            <View style={{ gap: 8 }}>
              <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 17, color: COLORS.text }}>Garçom responsável</Text>

              {isLockedMode ? (
                <View style={readonlyStyle}>
                  <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 15, color: COLORS.text }}>
                    {currentUserName}
                  </Text>
                  <Lock size={14} color={COLORS.textTertiary} />
                </View>
              ) : (
                <AnimatedPressable
                  onPress={() => { console.log("[NovaComanda] Abrir modal de garçons"); setShowGarcomModal(true); }}
                  style={inputStyle}
                >
                  <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 15, color: selectedGarcomId ? COLORS.text : COLORS.textTertiary }}>
                    {selectedGarcomDisplay}
                  </Text>
                  <ChevronDown size={16} color={COLORS.textSecondary} />
                </AnimatedPressable>
              )}
            </View>

            {!!error && (
              <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 13, color: COLORS.danger }}>{error}</Text>
            )}

            <AnimatedPressable
              onPress={() => { console.log("[NovaComanda] Abrir comanda pressionado"); handleSubmit(); }}
              disabled={submitting || !selectedMesaId}
              style={{ backgroundColor: COLORS.primary, borderRadius: 14, height: 52, alignItems: "center", justifyContent: "center", marginTop: 8, opacity: !selectedMesaId ? 0.6 : 1 }}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 16, color: "#fff" }}>Abrir Comanda</Text>
              )}
            </AnimatedPressable>
          </ScrollView>
        )}
      </KeyboardAvoidingView>

      {/* Garçom picker Modal */}
      <Modal
        visible={showGarcomModal}
        animationType="slide"
        transparent
        onRequestClose={() => { console.log("[NovaComanda] Modal garçom fechado"); setShowGarcomModal(false); }}
      >
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: COLORS.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "70%" }}>
            {/* Modal header */}
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: COLORS.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
              <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 18, color: COLORS.text }}>Selecionar Garçom</Text>
              <TouchableOpacity
                onPress={() => { console.log("[NovaComanda] Fechar modal garçom"); setShowGarcomModal(false); }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.surfaceSecondary, alignItems: "center", justifyContent: "center" }}
              >
                <Ionicons name="close" size={18} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            {garcons.length === 0 ? (
              <View style={{ padding: 40, alignItems: "center", gap: 12 }}>
                <Users size={32} color={COLORS.textTertiary} />
                <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 16, color: COLORS.text }}>Nenhum garçom encontrado</Text>
                <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 14, color: COLORS.textSecondary, textAlign: "center" }}>
                  Verifique se há garçons cadastrados no sistema.
                </Text>
              </View>
            ) : (
              <FlatList
                data={garcons}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ padding: 12, paddingBottom: 32, gap: 8 }}
                renderItem={({ item }) => {
                  const isSelected = selectedGarcomId === item.id;
                  const garcomDisplayName = getGarcomName(item);
                  const isCurrentUser = item.id === (user as any)?.id;
                  return (
                    <AnimatedPressable
                      onPress={() => {
                        console.log("[NovaComanda] Garçom selecionado:", garcomDisplayName);
                        setSelectedGarcomId(item.id);
                        setShowGarcomModal(false);
                      }}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 12,
                        padding: 14,
                        borderRadius: 12,
                        backgroundColor: isSelected ? COLORS.primaryMuted : COLORS.surface,
                        borderWidth: 1,
                        borderColor: isSelected ? COLORS.primary + "40" : COLORS.border,
                      }}
                    >
                      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: isSelected ? COLORS.primary : COLORS.surfaceSecondary, alignItems: "center", justifyContent: "center" }}>
                        <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 16, color: isSelected ? "#fff" : COLORS.textSecondary }}>
                          {garcomDisplayName.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 14, color: COLORS.text }}>{garcomDisplayName}</Text>
                          {isCurrentUser && (
                            <View style={{ backgroundColor: COLORS.primaryMuted, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                              <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 10, color: COLORS.primary }}>Você</Text>
                            </View>
                          )}
                        </View>
                        <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 12, color: COLORS.textSecondary }}>{item.email}</Text>
                      </View>
                      {isSelected && <Check size={18} color={COLORS.primary} />}
                    </AnimatedPressable>
                  );
                }}
              />
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
