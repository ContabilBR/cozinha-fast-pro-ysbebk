import React, { useState, useCallback } from "react";
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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { CardSkeleton } from "@/components/SkeletonLoader";
import { apiGet, apiPost, apiPut, apiDelete } from "@/utils/api";
import { getInitials, getRoleLabel } from "@/utils/helpers";
import { X, Users, Search } from "lucide-react-native";

interface ApiGarcom {
  id: string;
  nome?: string;
  name?: string;
  email: string;
  role?: string;
}

function getDisplayName(u: ApiGarcom): string {
  return u.name || u.nome || "";
}

export default function GestaoGarconsScreen() {
  const COLORS = useColors();
  const router = useRouter();

  const [garcons, setGarcons] = useState<ApiGarcom[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editingGarcom, setEditingGarcom] = useState<ApiGarcom | null>(null);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState("");

  const fetchGarcons = useCallback(async () => {
    console.log("[GestaoGarcons] GET /api/garcons");
    try {
      const res = await apiGet<any>("/api/garcons");
      const list: ApiGarcom[] = Array.isArray(res) ? res : (res.garcons || []);
      console.log("[GestaoGarcons] Carregados", list.length, "garçons");
      setGarcons(list);
      setError("");
    } catch (e: unknown) {
      console.error("[GestaoGarcons] Erro:", e);
      setError("Não foi possível carregar os garçons.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      console.log("[GestaoGarcons] Tela focada — recarregando garçons");
      setLoading(true);
      fetchGarcons();
    }, [fetchGarcons])
  );

  const handleRefresh = () => {
    console.log("[GestaoGarcons] Refresh manual");
    setRefreshing(true);
    fetchGarcons();
  };

  const openCreate = () => {
    console.log("[GestaoGarcons] Abrir modal de criação");
    setEditingGarcom(null);
    setNome(""); setEmail(""); setSenha(""); setModalError("");
    setShowModal(true);
  };

  const openEdit = (g: ApiGarcom) => {
    console.log("[GestaoGarcons] Abrir modal de edição:", g.id);
    setEditingGarcom(g);
    setNome(getDisplayName(g)); setEmail(g.email ?? ""); setSenha(""); setModalError("");
    setShowModal(true);
  };

  const handleSave = () => {
    if (!nome.trim()) { setModalError("Nome é obrigatório."); return; }
    if (!editingGarcom && !email.trim()) { setModalError("E-mail é obrigatório."); return; }
    if (!editingGarcom && !senha.trim()) { setModalError("Senha é obrigatória."); return; }
    console.log("[GestaoGarcons] Confirmar salvar pressionado, editando:", editingGarcom?.id ?? "novo");
    Alert.alert(
      "Confirmar",
      "Deseja salvar as alterações?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Confirmar",
          onPress: async () => {
            setSaving(true); setModalError("");
            try {
              if (editingGarcom) {
                const payload: Record<string, unknown> = { name: nome.trim(), email: email.trim() };
                if (senha.trim()) payload.password = senha.trim();
                console.log("[GestaoGarcons] PUT /api/garcons/" + editingGarcom.id);
                await apiPut(`/api/garcons/${editingGarcom.id}`, payload);
                console.log("[GestaoGarcons] Garçom atualizado:", editingGarcom.id);
              } else {
                console.log("[GestaoGarcons] POST /api/garcons");
                await apiPost("/api/garcons", {
                  name: nome.trim(),
                  email: email.trim(),
                  password: senha.trim(),
                });
                console.log("[GestaoGarcons] Garçom criado");
              }
              setShowModal(false);
              await fetchGarcons();
            } catch (e: unknown) {
              console.error("[GestaoGarcons] Erro ao salvar:", e);
              setModalError(e instanceof Error ? e.message : "Não foi possível salvar o garçom.");
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  const handleDelete = (id: string, nomeGarcom: string) => {
    const displayNome = nomeGarcom || "Garçom";
    console.log("[GestaoGarcons] Confirmar exclusão:", id, displayNome);
    Alert.alert(
      "Excluir garçom?",
      `Deseja excluir "${displayNome}"?\n\nEsta ação não pode ser desfeita.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: async () => {
            console.log("[GestaoGarcons] DELETE /api/garcons/" + id);
            try {
              await apiDelete(`/api/garcons/${id}`);
              console.log("[GestaoGarcons] Garçom excluído:", id);
              setGarcons((prev) => prev.filter((g) => g.id !== id));
            } catch (e: unknown) {
              console.error("[GestaoGarcons] Erro ao excluir:", e);
              Alert.alert("Erro", "Não foi possível excluir o garçom.");
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
  const filteredGarcons = search.trim()
    ? garcons.filter((g) => {
        const n = getDisplayName(g).toLowerCase();
        const e = (g.email ?? "").toLowerCase();
        return n.includes(searchLower) || e.includes(searchLower);
      })
    : garcons;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }} edges={["top", "left", "right"]}>
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
          onPress={() => { console.log("[GestaoGarcons] Botão voltar pressionado"); router.back(); }}
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
          Garçons
        </Text>
        <View style={{ flex: 1 }} />
        <AnimatedPressable
          onPress={() => { console.log("[GestaoGarcons] Botão incluir pressionado"); openCreate(); }}
          style={{ flexDirection: "row", alignItems: "center", backgroundColor: COLORS.success, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, gap: 6 }}
        >
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Incluir</Text>
        </AnimatedPressable>
      </View>

      {/* Search bar */}
      <View style={{ paddingHorizontal: 12, paddingVertical: 10, backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.divider }}>
        <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: COLORS.surfaceSecondary, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, gap: 8 }}>
          <Search size={16} color={COLORS.textSecondary} />
          <TextInput
            value={search}
            onChangeText={(t) => { console.log("[GestaoGarcons] Busca:", t); setSearch(t); }}
            placeholder="Buscar..."
            placeholderTextColor={COLORS.textTertiary}
            style={{ flex: 1, fontFamily: "Outfit_400Regular", fontSize: 15, color: COLORS.text, padding: 0 }}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Ionicons name="close-circle" size={16} color={COLORS.textSecondary} />
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
          <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 17, color: COLORS.text }}>Erro ao carregar garçons</Text>
          <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 14, color: COLORS.textSecondary, textAlign: "center" }}>{error}</Text>
          <AnimatedPressable onPress={fetchGarcons} style={{ backgroundColor: COLORS.primary, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 }}>
            <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 15, color: "#fff" }}>Tentar novamente</Text>
          </AnimatedPressable>
        </View>
      ) : (
        <FlatList
          data={filteredGarcons}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 12, paddingBottom: 120 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.primary} />}
          renderItem={({ item }) => {
            const displayName = getDisplayName(item);
            const initials = getInitials(displayName || item.email);
            const roleLabel = getRoleLabel(item.role);
            return (
              <View style={{ backgroundColor: COLORS.surface, borderRadius: 12, padding: 16, marginBottom: 10, flexDirection: "row", alignItems: "center", shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 4, elevation: 2, borderWidth: 1, borderColor: COLORS.border }}>
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.primaryMuted, alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                  <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 15, color: COLORS.primary }}>{initials}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 15, color: COLORS.text }} numberOfLines={1}>{displayName || "Sem nome"}</Text>
                  <Text numberOfLines={1} style={{ fontFamily: "Outfit_400Regular", fontSize: 12, color: COLORS.textSecondary, marginTop: 2 }}>{item.email}</Text>
                  <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 11, color: COLORS.primary, marginTop: 2 }}>{roleLabel}</Text>
                </View>
                <View style={{ gap: 6 }}>
                  <AnimatedPressable
                    onPress={() => { console.log("[GestaoGarcons] Editar pressionado:", item.id); openEdit(item); }}
                    style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#007AFF", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 7, gap: 4 }}
                  >
                    <Ionicons name="pencil" size={14} color="#fff" />
                    <Text style={{ color: "#fff", fontWeight: "600", fontSize: 13 }}>Editar</Text>
                  </AnimatedPressable>
                  <AnimatedPressable
                    onPress={() => { console.log("[GestaoGarcons] Excluir pressionado:", item.id); handleDelete(item.id, displayName); }}
                    style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#FF3B30", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 7, gap: 4 }}
                  >
                    <Ionicons name="trash" size={14} color="#fff" />
                    <Text style={{ color: "#fff", fontWeight: "600", fontSize: 13 }}>Excluir</Text>
                  </AnimatedPressable>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={{ alignItems: "center", justifyContent: "center", padding: 48, gap: 12 }}>
              <View style={{ width: 72, height: 72, borderRadius: 20, backgroundColor: COLORS.primaryMuted, alignItems: "center", justifyContent: "center" }}>
                <Users size={32} color={COLORS.primary} />
              </View>
              <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 17, color: COLORS.text }}>
                {search.trim() ? "Nenhum resultado encontrado" : "Nenhum garçom cadastrado"}
              </Text>
              <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 14, color: COLORS.textSecondary, textAlign: "center" }}>
                {search.trim() ? "Tente outro termo de busca" : "Toque em \"Incluir\" para adicionar garçons"}
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
                {editingGarcom ? "Editar Garçom" : "Novo Garçom"}
              </Text>
              <AnimatedPressable
                onPress={() => { console.log("[GestaoGarcons] Modal fechado"); setShowModal(false); }}
                style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.surfaceSecondary, alignItems: "center", justifyContent: "center" }}
              >
                <X size={16} color={COLORS.textSecondary} />
              </AnimatedPressable>
            </View>

            <View style={{ gap: 6 }}>
              <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 14, color: COLORS.text }}>Nome *</Text>
              <TextInput value={nome} onChangeText={setNome} placeholder="Nome completo" placeholderTextColor={COLORS.textTertiary} style={inputStyle} autoFocus />
            </View>

            <View style={{ gap: 6 }}>
              <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 14, color: COLORS.text }}>
                {editingGarcom ? "E-mail" : "E-mail *"}
              </Text>
              <TextInput value={email} onChangeText={setEmail} placeholder="email@exemplo.com" placeholderTextColor={COLORS.textTertiary} keyboardType="email-address" autoCapitalize="none" style={inputStyle} />
            </View>

            <View style={{ gap: 6 }}>
              <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 14, color: COLORS.text }}>
                {editingGarcom ? "Nova senha (opcional)" : "Senha *"}
              </Text>
              <TextInput value={senha} onChangeText={setSenha} placeholder={editingGarcom ? "Deixe em branco para manter" : "Senha"} placeholderTextColor={COLORS.textTertiary} secureTextEntry style={inputStyle} />
            </View>

            {modalError ? <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 13, color: COLORS.danger }}>{modalError}</Text> : null}

            <AnimatedPressable
              onPress={() => { console.log("[GestaoGarcons] Salvar garçom pressionado"); handleSave(); }}
              disabled={saving}
              style={{ backgroundColor: COLORS.primary, borderRadius: 14, height: 52, alignItems: "center", justifyContent: "center" }}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 16, color: "#fff" }}>
                  {editingGarcom ? "Salvar alterações" : "Adicionar garçom"}
                </Text>
              )}
            </AnimatedPressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
