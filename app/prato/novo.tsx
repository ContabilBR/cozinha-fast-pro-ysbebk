import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Switch,
  ActivityIndicator,
} from "react-native";
import { useRouter, Stack } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { Categoria } from "@/types";
import { apiGet, apiPost } from "@/utils/api";
import { ChevronDown } from "lucide-react-native";

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

export default function NovoPratoScreen() {
  const COLORS = useColors();
  const router = useRouter();

  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [preco, setPreco] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [imagemUrl, setImagemUrl] = useState("");
  const [tempoPreparo, setTempoPreparo] = useState("");
  const [disponivel, setDisponivel] = useState(true);
  const [restricoes, setRestricoes] = useState("");
  const [adicionais, setAdicionais] = useState("");
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [showCatPicker, setShowCatPicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    console.log("[NovoPrato] Fetching categorias");
    apiGet<any>("/api/categorias")
      .then((res) => {
        const list: Categoria[] = Array.isArray(res) ? res : (res.categorias || []);
        setCategorias(list);
      })
      .catch((e) => console.error("[NovoPrato] Error fetching categorias:", e));
  }, []);

  const selectedCat = categorias.find((c) => c.id === categoriaId);

  const handleSave = async () => {
    if (!nome.trim()) {
      setError("Nome é obrigatório.");
      return;
    }
    if (!preco || isNaN(Number(preco))) {
      setError("Preço inválido.");
      return;
    }
    console.log("[NovoPrato] Save pressed, nome:", nome);
    setSubmitting(true);
    setError("");
    try {
      await apiPost("/api/pratos", {
        nome: nome.trim(),
        descricao: descricao.trim() || undefined,
        preco: Number(preco),
        categoria_id: categoriaId || undefined,
        imagem_url: imagemUrl.trim() || undefined,
        tempo_preparo: Number(tempoPreparo) || 15,
        disponivel,
        restricoes: restricoes.trim() || undefined,
        adicionais: adicionais.trim() || undefined,
      });
      console.log("[NovoPrato] Prato created successfully");
      router.back();
    } catch (e: any) {
      console.error("[NovoPrato] Save error:", e);
      setError("Não foi possível salvar o prato.");
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
    <>
      <Stack.Screen
        options={{
          title: "Novo Prato",
          headerTintColor: COLORS.primary,
          headerBackButtonDisplayMode: "minimal",
          presentation: "modal",
        }}
      />
      <View style={{ flex: 1, backgroundColor: COLORS.background }}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100, gap: 16 }}>
          <FormField label="Nome *">
            <TextInput
              value={nome}
              onChangeText={setNome}
              placeholder="Ex: Frango Grelhado"
              placeholderTextColor={COLORS.textTertiary}
              style={inputStyle}
            />
          </FormField>

          <FormField label="Descrição">
            <TextInput
              value={descricao}
              onChangeText={setDescricao}
              placeholder="Descrição do prato"
              placeholderTextColor={COLORS.textTertiary}
              multiline
              numberOfLines={3}
              style={[inputStyle, { minHeight: 80, textAlignVertical: "top" }]}
            />
          </FormField>

          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <FormField label="Preço (R$) *">
                <TextInput
                  value={preco}
                  onChangeText={setPreco}
                  placeholder="0,00"
                  placeholderTextColor={COLORS.textTertiary}
                  keyboardType="decimal-pad"
                  style={inputStyle}
                />
              </FormField>
            </View>
            <View style={{ flex: 1 }}>
              <FormField label="Tempo (min)">
                <TextInput
                  value={tempoPreparo}
                  onChangeText={setTempoPreparo}
                  placeholder="15"
                  placeholderTextColor={COLORS.textTertiary}
                  keyboardType="number-pad"
                  style={inputStyle}
                />
              </FormField>
            </View>
          </View>

          <FormField label="Categoria">
            <AnimatedPressable
              onPress={() => {
                console.log("[NovoPrato] Category picker toggled");
                setShowCatPicker((v) => !v);
              }}
              style={[inputStyle, { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }]}
            >
              <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 15, color: selectedCat ? COLORS.text : COLORS.textTertiary }}>
                {selectedCat?.nome ?? "Selecionar categoria"}
              </Text>
              <ChevronDown size={16} color={COLORS.textSecondary} />
            </AnimatedPressable>
            {showCatPicker && (
              <View
                style={{
                  backgroundColor: COLORS.surface,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: COLORS.border,
                  overflow: "hidden",
                }}
              >
                {categorias.map((cat) => (
                  <AnimatedPressable
                    key={cat.id}
                    onPress={() => {
                      console.log("[NovoPrato] Category selected:", cat.nome);
                      setCategoriaId(cat.id);
                      setShowCatPicker(false);
                    }}
                    style={{
                      padding: 14,
                      borderBottomWidth: 1,
                      borderBottomColor: COLORS.divider,
                      backgroundColor: categoriaId === cat.id ? COLORS.primaryMuted : "transparent",
                    }}
                  >
                    <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 14, color: COLORS.text }}>
                      {cat.nome}
                    </Text>
                  </AnimatedPressable>
                ))}
              </View>
            )}
          </FormField>

          <FormField label="URL da imagem">
            <TextInput
              value={imagemUrl}
              onChangeText={setImagemUrl}
              placeholder="https://..."
              placeholderTextColor={COLORS.textTertiary}
              autoCapitalize="none"
              style={inputStyle}
            />
          </FormField>

          <FormField label="Restrições alimentares">
            <TextInput
              value={restricoes}
              onChangeText={setRestricoes}
              placeholder="Ex: Contém glúten, lactose"
              placeholderTextColor={COLORS.textTertiary}
              style={inputStyle}
            />
          </FormField>

          <FormField label="Adicionais disponíveis">
            <TextInput
              value={adicionais}
              onChangeText={setAdicionais}
              placeholder="Ex: Queijo extra, bacon"
              placeholderTextColor={COLORS.textTertiary}
              style={inputStyle}
            />
          </FormField>

          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: COLORS.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: COLORS.border }}>
            <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 15, color: COLORS.text }}>
              Disponível
            </Text>
            <Switch
              value={disponivel}
              onValueChange={(val) => {
                console.log("[NovoPrato] Disponivel toggled:", val);
                setDisponivel(val);
              }}
              trackColor={{ false: COLORS.border, true: COLORS.primary + "80" }}
              thumbColor={disponivel ? COLORS.primary : COLORS.textTertiary}
            />
          </View>

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
            style={{
              backgroundColor: COLORS.primary,
              borderRadius: 14,
              height: 52,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 16, color: "#fff" }}>
                Salvar prato
              </Text>
            )}
          </AnimatedPressable>
        </View>
      </View>
    </>
  );
}
