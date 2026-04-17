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
} from "react-native";
import { Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { apiGet, apiPost, apiPut, apiDelete } from "@/utils/api";
import { Plus, Pencil, Trash2, Tag, X } from "lucide-react-native";

interface ApiCategoria {
  id: string;
  nome: string;
  descricao?: string;
}

function CategoriaItem({
  categoria,
  onEdit,
  onDelete,
}: {
  categoria: ApiCategoria;
  onEdit: (c: ApiCategoria) => void;
  onDelete: (c: ApiCategoria) => void;
}) {
  const COLORS = useColors();
  return (
    <AnimatedPressable
      onPress={() => {
        console.log("[GestaoCategorias] Edit pressed:", categoria.id, categoria.nome);
        onEdit(categoria);
      }}
      style={{
        backgroundColor: COLORS.surface,
        borderRadius: 16,
        padding: 16,
        marginHorizontal: 16,
        marginVertical: 5,
        borderWidth: 1,
        borderColor: COLORS.border,
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 1,
      }}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          backgroundColor: "#8B5CF618",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Tag size={20} color="#8B5CF6" />
      </View>

      <View style={{ flex: 1, gap: 2 }}>
        <Text
          style={{
            fontFamily: "Outfit_600SemiBold",
            fontSize: 15,
            color: COLORS.text,
          }}
        >
          {categoria.nome}
        </Text>
        {categoria.descricao ? (
          <Text
            numberOfLines={1}
            style={{
              fontFamily: "Outfit_400Regular",
              fontSize: 12,
              color: COLORS.textSecondary,
            }}
          >
            {categoria.descricao}
          </Text>
        ) : null}
      </View>

      <View style={{ flexDirection: "row", gap: 8 }}>
        <AnimatedPressable
          onPress={() => {
            console.log("[GestaoCategorias] Edit icon pressed:", categoria.id);
            onEdit(categoria);
          }}
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            backgroundColor: COLORS.primaryMuted,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Pencil size={15} color={COLORS.primary} />
        </AnimatedPressable>
        <AnimatedPressable
          onPress={() => {
            console.log("[GestaoCategorias] Delete icon pressed:", categoria.id);
            onDelete(categoria);
          }}
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            backgroundColor: "#EF444418",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Trash2 size={15} color="#EF4444" />
        </AnimatedPressable>
      </View>
    </AnimatedPressable>
  );
}

export default function GestaoCategorias() {
  const COLORS = useColors();
  const insets = useSafeAreaInsets();

  const [categorias, setCategorias] = useState<ApiCategoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [modalVisible, setModalVisible] = useState(false);
  const [editingCategoria, setEditingCategoria] = useState<ApiCategoria | null>(null);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const fetchCategorias = useCallback(async () => {
    console.log("[GestaoCategorias] GET /api/categorias");
    try {
      const res = await apiGet<any>("/api/categorias");
      const list: ApiCategoria[] = Array.isArray(res) ? res : (res.categorias ?? []);
      console.log("[GestaoCategorias] Loaded", list.length, "categorias");
      setCategorias(list);
      setError("");
    } catch (e: any) {
      console.error("[GestaoCategorias] Error:", e instanceof Error ? e.message : String(e));
      setError("Não foi possível carregar as categorias.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchCategorias();
  }, [fetchCategorias]);

  const handleRefresh = () => {
    console.log("[GestaoCategorias] Manual refresh");
    setRefreshing(true);
    fetchCategorias();
  };

  const openCreate = () => {
    console.log("[GestaoCategorias] Open create modal");
    setEditingCategoria(null);
    setNome("");
    setDescricao("");
    setFormError("");
    setModalVisible(true);
  };

  const openEdit = (c: ApiCategoria) => {
    console.log("[GestaoCategorias] Open edit modal:", c.id, c.nome);
    setEditingCategoria(c);
    setNome(c.nome);
    setDescricao(c.descricao ?? "");
    setFormError("");
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!nome.trim()) {
      setFormError("Nome é obrigatório.");
      return;
    }
    setSubmitting(true);
    setFormError("");
    try {
      if (editingCategoria) {
        console.log("[GestaoCategorias] PUT /api/categorias/", editingCategoria.id, "nome:", nome);
        await apiPut(`/api/categorias/${editingCategoria.id}`, {
          nome: nome.trim(),
          descricao: descricao.trim() || undefined,
        });
        console.log("[GestaoCategorias] Categoria updated");
      } else {
        console.log("[GestaoCategorias] POST /api/categorias nome:", nome);
        await apiPost("/api/categorias", {
          nome: nome.trim(),
          descricao: descricao.trim() || undefined,
        });
        console.log("[GestaoCategorias] Categoria created");
      }
      setModalVisible(false);
      fetchCategorias();
    } catch (e: any) {
      console.error("[GestaoCategorias] Save error:", e instanceof Error ? e.message : String(e));
      setFormError(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (c: ApiCategoria) => {
    console.log("[GestaoCategorias] Confirm delete:", c.id, c.nome);
    Alert.alert(
      "Excluir Categoria",
      `Deseja excluir a categoria "${c.nome}"?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: async () => {
            console.log("[GestaoCategorias] DELETE /api/categorias/", c.id);
            try {
              await apiDelete(`/api/categorias/${c.id}`);
              console.log("[GestaoCategorias] Categoria deleted:", c.id);
              setCategorias((prev) => prev.filter((cat) => cat.id !== c.id));
            } catch (e: any) {
              console.error("[GestaoCategorias] Delete error:", e instanceof Error ? e.message : String(e));
              Alert.alert("Erro", e instanceof Error ? e.message : "Não foi possível excluir.");
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

  const modalTitle = editingCategoria ? "Editar Categoria" : "Nova Categoria";
  const saveLabel = editingCategoria ? "Salvar alterações" : "Criar Categoria";

  return (
    <>
      <Stack.Screen
        options={{
          title: "Gerenciar Categorias",
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
              onPress={fetchCategorias}
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
            data={categorias}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingTop: 12, paddingBottom: insets.bottom + 100 }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={COLORS.primary}
              />
            }
            renderItem={({ item }) => (
              <CategoriaItem
                categoria={item}
                onEdit={openEdit}
                onDelete={handleDelete}
              />
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
                    backgroundColor: "#8B5CF618",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Tag size={32} color="#8B5CF6" />
                </View>
                <Text
                  style={{
                    fontFamily: "Outfit_600SemiBold",
                    fontSize: 17,
                    color: COLORS.text,
                  }}
                >
                  Nenhuma categoria encontrada
                </Text>
                <Text
                  style={{
                    fontFamily: "Outfit_400Regular",
                    fontSize: 14,
                    color: COLORS.textSecondary,
                    textAlign: "center",
                  }}
                >
                  Toque no botão + para adicionar categorias
                </Text>
              </View>
            }
          />
        )}

        {/* FAB */}
        <AnimatedPressable
          onPress={openCreate}
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

      {/* Create / Edit Modal */}
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
                  {modalTitle}
                </Text>
                <AnimatedPressable
                  onPress={() => {
                    console.log("[GestaoCategorias] Close modal");
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
                  Nome *
                </Text>
                <TextInput
                  value={nome}
                  onChangeText={setNome}
                  placeholder="Ex: Entradas"
                  placeholderTextColor={COLORS.textTertiary}
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
                  Descrição
                </Text>
                <TextInput
                  value={descricao}
                  onChangeText={setDescricao}
                  placeholder="Descrição opcional"
                  placeholderTextColor={COLORS.textTertiary}
                  multiline
                  numberOfLines={2}
                  style={[inputStyle, { minHeight: 70, textAlignVertical: "top" }]}
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
                onPress={handleSave}
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
                    {saveLabel}
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
