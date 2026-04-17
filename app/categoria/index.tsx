import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  Modal,
  Alert,
  TouchableOpacity,
  SafeAreaView,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { CardSkeleton } from "@/components/SkeletonLoader";
import { Categoria } from "@/types";
import { apiGet, apiPost, apiPut, apiDelete } from "@/utils/api";
import { Plus, Pencil, Trash2, X, Tag } from "lucide-react-native";

export default function CategoriasScreen() {
  const COLORS = useColors();
  const router = useRouter();

  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState("");

  const fetchCategorias = useCallback(async () => {
    console.log("[Categorias] GET /api/categorias");
    try {
      const res = await apiGet<any>("/api/categorias");
      const list: Categoria[] = Array.isArray(res) ? res : (res.categorias || []);
      console.log("[Categorias] Carregadas", list.length, "categorias");
      setCategorias(list);
      setError("");
    } catch (e: any) {
      console.error("[Categorias] Erro:", e);
      setError("Não foi possível carregar as categorias.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchCategorias(); }, [fetchCategorias]);

  const handleRefresh = () => {
    console.log("[Categorias] Refresh manual");
    setRefreshing(true);
    fetchCategorias();
  };

  const openCreate = () => {
    console.log("[Categorias] Abrir modal de criação");
    setEditingId(null);
    setNome("");
    setDescricao("");
    setModalError("");
    setShowModal(true);
  };

  const openEdit = (cat: Categoria) => {
    console.log("[Categorias] Abrir modal de edição:", cat.id);
    setEditingId(cat.id);
    setNome(cat.nome);
    setDescricao(cat.descricao ?? "");
    setModalError("");
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!nome.trim()) { setModalError("Nome é obrigatório."); return; }
    console.log("[Categorias] Salvar pressionado, editingId:", editingId);
    setSaving(true);
    setModalError("");
    try {
      if (editingId) {
        console.log("[Categorias] PUT /api/categorias/" + editingId);
        await apiPut(`/api/categorias/${editingId}`, { nome: nome.trim(), descricao: descricao.trim() || undefined });
        console.log("[Categorias] Categoria atualizada:", editingId);
      } else {
        console.log("[Categorias] POST /api/categorias");
        await apiPost("/api/categorias", { nome: nome.trim(), descricao: descricao.trim() || undefined });
        console.log("[Categorias] Categoria criada");
      }
      setShowModal(false);
      await fetchCategorias();
    } catch (e: any) {
      console.error("[Categorias] Erro ao salvar:", e);
      setModalError("Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: string, nomeCategoria: string) => {
    console.log("[Categorias] Confirmar exclusão:", id, nomeCategoria);
    Alert.alert(
      "Excluir categoria?",
      `Deseja realmente excluir "${nomeCategoria}"?\n\nEsta ação não pode ser desfeita.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: async () => {
            console.log("[Categorias] DELETE /api/categorias/" + id);
            try {
              await apiDelete(`/api/categorias/${id}`);
              console.log("[Categorias] Categoria excluída:", id);
              setCategorias((prev) => prev.filter((c) => c.id !== id));
            } catch (e: any) {
              console.error("[Categorias] Erro ao excluir:", e);
              Alert.alert("Erro", "Não foi possível excluir a categoria.");
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
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      {/* Nav bar */}
      <View style={{
        flexDirection: "row",
        alignItems: "center",
        height: 56,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: "#e0e0e0",
        backgroundColor: "#fff",
      }}>
        <TouchableOpacity
          onPress={() => { console.log("[Categorias] Botão voltar pressionado"); router.back(); }}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={{ flexDirection: "row", alignItems: "center", zIndex: 1 }}
        >
          <Ionicons name="chevron-back" size={26} color="#007AFF" />
          <Text style={{ color: "#007AFF", fontSize: 17, fontWeight: "500" }}>Voltar</Text>
        </TouchableOpacity>
        <Text style={{ position: "absolute", left: 0, right: 0, textAlign: "center", fontSize: 17, fontWeight: "700", color: "#111" }}>
          Categorias
        </Text>
        <View style={{ flex: 1 }} />
        <TouchableOpacity
          onPress={() => { console.log("[Categorias] Botão incluir pressionado"); openCreate(); }}
          style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#34C759", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, gap: 6 }}
        >
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Incluir</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={{ padding: 16, gap: 12 }}>
          {[0, 1, 2].map((i) => <CardSkeleton key={i} />)}
        </View>
      ) : error ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 }}>
          <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 17, color: COLORS.text }}>Erro ao carregar categorias</Text>
          <AnimatedPressable
            onPress={fetchCategorias}
            style={{ backgroundColor: COLORS.primary, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 }}
          >
            <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 15, color: "#fff" }}>Tentar novamente</Text>
          </AnimatedPressable>
        </View>
      ) : (
        <FlatList
          data={categorias}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 100, gap: 10 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.primary} />}
          renderItem={({ item }) => (
            <View style={{ backgroundColor: COLORS.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: COLORS.border, flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: COLORS.primaryMuted, alignItems: "center", justifyContent: "center" }}>
                <Tag size={18} color={COLORS.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 15, color: COLORS.text }}>{item.nome}</Text>
                {item.descricao ? (
                  <Text numberOfLines={1} style={{ fontFamily: "Outfit_400Regular", fontSize: 12, color: COLORS.textSecondary }}>{item.descricao}</Text>
                ) : null}
              </View>
              <AnimatedPressable
                onPress={() => { console.log("[Categorias] Editar pressionado:", item.id); openEdit(item); }}
                style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: COLORS.surfaceSecondary, alignItems: "center", justifyContent: "center" }}
              >
                <Pencil size={16} color={COLORS.textSecondary} />
              </AnimatedPressable>
              <AnimatedPressable
                onPress={() => { console.log("[Categorias] Excluir pressionado:", item.id); handleDelete(item.id, item.nome); }}
                style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: COLORS.danger + "15", alignItems: "center", justifyContent: "center" }}
              >
                <Trash2 size={16} color={COLORS.danger} />
              </AnimatedPressable>
            </View>
          )}
          ListEmptyComponent={
            <View style={{ alignItems: "center", justifyContent: "center", padding: 48, gap: 12 }}>
              <View style={{ width: 72, height: 72, borderRadius: 20, backgroundColor: COLORS.primaryMuted, alignItems: "center", justifyContent: "center" }}>
                <Tag size={32} color={COLORS.primary} />
              </View>
              <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 17, color: COLORS.text }}>Nenhuma categoria</Text>
              <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 14, color: COLORS.textSecondary, textAlign: "center" }}>
                Crie categorias para organizar o cardápio
              </Text>
            </View>
          }
        />
      )}

      <AnimatedPressable
        onPress={() => { console.log("[Categorias] Botão incluir pressionado"); openCreate(); }}
        style={{ position: "absolute", bottom: 20, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center" }}
      >
        <Plus size={24} color="#fff" />
      </AnimatedPressable>

      <Modal visible={showModal} transparent animationType="fade" onRequestClose={() => setShowModal(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <View style={{ backgroundColor: COLORS.surface, borderRadius: 20, padding: 24, width: "100%", maxWidth: 380, gap: 16 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 20, color: COLORS.text }}>
                {editingId ? "Editar Categoria" : "Nova Categoria"}
              </Text>
              <AnimatedPressable
                onPress={() => { console.log("[Categorias] Modal fechado"); setShowModal(false); }}
                style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.surfaceSecondary, alignItems: "center", justifyContent: "center" }}
              >
                <X size={16} color={COLORS.textSecondary} />
              </AnimatedPressable>
            </View>

            <View style={{ gap: 6 }}>
              <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 14, color: COLORS.text }}>Nome *</Text>
              <TextInput value={nome} onChangeText={setNome} placeholder="Ex: Entradas" placeholderTextColor={COLORS.textTertiary} style={inputStyle} autoFocus />
            </View>

            <View style={{ gap: 6 }}>
              <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 14, color: COLORS.text }}>Descrição</Text>
              <TextInput value={descricao} onChangeText={setDescricao} placeholder="Descrição opcional" placeholderTextColor={COLORS.textTertiary} style={inputStyle} />
            </View>

            {modalError ? (
              <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 13, color: COLORS.danger }}>{modalError}</Text>
            ) : null}

            <AnimatedPressable
              onPress={() => { console.log("[Categorias] Salvar categoria pressionado"); handleSave(); }}
              disabled={saving}
              style={{ backgroundColor: COLORS.primary, borderRadius: 14, height: 52, alignItems: "center", justifyContent: "center" }}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 16, color: "#fff" }}>
                  {editingId ? "Salvar alterações" : "Criar categoria"}
                </Text>
              )}
            </AnimatedPressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
