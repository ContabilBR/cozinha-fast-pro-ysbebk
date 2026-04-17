import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  Switch,
  ScrollView,
  Animated,
  Platform,
} from "react-native";
import { Image } from "expo-image";
import { Stack } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { CardSkeleton } from "@/components/SkeletonLoader";
import { apiGet, apiPost, apiPut, apiDelete, BACKEND_URL, getBearerToken } from "@/utils/api";
import { formatCurrency } from "@/utils/helpers";
import { Plus, Pencil, Trash2, X, UtensilsCrossed, Camera, Image as ImageIcon, ChevronDown } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import type { ImageSourcePropType } from "react-native";

function resolveImageSource(source: string | number | ImageSourcePropType | undefined): ImageSourcePropType {
  if (!source) return { uri: "" };
  if (typeof source === "string") return { uri: source };
  return source as ImageSourcePropType;
}

interface ApiPrato {
  id: string;
  nome: string;
  descricao?: string;
  preco: number;
  imagem_url?: string;
  disponivel?: boolean;
  categoria_id?: string;
  categoria?: { id: string; nome: string };
}

interface ApiCategoria {
  id: string;
  nome: string;
}

function PratoCard({ prato, index, onEdit, onDelete }: {
  prato: ApiPrato;
  index: number;
  onEdit: (p: ApiPrato) => void;
  onDelete: (id: string) => void;
}) {
  const COLORS = useColors();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 350, delay: index * 50, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 350, delay: index * 50, useNativeDriver: true }),
    ]).start();
  }, [index, opacity, translateY]);

  const price = formatCurrency(prato.preco);
  const imageSource = resolveImageSource(prato.imagem_url);
  const disponivel = prato.disponivel !== false;

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      <View style={{
        backgroundColor: COLORS.surface,
        borderRadius: 16,
        marginHorizontal: 16,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: COLORS.border,
        flexDirection: "row",
        overflow: "hidden",
      }}>
        <View style={{ width: 80, height: 80, backgroundColor: COLORS.surfaceSecondary }}>
          {prato.imagem_url ? (
            <Image source={imageSource} style={{ width: "100%", height: "100%" }} contentFit="cover" />
          ) : (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              <UtensilsCrossed size={22} color={COLORS.textTertiary} />
            </View>
          )}
        </View>
        <View style={{ flex: 1, padding: 12, gap: 3 }}>
          <Text numberOfLines={1} style={{ fontFamily: "Outfit_600SemiBold", fontSize: 15, color: COLORS.text }}>
            {prato.nome}
          </Text>
          <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 14, color: COLORS.primary }}>
            {price}
          </Text>
          {prato.categoria && (
            <Text numberOfLines={1} style={{ fontFamily: "Outfit_400Regular", fontSize: 12, color: COLORS.textSecondary }}>
              {prato.categoria.nome}
            </Text>
          )}
          {!disponivel && (
            <View style={{ backgroundColor: COLORS.danger + "20", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, alignSelf: "flex-start" }}>
              <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 10, color: COLORS.danger }}>Indisponível</Text>
            </View>
          )}
        </View>
        <View style={{ flexDirection: "column", justifyContent: "center", gap: 8, paddingRight: 12 }}>
          <AnimatedPressable
            onPress={() => { console.log("[GestaoPratos] Edit pressed:", prato.id); onEdit(prato); }}
            style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: COLORS.surfaceSecondary, alignItems: "center", justifyContent: "center" }}
          >
            <Pencil size={16} color={COLORS.textSecondary} />
          </AnimatedPressable>
          <AnimatedPressable
            onPress={() => { console.log("[GestaoPratos] Delete pressed:", prato.id); onDelete(prato.id); }}
            style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: COLORS.danger + "15", alignItems: "center", justifyContent: "center" }}
          >
            <Trash2 size={16} color={COLORS.danger} />
          </AnimatedPressable>
        </View>
      </View>
    </Animated.View>
  );
}

export default function GestaoPratos() {
  const COLORS = useColors();

  const [pratos, setPratos] = useState<ApiPrato[]>([]);
  const [categorias, setCategorias] = useState<ApiCategoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingPrato, setEditingPrato] = useState<ApiPrato | null>(null);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [preco, setPreco] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [disponivel, setDisponivel] = useState(true);
  const [localImageUri, setLocalImageUri] = useState<string | null>(null);
  const [imagemUrl, setImagemUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState("");
  const [showCatPicker, setShowCatPicker] = useState(false);

  const fetchData = useCallback(async () => {
    console.log("[GestaoPratos] Fetching pratos and categorias");
    try {
      const [pratosRes, catRes] = await Promise.all([
        apiGet<any>("/api/pratos"),
        apiGet<any>("/api/categorias"),
      ]);
      const pratoList: ApiPrato[] = Array.isArray(pratosRes) ? pratosRes : (pratosRes.pratos || []);
      const catList: ApiCategoria[] = Array.isArray(catRes) ? catRes : (catRes.categorias || []);
      console.log("[GestaoPratos] Loaded", pratoList.length, "pratos,", catList.length, "categorias");
      setPratos(pratoList);
      setCategorias(catList);
      setError("");
    } catch (e: any) {
      console.error("[GestaoPratos] Error:", e);
      setError("Não foi possível carregar os pratos.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleRefresh = () => {
    console.log("[GestaoPratos] Manual refresh");
    setRefreshing(true);
    fetchData();
  };

  const openCreate = () => {
    console.log("[GestaoPratos] Open create modal");
    setEditingPrato(null);
    setNome(""); setDescricao(""); setPreco(""); setCategoriaId("");
    setDisponivel(true); setLocalImageUri(null); setImagemUrl("");
    setModalError(""); setShowCatPicker(false);
    setShowModal(true);
  };

  const openEdit = (p: ApiPrato) => {
    console.log("[GestaoPratos] Open edit modal:", p.id);
    setEditingPrato(p);
    setNome(p.nome ?? "");
    setDescricao(p.descricao ?? "");
    setPreco(String(p.preco ?? ""));
    setCategoriaId(p.categoria_id ?? "");
    setDisponivel(p.disponivel !== false);
    setLocalImageUri(null);
    setImagemUrl(p.imagem_url ?? "");
    setModalError(""); setShowCatPicker(false);
    setShowModal(true);
  };

  const pickImage = async (source: "camera" | "gallery") => {
    console.log("[GestaoPratos] pickImage pressed, source:", source);
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
        console.log("[GestaoPratos] Image selected:", asset.uri);
        setLocalImageUri(asset.uri);
        if (asset.base64) {
          await uploadImageBase64(asset.base64, asset.uri);
        }
      }
    } catch (e) {
      console.error("[GestaoPratos] Image picker error:", e);
    }
  };

  const uploadImageBase64 = async (base64: string, uri: string) => {
    console.log("[GestaoPratos] POST /api/upload/imagem");
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
        const url: string = data?.url || data?.imagem_url || "";
        console.log("[GestaoPratos] Upload concluído:", url);
        if (url) setImagemUrl(url);
      } else {
        const text = await res.text().catch(() => "");
        console.warn("[GestaoPratos] Upload failed:", res.status, text.slice(0, 100));
        // Keep local URI as fallback — will send as imagem_url
      }
    } catch (e) {
      console.error("[GestaoPratos] Upload error:", e);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!nome.trim()) { setModalError("Nome é obrigatório."); return; }
    const precoNum = parseFloat(preco.replace(",", "."));
    if (isNaN(precoNum) || precoNum < 0) { setModalError("Preço inválido."); return; }
    console.log("[GestaoPratos] Save pressed, editingPrato:", editingPrato?.id ?? "new");
    setSaving(true);
    setModalError("");
    try {
      const payload: any = {
        nome: nome.trim(),
        descricao: descricao.trim() || undefined,
        preco: precoNum,
        disponivel,
      };
      if (categoriaId) payload.categoria_id = categoriaId;
      const finalUrl = imagemUrl || (localImageUri ?? undefined);
      if (finalUrl) payload.imagem_url = finalUrl;

      if (editingPrato) {
        console.log("[GestaoPratos] PUT /api/pratos/" + editingPrato.id);
        await apiPut(`/api/pratos/${editingPrato.id}`, payload);
        console.log("[GestaoPratos] Prato atualizado:", editingPrato.id);
      } else {
        console.log("[GestaoPratos] POST /api/pratos");
        await apiPost("/api/pratos", payload);
        console.log("[GestaoPratos] Prato criado com sucesso");
      }
      setShowModal(false);
      await fetchData();
    } catch (e: any) {
      console.error("[GestaoPratos] Save error:", e);
      setModalError(e instanceof Error ? e.message : "Não foi possível salvar o prato.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: string) => {
    console.log("[GestaoPratos] Delete confirm for:", id);
    Alert.alert(
      "Excluir prato?",
      "Esta ação não pode ser desfeita.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: async () => {
            console.log("[GestaoPratos] DELETE /api/pratos/" + id);
            try {
              await apiDelete(`/api/pratos/${id}`);
              console.log("[GestaoPratos] Prato excluído:", id);
              setPratos((prev) => prev.filter((p) => p.id !== id));
            } catch (e: any) {
              console.error("[GestaoPratos] Delete error:", e);
              Alert.alert("Erro", "Não foi possível excluir o prato.");
            }
          },
        },
      ]
    );
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

  const selectedCat = categorias.find((c) => c.id === categoriaId);
  const displayImageUri = localImageUri ?? (imagemUrl || null);
  const imageSource = resolveImageSource(displayImageUri ?? undefined);

  return (
    <>
      <Stack.Screen
        options={{
          title: "Pratos",
          headerTintColor: COLORS.primary,
          headerBackButtonDisplayMode: "minimal",
          headerStyle: { backgroundColor: COLORS.surface },
          headerTitleStyle: { fontFamily: "Outfit_700Bold", color: COLORS.text },
        }}
      />
      <View style={{ flex: 1, backgroundColor: COLORS.background }}>
        {loading ? (
          <View style={{ paddingTop: 16 }}>
            {[0, 1, 2].map((i) => <CardSkeleton key={i} />)}
          </View>
        ) : error ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 }}>
            <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 17, color: COLORS.text }}>Erro ao carregar pratos</Text>
            <AnimatedPressable onPress={fetchData} style={{ backgroundColor: COLORS.primary, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 }}>
              <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 15, color: "#fff" }}>Tentar novamente</Text>
            </AnimatedPressable>
          </View>
        ) : (
          <FlatList
            data={pratos}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingTop: 16, paddingBottom: 120 }}
            contentInsetAdjustmentBehavior="automatic"
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.primary} />}
            renderItem={({ item, index }) => (
              <PratoCard prato={item} index={index} onEdit={openEdit} onDelete={handleDelete} />
            )}
            ListEmptyComponent={
              <View style={{ alignItems: "center", justifyContent: "center", padding: 48, gap: 12 }}>
                <View style={{ width: 72, height: 72, borderRadius: 20, backgroundColor: COLORS.primaryMuted, alignItems: "center", justifyContent: "center" }}>
                  <UtensilsCrossed size={32} color={COLORS.primary} />
                </View>
                <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 17, color: COLORS.text }}>Nenhum prato cadastrado</Text>
                <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 14, color: COLORS.textSecondary, textAlign: "center" }}>
                  Adicione pratos para montar o cardápio
                </Text>
              </View>
            }
          />
        )}

        <AnimatedPressable
          onPress={openCreate}
          style={{
            position: "absolute",
            bottom: 20,
            right: 20,
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: COLORS.primary,
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 4px 16px rgba(232, 82, 26, 0.4)",
          }}
        >
          <Plus size={24} color="#fff" />
        </AnimatedPressable>

        <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
            <View style={{ backgroundColor: COLORS.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "92%" }}>
              {/* Header */}
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
                <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 20, color: COLORS.text }}>
                  {editingPrato ? "Editar Prato" : "Novo Prato"}
                </Text>
                <AnimatedPressable
                  onPress={() => { console.log("[GestaoPratos] Modal closed"); setShowModal(false); }}
                  style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.surfaceSecondary, alignItems: "center", justifyContent: "center" }}
                >
                  <X size={16} color={COLORS.textSecondary} />
                </AnimatedPressable>
              </View>

              <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }} keyboardShouldPersistTaps="handled">
                {/* Image picker */}
                <View style={{ gap: 8 }}>
                  <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 14, color: COLORS.text }}>Foto do prato</Text>
                  {displayImageUri ? (
                    <View style={{ height: 140, borderRadius: 12, overflow: "hidden", backgroundColor: COLORS.surfaceSecondary }}>
                      <Image source={imageSource} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                      {uploading && (
                        <View style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center" }}>
                          <ActivityIndicator color="#fff" />
                          <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 12, color: "#fff", marginTop: 6 }}>Enviando...</Text>
                        </View>
                      )}
                    </View>
                  ) : (
                    <View style={{ height: 100, borderRadius: 12, backgroundColor: COLORS.surfaceSecondary, borderWidth: 1, borderColor: COLORS.border, alignItems: "center", justifyContent: "center", gap: 6 }}>
                      <UtensilsCrossed size={24} color={COLORS.textTertiary} />
                      <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 12, color: COLORS.textTertiary }}>Nenhuma foto</Text>
                    </View>
                  )}
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    <AnimatedPressable
                      onPress={() => pickImage("camera")}
                      style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: COLORS.surfaceSecondary, borderRadius: 12, paddingVertical: 10, borderWidth: 1, borderColor: COLORS.border }}
                    >
                      <Camera size={16} color={COLORS.primary} />
                      <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 13, color: COLORS.primary }}>Câmera</Text>
                    </AnimatedPressable>
                    <AnimatedPressable
                      onPress={() => pickImage("gallery")}
                      style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: COLORS.surfaceSecondary, borderRadius: 12, paddingVertical: 10, borderWidth: 1, borderColor: COLORS.border }}
                    >
                      <ImageIcon size={16} color={COLORS.primary} />
                      <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 13, color: COLORS.primary }}>Galeria</Text>
                    </AnimatedPressable>
                  </View>
                </View>

                {/* Nome */}
                <View style={{ gap: 6 }}>
                  <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 14, color: COLORS.text }}>Nome *</Text>
                  <TextInput value={nome} onChangeText={(t) => { setNome(t); setModalError(""); }} placeholder="Ex: Frango Grelhado" placeholderTextColor={COLORS.textTertiary} style={inputStyle} />
                </View>

                {/* Descrição */}
                <View style={{ gap: 6 }}>
                  <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 14, color: COLORS.text }}>Descrição</Text>
                  <TextInput value={descricao} onChangeText={setDescricao} placeholder="Descrição do prato" placeholderTextColor={COLORS.textTertiary} multiline numberOfLines={3} style={[inputStyle, { minHeight: 80, textAlignVertical: "top" }]} />
                </View>

                {/* Preço */}
                <View style={{ gap: 6 }}>
                  <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 14, color: COLORS.text }}>Preço (R$) *</Text>
                  <TextInput value={preco} onChangeText={(t) => { setPreco(t); setModalError(""); }} placeholder="0,00" placeholderTextColor={COLORS.textTertiary} keyboardType="decimal-pad" style={inputStyle} />
                </View>

                {/* Categoria */}
                <View style={{ gap: 6 }}>
                  <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 14, color: COLORS.text }}>Categoria</Text>
                  <AnimatedPressable
                    onPress={() => { console.log("[GestaoPratos] Categoria picker toggled"); setShowCatPicker((v) => !v); }}
                    style={[inputStyle, { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }]}
                  >
                    <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 15, color: selectedCat ? COLORS.text : COLORS.textTertiary }}>
                      {selectedCat?.nome ?? "Selecionar categoria"}
                    </Text>
                    <ChevronDown size={16} color={COLORS.textSecondary} />
                  </AnimatedPressable>
                  {showCatPicker && (
                    <View style={{ backgroundColor: COLORS.surface, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, overflow: "hidden" }}>
                      {categorias.length === 0 ? (
                        <View style={{ padding: 14 }}>
                          <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 14, color: COLORS.textSecondary }}>Nenhuma categoria</Text>
                        </View>
                      ) : (
                        categorias.map((cat) => (
                          <AnimatedPressable
                            key={cat.id}
                            onPress={() => { console.log("[GestaoPratos] Categoria selecionada:", cat.nome); setCategoriaId(cat.id); setShowCatPicker(false); }}
                            style={{ padding: 14, borderBottomWidth: 1, borderBottomColor: COLORS.divider, backgroundColor: categoriaId === cat.id ? COLORS.primaryMuted : "transparent" }}
                          >
                            <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 14, color: COLORS.text }}>{cat.nome}</Text>
                          </AnimatedPressable>
                        ))
                      )}
                    </View>
                  )}
                </View>

                {/* Disponível */}
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: COLORS.surfaceSecondary, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: COLORS.border }}>
                  <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 14, color: COLORS.text }}>Disponível</Text>
                  <Switch
                    value={disponivel}
                    onValueChange={(v) => { console.log("[GestaoPratos] Disponivel toggled:", v); setDisponivel(v); }}
                    trackColor={{ false: COLORS.border, true: COLORS.primary + "80" }}
                    thumbColor={disponivel ? COLORS.primary : COLORS.textTertiary}
                  />
                </View>

                {modalError ? <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 13, color: COLORS.danger }}>{modalError}</Text> : null}

                <AnimatedPressable
                  onPress={handleSave}
                  disabled={saving || uploading}
                  style={{ backgroundColor: COLORS.primary, borderRadius: 14, height: 52, alignItems: "center", justifyContent: "center", opacity: saving || uploading ? 0.7 : 1, marginBottom: 20 }}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 16, color: "#fff" }}>
                      {uploading ? "Aguardando upload..." : editingPrato ? "Salvar alterações" : "Adicionar prato"}
                    </Text>
                  )}
                </AnimatedPressable>
              </ScrollView>
            </View>
          </View>
        </Modal>
      </View>
    </>
  );
}
