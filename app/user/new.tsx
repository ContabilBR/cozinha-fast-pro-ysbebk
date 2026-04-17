import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Switch,
  ActivityIndicator,
  TouchableOpacity,
  SafeAreaView,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { UserRole } from "@/types";
import { apiPost } from "@/utils/api";
import { getRoleLabel } from "@/utils/helpers";

const ROLES: UserRole[] = ["garcom", "administrador", "gerente", "cozinheiro"];
const ROLE_COLORS: Record<UserRole, string> = {
  garcom: "#3B82F6",
  administrador: "#EF4444",
  admin: "#EF4444",
  gerente: "#8B5CF6",
  cozinheiro: "#F59E0B",
};

function FormField({
  label, value, onChangeText, placeholder, keyboardType, autoCapitalize, secureTextEntry,
}: {
  label: string; value: string; onChangeText: (t: string) => void;
  placeholder?: string; keyboardType?: any; autoCapitalize?: any; secureTextEntry?: boolean;
}) {
  const COLORS = useColors();
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 14, color: COLORS.text }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textTertiary}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize ?? "words"}
        secureTextEntry={secureTextEntry}
        style={{ backgroundColor: COLORS.surfaceSecondary, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, padding: 14, fontFamily: "Outfit_400Regular", fontSize: 15, color: COLORS.text, height: 52 }}
      />
    </View>
  );
}

export default function NewUserScreen() {
  const COLORS = useColors();
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("garcom");
  const [active, setActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    if (!name.trim()) { setError("Nome é obrigatório."); return; }
    if (!email.trim()) { setError("E-mail é obrigatório."); return; }
    if (!password.trim() || password.length < 6) { setError("Senha deve ter pelo menos 6 caracteres."); return; }
    console.log("[NewUser] Criar usuário pressionado:", email, "role:", role);
    setError("");
    setSubmitting(true);
    try {
      console.log("[NewUser] POST /api/users");
      await apiPost("/api/users", { name: name.trim(), email: email.trim(), password, role, active });
      console.log("[NewUser] Usuário criado com sucesso");
      router.back();
    } catch (e: any) {
      console.error("[NewUser] Erro:", e);
      setError("Não foi possível criar o usuário.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      {/* Nav bar */}
      <View style={{ flexDirection: "row", alignItems: "center", height: 56, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: "#e0e0e0", backgroundColor: "#fff" }}>
        <TouchableOpacity
          onPress={() => { console.log("[NewUser] Botão voltar pressionado"); router.back(); }}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={{ flexDirection: "row", alignItems: "center", zIndex: 1 }}
        >
          <Ionicons name="chevron-back" size={26} color="#007AFF" />
          <Text style={{ color: "#007AFF", fontSize: 17, fontWeight: "500" }}>Voltar</Text>
        </TouchableOpacity>
        <Text style={{ position: "absolute", left: 0, right: 0, textAlign: "center", fontSize: 17, fontWeight: "700", color: "#111" }}>
          New User
        </Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <FormField label="Nome *" value={name} onChangeText={setName} placeholder="Nome completo" />
        <FormField label="E-mail *" value={email} onChangeText={setEmail} placeholder="email@exemplo.com" keyboardType="email-address" autoCapitalize="none" />
        <FormField label="Senha *" value={password} onChangeText={setPassword} placeholder="Mínimo 6 caracteres" secureTextEntry autoCapitalize="none" />

        <View style={{ gap: 8 }}>
          <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 14, color: COLORS.text }}>Função</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {ROLES.map((r) => {
              const rc = ROLE_COLORS[r];
              const isSelected = role === r;
              const roleLabel = getRoleLabel(r);
              return (
                <AnimatedPressable
                  key={r}
                  onPress={() => { console.log("[NewUser] Função selecionada:", r); setRole(r); }}
                  style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: isSelected ? rc : COLORS.surfaceSecondary, borderWidth: 1.5, borderColor: isSelected ? rc : "transparent" }}
                >
                  <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 13, color: isSelected ? "#fff" : COLORS.textSecondary }}>{roleLabel}</Text>
                </AnimatedPressable>
              );
            })}
          </View>
        </View>

        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: COLORS.surface, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: COLORS.border }}>
          <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 15, color: COLORS.text }}>Usuário ativo</Text>
          <Switch
            value={active}
            onValueChange={(v) => { console.log("[NewUser] Toggle ativo:", v); setActive(v); }}
            trackColor={{ false: COLORS.border, true: COLORS.primary + "80" }}
            thumbColor={active ? COLORS.primary : COLORS.textTertiary}
          />
        </View>

        {!!error && <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 13, color: COLORS.danger }}>{error}</Text>}

        <AnimatedPressable
          onPress={() => { console.log("[NewUser] Criar usuário pressionado"); handleSave(); }}
          disabled={submitting}
          style={{ backgroundColor: COLORS.primary, borderRadius: 14, height: 52, alignItems: "center", justifyContent: "center", marginTop: 8 }}
        >
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 16, color: "#fff" }}>Criar usuário</Text>}
        </AnimatedPressable>
      </ScrollView>
    </SafeAreaView>
  );
}
