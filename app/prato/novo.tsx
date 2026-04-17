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
        result = await ImagePicker.launchCameraAsync({ mediaTypes: "images", quality: 0.8 });
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert("Permissão necessária", "Permita o acesso à galeria nas configurações.");
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: "images", quality: 0.8 });
      }
      if (!result.canceled && result.assets[0]) {
        console.log("[NovoPrato] Image selected:", result.assets[0].uri);
        setLocalImageUri(result.assets[0].uri);
      }
    } catch (e) {
      console.error("[NovoPrato] Image picker error:", e);
    }
  };

  const uploadImage = async (pratoId: string, uri: string) => {
    console.log("[NovoPrato] Uploading image for prato:", pratoId);
    const token = await getBearerToken();
    const formData = new FormData();
    const filename = uri.split("/").pop() ?? "image.jpg";
    const ext = filename.split(".").pop()?.toLowerCase() ?? "jpg";
    const mimeType = ext === "png" ? "image/png" : "image/jpeg";
    formData.append("imagem", { uri, name: filename, type: mimeType } as any);
    const res = await fetch(`${BACKEND_URL}/api/pratos/${pratoId}/imagem`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[NovoPrato] Image upload failed:", res.status, text.slice(0, 200));
    } else {
      console.log("[NovoPrato] Image uploaded successfully");
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
    console.log("[NovoPrato] Save pressed, nome:", nome);
    setSubmitting(true);
    setError("");
    try {
      const res = await apiPost<any>("/api/pratos", {
        nome: nome.trim(),
        descricao: descricao.trim() || undefined,
        preco: Number(preco),
        categoria_id: categoriaId || undefined,
        disponivel,
      });
      const pratoId = res?.prato?.id || res?.id;
      console.log("[NovoPrato] Prato created:", pratoId);
      if (pratoId && localImageUri) {
        await uploadImage(pratoId, localImageUri);
      }
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

  const imageSource = resolveImageSource(localImageUri ?? undefined);

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

          {/* Image section */}
          <FormField label="Foto do prato">
            <View style={{ gap: 10 }}>
              {localImageUri ? (
                <View style={{ height: 160, borderRadius: 12, overflow: "hidden", backgroundColor: COLORS.surfaceSecondary }}>
                  <Image source={imageSource} style={{ width: "100%", height: "100%" }} contentFit="cover" />
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
