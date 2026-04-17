import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { apiGet, apiPost, apiDelete } from "@/utils/api";
import { Trash2, Users, Plus } from "lucide-react-native";

interface ApiMesa {
  id: string;
  numero: number;
  capacidade: number;
  status: string;
}

function getMesaStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    livre: "Livre",
    disponivel: "Livre",
    free: "Livre",
    ocupada: "Ocupada",
    occupied: "Ocupada",
    reservada: "Reservada",
    reserved: "Reservada",
    aguardando_pedido: "Aguardando",
    em_preparacao: "Em Preparo",
    pedido_pronto: "Pronto",
    finalizada: "Finalizada",
  };
  return labels[status] || String(status);
}

function getMesaStatusColor(status: string): string {
  const map: Record<string, string> = {
    livre: "#22C55E",
    disponivel: "#22C55E",
    free: "#22C55E",
    ocupada: "#E8521A",
    occupied: "#E8521A",
    reservada: "#F59E0B",
    reserved: "#F59E0B",
    aguardando_pedido: "#3B82F6",
    em_preparacao: "#F59E0B",
    pedido_pronto: "#22C55E",
    finalizada: "#64748B",
  };
  return map[status] || "#94A3B8";
}

function isLivre(status: string): boolean {
  return status === "livre" || status === "disponivel" || status === "free";
}

function MesaCard({
  mesa,
  onDelete,
}: {
  mesa: ApiMesa;
  onDelete: (mesa: ApiMesa) => void;
}) {
  const COLORS = useColors();
  const statusColor = getMesaStatusColor(mesa.status);
  const statusLabel = getMesaStatusLabel(mesa.status);
  const livre = isLivre(mesa.status);
  const capacidadeText = `${mesa.capacidade} lugares`;

  return (
    <View
      style={{
        backgroundColor: COLORS.surface,
        borderRadius: 16,
        padding: 14,
        borderWidth: 2,
        borderColor: livre ? COLORS.border : statusColor + "50",
        flex: 1,
        margin: 5,
        minHeight: 120,
        justifyContent: "space-between",
      }}
    >
      <View
        style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}
      >
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            backgroundColor: statusColor + "18",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text
            style={{ fontFamily: "Outfit_700Bold", fontSize: 18, color: statusColor }}
          >
            {mesa.numero}
          </Text>
        </View>
        {livre ? (
          <AnimatedPressable
            onPress={() => {
              console.log("[GestaoMesas] Delete pressed for mesa:", mesa.id, "numero:", mesa.numero);
              onDelete(mesa);
            }}
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              backgroundColor: "#EF444418",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Trash2 size={14} color="#EF4444" />
          </AnimatedPressable>
        ) : (
          <View
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              backgroundColor: COLORS.surfaceSecondary,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Trash2 size={14} color={COLORS.textTertiary} />
          </View>
        )}
      </View>

      <View style={{ gap: 4, marginTop: 8 }}>
        <View
          style={{
            backgroundColor: statusColor + "20",
            borderRadius: 20,
            paddingHorizontal: 8,
            paddingVertical: 3,
            alignSelf: "flex-start",
          }}
        >
          <Text
            style={{ fontFamily: "Outfit_600SemiBold", fontSize: 10, color: statusColor }}
          >
            {statusLabel}
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
          <Users size={12} color={COLORS.textSecondary} />
          <Text
            style={{
              fontFamily: "Outfit_400Regular",
              fontSize: 11,
              color: COLORS.textSecondary,
            }}
          >
            {capacidadeText}
          </Text>
        </View>
      </View>
    </View>
  );
}

export default function GestaoMesasScreen() {
  const COLORS = useColors();
  const insets = useSafeAreaInsets();

  const [mesas, setMesas] = useState<ApiMesa[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [numero, setNumero] = useState("");
  const [capacidade, setCapacidade] = useState("4");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const fetchMesas = useCallback(async () => {
    console.log("[GestaoMesas] GET /api/mesas");
    try {
      const res = await apiGet<any>("/api/mesas");
      const list: ApiMesa[] = Array.isArray(res) ? res : (res.mesas ?? []);
      console.log("[GestaoMesas] Loaded", list.length, "mesas");
      setMesas(list);
      setError("");
    } catch (e: any) {
      console.error("[GestaoMesas] Error:", e instanceof Error ? e.message : String(e));
      setError("Não foi possível carregar as mesas.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchMesas();
  }, [fetchMesas]);

  const handleRefresh = () => {
    console.log("[GestaoMesas] Manual refresh");
    setRefreshing(true);
    fetchMesas();
  };

  const handleCreate = async () => {
    const numVal = parseInt(numero, 10);
    const capVal = parseInt(capacidade, 10);
    if (!numero || isNaN(numVal) || numVal <= 0) {
      setFormError("Número da mesa inválido.");
      return;
    }
    if (!capacidade || isNaN(capVal) || capVal <= 0) {
      setFormError("Capacidade inválida.");
      return;
    }
    const exists = mesas.some((m) => m.numero === numVal);
    if (exists) {
      setFormError("Número já existe.");
      return;
    }
    console.log("[GestaoMesas] POST /api/mesas numero:", numVal, "capacidade:", capVal);
    setSubmitting(true);
    setFormError("");
    try {
      await apiPost("/api/mesas", { numero: numVal, capacidade: capVal });
      console.log("[GestaoMesas] Mesa created successfully");
      setNumero("");
      setCapacidade("4");
      fetchMesas();
    } catch (e: any) {
      console.error("[GestaoMesas] Create error:", e instanceof Error ? e.message : String(e));
      const msg = e instanceof Error ? e.message : "Não foi possível criar a mesa.";
      setFormError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (mesa: ApiMesa) => {
    console.log("[GestaoMesas] Confirm delete mesa:", mesa.id, "numero:", mesa.numero);
    Alert.alert(
      "Excluir Mesa",
      `Deseja excluir a Mesa ${mesa.numero}?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: async () => {
            console.log("[GestaoMesas] DELETE /api/mesas/", mesa.id);
            try {
              await apiDelete(`/api/mesas/${mesa.id}`);
              console.log("[GestaoMesas] Mesa deleted:", mesa.id);
              setMesas((prev) => prev.filter((m) => m.id !== mesa.id));
            } catch (e: any) {
              console.error("[GestaoMesas] Delete error:", e instanceof Error ? e.message : String(e));
              Alert.alert("Erro", e instanceof Error ? e.message : "Não foi possível excluir a mesa.");
            }
          },
        },
      ]
    );
  };

  const inputStyle = {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 12,
    padding: 12,
    fontFamily: "Outfit_400Regular" as const,
    fontSize: 15,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  };

  // Build rows of 3 for the grid
  const rows: ApiMesa[][] = [];
  for (let i = 0; i < mesas.length; i += 3) {
    rows.push(mesas.slice(i, i + 3));
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: "Gerenciar Mesas",
          headerTintColor: COLORS.primary,
          headerBackButtonDisplayMode: "minimal",
          headerStyle: { backgroundColor: COLORS.surface },
          headerTitleStyle: { fontFamily: "Outfit_700Bold", color: COLORS.text },
        }}
      />

      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: COLORS.background }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={COLORS.primary}
            />
          }
          keyboardShouldPersistTaps="handled"
        >
          {/* Inline creation form */}
          <View
            style={{
              margin: 16,
              backgroundColor: COLORS.surface,
              borderRadius: 20,
              padding: 20,
              borderWidth: 1,
              borderColor: COLORS.border,
              gap: 14,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.06,
              shadowRadius: 8,
              elevation: 2,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor: COLORS.primaryMuted,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Plus size={18} color={COLORS.primary} />
              </View>
              <Text
                style={{
                  fontFamily: "Outfit_700Bold",
                  fontSize: 17,
                  color: COLORS.text,
                }}
              >
                Nova Mesa
              </Text>
            </View>

            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ flex: 1, gap: 6 }}>
                <Text
                  style={{
                    fontFamily: "Outfit_600SemiBold",
                    fontSize: 13,
                    color: COLORS.text,
                  }}
                >
                  Número da Mesa *
                </Text>
                <TextInput
                  value={numero}
                  onChangeText={(t) => {
                    setNumero(t);
                    setFormError("");
                  }}
                  placeholder="Ex: 1"
                  placeholderTextColor={COLORS.textTertiary}
                  keyboardType="number-pad"
                  style={inputStyle}
                />
              </View>
              <View style={{ flex: 1, gap: 6 }}>
                <Text
                  style={{
                    fontFamily: "Outfit_600SemiBold",
                    fontSize: 13,
                    color: COLORS.text,
                  }}
                >
                  Capacidade *
                </Text>
                <TextInput
                  value={capacidade}
                  onChangeText={(t) => {
                    setCapacidade(t);
                    setFormError("");
                  }}
                  placeholder="4"
                  placeholderTextColor={COLORS.textTertiary}
                  keyboardType="number-pad"
                  style={inputStyle}
                />
              </View>
            </View>

            {formError ? (
              <Text
                style={{
                  fontFamily: "Outfit_400Regular",
                  fontSize: 13,
                  color: COLORS.danger,
                }}
              >
                {formError}
              </Text>
            ) : null}

            <AnimatedPressable
              onPress={() => {
                console.log("[GestaoMesas] Adicionar Mesa pressed");
                handleCreate();
              }}
              disabled={submitting}
              style={{
                backgroundColor: COLORS.primary,
                borderRadius: 14,
                height: 50,
                alignItems: "center",
                justifyContent: "center",
                opacity: submitting ? 0.7 : 1,
              }}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text
                  style={{
                    fontFamily: "Outfit_700Bold",
                    fontSize: 15,
                    color: "#fff",
                  }}
                >
                  Adicionar Mesa
                </Text>
              )}
            </AnimatedPressable>
          </View>

          {/* Section header */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 20,
              paddingBottom: 8,
            }}
          >
            <Text
              style={{
                fontFamily: "Outfit_700Bold",
                fontSize: 16,
                color: COLORS.text,
              }}
            >
              Mesas Cadastradas
            </Text>
            <Text
              style={{
                fontFamily: "Outfit_400Regular",
                fontSize: 13,
                color: COLORS.textSecondary,
              }}
            >
              {mesas.length} mesa{mesas.length !== 1 ? "s" : ""}
            </Text>
          </View>

          {loading ? (
            <View style={{ alignItems: "center", paddingVertical: 48 }}>
              <ActivityIndicator color={COLORS.primary} size="large" />
            </View>
          ) : error ? (
            <View
              style={{
                alignItems: "center",
                padding: 32,
                gap: 12,
              }}
            >
              <Text
                style={{
                  fontFamily: "Outfit_600SemiBold",
                  fontSize: 15,
                  color: COLORS.text,
                  textAlign: "center",
                }}
              >
                {error}
              </Text>
              <AnimatedPressable
                onPress={fetchMesas}
                style={{
                  backgroundColor: COLORS.primary,
                  borderRadius: 12,
                  paddingHorizontal: 24,
                  paddingVertical: 12,
                }}
              >
                <Text
                  style={{ fontFamily: "Outfit_600SemiBold", fontSize: 15, color: "#fff" }}
                >
                  Tentar novamente
                </Text>
              </AnimatedPressable>
            </View>
          ) : mesas.length === 0 ? (
            <View
              style={{
                alignItems: "center",
                padding: 48,
                gap: 12,
              }}
            >
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 18,
                  backgroundColor: COLORS.primaryMuted,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Users size={28} color={COLORS.primary} />
              </View>
              <Text
                style={{
                  fontFamily: "Outfit_600SemiBold",
                  fontSize: 16,
                  color: COLORS.text,
                }}
              >
                Nenhuma mesa cadastrada
              </Text>
              <Text
                style={{
                  fontFamily: "Outfit_400Regular",
                  fontSize: 13,
                  color: COLORS.textSecondary,
                  textAlign: "center",
                }}
              >
                Use o formulário acima para adicionar mesas
              </Text>
            </View>
          ) : (
            <View style={{ paddingHorizontal: 8 }}>
              {rows.map((row, rowIdx) => (
                <View key={rowIdx} style={{ flexDirection: "row" }}>
                  {row.map((mesa) => (
                    <MesaCard key={mesa.id} mesa={mesa} onDelete={handleDelete} />
                  ))}
                  {/* Fill empty cells to keep grid alignment */}
                  {row.length < 3 &&
                    Array.from({ length: 3 - row.length }).map((_, i) => (
                      <View key={`empty-${i}`} style={{ flex: 1, margin: 5 }} />
                    ))}
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}
