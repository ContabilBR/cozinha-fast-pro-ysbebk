import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Switch,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { Prato, Categoria } from "@/types";
import { apiGet, apiPut } from "@/utils/api";
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

export default function EditarPratoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
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
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    console.log("[EditarPrato] Fetching prato and categorias:", id);
    Promise.all([
      apiGet<any>(`/api/pratos/${id}`),
      apiGet<any>("/api/categorias"),
    ]).then(([pratoRes, catRes]) => {
      const p: Prato = pratoRes.prato || pratoRes;
      const cats: Categoria[] = Array.isArray(catRes) ? catRes : (catRes.categorias || []);
      setNome(p.nome);
      setDescricao(p.descricao ?? "");
      setPreco(String(p.preco));
      setCategoriaId(p.categoria_id ?? "");
      setImagemUrl(p.imagem_url ?? "");
      setTempoPreparo(String(p.tempo_preparo));
      setDisponivel(p.disponivel);
      setRestricoes(p.restricoes ?? "");
      setAdicionais(p.adicionais ?? "");
      setCategorias(cats);
    }).catch((e) => {
      console.error("[EditarPrato] Error:", e);
      setError("Não foi possível carregar o prato.");
    }).finally(() => setLoading(false));
  }, [id]);

  const selectedCat = categorias.find((c) => c.id === categoriaId);

  const handleSave = async () => {
    if (!nome.trim()) {
      setError("Nome é obrigatório.");
      return;
    }
    console.log("[EditarPrato] Save pressed:", id);
    setSubmitting(true);
    setError("");
    try {
      await apiPut(`/api/pratos/${id}`, {
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
      console.log("[EditarPrato] Prato updated successfully");
      router.back();
    } catch (e: any) {
      console.error("[EditarPrato] Save error:", e);
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
        <Stack.Screen options={{ title: "Editar Prato", headerTintColor: COLORS.primary }} />
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
          title: "Editar Prato",
          headerTintColor: COLORS.primary,
          headerBackButtonDisplayMode: "minimal",
        }}
      />
      <View style={{ flex: 1, backgroundColor: COLORS.background }}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100, gap: 16 }}>
          <FormField label="Nome *">
            <TextInput value={nome} onChangeText={setNome} placeholder="Nome do prato" placeholderTextColor={COLORS.textTertiary} style={inputStyle} />
          </FormField>

          <FormField label="Descrição">
            <TextInput value={descricao} onChangeText={setDescricao} placeholder="Descrição" placeholderTextColor={COLORS.textTertiary} multiline numberOfLines={3} style={[inputStyle, { minHeight: 80, textAlignVertical: "top" }]} />
          </FormField>

          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <FormField label="Preço (R$) *">
                <TextInput value={preco} onChangeText={setPreco} placeholder="0,00" placeholderTextColor={COLORS.textTertiary} keyboardType="decimal-pad" style={inputStyle} />
              </FormField>
            </View>
            <View style={{ flex: 1 }}>
              <FormField label="Tempo (min)">
                <TextInput value={tempoPreparo} onChangeText={setTempoPreparo} placeholder="15" placeholderTextColor={COLORS.textTertiary} keyboardType="number-pad" style={inputStyle} />
              </FormField>
            </View>
          </View>

          <FormField label="Categoria">
            <AnimatedPressable
              onPress={() => setShowCatPicker((v) => !v)}
              style={[inputStyle, { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }]}
            >
              <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 15, color: selectedCat ? COLORS.text : COLORS.textTertiary }}>
                {selectedCat?.nome ?? "Selecionar categoria"}
              </Text>
              <ChevronDown size={16} color={COLORS.textSecondary} />
            </AnimatedPressable>
            {showCatPicker && (
              <View style={{ backgroundColor: COLORS.surface, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, overflow: "hidden" }}>
                {categorias.map((cat) => (
                  <AnimatedPressable
                    key={cat.id}
                    onPress={() => {
                      console.log("[EditarPrato] Category selected:", cat.nome);
                      setCategoriaId(cat.id);
                      setShowCatPicker(false);
                    }}
                    style={{ padding: 14, borderBottomWidth: 1, borderBottomColor: COLORS.divider, backgroundColor: categoriaId === cat.id ? COLORS.primaryMuted : "transparent" }}
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
            <TextInput value={imagemUrl} onChangeText={setImagemUrl} placeholder="https://..." placeholderTextColor={COLORS.textTertiary} autoCapitalize="none" style={inputStyle} />
          </FormField>

          <FormField label="Restrições alimentares">
            <TextInput value={restricoes} onChangeText={setRestricoes} placeholder="Ex: Contém glúten" placeholderTextColor={COLORS.textTertiary} style={inputStyle} />
          </FormField>

          <FormField label="Adicionais disponíveis">
            <TextInput value={adicionais} onChangeText={setAdicionais} placeholder="Ex: Queijo extra" placeholderTextColor={COLORS.textTertiary} style={inputStyle} />
          </FormField>

          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: COLORS.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: COLORS.border }}>
            <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 15, color: COLORS.text }}>
              Disponível
            </Text>
            <Switch
              value={disponivel}
              onValueChange={(val) => {
                console.log("[EditarPrato] Disponivel toggled:", val);
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
