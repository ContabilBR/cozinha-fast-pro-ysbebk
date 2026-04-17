import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { UserRole } from "@/types";
import { apiGet, apiPut } from "@/utils/api";
import { getRoleLabel } from "@/utils/helpers";
import { ChevronDown } from "lucide-react-native";

const ROLES: UserRole[] = ["garcom", "cozinheiro", "gerente", "administrador"];

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  const COLORS = useColors();
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 14, color: COLORS.text }}>
        {label}
      </Text>
      {children}
    </View>
  );
}

export default function EditarUsuarioScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const COLORS = useColors();
  const router = useRouter();

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [role, setRole] = useState<UserRole>("garcom");
  const [showRolePicker, setShowRolePicker] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    console.log("[EditarUsuario] Fetching user:", id);
    apiGet<any>(`/api/usuarios/${id}`)
      .then((res) => {
        const u = res.usuario || res.user || res;
        setNome(u.name ?? "");
        setEmail(u.email ?? "");
        setRole(u.role ?? "garcom");
      })
      .catch((e) => {
        console.error("[EditarUsuario] Error:", e);
        setError("Não foi possível carregar o usuário.");
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handleSave = async () => {
    if (!nome.trim()) { setError("Nome é obrigatório."); return; }
    console.log("[EditarUsuario] Save pressed:", id, "role:", role);
    setSubmitting(true);
    setError("");
    try {
      const payload: any = { name: nome.trim(), email: email.trim(), role };
      if (senha.trim()) payload.password = senha;
      await apiPut(`/api/usuarios/${id}`, payload);
      console.log("[EditarUsuario] User updated successfully");
      router.back();
    } catch (e: any) {
      console.error("[EditarUsuario] Save error:", e);
      setError("Não foi possível salvar as alterações.");
    } finally {
      setSubmitting(false);
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

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: "Editar Usuário", headerTintColor: COLORS.primary }} />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.background }}>
          <ActivityIndicator color={COLORS.primary} />
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: "Editar Usuário",
          headerTintColor: COLORS.primary,
          headerBackButtonDisplayMode: "minimal",
        }}
      />
      <View style={{ flex: 1, backgroundColor: COLORS.background }}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100, gap: 16 }}>
          <FormField label="Nome *">
            <TextInput value={nome} onChangeText={setNome} placeholder="Nome completo" placeholderTextColor={COLORS.textTertiary} style={inputStyle} />
          </FormField>

          <FormField label="E-mail">
            <TextInput value={email} onChangeText={setEmail} placeholder="email@exemplo.com" placeholderTextColor={COLORS.textTertiary} keyboardType="email-address" autoCapitalize="none" style={inputStyle} />
          </FormField>

          <FormField label="Nova senha (opcional)">
            <TextInput value={senha} onChangeText={setSenha} placeholder="Deixe em branco para manter" placeholderTextColor={COLORS.textTertiary} secureTextEntry style={inputStyle} />
          </FormField>

          <FormField label="Função">
            <AnimatedPressable
              onPress={() => {
                console.log("[EditarUsuario] Role picker toggled");
                setShowRolePicker((v) => !v);
              }}
              style={[inputStyle, { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }]}
            >
              <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 15, color: COLORS.text }}>
                {getRoleLabel(role)}
              </Text>
              <ChevronDown size={16} color={COLORS.textSecondary} />
            </AnimatedPressable>
            {showRolePicker && (
              <View style={{ backgroundColor: COLORS.surface, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, overflow: "hidden" }}>
                {ROLES.map((r) => (
                  <AnimatedPressable
                    key={r}
                    onPress={() => {
                      console.log("[EditarUsuario] Role selected:", r);
                      setRole(r);
                      setShowRolePicker(false);
                    }}
                    style={{ padding: 14, borderBottomWidth: 1, borderBottomColor: COLORS.divider, backgroundColor: role === r ? COLORS.primaryMuted : "transparent" }}
                  >
                    <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 14, color: COLORS.text }}>
                      {getRoleLabel(r)}
                    </Text>
                  </AnimatedPressable>
                ))}
              </View>
            )}
          </FormField>

          {error ? (
            <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 13, color: COLORS.danger, textAlign: "center" }}>
              {error}
            </Text>
          ) : null}
        </ScrollView>

        <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: COLORS.surface, borderTopWidth: 1, borderTopColor: COLORS.border }}>
          <AnimatedPressable
            onPress={handleSave}
            disabled={submitting}
            style={{ backgroundColor: COLORS.primary, borderRadius: 14, height: 52, alignItems: "center", justifyContent: "center" }}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 16, color: "#fff" }}>
                Salvar alterações
              </Text>
            )}
          </AnimatedPressable>
        </View>
      </View>
    </>
  );
}
