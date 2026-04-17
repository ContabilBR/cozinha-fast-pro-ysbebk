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
import { useColors } from "@/hooks/useColors";
import { CardSkeleton } from "@/components/SkeletonLoader";
import { apiGet, apiPost, apiPut, apiDelete } from "@/utils/api";
import { getInitials, getRoleLabel } from "@/utils/helpers";
import { X, Users } from "lucide-react-native";

interface ApiGarcom {
  id: string;
  nome?: string;
  name?: string;
  email: string;
  role: string;
}

function getDisplayName(u: ApiGarcom): string {
  return u.nome || u.name || "";
}

export default function GestaoGarconsScreen() {
  const COLORS = useColors();
  const router = useRouter();

  const [garcons, setGarcons] = useState<ApiGarcom[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editingGarcom, setEditingGarcom] = useState<ApiGarcom | null>(null);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState("");

  const fetchGarcons = useCallback(async () => {
    console.log("[GestaoGarcons] GET /api/usuarios (role=garcom)");
    try {
      const res = await apiGet<any>("/api/usuarios");
      const all: ApiGarcom[] = Array.isArray(res) ? res : (res.usuarios || res.users || []);
      const filtered = all.filter((u) => u.role === "garcom" || u.role === "waiter" || u.role === "garçom");
      console.log("[GestaoGarcons] Carregados", filtered.length, "garçons");
      setGarcons(filtered);
      setError("");
    } catch (e: unknown) {
      console.error("[GestaoGarcons] Erro:", e);
      try {
        console.log("[GestaoGarcons] Fallback GET /api/garcons");
        const res2 = await apiGet<any>("/api/garcons");
        const list: ApiGarcom[] = Array.isArray(res2) ? res2 : (res2.garcons || []);
        console.log("[GestaoGarcons] Fallback carregados", list.length, "garçons");
        setGarcons(list);
        setError("");
      } catch (e2: unknown) {
        console.error("[GestaoGarcons] Fallback erro:", e2);
        setError("Não foi possível carregar os garçons.");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchGarcons(); }, [fetchGarcons]);

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

  const handleSave = async () => {
    if (!nome.trim()) { setModalError("Nome é obrigatório."); return; }
    if (!editingGarcom && !email.trim()) { setModalError("E-mail é obrigatório."); return; }
    if (!editingGarcom && !senha.trim()) { setModalError("Senha é obrigatória."); return; }
    console.log("[GestaoGarcons] Salvar pressionado, editando:", editingGarcom?.id ?? "novo");
    setSaving(true); setModalError("");
    try {
      if (editingGarcom) {
        const payload: Record<string, unknown> = { nome: nome.trim(), name: nome.trim(), email: email.trim(), role: "garcom" };
        if (senha.trim()) payload.senha = senha;
        console.log("[GestaoGarcons] PUT /api/usuarios/" + editingGarcom.id);
        await apiPut(`/api/usuarios/${editingGarcom.id}`, payload);
        console.log("[GestaoGarcons] Garçom atualizado:", editingGarcom.id);
      } else {
        console.log("[GestaoGarcons] POST /api/usuarios (garcom)");
        await apiPost("/api/usuarios", {
          nome: nome.trim(),
          name: nome.trim(),
          email: email.trim(),
          senha,
          password: senha,
          role: "garcom",
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
  };

  const handleDelete = (id: string, nomeGarcom: string) => {
    const displayNome = nomeGarcom || "Garçom";
    console.log("[GestaoGarcons] Confirmar exclusão:", id, displayNome);
    Alert.alert(
      "Confirmar Exclusão",
      `Deseja realmente excluir "${displayNome}"?\n\nEsta ação não pode ser desfeita.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: async () => {
            console.log("[GestaoGarcons] DELETE /api/usuarios/" + id);
            try {
              await apiDelete(`/api/usuarios/${id}`);
              console.log("[GestaoGarcons] Garçom excluído:", id);
              setGarcons((prev) => prev.filter((g) => g.id !== id));
              Alert.alert("Sucesso", `"${displayNome}" excluído com sucesso.`);
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
          onPress={() => { console.log("[GestaoGarcons] Botão voltar pressionado"); router.back(); }}
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
        }}>
          Garçons
        </Text>
        <View style={{ flex: 1 }} />
        <TouchableOpacity
          onPress={() => { console.log("[GestaoGarcons] Botão incluir pressionado"); openCreate(); }}
          style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#34C759", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, gap: 6 }}
        >
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Incluir</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={{ paddingTop: 16 }}>
          {[0, 1, 2].map((i) => <CardSkeleton key={i} />)}
        </View>
      ) : error ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 }}>
          <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 17, color: COLORS.text }}>Erro ao carregar garçons</Text>
          <TouchableOpacity onPress={fetchGarcons} style={{ backgroundColor: COLORS.primary, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 }}>
            <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 15, color: "#fff" }}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={garcons}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 12, paddingBottom: 120 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.primary} />}
          renderItem={({ item }) => {
            const displayName = getDisplayName(item);
            const initials = getInitials(displayName || item.email);
            const roleLabel = getRoleLabel(item.role);
            return (
              <View style={{ backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 10, flexDirection: "row", alignItems: "center", shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 }}>
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.primaryMuted, alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                  <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 15, color: COLORS.primary }}>{initials}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: "600", color: "#111" }}>{displayName || "Sem nome"}</Text>
                  <Text numberOfLines={1} style={{ fontSize: 12, color: COLORS.textSecondary, marginTop: 2 }}>{item.email}</Text>
                  <Text style={{ fontSize: 11, color: COLORS.primary, marginTop: 2 }}>{roleLabel}</Text>
                </View>
                <View style={{ gap: 6 }}>
                  <TouchableOpacity
                    onPress={() => { console.log("[GestaoGarcons] Editar pressionado:", item.id); openEdit(item); }}
                    style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#007AFF", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 7, gap: 4 }}
                  >
                    <Ionicons name="pencil" size={14} color="#fff" />
                    <Text style={{ color: "#fff", fontWeight: "600", fontSize: 13 }}>Editar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => { console.log("[GestaoGarcons] Excluir pressionado:", item.id); handleDelete(item.id, displayName); }}
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
              <Users size={32} color={COLORS.textTertiary} />
              <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 17, color: COLORS.text }}>Nenhum garçom cadastrado</Text>
              <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 14, color: COLORS.textSecondary, textAlign: "center" }}>
                Toque em "Incluir" para adicionar garçons
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
              <TouchableOpacity
                onPress={() => { console.log("[GestaoGarcons] Modal fechado"); setShowModal(false); }}
                style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.surfaceSecondary, alignItems: "center", justifyContent: "center" }}
              >
                <X size={16} color={COLORS.textSecondary} />
              </TouchableOpacity>
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

            <TouchableOpacity
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
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
