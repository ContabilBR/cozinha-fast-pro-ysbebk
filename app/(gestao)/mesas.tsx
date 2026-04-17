import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
} from "react-native";
import { Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { apiGet, apiPost, apiDelete } from "@/utils/api";
import { Plus, Trash2, Users, X } from "lucide-react-native";

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
        {livre && (
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
            {mesa.capacidade} lugares
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

  const [modalVisible, setModalVisible] = useState(false);
  const [numero, setNumero] = useState("");
  const [capacidade, setCapacidade] = useState("4");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const fetchMesas = useCallback(async () => {
    console.log("[GestaoMesas] Fetching mesas");
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

  const handleOpenModal = () => {
    console.log("[GestaoMesas] Open create modal");
    setNumero("");
    setCapacidade("4");
    setFormError("");
    setModalVisible(true);
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
    console.log("[GestaoMesas] POST /api/mesas numero:", numVal, "capacidade:", capVal);
    setSubmitting(true);
    setFormError("");
    try {
      await apiPost("/api/mesas", { numero: numVal, capacidade: capVal });
      console.log("[GestaoMesas] Mesa created successfully");
      setModalVisible(false);
      fetchMesas();
    } catch (e: any) {
      console.error("[GestaoMesas] Create error:", e instanceof Error ? e.message : String(e));
      setFormError(e instanceof Error ? e.message : "Não foi possível criar a mesa.");
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

      <View style={{ flex: 1, backgroundColor: COLORS.background }}>
        {loading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator color={COLORS.primary} size="large" />
          </View>
        ) : error ? (
          <View
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              padding: 32,
              gap: 12,
            }}
          >
            <Text
              style={{
                fontFamily: "Outfit_600SemiBold",
                fontSize: 17,
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
        ) : (
          <FlatList
            data={mesas}
            keyExtractor={(item) => item.id}
            numColumns={3}
            contentContainerStyle={{ padding: 8, paddingBottom: insets.bottom + 100 }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={COLORS.primary}
              />
            }
            renderItem={({ item }) => (
              <MesaCard mesa={item} onDelete={handleDelete} />
            )}
            ListEmptyComponent={
              <View
                style={{
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 48,
                  gap: 12,
                }}
              >
                <View
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: 20,
                    backgroundColor: COLORS.primaryMuted,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Users size={32} color={COLORS.primary} />
                </View>
                <Text
                  style={{
                    fontFamily: "Outfit_600SemiBold",
                    fontSize: 17,
                    color: COLORS.text,
                  }}
                >
                  Nenhuma mesa cadastrada
                </Text>
                <Text
                  style={{
                    fontFamily: "Outfit_400Regular",
                    fontSize: 14,
                    color: COLORS.textSecondary,
                    textAlign: "center",
                  }}
                >
                  Toque no botão + para adicionar mesas
                </Text>
              </View>
            }
          />
        )}

        {/* FAB */}
        <AnimatedPressable
          onPress={handleOpenModal}
          style={{
            position: "absolute",
            bottom: insets.bottom + 24,
            right: 20,
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: COLORS.primary,
            alignItems: "center",
            justifyContent: "center",
            shadowColor: COLORS.primary,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.4,
            shadowRadius: 8,
            elevation: 6,
          }}
        >
          <Plus size={24} color="#fff" />
        </AnimatedPressable>
      </View>

      {/* Create Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <View
            style={{
              flex: 1,
              justifyContent: "flex-end",
              backgroundColor: "rgba(0,0,0,0.5)",
            }}
          >
            <View
              style={{
                backgroundColor: COLORS.surface,
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                padding: 24,
                paddingBottom: insets.bottom + 24,
                gap: 16,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    fontFamily: "Outfit_700Bold",
                    fontSize: 20,
                    color: COLORS.text,
                  }}
                >
                  Nova Mesa
                </Text>
                <AnimatedPressable
                  onPress={() => {
                    console.log("[GestaoMesas] Close modal");
                    setModalVisible(false);
                  }}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: COLORS.surfaceSecondary,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <X size={16} color={COLORS.textSecondary} />
                </AnimatedPressable>
              </View>

              <View style={{ gap: 6 }}>
                <Text
                  style={{
                    fontFamily: "Outfit_600SemiBold",
                    fontSize: 14,
                    color: COLORS.text,
                  }}
                >
                  Número da Mesa *
                </Text>
                <TextInput
                  value={numero}
                  onChangeText={setNumero}
                  placeholder="Ex: 1"
                  placeholderTextColor={COLORS.textTertiary}
                  keyboardType="number-pad"
                  style={inputStyle}
                />
              </View>

              <View style={{ gap: 6 }}>
                <Text
                  style={{
                    fontFamily: "Outfit_600SemiBold",
                    fontSize: 14,
                    color: COLORS.text,
                  }}
                >
                  Capacidade *
                </Text>
                <TextInput
                  value={capacidade}
                  onChangeText={setCapacidade}
                  placeholder="4"
                  placeholderTextColor={COLORS.textTertiary}
                  keyboardType="number-pad"
                  style={inputStyle}
                />
              </View>

              {formError ? (
                <Text
                  style={{
                    fontFamily: "Outfit_400Regular",
                    fontSize: 13,
                    color: COLORS.danger,
                    textAlign: "center",
                  }}
                >
                  {formError}
                </Text>
              ) : null}

              <AnimatedPressable
                onPress={handleCreate}
                disabled={submitting}
                style={{
                  backgroundColor: COLORS.primary,
                  borderRadius: 14,
                  height: 52,
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
                      fontSize: 16,
                      color: "#fff",
                    }}
                  >
                    Criar Mesa
                  </Text>
                )}
              </AnimatedPressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}
