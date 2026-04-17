import React, { useEffect, useState } from "react";
import { View, Text, TextInput, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform, Switch, TouchableOpacity, Alert } from "react-native";
import { Image } from "expo-image";
import { Stack, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { apiGet, apiPost } from "@/utils/api";
import { Plus, Camera, ChevronDown } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";

const BACKEND_URL = "https://j74mf38wgua3d4qd5mqbjjvza88n2qcp.app.specular.dev";
const DEFAULT_IMAGE = "https://picsum.photos/seed/novoprato/400/300";

interface ApiCategoria { id: string; nome: string; }

export default function GestaoPratos() {
  const COLORS = useColors();
  const insets = useSafeAreaInsets();
  const [categorias, setCategorias] = useState<ApiCategoria[]>([]);
  const [loadingCats, setLoadingCats] = useState(true);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [preco, setPreco] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [imagemUrl, setImagemUrl] = useState("");
  const [disponivel, setDisponivel] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    console.log("[GestaoPratos] GET /api/categorias");
    apiGet<any>("/api/categorias")
      .then((res) => {
        const list: ApiCategoria[] = Array.isArray(res) ? res : (res.categorias ?? []);
        console.log("[GestaoPratos] Categorias carregadas", list.length);
        setCategorias(list);
      })
      .catch((e) => { console.log("[GestaoPratos] Erro ao carregar categorias", e); setCategorias([]); })
      .finally(() => setLoadingCats(false));
  }, []);

  const selectedCategoria = categorias.find((c) => c.id === categoriaId);

  const pickImage = async () => {
    console.log("[GestaoPratos] pickImage pressed");
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [4, 3], quality: 0.7, base64: true });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    if (!asset.base64) { Alert.alert("Erro", "Não foi possível ler a imagem."); return; }
    setUploading(true);
    try {
      console.log("[GestaoPratos] POST /api/upload/imagem");
      const response = await fetch(`${BACKEND_URL}/api/upload/imagem`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ base64: asset.base64, mimeType: asset.mimeType ?? "image/jpeg" }) });
      if (!response.ok) throw new Error("Falha no upload da imagem.");
      const data = await response.json();
      const url: string = data.url ?? "";
      const finalUrl = url.startsWith("http") ? url : `${BACKEND_URL}${url}`;
      console.log("[GestaoPratos] Upload concluído", finalUrl);
      setImagemUrl(finalUrl);
    } catch (e: any) {
      console.log("[GestaoPratos] Erro no upload", e);
      Alert.alert("Erro", e instanceof Error ? e.message : "Não foi possível fazer upload.");
    } finally {
      setUploading(false);
    }
  };

  const handleCreate = async () => {
    console.log("[GestaoPratos] handleCreate pressed", { nome, preco, categoriaId, disponivel });
    if (!nome.trim()) { setFormError("Nome é obrigatório."); return; }
    const precoNum = parseFloat(preco.replace(",", "."));
    if (isNaN(precoNum) || precoNum < 0) { setFormError("Preço inválido."); return; }
    setSubmitting(true);
    setFormError("");
    try {
      console.log("[GestaoPratos] POST /api/pratos", { nome: nome.trim(), preco: precoNum, categoriaId, disponivel });
      await apiPost("/api/pratos", { nome: nome.trim(), descricao: descricao.trim() || undefined, preco: precoNum, categoria_id: categoriaId || undefined, imagem_url: imagemUrl || DEFAULT_IMAGE, disponivel });
      console.log("[GestaoPratos] Prato criado com sucesso");
      router.back();
    } catch (e: any) {
      console.log("[GestaoPratos] Erro ao criar prato", e);
      setFormError(e instanceof Error ? e.message : "Não foi possível criar o prato.");
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle = { backgroundColor: COLORS.surfaceSecondary, borderRadius: 12, padding: 12, fontFamily: "Outfit_400Regular" as const, fontSize: 15, color: COLORS.text, borderWidth: 1, borderColor: COLORS.border };

  return (
    <>
      <Stack.Screen options={{ title: "Novo Prato", headerTintColor: COLORS.primary, headerBackButtonDisplayMode: "minimal", headerStyle: { backgroundColor: COLORS.surface }, headerTitleStyle: { fontFamily: "Outfit_700Bold", color: COLORS.text } }} />
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: COLORS.background }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }} keyboardShouldPersistTaps="handled">
          <View style={{ backgroundColor: COLORS.surface, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: COLORS.border, gap: 16 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: COLORS.primaryMuted, alignItems: "center", justifyContent: "center" }}>
                <Plus size={18} color={COLORS.primary} />
              </View>
              <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 17, color: COLORS.text }}>Novo Prato</Text>
            </View>

            <View style={{ gap: 6 }}>
              <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 13, color: COLORS.text }}>Nome *</Text>
              <TextInput value={nome} onChangeText={(t) => { setNome(t); setFormError(""); }} placeholder="Ex: Frango Grelhado" placeholderTextColor={COLORS.textTertiary} style={inputStyle} />
            </View>

            <View style={{ gap: 6 }}>
              <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 13, color: COLORS.text }}>Descrição</Text>
              <TextInput value={descricao} onChangeText={setDescricao} placeholder="Descrição do prato" placeholderTextColor={COLORS.textTertiary} multiline numberOfLines={3} style={[inputStyle, { minHeight: 80, textAlignVertical: "top" }]} />
            </View>

            <View style={{ gap: 6 }}>
              <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 13, color: COLORS.text }}>Preço (R$) *</Text>
              <TextInput value={preco} onChangeText={(t) => { setPreco(t); setFormError(""); }} placeholder="0,00" placeholderTextColor={COLORS.textTertiary} keyboardType="decimal-pad" style={inputStyle} />
            </View>

            <View style={{ gap: 6 }}>
              <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 13, color: COLORS.text }}>Categoria</Text>
              {loadingCats ? (
                <ActivityIndicator color={COLORS.primary} size="small" />
              ) : (
                <View>
                  <TouchableOpacity onPress={() => { console.log("[GestaoPratos] categoria picker toggled"); setPickerOpen((v) => !v); }} activeOpacity={0.7} style={[inputStyle, { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }]}>
                    <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 15, color: selectedCategoria ? COLORS.text : COLORS.textTertiary, flex: 1 }}>
                      {selectedCategoria ? selectedCategoria.nome : "Selecionar categoria"}
                    </Text>
                    <ChevronDown size={16} color={COLORS.textSecondary} />
                  </TouchableOpacity>
                  {pickerOpen && (
                    <View style={{ backgroundColor: COLORS.surface, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, marginTop: 4, overflow: "hidden", elevation: 4 }}>
                      {categorias.length === 0 ? (
                        <View style={{ padding: 16 }}>
                          <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 14, color: COLORS.textSecondary }}>Nenhuma categoria cadastrada</Text>
                        </View>
                      ) : (
                        categorias.map((cat) => (
                          <TouchableOpacity key={cat.id} onPress={() => { console.log("[GestaoPratos] categoria selecionada", cat.nome); setCategoriaId(cat.id); setPickerOpen(false); }} activeOpacity={0.7}
                            style={{ paddingHorizontal: 14, paddingVertical: 12, backgroundColor: cat.id === categoriaId ? COLORS.primaryMuted : "transparent", borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
                            <Text style={{ fontFamily: cat.id === categoriaId ? "Outfit_600SemiBold" : "Outfit_400Regular", fontSize: 14, color: cat.id === categoriaId ? COLORS.primary : COLORS.text }}>
                              {cat.nome}
                            </Text>
                          </TouchableOpacity>
                        ))
                      )}
                    </View>
                  )}
                </View>
              )}
            </View>

            <View style={{ gap: 6 }}>
              <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 13, color: COLORS.text }}>Imagem</Text>
              <TouchableOpacity onPress={pickImage} activeOpacity={0.8} style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: COLORS.surfaceSecondary, borderRadius: 12, padding: 10, borderWidth: 1, borderColor: COLORS.border }}>
                <View style={{ width: 56, height: 56, borderRadius: 10, overflow: "hidden", backgroundColor: COLORS.background }}>
                  <Image source={{ uri: imagemUrl || DEFAULT_IMAGE }} style={{ width: 56, height: 56 }} contentFit="cover" />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 13, color: COLORS.text }}>{uploading ? "Enviando imagem..." : imagemUrl ? "Imagem selecionada" : "Selecionar imagem"}</Text>
                  <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 11, color: COLORS.textSecondary }}>{imagemUrl ? "Toque para trocar" : "Da galeria"}</Text>
                </View>
                {uploading ? <ActivityIndicator color={COLORS.primary} size="small" /> : (
                  <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: COLORS.primaryMuted, alignItems: "center", justifyContent: "center" }}>
                    <Camera size={15} color={COLORS.primary} />
                  </View>
                )}
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: COLORS.surfaceSecondary, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: COLORS.border }}>
              <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 14, color: COLORS.text }}>Disponível</Text>
              <Switch value={disponivel} onValueChange={(v) => { console.log("[GestaoPratos] disponivel toggled", v); setDisponivel(v); }} trackColor={{ false: COLORS.border, true: COLORS.primary + "80" }} thumbColor={disponivel ? COLORS.primary : COLORS.textTertiary} />
            </View>

            {formError ? <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 13, color: COLORS.danger }}>{formError}</Text> : null}

            <AnimatedPressable onPress={handleCreate} disabled={submitting || uploading} style={{ backgroundColor: COLORS.primary, borderRadius: 14, height: 50, alignItems: "center", justifyContent: "center", opacity: submitting || uploading ? 0.7 : 1 }}>
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 15, color: "#fff" }}>Adicionar Prato</Text>}
            </AnimatedPressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}
