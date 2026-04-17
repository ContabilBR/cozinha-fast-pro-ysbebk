import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  Animated,
} from "react-native";
import { Stack } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { CardSkeleton } from "@/components/SkeletonLoader";
import { apiGet, apiPost, apiPut, apiDelete } from "@/utils/api";
import { getMesaStatusLabel, getMesaStatusColor } from "@/utils/helpers";
import { Plus, Pencil, Trash2, X, LayoutGrid, Users } from "lucide-react-native";

interface ApiMesa {
  id: string;
  numero: number;
  capacidade: number;
  status: string;
}

function MesaCard({ mesa, index, onEdit, onDelete }: {
  mesa: ApiMesa;
  index: number;
  onEdit: (m: ApiMesa) => void;
  onDelete: (id: string) => void;
}) {
  const COLORS = useColors();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 350, delay: index * 60, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 350, delay: index * 60, useNativeDriver: true }),
    ]).start();
  }, [index, opacity, translateY]);

  const statusColor = getMesaStatusColor(mesa.status);
  const statusLabel = getMesaStatusLabel(mesa.status);

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      <View style={{
        backgroundColor: COLORS.surface,
        borderRadius: 14,
        padding: 14,
        marginHorizontal: 16,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: COLORS.border,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
      }}>
        <View style={{ width: 52, height: 52, borderRadius: 14, backgroundColor: statusColor + "18", alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 22, color: statusColor }}>{mesa.numero}</Text>
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 15, color: COLORS.text }}>Mesa {mesa.numero}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Users size={12} color={COLORS.textSecondary} />
              <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 12, color: COLORS.textSecondary }}>{mesa.capacidade} lugares</Text>
            </View>
            <View style={{ backgroundColor: statusColor + "20", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
              <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 11, color: statusColor }}>{statusLabel}</Text>
            </View>
          </View>
        </View>
        <AnimatedPressable
          onPress={() => { console.log("[GestaoMesas] Edit pressed:", mesa.id); onEdit(mesa); }}
          style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: COLORS.surfaceSecondary, alignItems: "center", justifyContent: "center" }}
        >
          <Pencil size={16} color={COLORS.textSecondary} />
        </AnimatedPressable>
        <AnimatedPressable
          onPress={() => { console.log("[GestaoMesas] Delete pressed:", mesa.id); onDelete(mesa.id); }}
          style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: COLORS.danger + "15", alignItems: "center", justifyContent: "center" }}
        >
          <Trash2 size={16} color={COLORS.danger} />
        </AnimatedPressable>
      </View>
    </Animated.View>
  );
}

export default function GestaoMesasScreen() {
  const COLORS = useColors();

  const [mesas, setMesas] = useState<ApiMesa[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editingMesa, setEditingMesa] = useState<ApiMesa | null>(null);
  const [numero, setNumero] = useState("");
  const [capacidade, setCapacidade] = useState("4");
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState("");

  const fetchMesas = useCallback(async () => {
    console.log("[GestaoMesas] GET /api/mesas");
    try {
      const res = await apiGet<any>("/api/mesas");
      const list: ApiMesa[] = Array.isArray(res) ? res : (res.mesas || []);
      console.log("[GestaoMesas] Loaded", list.length, "mesas");
      setMesas(list);
      setError("");
    } catch (e: any) {
      console.error("[GestaoMesas] Error:", e);
      setError("Não foi possível carregar as mesas.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchMesas(); }, [fetchMesas]);

  const handleRefresh = () => {
    console.log("[GestaoMesas] Manual refresh");
    setRefreshing(true);
    fetchMesas();
  };

  const openCreate = () => {
    console.log("[GestaoMesas] Open create modal");
    setEditingMesa(null);
    setNumero(""); setCapacidade("4"); setModalError("");
    setShowModal(true);
  };

  const openEdit = (m: ApiMesa) => {
    console.log("[GestaoMesas] Open edit modal:", m.id);
    setEditingMesa(m);
    setNumero(String(m.numero)); setCapacidade(String(m.capacidade)); setModalError("");
    setShowModal(true);
  };

  const handleSave = async () => {
    const numVal = parseInt(numero, 10);
    const capVal = parseInt(capacidade, 10);
    if (!numero || isNaN(numVal) || numVal <= 0) { setModalError("Número da mesa inválido."); return; }
    if (!capacidade || isNaN(capVal) || capVal <= 0) { setModalError("Capacidade inválida."); return; }
    console.log("[GestaoMesas] Save pressed, editingMesa:", editingMesa?.id ?? "new");
    setSaving(true); setModalError("");
    try {
      if (editingMesa) {
        console.log("[GestaoMesas] PUT /api/mesas/" + editingMesa.id);
        await apiPut(`/api/mesas/${editingMesa.id}`, { numero: numVal, capacidade: capVal });
        console.log("[GestaoMesas] Mesa atualizada:", editingMesa.id);
      } else {
        console.log("[GestaoMesas] POST /api/mesas", { numero: numVal, capacidade: capVal });
        await apiPost("/api/mesas", { numero: numVal, capacidade: capVal });
        console.log("[GestaoMesas] Mesa criada");
      }
      setShowModal(false);
      await fetchMesas();
    } catch (e: any) {
      console.error("[GestaoMesas] Save error:", e);
      setModalError(e instanceof Error ? e.message : "Não foi possível salvar a mesa.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: string) => {
    console.log("[GestaoMesas] Delete confirm for:", id);
    Alert.alert(
      "Excluir mesa?",
      "Esta ação não pode ser desfeita.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: async () => {
            console.log("[GestaoMesas] DELETE /api/mesas/" + id);
            try {
              await apiDelete(`/api/mesas/${id}`);
              console.log("[GestaoMesas] Mesa excluída:", id);
              setMesas((prev) => prev.filter((m) => m.id !== id));
            } catch (e: any) {
              console.error("[GestaoMesas] Delete error:", e);
              Alert.alert("Erro", "Não foi possível excluir a mesa.");
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
          title: "Mesas",
          headerTintColor: COLORS.primary,
          headerBackButtonDisplayMode: "minimal",
          headerStyle: { backgroundColor: COLORS.surface },
          headerTitleStyle: { fontFamily: "Outfit_700Bold", color: COLORS.text },
        }}
      />
      <View style={{ flex: 1, backgroundColor: COLORS.background }}>
        {loading ? (
          <View style={{ paddingTop: 16 }}>
            {[0, 1, 2].map((i) => <CardSkeleton key={i} />)}
          </View>
        ) : error ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 }}>
            <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 17, color: COLORS.text }}>Erro ao carregar mesas</Text>
            <AnimatedPressable onPress={fetchMesas} style={{ backgroundColor: COLORS.primary, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 }}>
              <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 15, color: "#fff" }}>Tentar novamente</Text>
            </AnimatedPressable>
          </View>
        ) : (
          <FlatList
            data={mesas}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingTop: 16, paddingBottom: 120 }}
            contentInsetAdjustmentBehavior="automatic"
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.primary} />}
            renderItem={({ item, index }) => (
              <MesaCard mesa={item} index={index} onEdit={openEdit} onDelete={handleDelete} />
            )}
            ListEmptyComponent={
              <View style={{ alignItems: "center", justifyContent: "center", padding: 48, gap: 12 }}>
                <View style={{ width: 72, height: 72, borderRadius: 20, backgroundColor: COLORS.primaryMuted, alignItems: "center", justifyContent: "center" }}>
                  <LayoutGrid size={32} color={COLORS.primary} />
                </View>
                <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 17, color: COLORS.text }}>Nenhuma mesa cadastrada</Text>
                <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 14, color: COLORS.textSecondary, textAlign: "center" }}>
                  Adicione mesas para gerenciar o salão
                </Text>
              </View>
            }
          />
        )}

        <AnimatedPressable
          onPress={openCreate}
          style={{
            position: "absolute",
            bottom: 20,
            right: 20,
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: COLORS.primary,
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 4px 16px rgba(232, 82, 26, 0.4)",
          }}
        >
          <Plus size={24} color="#fff" />
        </AnimatedPressable>

        <Modal visible={showModal} transparent animationType="fade" onRequestClose={() => setShowModal(false)}>
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center", padding: 24 }}>
            <View style={{ backgroundColor: COLORS.surface, borderRadius: 20, padding: 24, width: "100%", maxWidth: 380, gap: 16 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 20, color: COLORS.text }}>
                  {editingMesa ? "Editar Mesa" : "Nova Mesa"}
                </Text>
                <AnimatedPressable
                  onPress={() => { console.log("[GestaoMesas] Modal closed"); setShowModal(false); }}
                  style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.surfaceSecondary, alignItems: "center", justifyContent: "center" }}
                >
                  <X size={16} color={COLORS.textSecondary} />
                </AnimatedPressable>
              </View>

              <View style={{ flexDirection: "row", gap: 12 }}>
                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 14, color: COLORS.text }}>Número *</Text>
                  <TextInput value={numero} onChangeText={(t) => { setNumero(t); setModalError(""); }} placeholder="Ex: 1" placeholderTextColor={COLORS.textTertiary} keyboardType="number-pad" style={inputStyle} autoFocus />
                </View>
                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 14, color: COLORS.text }}>Capacidade *</Text>
                  <TextInput value={capacidade} onChangeText={(t) => { setCapacidade(t); setModalError(""); }} placeholder="4" placeholderTextColor={COLORS.textTertiary} keyboardType="number-pad" style={inputStyle} />
                </View>
              </View>

              {modalError ? <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 13, color: COLORS.danger }}>{modalError}</Text> : null}

              <AnimatedPressable
                onPress={handleSave}
                disabled={saving}
                style={{ backgroundColor: COLORS.primary, borderRadius: 14, height: 52, alignItems: "center", justifyContent: "center" }}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 16, color: "#fff" }}>
                    {editingMesa ? "Salvar alterações" : "Adicionar mesa"}
                  </Text>
                )}
              </AnimatedPressable>
            </View>
          </View>
        </Modal>
      </View>
    </>
  );
}
