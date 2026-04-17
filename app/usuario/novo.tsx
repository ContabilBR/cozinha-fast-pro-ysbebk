import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
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
import { ChevronDown } from "lucide-react-native";

const ROLES: UserRole[] = ["garcom", "cozinheiro", "gerente", "administrador"];

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  const COLORS = useColors();
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 14, color: COLORS.text }}>{label}</Text>
      {children}
    </View>
  );
}

export default function NovoUsuarioScreen() {
  const COLORS = useColors();
  const router = useRouter();

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [role, setRole] = useState<UserRole>("garcom");
  const [showRolePicker, setShowRolePicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    if (!nome.trim()) { setError("Nome é obrigatório."); return; }
    if (!email.trim()) { setError("E-mail é obrigatório."); return; }
    if (!senha.trim()) { setError("Senha é obrigatória."); return; }
    console.log("[NovoUsuario] Salvar pressionado, email:", email, "role:", role);
    setSubmitting(true);
    setError("");
    try {
      console.log("[NovoUsuario] POST /api/usuarios");
      await apiPost("/api/usuarios", { name: nome.trim(), nome: nome.trim(), email: email.trim(), password: senha, senha, role });
      console.log("[NovoUsuario] Usuário criado com sucesso");
      router.back();
    } catch (e: any) {
      console.error("[NovoUsuario] Erro ao salvar:", e);
      setError("Não foi possível criar o usuário.");
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
          onPress={() => { console.log("[NovoUsuario] Botão voltar pressionado"); router.back(); }}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={{ flexDirection: "row", alignItems: "center", zIndex: 1 }}
        >
          <Ionicons name="chevron-back" size={26} color="#007AFF" />
          <Text style={{ color: "#007AFF", fontSize: 17, fontWeight: "500" }}>Voltar</Text>
        </TouchableOpacity>
        <Text style={{ position: "absolute", left: 0, right: 0, textAlign: "center", fontSize: 17, fontWeight: "700", color: "#111" }}>
          Novo Usuário
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100, gap: 16 }}>
        <FormField label="Nome *">
          <TextInput value={nome} onChangeText={setNome} placeholder="Nome completo" placeholderTextColor={COLORS.textTertiary} style={inputStyle} />
        </FormField>

        <FormField label="E-mail *">
          <TextInput value={email} onChangeText={setEmail} placeholder="email@exemplo.com" placeholderTextColor={COLORS.textTertiary} keyboardType="email-address" autoCapitalize="none" style={inputStyle} />
        </FormField>

        <FormField label="Senha *">
          <TextInput value={senha} onChangeText={setSenha} placeholder="Senha" placeholderTextColor={COLORS.textTertiary} secureTextEntry style={inputStyle} />
        </FormField>

        <FormField label="Função">
          <AnimatedPressable
            onPress={() => { console.log("[NovoUsuario] Seletor de função alternado"); setShowRolePicker((v) => !v); }}
            style={[inputStyle, { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }]}
          >
            <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 15, color: COLORS.text }}>{getRoleLabel(role)}</Text>
            <ChevronDown size={16} color={COLORS.textSecondary} />
          </AnimatedPressable>
          {showRolePicker && (
            <View style={{ backgroundColor: COLORS.surface, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, overflow: "hidden" }}>
              {ROLES.map((r) => (
                <AnimatedPressable
                  key={r}
                  onPress={() => { console.log("[NovoUsuario] Função selecionada:", r); setRole(r); setShowRolePicker(false); }}
                  style={{ padding: 14, borderBottomWidth: 1, borderBottomColor: COLORS.divider, backgroundColor: role === r ? COLORS.primaryMuted : "transparent" }}
                >
                  <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 14, color: COLORS.text }}>{getRoleLabel(r)}</Text>
                </AnimatedPressable>
              ))}
            </View>
          )}
        </FormField>

        {error ? (
          <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 13, color: COLORS.danger, textAlign: "center" }}>{error}</Text>
        ) : null}
      </ScrollView>

      <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: COLORS.surface, borderTopWidth: 1, borderTopColor: COLORS.border }}>
        <AnimatedPressable
          onPress={() => { console.log("[NovoUsuario] Criar usuário pressionado"); handleSave(); }}
          disabled={submitting}
          style={{ backgroundColor: COLORS.primary, borderRadius: 14, height: 52, alignItems: "center", justifyContent: "center" }}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 16, color: "#fff" }}>Criar usuário</Text>
          )}
        </AnimatedPressable>
      </View>
    </SafeAreaView>
  );
}
