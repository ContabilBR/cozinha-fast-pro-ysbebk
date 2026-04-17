import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  Alert,
  TouchableOpacity,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { CardSkeleton } from "@/components/SkeletonLoader";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { apiGet, apiDelete } from "@/utils/api";
import { getInitials, getRoleLabel } from "@/utils/helpers";
import { Users, Search } from "lucide-react-native";

interface ApiUsuario {
  id: string;
  nome?: string;
  name?: string;
  email: string;
  role?: string;
}

function getDisplayName(u: ApiUsuario): string {
  return u.name || u.nome || "";
}

function getRoleBadgeColor(role: string | undefined): { bg: string; text: string } {
  switch (role) {
    case "administrador":
    case "admin":
      return { bg: "#FEE2E2", text: "#DC2626" };
    case "gerente":
      return { bg: "#FEF3C7", text: "#D97706" };
    case "garcom":
      return { bg: "#DBEAFE", text: "#2563EB" };
    case "cozinheiro":
      return { bg: "#D1FAE5", text: "#059669" };
    default:
      return { bg: "#F1F5F9", text: "#64748B" };
  }
}

export default function GestaoUsuariosScreen() {
  const COLORS = useColors();
  const router = useRouter();

  const [usuarios, setUsuarios] = useState<ApiUsuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const fetchUsuarios = useCallback(async () => {
    console.log("[GestaoUsuarios] GET /api/usuarios");
    try {
      const res = await apiGet<any>("/api/usuarios");
      const list: ApiUsuario[] = Array.isArray(res) ? res : (res.usuarios || res.users || []);
      console.log("[GestaoUsuarios] Carregados", list.length, "usuários");
      setUsuarios(list);
      setError("");
    } catch (e: unknown) {
      console.error("[GestaoUsuarios] Erro:", e);
      setError("Não foi possível carregar os usuários.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      console.log("[GestaoUsuarios] Tela focada — recarregando usuários");
      setLoading(true);
      fetchUsuarios();
    }, [fetchUsuarios])
  );

  const handleRefresh = () => {
    console.log("[GestaoUsuarios] Refresh manual");
    setRefreshing(true);
    fetchUsuarios();
  };

  const handleDelete = (id: string, nomeUsuario: string) => {
    const displayNome = nomeUsuario || "Usuário";
    console.log("[GestaoUsuarios] Confirmar exclusão:", id, displayNome);
    Alert.alert(
      "Excluir usuário?",
      `Deseja excluir "${displayNome}"?\n\nEsta ação não pode ser desfeita.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: async () => {
            console.log("[GestaoUsuarios] DELETE /api/usuarios/" + id);
            try {
              await apiDelete(`/api/usuarios/${id}`);
              console.log("[GestaoUsuarios] Usuário excluído:", id);
              setUsuarios((prev) => prev.filter((u) => u.id !== id));
            } catch (e: unknown) {
              console.error("[GestaoUsuarios] Erro ao excluir:", e);
              Alert.alert("Erro", "Não foi possível excluir o usuário.");
            }
          },
        },
      ]
    );
  };

  const searchLower = search.toLowerCase();
  const filteredUsuarios = search.trim()
    ? usuarios.filter((u) => {
        const n = getDisplayName(u).toLowerCase();
        const e = (u.email ?? "").toLowerCase();
        const r = getRoleLabel(u.role).toLowerCase();
        return n.includes(searchLower) || e.includes(searchLower) || r.includes(searchLower);
      })
    : usuarios;

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
          onPress={() => { console.log("[GestaoUsuarios] Botão voltar pressionado"); router.back(); }}
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
          Usuários
        </Text>
        <View style={{ flex: 1 }} />
        <AnimatedPressable
          onPress={() => { console.log("[GestaoUsuarios] Botão incluir pressionado"); router.push("/usuario/novo"); }}
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
            onChangeText={(t) => { console.log("[GestaoUsuarios] Busca:", t); setSearch(t); }}
            placeholder="Buscar por nome, e-mail ou função..."
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
          {[0, 1, 2, 3].map((i) => <CardSkeleton key={i} />)}
        </View>
      ) : error ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 }}>
          <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 17, color: COLORS.text }}>Erro ao carregar usuários</Text>
          <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 14, color: COLORS.textSecondary, textAlign: "center" }}>{error}</Text>
          <AnimatedPressable onPress={fetchUsuarios} style={{ backgroundColor: COLORS.primary, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 }}>
            <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 15, color: "#fff" }}>Tentar novamente</Text>
          </AnimatedPressable>
        </View>
      ) : (
        <FlatList
          data={filteredUsuarios}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 12, paddingBottom: 120 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.primary} />}
          renderItem={({ item }) => {
            const displayName = getDisplayName(item);
            const initials = getInitials(displayName || item.email);
            const roleLabel = getRoleLabel(item.role);
            const badgeColors = getRoleBadgeColor(item.role);
            return (
              <View style={{ backgroundColor: COLORS.surface, borderRadius: 12, padding: 16, marginBottom: 10, flexDirection: "row", alignItems: "center", shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 4, elevation: 2, borderWidth: 1, borderColor: COLORS.border }}>
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.primaryMuted, alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                  <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 15, color: COLORS.primary }}>{initials}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 15, color: COLORS.text }} numberOfLines={1}>{displayName || "Sem nome"}</Text>
                  <Text numberOfLines={1} style={{ fontFamily: "Outfit_400Regular", fontSize: 12, color: COLORS.textSecondary, marginTop: 2 }}>{item.email}</Text>
                  <View style={{ marginTop: 4 }}>
                    <View style={{ alignSelf: "flex-start", backgroundColor: badgeColors.bg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 }}>
                      <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 11, color: badgeColors.text }}>{roleLabel}</Text>
                    </View>
                  </View>
                </View>
                <View style={{ gap: 6 }}>
                  <AnimatedPressable
                    onPress={() => { console.log("[GestaoUsuarios] Editar pressionado:", item.id); router.push(`/usuario/${item.id}`); }}
                    style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#007AFF", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 7, gap: 4 }}
                  >
                    <Ionicons name="pencil" size={14} color="#fff" />
                    <Text style={{ color: "#fff", fontWeight: "600", fontSize: 13 }}>Editar</Text>
                  </AnimatedPressable>
                  <AnimatedPressable
                    onPress={() => { console.log("[GestaoUsuarios] Excluir pressionado:", item.id); handleDelete(item.id, displayName); }}
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
                {search.trim() ? "Nenhum resultado encontrado" : "Nenhum usuário cadastrado"}
              </Text>
              <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 14, color: COLORS.textSecondary, textAlign: "center" }}>
                {search.trim() ? "Tente outro termo de busca" : "Toque em \"Incluir\" para adicionar usuários"}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
