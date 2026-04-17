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
import { getInitials, getRoleLabel } from "@/utils/helpers";
import { Plus, Pencil, Trash2, X, Users } from "lucide-react-native";

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

function GarcomCard({ garcom, index, onEdit, onDelete }: {
  garcom: ApiGarcom;
  index: number;
  onEdit: (g: ApiGarcom) => void;
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

  const displayName = getDisplayName(garcom);
  const initials = getInitials(displayName || garcom.email);
  const roleLabel = getRoleLabel(garcom.role);

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
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.primaryMuted, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 15, color: COLORS.primary }}>{initials}</Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text numberOfLines={1} style={{ fontFamily: "Outfit_600SemiBold", fontSize: 15, color: COLORS.text }}>
            {displayName || "Sem nome"}
          </Text>
          <Text numberOfLines={1} style={{ fontFamily: "Outfit_400Regular", fontSize: 12, color: COLORS.textSecondary }}>
            {garcom.email}
          </Text>
          <View style={{ backgroundColor: COLORS.primaryMuted, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, alignSelf: "flex-start" }}>
            <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 11, color: COLORS.primary }}>{roleLabel}</Text>
          </View>
        </View>
        <AnimatedPressable
          onPress={() => { console.log("[GestaoGarcons] Edit pressed:", garcom.id); onEdit(garcom); }}
          style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: COLORS.surfaceSecondary, alignItems: "center", justifyContent: "center" }}
        >
          <Pencil size={16} color={COLORS.textSecondary} />
        </AnimatedPressable>
        <AnimatedPressable
          onPress={() => { console.log("[GestaoGarcons] Delete pressed:", garcom.id); onDelete(garcom.id); }}
          style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: COLORS.danger + "15", alignItems: "center", justifyContent: "center" }}
        >
          <Trash2 size={16} color={COLORS.danger} />
        </AnimatedPressable>
      </View>
    </Animated.View>
  );
}

export default function GestaoGarconsScreen() {
  const COLORS = useColors();

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
    console.log("[GestaoGarcons] GET /api/garcons");
    try {
      const res = await apiGet<any>("/api/garcons");
      const list: ApiGarcom[] = Array.isArray(res) ? res : (res.garcons || res.usuarios || res.users || []);
      console.log("[GestaoGarcons] Loaded", list.length, "garcons");
      setGarcons(list);
      setError("");
    } catch (e: any) {
      console.error("[GestaoGarcons] Error:", e);
      // Fallback: try /api/usuarios filtered by role
      try {
        console.log("[GestaoGarcons] Fallback GET /api/usuarios");
        const res2 = await apiGet<any>("/api/usuarios");
        const all: ApiGarcom[] = Array.isArray(res2) ? res2 : (res2.usuarios || res2.users || []);
        const filtered = all.filter((u) => u.role === "garcom");
        console.log("[GestaoGarcons] Fallback loaded", filtered.length, "garcons");
        setGarcons(filtered);
        setError("");
      } catch (e2: any) {
        console.error("[GestaoGarcons] Fallback error:", e2);
        setError("Não foi possível carregar os garçons.");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchGarcons(); }, [fetchGarcons]);

  const handleRefresh = () => {
    console.log("[GestaoGarcons] Manual refresh");
    setRefreshing(true);
    fetchGarcons();
  };

  const openCreate = () => {
    console.log("[GestaoGarcons] Open create modal");
    setEditingGarcom(null);
    setNome(""); setEmail(""); setSenha(""); setModalError("");
    setShowModal(true);
  };

  const openEdit = (g: ApiGarcom) => {
    console.log("[GestaoGarcons] Open edit modal:", g.id);
    setEditingGarcom(g);
    setNome(getDisplayName(g)); setEmail(g.email ?? ""); setSenha(""); setModalError("");
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!nome.trim()) { setModalError("Nome é obrigatório."); return; }
    if (!editingGarcom && !email.trim()) { setModalError("E-mail é obrigatório."); return; }
    if (!editingGarcom && !senha.trim()) { setModalError("Senha é obrigatória."); return; }
    console.log("[GestaoGarcons] Save pressed, editingGarcom:", editingGarcom?.id ?? "new");
    setSaving(true); setModalError("");
    try {
      if (editingGarcom) {
        const payload: any = { nome: nome.trim(), name: nome.trim(), email: email.trim(), role: "garcom" };
        if (senha.trim()) payload.senha = senha;
        console.log("[GestaoGarcons] PUT /api/usuarios/" + editingGarcom.id);
        await apiPut(`/api/usuarios/${editingGarcom.id}`, payload);
        console.log("[GestaoGarcons] Garcom atualizado:", editingGarcom.id);
      } else {
        console.log("[GestaoGarcons] POST /api/usuarios (garcom)");
        await apiPost("/api/usuarios", {
          nome: nome.trim(),
          name: nome.trim(),
          email: email.trim(),
          senha: senha,
          password: senha,
          role: "garcom",
        });
        console.log("[GestaoGarcons] Garcom criado");
      }
      setShowModal(false);
      await fetchGarcons();
    } catch (e: any) {
      console.error("[GestaoGarcons] Save error:", e);
      setModalError(e instanceof Error ? e.message : "Não foi possível salvar o garçom.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: string) => {
    console.log("[GestaoGarcons] Delete confirm for:", id);
    Alert.alert(
      "Excluir garçom?",
      "Esta ação não pode ser desfeita.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: async () => {
            console.log("[GestaoGarcons] DELETE /api/usuarios/" + id);
            try {
              await apiDelete(`/api/usuarios/${id}`);
              console.log("[GestaoGarcons] Garcom excluído:", id);
              setGarcons((prev) => prev.filter((g) => g.id !== id));
            } catch (e: any) {
              console.error("[GestaoGarcons] Delete error:", e);
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
    <>
      <Stack.Screen
        options={{
          title: "Garçons",
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
            <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 17, color: COLORS.text }}>Erro ao carregar garçons</Text>
            <AnimatedPressable onPress={fetchGarcons} style={{ backgroundColor: COLORS.primary, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 }}>
              <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 15, color: "#fff" }}>Tentar novamente</Text>
            </AnimatedPressable>
          </View>
        ) : (
          <FlatList
            data={garcons}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingTop: 16, paddingBottom: 120 }}
            contentInsetAdjustmentBehavior="automatic"
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.primary} />}
            renderItem={({ item, index }) => (
              <GarcomCard garcom={item} index={index} onEdit={openEdit} onDelete={handleDelete} />
            )}
            ListEmptyComponent={
              <View style={{ alignItems: "center", justifyContent: "center", padding: 48, gap: 12 }}>
                <View style={{ width: 72, height: 72, borderRadius: 20, backgroundColor: COLORS.primaryMuted, alignItems: "center", justifyContent: "center" }}>
                  <Users size={32} color={COLORS.primary} />
                </View>
                <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 17, color: COLORS.text }}>Nenhum garçom cadastrado</Text>
                <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 14, color: COLORS.textSecondary, textAlign: "center" }}>
                  Adicione garçons para gerenciar o atendimento
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
                  {editingGarcom ? "Editar Garçom" : "Novo Garçom"}
                </Text>
                <AnimatedPressable
                  onPress={() => { console.log("[GestaoGarcons] Modal closed"); setShowModal(false); }}
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
                  E-mail {editingGarcom ? "" : "*"}
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
                onPress={handleSave}
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
      </View>
    </>
  );
}
