import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  Animated,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { CardSkeleton } from "@/components/SkeletonLoader";
import { User, UserRole } from "@/types";
import { apiGet } from "@/utils/api";
import { getRoleLabel, getInitials } from "@/utils/helpers";
import { Plus, Users } from "lucide-react-native";

const ROLE_COLORS: Record<UserRole, string> = {
  garcom: "#3B82F6",
  administrador: "#EF4444",
  gerente: "#8B5CF6",
  cozinheiro: "#F59E0B",
};

function UserCard({ user, onPress, index }: { user: User; onPress: () => void; index: number }) {
  const COLORS = useColors();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 350, delay: index * 60, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 350, delay: index * 60, useNativeDriver: true }),
    ]).start();
  }, []);

  const roleColor = ROLE_COLORS[user.role] || COLORS.textSecondary;
  const initials = getInitials(user.name || user.email);
  const roleLabel = getRoleLabel(user.role);
  const activeLabel = user.active ? "Ativo" : "Inativo";

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      <AnimatedPressable
        onPress={onPress}
        style={{
          backgroundColor: COLORS.surface,
          borderRadius: 16,
          padding: 16,
          marginHorizontal: 16,
          marginBottom: 10,
          borderWidth: 1,
          borderColor: COLORS.border,
          boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)",
          flexDirection: "row",
          alignItems: "center",
          gap: 14,
        }}
      >
        {/* Avatar */}
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

        {/* Info */}
        <View style={{ flex: 1, gap: 3 }}>
          <Text
            numberOfLines={1}
            style={{ fontFamily: "Outfit_600SemiBold", fontSize: 15, color: COLORS.text }}
          >
            {user.name || "Sem nome"}
          </Text>
          <Text
            numberOfLines={1}
            style={{ fontFamily: "Outfit_400Regular", fontSize: 13, color: COLORS.textSecondary }}
          >
            {user.email}
          </Text>
        </View>

        {/* Role badge + active */}
        <View style={{ alignItems: "flex-end", gap: 6 }}>
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
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <View
              style={{
                width: 7,
                height: 7,
                borderRadius: 4,
                backgroundColor: user.active ? COLORS.success : COLORS.textTertiary,
              }}
            />
            <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 11, color: COLORS.textSecondary }}>
              {activeLabel}
            </Text>
          </View>
        </View>
      </AnimatedPressable>
    </Animated.View>
  );
}

export default function UsuariosScreen() {
  const COLORS = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const fetchUsers = useCallback(async () => {
    console.log("[Usuarios] Fetching users");
    try {
      const res = await apiGet<any>("/api/users");
      const list: User[] = Array.isArray(res) ? res : (res.users || []);
      setUsers(list);
      setError("");
    } catch (e: any) {
      console.error("[Usuarios] Error:", e);
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
      {/* Header */}
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
            <UserCard
              user={item}
              onPress={() => {
                console.log("[Usuarios] User pressed:", item.id);
                router.push(`/user/${item.id}`);
              }}
              index={index}
            />
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

      {/* FAB */}
      <AnimatedPressable
        onPress={() => {
          console.log("[Usuarios] FAB - new user");
          router.push("/user/new");
        }}
        style={{
          position: "absolute",
          bottom: insets.bottom + 90,
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
    </View>
  );
}
