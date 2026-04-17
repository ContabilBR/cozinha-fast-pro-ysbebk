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
import { Stack, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { apiGet, apiPost, apiPut, apiDelete } from "@/utils/api";
import { Plus, Pencil, Trash2, Tag, Check, X } from "lucide-react-native";

interface ApiCategoria {
  id: string;
  nome: string;
  descricao?: string;
}

function CategoriaRow({
  categoria,
  onEdit,
  onDelete,
  onSaveEdit,
  isEditing,
  onCancelEdit,
}: {
  categoria: ApiCategoria;
  onEdit: (c: ApiCategoria) => void;
  onDelete: (c: ApiCategoria) => void;
  onSaveEdit: (id: string, nome: string, descricao: string) => Promise<void>;
  isEditing: boolean;
  onCancelEdit: () => void;
}) {
  const COLORS = useColors();
  const [editNome, setEditNome] = useState(categoria.nome);
  const [editDescricao, setEditDescricao] = useState(categoria.descricao ?? "");
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState("");

  // Sync when editing starts
  useEffect(() => {
    if (isEditing) {
      setEditNome(categoria.nome);
      setEditDescricao(categoria.descricao ?? "");
      setEditError("");
    }
  }, [isEditing, categoria]);

  const handleSave = async () => {
    if (!editNome.trim()) {
      setEditError("Nome é obrigatório.");
      return;
    }
    setSaving(true);
    setEditError("");
    try {
      await onSaveEdit(categoria.id, editNome.trim(), editDescricao.trim());
    } catch (e: any) {
      setEditError(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    backgroundColor: COLORS.background,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontFamily: "Outfit_400Regular" as const,
    fontSize: 14,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  };

  if (isEditing) {
    return (
      <View
        style={{
          backgroundColor: COLORS.primaryMuted,
          borderRadius: 16,
          padding: 16,
          marginHorizontal: 16,
          marginVertical: 5,
          borderWidth: 1.5,
          borderColor: COLORS.primary + "40",
          gap: 10,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2 }}>
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              backgroundColor: COLORS.primary + "20",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Pencil size={13} color={COLORS.primary} />
          </View>
          <Text
            style={{
              fontFamily: "Outfit_600SemiBold",
              fontSize: 13,
              color: COLORS.primary,
            }}
          >
            Editando categoria
          </Text>
        </View>

        <View style={{ gap: 6 }}>
          <Text
            style={{
              fontFamily: "Outfit_600SemiBold",
              fontSize: 12,
              color: COLORS.text,
            }}
          >
            Nome *
          </Text>
          <TextInput
            value={editNome}
            onChangeText={(t) => {
              setEditNome(t);
              setEditError("");
            }}
            placeholder="Nome da categoria"
            placeholderTextColor={COLORS.textTertiary}
            style={inputStyle}
            autoFocus
          />
        </View>

        <View style={{ gap: 6 }}>
          <Text
            style={{
              fontFamily: "Outfit_600SemiBold",
              fontSize: 12,
              color: COLORS.text,
            }}
          >
            Descrição
          </Text>
          <TextInput
            value={editDescricao}
            onChangeText={setEditDescricao}
            placeholder="Descrição opcional"
            placeholderTextColor={COLORS.textTertiary}
            multiline
            numberOfLines={2}
            style={[inputStyle, { minHeight: 60, textAlignVertical: "top" }]}
          />
        </View>

        {editError ? (
          <Text
            style={{
              fontFamily: "Outfit_400Regular",
              fontSize: 12,
              color: COLORS.danger,
            }}
          >
            {editError}
          </Text>
        ) : null}

        <View style={{ flexDirection: "row", gap: 10 }}>
          <AnimatedPressable
            onPress={() => {
              console.log("[GestaoCategorias] Cancel edit:", categoria.id);
              onCancelEdit();
            }}
            style={{
              flex: 1,
              height: 42,
              borderRadius: 12,
              backgroundColor: COLORS.surfaceSecondary,
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
              gap: 6,
            }}
          >
            <X size={14} color={COLORS.textSecondary} />
            <Text
              style={{
                fontFamily: "Outfit_600SemiBold",
                fontSize: 14,
                color: COLORS.textSecondary,
              }}
            >
              Cancelar
            </Text>
          </AnimatedPressable>
          <AnimatedPressable
            onPress={() => {
              console.log("[GestaoCategorias] Save edit pressed:", categoria.id);
              handleSave();
            }}
            disabled={saving}
            style={{
              flex: 1,
              height: 42,
              borderRadius: 12,
              backgroundColor: COLORS.primary,
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
              gap: 6,
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Check size={14} color="#fff" />
                <Text
                  style={{
                    fontFamily: "Outfit_600SemiBold",
                    fontSize: 14,
                    color: "#fff",
                  }}
                >
                  Salvar
                </Text>
              </>
            )}
          </AnimatedPressable>
        </View>
      </View>
    );
  }

  return (
    <View
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
            console.log("[GestaoCategorias] Edit icon pressed:", categoria.id, categoria.nome);
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
            console.log("[GestaoCategorias] Delete icon pressed:", categoria.id, categoria.nome);
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
    </View>
  );
}

export default function GestaoCategorias() {
  const COLORS = useColors();
  const insets = useSafeAreaInsets();

  const [categorias, setCategorias] = useState<ApiCategoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  // Create form
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  // Inline edit
  const [editingId, setEditingId] = useState<string | null>(null);

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

  const handleCreate = async () => {
    if (!nome.trim()) {
      setFormError("Nome é obrigatório.");
      return;
    }
    console.log("[GestaoCategorias] POST /api/categorias nome:", nome.trim());
    setSubmitting(true);
    setFormError("");
    try {
      await apiPost("/api/categorias", {
        nome: nome.trim(),
        descricao: descricao.trim() || undefined,
      });
      console.log("[GestaoCategorias] Categoria created, resetting form and refreshing list");
      setNome("");
      setDescricao("");
      fetchCategorias();
    } catch (e: any) {
      console.error("[GestaoCategorias] Create error:", e instanceof Error ? e.message : String(e));
      setFormError(e instanceof Error ? e.message : "Não foi possível criar a categoria.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveEdit = async (id: string, editNome: string, editDescricao: string) => {
    console.log("[GestaoCategorias] PUT /api/categorias/", id, "nome:", editNome);
    await apiPut(`/api/categorias/${id}`, {
      nome: editNome,
      descricao: editDescricao || undefined,
    });
    console.log("[GestaoCategorias] Categoria updated:", id);
    setEditingId(null);
    fetchCategorias();
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
              if (editingId === c.id) setEditingId(null);
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

  const countText = `${categorias.length} categoria${categorias.length !== 1 ? "s" : ""}`;

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
                  backgroundColor: "#8B5CF618",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Plus size={18} color="#8B5CF6" />
              </View>
              <Text
                style={{
                  fontFamily: "Outfit_700Bold",
                  fontSize: 17,
                  color: COLORS.text,
                }}
              >
                Nova Categoria
              </Text>
            </View>

            <View style={{ gap: 6 }}>
              <Text
                style={{
                  fontFamily: "Outfit_600SemiBold",
                  fontSize: 13,
                  color: COLORS.text,
                }}
              >
                Nome *
              </Text>
              <TextInput
                value={nome}
                onChangeText={(t) => {
                  setNome(t);
                  setFormError("");
                }}
                placeholder="Ex: Entradas"
                placeholderTextColor={COLORS.textTertiary}
                style={inputStyle}
              />
            </View>

            <View style={{ gap: 6 }}>
              <Text
                style={{
                  fontFamily: "Outfit_600SemiBold",
                  fontSize: 13,
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
                style={[inputStyle, { minHeight: 68, textAlignVertical: "top" }]}
              />
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
                console.log("[GestaoCategorias] Adicionar Categoria pressed");
                handleCreate();
              }}
              disabled={submitting}
              style={{
                backgroundColor: "#8B5CF6",
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
                  Adicionar Categoria
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
              Categorias Cadastradas
            </Text>
            <Text
              style={{
                fontFamily: "Outfit_400Regular",
                fontSize: 13,
                color: COLORS.textSecondary,
              }}
            >
              {countText}
            </Text>
          </View>

          {loading ? (
            <View style={{ alignItems: "center", paddingVertical: 48 }}>
              <ActivityIndicator color={COLORS.primary} size="large" />
            </View>
          ) : error ? (
            <View style={{ alignItems: "center", padding: 32, gap: 12 }}>
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
          ) : categorias.length === 0 ? (
            <View style={{ alignItems: "center", padding: 48, gap: 12 }}>
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 18,
                  backgroundColor: "#8B5CF618",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Tag size={28} color="#8B5CF6" />
              </View>
              <Text
                style={{
                  fontFamily: "Outfit_600SemiBold",
                  fontSize: 16,
                  color: COLORS.text,
                }}
              >
                Nenhuma categoria encontrada
              </Text>
              <Text
                style={{
                  fontFamily: "Outfit_400Regular",
                  fontSize: 13,
                  color: COLORS.textSecondary,
                  textAlign: "center",
                }}
              >
                Use o formulário acima para adicionar categorias
              </Text>
            </View>
          ) : (
            <View style={{ paddingTop: 4, paddingBottom: 8 }}>
              {categorias.map((cat) => (
                <CategoriaRow
                  key={cat.id}
                  categoria={cat}
                  isEditing={editingId === cat.id}
                  onEdit={(c) => {
                    console.log("[GestaoCategorias] Start inline edit:", c.id);
                    setEditingId(c.id);
                  }}
                  onCancelEdit={() => {
                    console.log("[GestaoCategorias] Cancel inline edit");
                    setEditingId(null);
                  }}
                  onSaveEdit={handleSaveEdit}
                  onDelete={handleDelete}
                />
              ))}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}
