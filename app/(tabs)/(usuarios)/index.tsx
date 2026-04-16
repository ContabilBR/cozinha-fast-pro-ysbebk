import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  Animated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { CardSkeleton } from "@/components/SkeletonLoader";
import { apiGet } from "@/utils/api";
import { getRoleLabel, getInitials } from "@/utils/helpers";
import { Users } from "lucide-react-native";

interface ApiUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

const ROLE_COLORS: Record<string, string> = {
  garcom: "#3B82F6",
  administrador: "#EF4444",
  admin: "#EF4444",
  gerente: "#8B5CF6",
  cozinheiro: "#F59E0B",
};

function UserCard({ user, index }: { user: ApiUser; index: number }) {
  const COLORS = useColors();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 350, delay: index * 60, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 350, delay: index * 60, useNativeDriver: true }),
    ]).start();
  }, [index, opacity, translateY]);

  const roleColor = ROLE_COLORS[user.role] || COLORS.textSecondary;
  const initials = getInitials(user.name || user.email);
  const roleLabel = getRoleLabel(user.role);

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      <View
        style={{
          backgroundColor: COLORS.surface,
          borderRadius: 16,
          padding: 16,
          marginHorizontal: 16,
          marginBottom: 10,
          borderWidth: 1,
          borderColor: COLORS.border,
          flexDirection: "row",
          alignItems: "center",
          gap: 14,
        }}
      >
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: roleColor + "20",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 16, color: roleColor }}>
            {initials}
          </Text>
        </View>

        <View style={{ flex: 1, gap: 3 }}>
          <Text numberOfLines={1} style={{ fontFamily: "Outfit_600SemiBold", fontSize: 15, color: COLORS.text }}>
            {user.name || "Sem nome"}
          </Text>
          <Text numberOfLines={1} style={{ fontFamily: "Outfit_400Regular", fontSize: 13, color: COLORS.textSecondary }}>
            {user.email}
          </Text>
        </View>

        <View
          style={{
            backgroundColor: roleColor + "20",
            borderRadius: 8,
            paddingHorizontal: 8,
            paddingVertical: 3,
          }}
        >
          <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 11, color: roleColor }}>
            {roleLabel}
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}

export default function UsuariosScreen() {
  const COLORS = useColors();
  const insets = useSafeAreaInsets();

  const [users, setUsers] = useState<ApiUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const fetchUsers = useCallback(async () => {
    console.log("[Usuarios] Fetching users from /api/users");
    try {
      const res = await apiGet<any>("/api/users");
      const list: ApiUser[] = Array.isArray(res) ? res : (res.users || []);
      console.log("[Usuarios] Loaded", list.length, "users");
      setUsers(list);
      setError("");
    } catch (e: any) {
      console.error("[Usuarios] Error:", e instanceof Error ? e.message : String(e));
      setError("Não foi possível carregar os usuários.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleRefresh = () => {
    console.log("[Usuarios] Manual refresh");
    setRefreshing(true);
    fetchUsers();
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <View
        style={{
          paddingTop: insets.top + 12,
          paddingHorizontal: 20,
          paddingBottom: 16,
          backgroundColor: COLORS.surface,
          borderBottomWidth: 1,
          borderBottomColor: COLORS.border,
        }}
      >
        <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 26, color: COLORS.text, letterSpacing: -0.3 }}>
          Usuários
        </Text>
        <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 13, color: COLORS.textSecondary }}>
          {users.length} cadastrados
        </Text>
      </View>

      {loading ? (
        <View style={{ paddingTop: 16 }}>
          {[0, 1, 2].map((i) => <CardSkeleton key={i} />)}
        </View>
      ) : error ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 }}>
          <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 17, color: COLORS.text }}>
            Erro ao carregar usuários
          </Text>
          <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 14, color: COLORS.textSecondary, textAlign: "center" }}>
            {error}
          </Text>
          <AnimatedPressable
            onPress={fetchUsers}
            style={{ backgroundColor: COLORS.primary, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 }}
          >
            <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 15, color: "#fff" }}>
              Tentar novamente
            </Text>
          </AnimatedPressable>
        </View>
      ) : (
        <FlatList
          data={users}
          renderItem={({ item, index }) => (
            <UserCard user={item} index={index} />
          )}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingTop: 16, paddingBottom: 120 }}
          contentInsetAdjustmentBehavior="automatic"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.primary} />
          }
          ListEmptyComponent={
            <View style={{ alignItems: "center", justifyContent: "center", padding: 48, gap: 12 }}>
              <View
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 20,
                  backgroundColor: COLORS.primaryMuted,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Users size={32} color={COLORS.primary} />
              </View>
              <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 17, color: COLORS.text }}>
                Nenhum usuário encontrado
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}
