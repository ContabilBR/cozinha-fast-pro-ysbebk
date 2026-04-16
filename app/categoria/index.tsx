import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  Modal,
} from "react-native";
import { Stack } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { CardSkeleton } from "@/components/SkeletonLoader";
import { Categoria } from "@/types";
import { apiGet, apiPost, apiPut, apiDelete } from "@/utils/api";
import { Plus, Pencil, Trash2, X, Tag } from "lucide-react-native";

export default function CategoriasScreen() {
  const COLORS = useColors();

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
    console.log("[Categorias] Fetching categorias");
    try {
      const res = await apiGet<any>("/api/categorias");
      const list: Categoria[] = Array.isArray(res) ? res : (res.categorias || []);
      setCategorias(list);
      setError("");
    } catch (e: any) {
      console.error("[Categorias] Error:", e);
      setError("Não foi possível carregar as categorias.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchCategorias(); }, [fetchCategorias]);

  const handleRefresh = () => {
    console.log("[Categorias] Manual refresh");
    setRefreshing(true);
    fetchCategorias();
  };

  const openCreate = () => {
    console.log("[Categorias] Open create modal");
    setEditingId(null);
    setNome("");
    setDescricao("");
    setModalError("");
    setShowModal(true);
  };

  const openEdit = (cat: Categoria) => {
    console.log("[Categorias] Open edit modal:", cat.id);
    setEditingId(cat.id);
    setNome(cat.nome);
    setDescricao(cat.descricao ?? "");
    setModalError("");
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!nome.trim()) {
      setModalError("Nome é obrigatório.");
      return;
    }
    console.log("[Categorias] Save pressed, editingId:", editingId);
    setSaving(true);
    setModalError("");
    try {
      if (editingId) {
        await apiPut(`/api/categorias/${editingId}`, { nome: nome.trim(), descricao: descricao.trim() || undefined });
        console.log("[Categorias] Categoria updated:", editingId);
      } else {
        await apiPost("/api/categorias", { nome: nome.trim(), descricao: descricao.trim() || undefined });
        console.log("[Categorias] Categoria created");
      }
      setShowModal(false);
      await fetchCategorias();
    } catch (e: any) {
      console.error("[Categorias] Save error:", e);
      setModalError("Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    console.log("[Categorias] Delete pressed:", id);
    try {
      await apiDelete(`/api/categorias/${id}`);
      console.log("[Categorias] Categoria deleted:", id);
      setCategorias((prev) => prev.filter((c) => c.id !== id));
    } catch (e: any) {
      console.error("[Categorias] Delete error:", e);
    }
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
          title: "Categorias",
          headerTintColor: COLORS.primary,
          headerBackButtonDisplayMode: "minimal",
        }}
      />
      <View style={{ flex: 1, backgroundColor: COLORS.background }}>
        {loading ? (
          <View style={{ padding: 16, gap: 12 }}>
            {[0, 1, 2].map((i) => <CardSkeleton key={i} />)}
          </View>
        ) : error ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 }}>
            <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 17, color: COLORS.text }}>
              Erro ao carregar categorias
            </Text>
            <AnimatedPressable
              onPress={fetchCategorias}
              style={{ backgroundColor: COLORS.primary, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 }}
            >
              <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 15, color: "#fff" }}>
                Tentar novamente
              </Text>
            </AnimatedPressable>
          </View>
        ) : (
          <FlatList
            data={categorias}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: 16, paddingBottom: 100, gap: 10 }}
            contentInsetAdjustmentBehavior="automatic"
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.primary} />
            }
            renderItem={({ item }) => (
              <View
                style={{
                  backgroundColor: COLORS.surface,
                  borderRadius: 14,
                  padding: 14,
                  borderWidth: 1,
                  borderColor: COLORS.border,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    backgroundColor: COLORS.primaryMuted,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Tag size={18} color={COLORS.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 15, color: COLORS.text }}>
                    {item.nome}
                  </Text>
                  {item.descricao ? (
                    <Text numberOfLines={1} style={{ fontFamily: "Outfit_400Regular", fontSize: 12, color: COLORS.textSecondary }}>
                      {item.descricao}
                    </Text>
                  ) : null}
                </View>
                <AnimatedPressable
                  onPress={() => openEdit(item)}
                  style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: COLORS.surfaceSecondary, alignItems: "center", justifyContent: "center" }}
                >
                  <Pencil size={16} color={COLORS.textSecondary} />
                </AnimatedPressable>
                <AnimatedPressable
                  onPress={() => handleDelete(item.id)}
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
                <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 17, color: COLORS.text }}>
                  Nenhuma categoria
                </Text>
                <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 14, color: COLORS.textSecondary, textAlign: "center" }}>
                  Crie categorias para organizar o cardápio
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
                  {editingId ? "Editar Categoria" : "Nova Categoria"}
                </Text>
                <AnimatedPressable
                  onPress={() => setShowModal(false)}
                  style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.surfaceSecondary, alignItems: "center", justifyContent: "center" }}
                >
                  <X size={16} color={COLORS.textSecondary} />
                </AnimatedPressable>
              </View>

              <View style={{ gap: 6 }}>
                <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 14, color: COLORS.text }}>
                  Nome *
                </Text>
                <TextInput
                  value={nome}
                  onChangeText={setNome}
                  placeholder="Ex: Entradas"
                  placeholderTextColor={COLORS.textTertiary}
                  style={inputStyle}
                  autoFocus
                />
              </View>

              <View style={{ gap: 6 }}>
                <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 14, color: COLORS.text }}>
                  Descrição
                </Text>
                <TextInput
                  value={descricao}
                  onChangeText={setDescricao}
                  placeholder="Descrição opcional"
                  placeholderTextColor={COLORS.textTertiary}
                  style={inputStyle}
                />
              </View>

              {modalError ? (
                <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 13, color: COLORS.danger }}>
                  {modalError}
                </Text>
              ) : null}

              <AnimatedPressable
                onPress={handleSave}
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
      </View>
    </>
  );
}
