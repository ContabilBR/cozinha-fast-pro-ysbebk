import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Switch,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { SkeletonLine } from "@/components/SkeletonLoader";
import { User, UserRole } from "@/types";
import { apiGet, apiPut } from "@/utils/api";
import { getRoleLabel, getInitials } from "@/utils/helpers";

const ROLES: UserRole[] = ["garcom", "administrador", "gerente", "cozinheiro"];
const ROLE_COLORS: Record<UserRole, string> = {
  garcom: "#3B82F6",
  administrador: "#EF4444",
  gerente: "#8B5CF6",
  cozinheiro: "#F59E0B",
};

function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  autoCapitalize,
  secureTextEntry,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  keyboardType?: any;
  autoCapitalize?: any;
  secureTextEntry?: boolean;
}) {
  const COLORS = useColors();
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 14, color: COLORS.text }}>
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textTertiary}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize ?? "words"}
        secureTextEntry={secureTextEntry}
        style={{
          backgroundColor: COLORS.surfaceSecondary,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: COLORS.border,
          padding: 14,
          fontFamily: "Outfit_400Regular",
          fontSize: 15,
          color: COLORS.text,
          height: 52,
        }}
      />
    </View>
  );
}

export default function UserDetailScreen() {
  const COLORS = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("garcom");
  const [active, setActive] = useState(true);

  const fetchUser = useCallback(async () => {
    if (!id) return;
    console.log("[UserDetail] Fetching user:", id);
    try {
      const data = await apiGet<User>(`/api/users/${id}`);
      setUser(data);
      setName(data.name);
      setEmail(data.email);
      setRole(data.role);
      setActive(data.active);
    } catch (e) {
      console.error("[UserDetail] Error:", e);
      setError("Não foi possível carregar o usuário.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchUser(); }, [fetchUser]);

  const handleSave = async () => {
    if (!name.trim()) { setError("Nome é obrigatório."); return; }
    if (!email.trim()) { setError("E-mail é obrigatório."); return; }
    console.log("[UserDetail] Saving user:", id);
    setError("");
    setSubmitting(true);
    try {
      await apiPut(`/api/users/${id}`, {
        name: name.trim(),
        email: email.trim(),
        role,
        active,
      });
      console.log("[UserDetail] User saved successfully");
      router.back();
    } catch (e: any) {
      console.error("[UserDetail] Save error:", e);
      setError("Não foi possível salvar o usuário.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.background, padding: 20, gap: 16 }}>
        <SkeletonLine width="60%" height={20} />
        <SkeletonLine width="100%" height={52} borderRadius={12} />
        <SkeletonLine width="100%" height={52} borderRadius={12} />
      </View>
    );
  }

  const initials = getInitials(name || email);
  const roleColor = ROLE_COLORS[role] || COLORS.primary;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: COLORS.background }}
      contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
    >
      {/* Avatar */}
      <View style={{ alignItems: "center", marginBottom: 8 }}>
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: 36,
            backgroundColor: roleColor + "20",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 26, color: roleColor }}>
            {initials}
          </Text>
        </View>
      </View>

      <FormField label="Nome *" value={name} onChangeText={setName} placeholder="Nome completo" />
      <FormField label="E-mail *" value={email} onChangeText={setEmail} placeholder="email@exemplo.com" keyboardType="email-address" autoCapitalize="none" />

      {/* Role picker */}
      <View style={{ gap: 8 }}>
        <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 14, color: COLORS.text }}>
          Função
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {ROLES.map((r) => {
            const rc = ROLE_COLORS[r];
            const isSelected = role === r;
            return (
              <AnimatedPressable
                key={r}
                onPress={() => {
                  console.log("[UserDetail] Role selected:", r);
                  setRole(r);
                }}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 20,
                  backgroundColor: isSelected ? rc : COLORS.surfaceSecondary,
                  borderWidth: 1.5,
                  borderColor: isSelected ? rc : "transparent",
                }}
              >
                <Text
                  style={{
                    fontFamily: "Outfit_600SemiBold",
                    fontSize: 13,
                    color: isSelected ? "#fff" : COLORS.textSecondary,
                  }}
                >
                  {getRoleLabel(r)}
                </Text>
              </AnimatedPressable>
            );
          })}
        </View>
      </View>

      {/* Active toggle */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          backgroundColor: COLORS.surface,
          borderRadius: 12,
          padding: 16,
          borderWidth: 1,
          borderColor: COLORS.border,
        }}
      >
        <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 15, color: COLORS.text }}>
          Usuário ativo
        </Text>
        <Switch
          value={active}
          onValueChange={(v) => {
            console.log("[UserDetail] Active toggle:", v);
            setActive(v);
          }}
          trackColor={{ false: COLORS.border, true: COLORS.primary + "80" }}
          thumbColor={active ? COLORS.primary : COLORS.textTertiary}
        />
      </View>

      {!!error && (
        <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 13, color: COLORS.danger }}>
          {error}
        </Text>
      )}

      <AnimatedPressable
        onPress={handleSave}
        disabled={submitting}
        style={{
          backgroundColor: COLORS.primary,
          borderRadius: 14,
          height: 52,
          alignItems: "center",
          justifyContent: "center",
          marginTop: 8,
        }}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 16, color: "#fff" }}>
            Salvar alterações
          </Text>
        )}
      </AnimatedPressable>
    </ScrollView>
  );
}
