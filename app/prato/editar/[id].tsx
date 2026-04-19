import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Switch,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { Prato, Categoria } from "@/types";
import { apiGet, apiPut, BACKEND_URL, getBearerToken } from "@/utils/api";
import { ChevronDown, Camera, Image as ImageIcon, UtensilsCrossed } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import type { ImageSourcePropType } from "react-native";

function resolveImageSource(source: string | number | ImageSourcePropType | undefined): ImageSourcePropType {
  if (!source) return { uri: "" };
  if (typeof source === "string") {
    if (!source.startsWith("http") && !source.startsWith("file") && !source.startsWith("data:")) {
      return { uri: `data:image/jpeg;base64,${source}` };
    }
    return { uri: source };
  }
  return source as ImageSourcePropType;
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  const COLORS = useColors();
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 14, color: COLORS.text }}>{label}</Text>
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
  const [disponivel, setDisponivel] = useState(true);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [showCatPicker, setShowCatPicker] = useState(false);
  const [localImageUri, setLocalImageUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    console.log("[EditarPrato] GET /api/pratos/" + id + " e /api/categorias");
    Promise.all([
      apiGet<any>(`/api/pratos/${id}`),
      apiGet<any>("/api/categorias"),
    ]).then(([pratoRes, catRes]) => {
      const p: Prato = pratoRes.prato || pratoRes;
      const cats: Categoria[] = Array.isArray(catRes) ? catRes : (catRes.categorias || []);
      console.log("[EditarPrato] Carregado prato:", p.nome, "categorias:", cats.length);
      setNome(p.nome ?? "");
      setDescricao(p.descricao ?? "");
      const precoRaw = p.preco != null ? Number(p.preco).toFixed(2).replace(".", ",") : "";
      setPreco(precoRaw);
      setCategoriaId(p.categoria_id ?? "");
      setImagemUrl(p.imagem_url ?? "");
      setDisponivel(p.disponivel ?? true);
      setCategorias(cats);
    }).catch((e) => {
      console.error("[EditarPrato] Erro:", e);
      setError("Não foi possível carregar o prato.");
    }).finally(() => setLoading(false));
  }, [id]);

  const selectedCat = categorias.find((c) => c.id === categoriaId);

  const pickImage = async (source: "camera" | "gallery") => {
    console.log("[EditarPrato] Selecionar imagem, fonte:", source);
    try {
      let result: ImagePicker.ImagePickerResult;
      if (source === "camera") {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) { Alert.alert("Permissão necessária", "Permita o acesso à câmera."); return; }
        result = await ImagePicker.launchCameraAsync({ mediaTypes: "images", quality: 0.8, base64: true });
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) { Alert.alert("Permissão necessária", "Permita o acesso à galeria."); return; }
        result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: "images", quality: 0.8, base64: true });
      }
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        console.log("[EditarPrato] Imagem selecionada:", asset.uri);
        setLocalImageUri(asset.uri);
      }
    } catch (e) {
      console.error("[EditarPrato] Erro no seletor de imagem:", e);
    }
  };

  const uploadFoto = async (): Promise<void> => {
    if (!localImageUri || !id) return;
    console.log("[EditarPrato] POST /api/pratos/" + id + "/foto (base64)");
    setUploading(true);
    try {
      const token = await getBearerToken();
      const ext = localImageUri.split(".").pop()?.toLowerCase() ?? "jpg";
      const mimeType = ext === "png" ? "image/png" : "image/jpeg";
      const base64 = await FileSystem.readAsStringAsync(localImageUri, { encoding: "base64" as any });
      const imagem_base64 = `data:${mimeType};base64,${base64}`;
      const res = await fetch(`${BACKEND_URL}/api/pratos/${id}/foto`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ imagem_base64 }),
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        console.log("[EditarPrato] Upload de foto concluído, url:", data?.url);
      } else {
        const text = await res.text().catch(() => "");
        console.warn("[EditarPrato] Upload de foto falhou:", res.status, text.slice(0, 100));
      }
    } catch (e) {
      console.error("[EditarPrato] Erro no upload de foto:", e);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!nome.trim()) { setError("Nome é obrigatório."); return; }
    const precoNum = parseFloat(preco.replace(",", "."));
    if (isNaN(precoNum) || precoNum < 0) { setError("Preço inválido."); return; }
    console.log("[EditarPrato] Salvar alterações pressionado:", id, "nome:", nome);
    setSubmitting(true);
    setError("");
    try {
      const payload: any = {
        nome: nome.trim(),
        descricao: descricao.trim() || undefined,
        preco: precoNum,
        disponivel,
      };
      if (categoriaId) payload.categoria_id = categoriaId;
      if (imagemUrl.trim() && !localImageUri) payload.imagem_url = imagemUrl.trim();
      console.log("[EditarPrato] PUT /api/pratos/" + id);
      await apiPut(`/api/pratos/${id}`, payload);
      console.log("[EditarPrato] Prato atualizado com sucesso");
      if (localImageUri) {
        await uploadFoto();
      }
      router.back();
    } catch (e: any) {
      console.error("[EditarPrato] Erro ao salvar:", e);
      setError(e instanceof Error ? e.message : "Não foi possível salvar as alterações.");
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

  // imageSource kept for backward compat but individual fields now use resolveImageSource directly

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }} edges={["top", "left", "right"]}>
        <View style={{ flexDirection: "row", alignItems: "center", height: 56, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: COLORS.surface }}>
          <AnimatedPressable onPress={() => { console.log("[EditarPrato] Botão voltar pressionado (loading)"); router.back(); }} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 8, paddingRight: 8 }}>
            <Ionicons name="chevron-back" size={26} color="#007AFF" />
            <Text style={{ color: "#007AFF", fontSize: 17, fontWeight: "500" }}>Voltar</Text>
          </AnimatedPressable>
          <Text style={{ position: "absolute", left: 0, right: 0, textAlign: "center", fontSize: 17, fontWeight: "700", color: COLORS.text, height: 56, lineHeight: 56 }}>Editar Prato</Text>
        </View>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
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
            onPress={() => { console.log("[EditarPrato] Botão voltar pressionado"); router.back(); }}
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
            Editar Prato
          </Text>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 48, gap: 16 }} keyboardShouldPersistTaps="handled">
          <FormField label="Nome *">
            <TextInput value={nome} onChangeText={setNome} placeholder="Nome do prato" placeholderTextColor={COLORS.textTertiary} style={inputStyle} />
          </FormField>

          <FormField label="Descrição">
            <TextInput value={descricao} onChangeText={setDescricao} placeholder="Descrição" placeholderTextColor={COLORS.textTertiary} multiline numberOfLines={3} style={[inputStyle, { minHeight: 80, textAlignVertical: "top" }]} />
          </FormField>

          <FormField label="Preço (R$) *">
            <TextInput value={preco} onChangeText={setPreco} placeholder="0,00" placeholderTextColor={COLORS.textTertiary} keyboardType="decimal-pad" style={inputStyle} />
          </FormField>

          <FormField label="Categoria">
            <AnimatedPressable
              onPress={() => { console.log("[EditarPrato] Seletor de categoria alternado"); setShowCatPicker((v) => !v); }}
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
                    onPress={() => { console.log("[EditarPrato] Categoria selecionada:", cat.nome); setCategoriaId(cat.id); setShowCatPicker(false); }}
                    style={{ padding: 14, borderBottomWidth: 1, borderBottomColor: COLORS.divider, backgroundColor: categoriaId === cat.id ? COLORS.primaryMuted : "transparent" }}
                  >
                    <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 14, color: COLORS.text }}>{cat.nome}</Text>
                  </AnimatedPressable>
                ))}
              </View>
            )}
          </FormField>

          <FormField label="URL da imagem">
            <TextInput
              value={imagemUrl}
              onChangeText={(t) => { console.log("[EditarPrato] imagem_url alterada"); setImagemUrl(t); setLocalImageUri(null); }}
              placeholder="https://exemplo.com/imagem.jpg"
              placeholderTextColor={COLORS.textTertiary}
              autoCapitalize="none"
              keyboardType="url"
              style={inputStyle}
            />
            {imagemUrl.trim() && !localImageUri ? (
              <View style={{ height: 160, borderRadius: 12, overflow: "hidden", backgroundColor: COLORS.surfaceSecondary, marginTop: 8 }}>
                <Image source={resolveImageSource(imagemUrl)} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                <AnimatedPressable
                  onPress={() => { console.log("[EditarPrato] Remover URL pressionado"); setImagemUrl(""); }}
                  style={{ position: "absolute", top: 8, right: 8, backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 14, width: 28, height: 28, alignItems: "center", justifyContent: "center" }}
                >
                  <Ionicons name="close" size={16} color="#fff" />
                </AnimatedPressable>
              </View>
            ) : null}
          </FormField>

          <FormField label="Foto do prato (câmera/galeria)">
            <View style={{ gap: 10 }}>
              {localImageUri ? (
                <View style={{ width: "100%", height: 200, borderRadius: 12, overflow: "hidden", backgroundColor: COLORS.surfaceSecondary }}>
                  <Image source={{ uri: localImageUri }} style={{ width: "100%", height: 200 }} contentFit="cover" />
                  <AnimatedPressable
                    onPress={() => { console.log("[EditarPrato] Remover foto pressionado"); setLocalImageUri(null); }}
                    style={{ position: "absolute", top: 8, right: 8, backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 14, width: 28, height: 28, alignItems: "center", justifyContent: "center" }}
                  >
                    <Ionicons name="close" size={16} color="#fff" />
                  </AnimatedPressable>
                  <View style={{ position: "absolute", bottom: 8, left: 8, backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                    <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 10, color: "#fff" }}>Nova foto selecionada</Text>
                  </View>
                </View>
              ) : (
                <View style={{ width: "100%", height: 120, borderRadius: 12, backgroundColor: COLORS.surfaceSecondary, borderWidth: 1, borderColor: COLORS.border, alignItems: "center", justifyContent: "center", gap: 6 }}>
                  <UtensilsCrossed size={28} color={COLORS.textTertiary} />
                  <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 12, color: COLORS.textTertiary }}>Nenhuma foto selecionada</Text>
                </View>
              )}
              <View style={{ flexDirection: "row", gap: 10 }}>
                <AnimatedPressable
                  onPress={() => { console.log("[EditarPrato] Câmera pressionada"); pickImage("camera"); }}
                  style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: COLORS.surface, borderRadius: 12, paddingVertical: 12, borderWidth: 1, borderColor: COLORS.border }}
                >
                  <Camera size={18} color={COLORS.primary} />
                  <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 14, color: COLORS.primary }}>Tirar Foto</Text>
                </AnimatedPressable>
                <AnimatedPressable
                  onPress={() => { console.log("[EditarPrato] Galeria pressionada"); pickImage("gallery"); }}
                  style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: COLORS.surface, borderRadius: 12, paddingVertical: 12, borderWidth: 1, borderColor: COLORS.border }}
                >
                  <ImageIcon size={18} color={COLORS.primary} />
                  <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 14, color: COLORS.primary }}>Galeria</Text>
                </AnimatedPressable>
              </View>
            </View>
          </FormField>

          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: COLORS.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: COLORS.border }}>
            <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 15, color: COLORS.text }}>Disponível</Text>
            <Switch
              value={disponivel}
              onValueChange={(val) => { console.log("[EditarPrato] Disponível alternado:", val); setDisponivel(val); }}
              trackColor={{ false: COLORS.border, true: COLORS.primary + "80" }}
              thumbColor={disponivel ? COLORS.primary : COLORS.textTertiary}
            />
          </View>

          {error ? (
            <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 13, color: COLORS.danger, textAlign: "center" }}>{error}</Text>
          ) : null}

          <AnimatedPressable
            onPress={() => { console.log("[EditarPrato] Salvar alterações pressionado"); handleSave(); }}
            disabled={submitting || uploading}
            style={{ backgroundColor: COLORS.primary, borderRadius: 14, height: 52, alignItems: "center", justifyContent: "center", opacity: uploading ? 0.7 : 1 }}
          >
            {submitting || uploading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 16, color: "#fff" }}>Salvar alterações</Text>
            )}
          </AnimatedPressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
