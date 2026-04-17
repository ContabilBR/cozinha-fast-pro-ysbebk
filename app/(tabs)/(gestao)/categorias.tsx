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
import { X, Tag, Search } from "lucide-react-native";

interface ApiCategoria {
  id: string;
  nome: string;
  descricao?: string;
}

export default function GestaoCategorias() {
  const COLORS = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [categorias, setCategorias] = useState<ApiCategoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editingCat, setEditingCat] = useState<ApiCategoria | null>(null);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState("");

  const fetchCategorias = useCallback(async () => {
    console.log("[GestaoCategorias] GET /api/categorias");
    try {
      const res = await apiGet<any>("/api/categorias");
      const list: ApiCategoria[] = Array.isArray(res) ? res : (res.categorias || []);
      console.log("[GestaoCategorias] Carregadas", list.length, "categorias");
      setCategorias(list);
      setError("");
    } catch (e: unknown) {
      console.error("[GestaoCategorias] Erro:", e);
      setError("Não foi possível carregar as categorias.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchCategorias(); }, [fetchCategorias]);

  const handleRefresh = () => {
    console.log("[GestaoCategorias] Refresh manual");
    setRefreshing(true);
    fetchCategorias();
  };

  const openCreate = () => {
    console.log("[GestaoCategorias] Abrir modal de criação");
    setEditingCat(null);
    setNome(""); setDescricao(""); setModalError("");
    setShowModal(true);
  };

  const openEdit = (c: ApiCategoria) => {
    console.log("[GestaoCategorias] Abrir modal de edição:", c.id);
    setEditingCat(c);
    setNome(c.nome); setDescricao(c.descricao ?? ""); setModalError("");
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!nome.trim()) { setModalError("Nome é obrigatório."); return; }
    console.log("[GestaoCategorias] Salvar pressionado, editando:", editingCat?.id ?? "novo");
    setSaving(true); setModalError("");
    try {
      if (editingCat) {
        console.log("[GestaoCategorias] PUT /api/categorias/" + editingCat.id);
        await apiPut(`/api/categorias/${editingCat.id}`, { nome: nome.trim(), descricao: descricao.trim() || undefined });
        console.log("[GestaoCategorias] Categoria atualizada:", editingCat.id);
      } else {
        console.log("[GestaoCategorias] POST /api/categorias");
        await apiPost("/api/categorias", { nome: nome.trim(), descricao: descricao.trim() || undefined });
        console.log("[GestaoCategorias] Categoria criada");
      }
      setShowModal(false);
      await fetchCategorias();
    } catch (e: unknown) {
      console.error("[GestaoCategorias] Erro ao salvar:", e);
      setModalError(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: string, nomeCategoria: string) => {
    console.log("[GestaoCategorias] Confirmar exclusão:", id, nomeCategoria);
    Alert.alert(
      "Excluir categoria?",
      `Deseja realmente excluir "${nomeCategoria}"?\n\nEsta ação não pode ser desfeita.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: async () => {
            console.log("[GestaoCategorias] DELETE /api/categorias/" + id);
            try {
              await apiDelete(`/api/categorias/${id}`);
              console.log("[GestaoCategorias] Categoria excluída:", id);
              setCategorias((prev) => prev.filter((c) => c.id !== id));
            } catch (e: unknown) {
              console.error("[GestaoCategorias] Erro ao excluir:", e);
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

  const searchLower = search.toLowerCase();
  const filteredCategorias = search.trim()
    ? categorias.filter((c) => c.nome.toLowerCase().includes(searchLower) || (c.descricao ?? "").toLowerCase().includes(searchLower))
    : categorias;

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
          onPress={() => { console.log("[GestaoCategorias] Botão voltar pressionado"); router.back(); }}
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
          Categorias
        </Text>
        <View style={{ flex: 1 }} />
        <TouchableOpacity
          onPress={() => { console.log("[GestaoCategorias] Botão incluir pressionado"); openCreate(); }}
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
            onChangeText={(t) => { console.log("[GestaoCategorias] Busca:", t); setSearch(t); }}
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
          <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 17, color: COLORS.text }}>Erro ao carregar categorias</Text>
          <TouchableOpacity onPress={fetchCategorias} style={{ backgroundColor: COLORS.primary, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 }}>
            <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 15, color: "#fff" }}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredCategorias}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 12, paddingBottom: 120 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.primary} />}
          renderItem={({ item }) => (
            <View style={{ backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 10, flexDirection: "row", alignItems: "center", shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 }}>
              <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: COLORS.primaryMuted, alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                <Tag size={18} color={COLORS.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: "600", color: "#111" }}>{item.nome}</Text>
                {item.descricao ? (
                  <Text numberOfLines={1} style={{ fontSize: 12, color: COLORS.textSecondary, marginTop: 2 }}>{item.descricao}</Text>
                ) : null}
              </View>
              <View style={{ gap: 6 }}>
                <TouchableOpacity
                  onPress={() => { console.log("[GestaoCategorias] Editar pressionado:", item.id); openEdit(item); }}
                  style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#007AFF", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 7, gap: 4 }}
                >
                  <Ionicons name="pencil" size={14} color="#fff" />
                  <Text style={{ color: "#fff", fontWeight: "600", fontSize: 13 }}>Editar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => { console.log("[GestaoCategorias] Excluir pressionado:", item.id); handleDelete(item.id, item.nome); }}
                  style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#FF3B30", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 7, gap: 4 }}
                >
                  <Ionicons name="trash" size={14} color="#fff" />
                  <Text style={{ color: "#fff", fontWeight: "600", fontSize: 13 }}>Excluir</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={{ alignItems: "center", justifyContent: "center", padding: 48, gap: 12 }}>
              <Tag size={32} color={COLORS.textTertiary} />
              <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 17, color: COLORS.text }}>
                {search.trim() ? "Nenhum resultado encontrado" : "Nenhuma categoria"}
              </Text>
              <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 14, color: COLORS.textSecondary, textAlign: "center" }}>
                {search.trim() ? "Tente outro termo de busca" : "Toque em \"Incluir\" para criar categorias"}
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
                {editingCat ? "Editar Categoria" : "Nova Categoria"}
              </Text>
              <TouchableOpacity
                onPress={() => { console.log("[GestaoCategorias] Modal fechado"); setShowModal(false); }}
                style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.surfaceSecondary, alignItems: "center", justifyContent: "center" }}
              >
                <X size={16} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={{ gap: 6 }}>
              <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 14, color: COLORS.text }}>Nome *</Text>
              <TextInput value={nome} onChangeText={setNome} placeholder="Ex: Entradas" placeholderTextColor={COLORS.textTertiary} style={inputStyle} autoFocus />
            </View>

            <View style={{ gap: 6 }}>
              <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 14, color: COLORS.text }}>Descrição</Text>
              <TextInput value={descricao} onChangeText={setDescricao} placeholder="Descrição opcional" placeholderTextColor={COLORS.textTertiary} style={inputStyle} />
            </View>

            {modalError ? <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 13, color: COLORS.danger }}>{modalError}</Text> : null}

            <TouchableOpacity
              onPress={() => { console.log("[GestaoCategorias] Salvar categoria pressionado"); handleSave(); }}
              disabled={saving}
              style={{ backgroundColor: COLORS.primary, borderRadius: 14, height: 52, alignItems: "center", justifyContent: "center" }}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 16, color: "#fff" }}>
                  {editingCat ? "Salvar alterações" : "Criar categoria"}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
