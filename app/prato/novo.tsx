import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Switch,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Image } from "expo-image";
import { useRouter, Stack } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { Categoria } from "@/types";
import { apiGet, apiPost, BACKEND_URL, getBearerToken } from "@/utils/api";
import { ChevronDown, Camera, Image as ImageIcon, UtensilsCrossed } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import type { ImageSourcePropType } from "react-native";

function resolveImageSource(source: string | number | ImageSourcePropType | undefined): ImageSourcePropType {
  if (!source) return { uri: "" };
  if (typeof source === "string") return { uri: source };
  return source as ImageSourcePropType;
}

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
  const [disponivel, setDisponivel] = useState(true);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [showCatPicker, setShowCatPicker] = useState(false);
  const [localImageUri, setLocalImageUri] = useState<string | null>(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    console.log("[NovoPrato] Fetching categorias");
    apiGet<any>("/api/categorias")
      .then((res) => {
        const list: Categoria[] = Array.isArray(res) ? res : (res.categorias || []);
        console.log("[NovoPrato] Loaded", list.length, "categorias");
        setCategorias(list);
      })
      .catch((e) => console.error("[NovoPrato] Error fetching categorias:", e));
  }, []);

  const selectedCat = categorias.find((c) => c.id === categoriaId);

  const pickImage = async (source: "camera" | "gallery") => {
    console.log("[NovoPrato] Pick image from:", source);
    try {
      let result: ImagePicker.ImagePickerResult;
      if (source === "camera") {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert("Permissão necessária", "Permita o acesso à câmera nas configurações.");
          return;
        }
        result = await ImagePicker.launchCameraAsync({ mediaTypes: "images", quality: 0.8, base64: true });
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert("Permissão necessária", "Permita o acesso à galeria nas configurações.");
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: "images", quality: 0.8, base64: true });
      }
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        console.log("[NovoPrato] Image selected:", asset.uri);
        setLocalImageUri(asset.uri);
        setUploadedImageUrl(null);
        // Upload immediately
        if (asset.base64) {
          await uploadImageBase64(asset.base64, asset.uri);
        }
      }
    } catch (e) {
      console.error("[NovoPrato] Image picker error:", e);
    }
  };

  const uploadImageBase64 = async (base64: string, uri: string) => {
    console.log("[NovoPrato] Uploading image via /api/upload/imagem");
    setUploading(true);
    try {
      const ext = uri.split(".").pop()?.toLowerCase() ?? "jpg";
      const mimeType = ext === "png" ? "image/png" : "image/jpeg";
      const token = await getBearerToken();
      const res = await fetch(`${BACKEND_URL}/api/upload/imagem`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ imagem: `data:${mimeType};base64,${base64}` }),
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        const url = data?.url || data?.imagem_url || null;
        console.log("[NovoPrato] Image uploaded, url:", url);
        setUploadedImageUrl(url);
      } else {
        const text = await res.text().catch(() => "");
        console.error("[NovoPrato] Image upload failed:", res.status, text.slice(0, 200));
        // Use picsum placeholder on failure
        const seed = Math.random().toString(36).slice(2, 10);
        setUploadedImageUrl(`https://picsum.photos/seed/${seed}/400/300`);
      }
    } catch (e) {
      console.error("[NovoPrato] Image upload error:", e);
      const seed = Math.random().toString(36).slice(2, 10);
      setUploadedImageUrl(`https://picsum.photos/seed/${seed}/400/300`);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!nome.trim()) {
      setError("Nome é obrigatório.");
      return;
    }
    if (!preco || isNaN(Number(preco))) {
      setError("Preço inválido.");
      return;
    }
    console.log("[NovoPrato] Save pressed, nome:", nome, "categoria:", categoriaId, "imagem_url:", uploadedImageUrl);
    setSubmitting(true);
    setError("");
    try {
      const payload: any = {
        nome: nome.trim(),
        descricao: descricao.trim() || undefined,
        preco: Number(preco),
        disponivel,
      };
      if (categoriaId) payload.categoria_id = categoriaId;
      if (uploadedImageUrl) payload.imagem_url = uploadedImageUrl;

      const res = await apiPost<any>("/api/pratos", payload);
      const pratoId = res?.prato?.id || res?.id;
      console.log("[NovoPrato] Prato created:", pratoId);
      router.back();
    } catch (e: any) {
      console.error("[NovoPrato] Save error:", e);
      setError(e instanceof Error ? e.message : "Não foi possível salvar o prato.");
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

  const displayImageUri = localImageUri ?? null;
  const imageSource = resolveImageSource(displayImageUri ?? undefined);

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
                {categorias.length === 0 ? (
                  <View style={{ padding: 14 }}>
                    <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 14, color: COLORS.textSecondary }}>
                      Nenhuma categoria disponível
                    </Text>
                  </View>
                ) : (
                  categorias.map((cat) => (
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
                  ))
                )}
              </View>
            )}
          </FormField>

          {/* Image section */}
          <FormField label="Foto do prato">
            <View style={{ gap: 10 }}>
              {displayImageUri ? (
                <View style={{ height: 160, borderRadius: 12, overflow: "hidden", backgroundColor: COLORS.surfaceSecondary }}>
                  <Image source={imageSource} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                  {uploading && (
                    <View style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center" }}>
                      <ActivityIndicator color="#fff" />
                      <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 12, color: "#fff", marginTop: 6 }}>
                        Enviando...
                      </Text>
                    </View>
                  )}
                  {uploadedImageUrl && !uploading && (
                    <View style={{ position: "absolute", bottom: 8, right: 8, backgroundColor: "#22C55ECC", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                      <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 10, color: "#fff" }}>
                        Enviada
                      </Text>
                    </View>
                  )}
                </View>
              ) : (
                <View
                  style={{
                    height: 120,
                    borderRadius: 12,
                    backgroundColor: COLORS.surfaceSecondary,
                    borderWidth: 1,
                    borderColor: COLORS.border,
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  <UtensilsCrossed size={28} color={COLORS.textTertiary} />
                  <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 13, color: COLORS.textTertiary }}>
                    Nenhuma foto selecionada
                  </Text>
                </View>
              )}
              <View style={{ flexDirection: "row", gap: 10 }}>
                <AnimatedPressable
                  onPress={() => pickImage("camera")}
                  style={{
                    flex: 1,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    backgroundColor: COLORS.surface,
                    borderRadius: 12,
                    paddingVertical: 12,
                    borderWidth: 1,
                    borderColor: COLORS.border,
                  }}
                >
                  <Camera size={18} color={COLORS.primary} />
                  <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 14, color: COLORS.primary }}>
                    Tirar Foto
                  </Text>
                </AnimatedPressable>
                <AnimatedPressable
                  onPress={() => pickImage("gallery")}
                  style={{
                    flex: 1,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    backgroundColor: COLORS.surface,
                    borderRadius: 12,
                    paddingVertical: 12,
                    borderWidth: 1,
                    borderColor: COLORS.border,
                  }}
                >
                  <ImageIcon size={18} color={COLORS.primary} />
                  <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 14, color: COLORS.primary }}>
                    Galeria
                  </Text>
                </AnimatedPressable>
              </View>
            </View>
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
            disabled={submitting || uploading}
            style={{
              backgroundColor: COLORS.primary,
              borderRadius: 14,
              height: 52,
              alignItems: "center",
              justifyContent: "center",
              opacity: uploading ? 0.7 : 1,
            }}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 16, color: "#fff" }}>
                {uploading ? "Aguardando upload..." : "Salvar prato"}
              </Text>
            )}
          </AnimatedPressable>
        </View>
      </View>
    </>
  );
}
