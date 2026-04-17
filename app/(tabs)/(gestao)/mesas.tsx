import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { CardSkeleton } from "@/components/SkeletonLoader";
import { apiGet, apiPost, apiPut, apiDelete } from "@/utils/api";
import { getMesaStatusLabel, getMesaStatusColor } from "@/utils/helpers";
import { X, LayoutGrid, Users, Search } from "lucide-react-native";

interface ApiMesa {
  id: string;
  numero: number;
  capacidade: number;
  status: string;
}

const STATUS_OPTIONS = [
  { value: "disponivel", label: "Disponível" },
  { value: "ocupada", label: "Ocupada" },
  { value: "reservada", label: "Reservada" },
];

export default function GestaoMesasScreen() {
  const COLORS = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [mesas, setMesas] = useState<ApiMesa[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editingMesa, setEditingMesa] = useState<ApiMesa | null>(null);
  const [numero, setNumero] = useState("");
  const [capacidade, setCapacidade] = useState("4");
  const [status, setStatus] = useState("disponivel");
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState("");

  const fetchMesas = useCallback(async () => {
    console.log("[GestaoMesas] GET /api/mesas");
    try {
      const res = await apiGet<any>("/api/mesas");
      const list: ApiMesa[] = Array.isArray(res) ? res : (res.mesas || []);
      console.log("[GestaoMesas] Carregadas", list.length, "mesas");
      setMesas(list);
      setError("");
    } catch (e: unknown) {
      console.error("[GestaoMesas] Erro:", e);
      setError("Não foi possível carregar as mesas.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchMesas(); }, [fetchMesas]);

  const handleRefresh = () => {
    console.log("[GestaoMesas] Refresh manual");
    setRefreshing(true);
    fetchMesas();
  };

  const openCreate = () => {
    console.log("[GestaoMesas] Abrir modal de criação");
    setEditingMesa(null);
    setNumero(""); setCapacidade("4"); setStatus("disponivel"); setModalError("");
    setShowModal(true);
  };

  const openEdit = (m: ApiMesa) => {
    console.log("[GestaoMesas] Abrir modal de edição:", m.id);
    setEditingMesa(m);
    setNumero(String(m.numero)); setCapacidade(String(m.capacidade)); setStatus(m.status || "disponivel"); setModalError("");
    setShowModal(true);
  };

  const handleSave = async () => {
    const numVal = parseInt(numero, 10);
    const capVal = parseInt(capacidade, 10);
    if (!numero || isNaN(numVal) || numVal <= 0) { setModalError("Número da mesa inválido."); return; }
    if (!capacidade || isNaN(capVal) || capVal <= 0) { setModalError("Capacidade inválida."); return; }
    console.log("[GestaoMesas] Salvar pressionado, editando:", editingMesa?.id ?? "novo");
    setSaving(true); setModalError("");
    try {
      if (editingMesa) {
        console.log("[GestaoMesas] PUT /api/mesas/" + editingMesa.id);
        await apiPut(`/api/mesas/${editingMesa.id}`, { numero: numVal, capacidade: capVal, status });
        console.log("[GestaoMesas] Mesa atualizada:", editingMesa.id);
      } else {
        console.log("[GestaoMesas] POST /api/mesas", { numero: numVal, capacidade: capVal, status });
        await apiPost("/api/mesas", { numero: numVal, capacidade: capVal, status });
        console.log("[GestaoMesas] Mesa criada");
      }
      setShowModal(false);
      await fetchMesas();
    } catch (e: unknown) {
      console.error("[GestaoMesas] Erro ao salvar:", e);
      setModalError(e instanceof Error ? e.message : "Não foi possível salvar a mesa.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: string, numeroMesa: number) => {
    const nomeMesa = `Mesa ${numeroMesa}`;
    console.log("[GestaoMesas] Confirmar exclusão:", id, nomeMesa);
    Alert.alert(
      "Excluir mesa?",
      `Deseja realmente excluir "${nomeMesa}"?\n\nEsta ação não pode ser desfeita.`,
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
            } catch (e: unknown) {
              console.error("[GestaoMesas] Erro ao excluir:", e);
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

  const searchLower = search.toLowerCase();
  const filteredMesas = search.trim()
    ? mesas.filter((m) => String(m.numero).includes(searchLower) || getMesaStatusLabel(m.status).toLowerCase().includes(searchLower))
    : mesas;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      {/* Nav bar */}
      <View style={{
        flexDirection: "row",
        alignItems: "center",
        height: 56 + insets.top,
        paddingTop: insets.top,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: "#e0e0e0",
        backgroundColor: "#fff",
      }}>
        <TouchableOpacity
          onPress={() => { console.log("[GestaoMesas] Botão voltar pressionado"); router.back(); }}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={{ flexDirection: "row", alignItems: "center", zIndex: 1 }}
        >
          <Ionicons name="chevron-back" size={26} color="#007AFF" />
          <Text style={{ color: "#007AFF", fontSize: 17, fontWeight: "500" }}>Voltar</Text>
        </TouchableOpacity>
        <Text style={{
          position: "absolute",
          left: 0,
          right: 0,
          textAlign: "center",
          fontSize: 17,
          fontWeight: "700",
          color: "#111",
          top: insets.top,
          height: 56,
          lineHeight: 56,
        }}>
          Mesas
        </Text>
        <View style={{ flex: 1 }} />
        <TouchableOpacity
          onPress={() => { console.log("[GestaoMesas] Botão incluir pressionado"); openCreate(); }}
          style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#34C759", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, gap: 6 }}
        >
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Incluir</Text>
        </TouchableOpacity>
      </View>

      {/* Search bar */}
      <View style={{ paddingHorizontal: 12, paddingVertical: 10, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#f0f0f0" }}>
        <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#F2F2F7", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, gap: 8 }}>
          <Search size={16} color="#8E8E93" />
          <TextInput
            value={search}
            onChangeText={(t) => { console.log("[GestaoMesas] Busca:", t); setSearch(t); }}
            placeholder="Buscar..."
            placeholderTextColor="#8E8E93"
            style={{ flex: 1, fontFamily: "Outfit_400Regular", fontSize: 15, color: "#111", padding: 0 }}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Ionicons name="close-circle" size={16} color="#8E8E93" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading ? (
        <View style={{ paddingTop: 16 }}>
          {[0, 1, 2].map((i) => <CardSkeleton key={i} />)}
        </View>
      ) : error ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 }}>
          <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 17, color: COLORS.text }}>Erro ao carregar mesas</Text>
          <TouchableOpacity onPress={fetchMesas} style={{ backgroundColor: COLORS.primary, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 }}>
            <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 15, color: "#fff" }}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredMesas}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 12, paddingBottom: 120 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.primary} />}
          renderItem={({ item }) => {
            const statusColor = getMesaStatusColor(item.status);
            const statusLabel = getMesaStatusLabel(item.status);
            const numeroStr = String(item.numero);
            return (
              <View style={{ backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 10, flexDirection: "row", alignItems: "center", shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 }}>
                <View style={{ width: 52, height: 52, borderRadius: 14, backgroundColor: statusColor + "18", alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                  <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 22, color: statusColor }}>{numeroStr}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: "600", color: "#111" }}>Mesa {item.numero}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Users size={12} color={COLORS.textSecondary} />
                      <Text style={{ fontSize: 12, color: COLORS.textSecondary }}>{item.capacidade} lugares</Text>
                    </View>
                    <View style={{ backgroundColor: statusColor + "20", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                      <Text style={{ fontSize: 11, fontWeight: "600", color: statusColor }}>{statusLabel}</Text>
                    </View>
                  </View>
                </View>
                <View style={{ gap: 6 }}>
                  <TouchableOpacity
                    onPress={() => { console.log("[GestaoMesas] Editar pressionado:", item.id); openEdit(item); }}
                    style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#007AFF", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 7, gap: 4 }}
                  >
                    <Ionicons name="pencil" size={14} color="#fff" />
                    <Text style={{ color: "#fff", fontWeight: "600", fontSize: 13 }}>Editar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => { console.log("[GestaoMesas] Excluir pressionado:", item.id); handleDelete(item.id, item.numero); }}
                    style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#FF3B30", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 7, gap: 4 }}
                  >
                    <Ionicons name="trash" size={14} color="#fff" />
                    <Text style={{ color: "#fff", fontWeight: "600", fontSize: 13 }}>Excluir</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={{ alignItems: "center", justifyContent: "center", padding: 48, gap: 12 }}>
              <LayoutGrid size={32} color={COLORS.textTertiary} />
              <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 17, color: COLORS.text }}>
                {search.trim() ? "Nenhum resultado encontrado" : "Nenhuma mesa cadastrada"}
              </Text>
              <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 14, color: COLORS.textSecondary, textAlign: "center" }}>
                {search.trim() ? "Tente outro termo de busca" : "Toque em \"Incluir\" para adicionar mesas"}
              </Text>
            </View>
          }
        />
      )}

      <Modal visible={showModal} transparent animationType="fade" onRequestClose={() => setShowModal(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <View style={{ backgroundColor: COLORS.surface, borderRadius: 20, padding: 24, width: "100%", maxWidth: 380, gap: 16 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 20, color: COLORS.text }}>
                {editingMesa ? "Editar Mesa" : "Nova Mesa"}
              </Text>
              <TouchableOpacity
                onPress={() => { console.log("[GestaoMesas] Modal fechado"); setShowModal(false); }}
                style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.surfaceSecondary, alignItems: "center", justifyContent: "center" }}
              >
                <X size={16} color={COLORS.textSecondary} />
              </TouchableOpacity>
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

            <View style={{ gap: 6 }}>
              <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 14, color: COLORS.text }}>Status</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {STATUS_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    onPress={() => { console.log("[GestaoMesas] Status selecionado:", opt.value); setStatus(opt.value); }}
                    style={{
                      flex: 1,
                      paddingVertical: 8,
                      borderRadius: 10,
                      alignItems: "center",
                      backgroundColor: status === opt.value ? COLORS.primary : COLORS.surfaceSecondary,
                      borderWidth: 1,
                      borderColor: status === opt.value ? COLORS.primary : COLORS.border,
                    }}
                  >
                    <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 12, color: status === opt.value ? "#fff" : COLORS.textSecondary }}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {modalError ? <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 13, color: COLORS.danger }}>{modalError}</Text> : null}

            <TouchableOpacity
              onPress={() => { console.log("[GestaoMesas] Salvar mesa pressionado"); handleSave(); }}
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
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
