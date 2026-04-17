import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  Switch,
  TouchableOpacity,
} from "react-native";
import { Image } from "expo-image";
import { Stack, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { apiGet, apiPost, apiPut, apiDelete } from "@/utils/api";
import { Plus, Pencil, Trash2, UtensilsCrossed, Check, X, Camera, ChevronDown } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import type { ImageSourcePropType } from "react-native";

const BACKEND_URL = "https://j74mf38wgua3d4qd5mqbjjvza88n2qcp.app.specular.dev";
const DEFAULT_IMAGE = "https://picsum.photos/seed/novoprato/400/300";

function resolveImageSource(
  source: string | number | ImageSourcePropType | undefined
): ImageSourcePropType {
  if (!source) return { uri: DEFAULT_IMAGE };
  if (typeof source === "string") return { uri: source || DEFAULT_IMAGE };
  return source as ImageSourcePropType;
}

function getPicsumUrl(id: string): string {
  const seed = id ? id.slice(0, 8) : "prato";
  return `https://picsum.photos/seed/${seed}/400/300`;
}

interface ApiCategoria {
  id: string;
  nome: string;
}

interface ApiPrato {
  id: string;
  nome: string;
  descricao?: string;
  preco: number;
  imagem_url?: string;
  categoria_id?: string;
  categoria?: { id: string; nome: string };
  disponivel?: boolean;
}

// ─── Category Picker ────────────────────────────────────────────────────────

function CategoryPicker({
  categorias,
  selectedId,
  onSelect,
  inputStyle,
}: {
  categorias: ApiCategoria[];
  selectedId: string;
  onSelect: (id: string) => void;
  inputStyle: object;
}) {
  const COLORS = useColors();
  const [open, setOpen] = useState(false);
  const selected = categorias.find((c) => c.id === selectedId);
  const selectedNome = selected ? selected.nome : "Selecionar categoria";

  return (
    <View>
      <TouchableOpacity
        onPress={() => {
          console.log("[GestaoPratos] Category picker toggled");
          setOpen((v) => !v);
        }}
        activeOpacity={0.7}
        style={[
          inputStyle,
          {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          },
        ]}
      >
        <Text
          style={{
            fontFamily: "Outfit_400Regular",
            fontSize: 15,
            color: selected ? COLORS.text : COLORS.textTertiary,
            flex: 1,
          }}
        >
          {selectedNome}
        </Text>
        <ChevronDown size={16} color={COLORS.textSecondary} />
      </TouchableOpacity>
      {open && (
        <View
          style={{
            backgroundColor: COLORS.surface,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: COLORS.border,
            marginTop: 4,
            overflow: "hidden",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
            elevation: 4,
          }}
        >
          {categorias.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              onPress={() => {
                console.log("[GestaoPratos] Category selected:", cat.id, cat.nome);
                onSelect(cat.id);
                setOpen(false);
              }}
              activeOpacity={0.7}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 12,
                backgroundColor: cat.id === selectedId ? COLORS.primaryMuted : "transparent",
                borderBottomWidth: 1,
                borderBottomColor: COLORS.divider,
              }}
            >
              <Text
                style={{
                  fontFamily: cat.id === selectedId ? "Outfit_600SemiBold" : "Outfit_400Regular",
                  fontSize: 14,
                  color: cat.id === selectedId ? COLORS.primary : COLORS.text,
                }}
              >
                {cat.nome}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Image Picker Button ─────────────────────────────────────────────────────

function ImagePickerField({
  imageUri,
  onImagePicked,
  inputStyle,
}: {
  imageUri: string;
  onImagePicked: (uri: string) => void;
  inputStyle: object;
}) {
  const COLORS = useColors();
  const [uploading, setUploading] = useState(false);

  const pickImage = async () => {
    console.log("[GestaoPratos] Image picker opened");
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
      base64: true,
    });
    if (result.canceled || !result.assets?.[0]) {
      console.log("[GestaoPratos] Image picker cancelled");
      return;
    }
    const asset = result.assets[0];
    if (!asset.base64) {
      Alert.alert("Erro", "Não foi possível ler a imagem.");
      return;
    }
    console.log("[GestaoPratos] POST /api/upload/imagem");
    setUploading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/upload/imagem`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base64: asset.base64, mimeType: asset.mimeType ?? "image/jpeg" }),
      });
      if (!response.ok) {
        const txt = await response.text();
        console.error("[GestaoPratos] Upload error:", txt.slice(0, 200));
        throw new Error("Falha no upload da imagem.");
      }
      const data = await response.json();
      const url: string = data.url ?? data.imagem_url ?? data.path ?? "";
      console.log("[GestaoPratos] Image uploaded:", url);
      onImagePicked(url);
    } catch (e: any) {
      console.error("[GestaoPratos] Upload error:", e instanceof Error ? e.message : String(e));
      Alert.alert("Erro", e instanceof Error ? e.message : "Não foi possível fazer upload da imagem.");
    } finally {
      setUploading(false);
    }
  };

  const hasCustomImage = imageUri && imageUri !== DEFAULT_IMAGE;
  const previewSource = resolveImageSource(imageUri || DEFAULT_IMAGE);

  return (
    <TouchableOpacity
      onPress={pickImage}
      activeOpacity={0.8}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        backgroundColor: COLORS.surfaceSecondary,
        borderRadius: 12,
        padding: 10,
        borderWidth: 1,
        borderColor: COLORS.border,
      }}
    >
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 10,
          overflow: "hidden",
          backgroundColor: COLORS.background,
        }}
      >
        <Image
          source={previewSource}
          style={{ width: 56, height: 56 }}
          contentFit="cover"
          transition={200}
        />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          style={{
            fontFamily: "Outfit_600SemiBold",
            fontSize: 13,
            color: COLORS.text,
          }}
        >
          {uploading ? "Enviando imagem..." : hasCustomImage ? "Imagem selecionada" : "Selecionar imagem"}
        </Text>
        <Text
          style={{
            fontFamily: "Outfit_400Regular",
            fontSize: 11,
            color: COLORS.textSecondary,
          }}
        >
          {hasCustomImage ? "Toque para trocar" : "Da galeria ou câmera"}
        </Text>
      </View>
      {uploading ? (
        <ActivityIndicator color={COLORS.primary} size="small" />
      ) : (
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            backgroundColor: COLORS.primaryMuted,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Camera size={15} color={COLORS.primary} />
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Prato Form (shared for create and inline edit) ──────────────────────────

interface PratoFormValues {
  nome: string;
  descricao: string;
  preco: string;
  categoriaId: string;
  imagemUrl: string;
  disponivel: boolean;
}

function PratoForm({
  initial,
  categorias,
  onSubmit,
  onCancel,
  submitLabel,
  isEditing,
}: {
  initial: PratoFormValues;
  categorias: ApiCategoria[];
  onSubmit: (values: PratoFormValues) => Promise<void>;
  onCancel?: () => void;
  submitLabel: string;
  isEditing?: boolean;
}) {
  const COLORS = useColors();
  const [values, setValues] = useState<PratoFormValues>(initial);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    setValues(initial);
    setFormError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial.nome, initial.descricao, initial.preco, initial.categoriaId, initial.imagemUrl, initial.disponivel]);

  const set = (key: keyof PratoFormValues, val: string | boolean) => {
    setValues((prev) => ({ ...prev, [key]: val }));
    setFormError("");
  };

  const handleSubmit = async () => {
    if (!values.nome.trim()) {
      setFormError("Nome é obrigatório.");
      return;
    }
    const precoNum = parseFloat(values.preco.replace(",", "."));
    if (isNaN(precoNum) || precoNum < 0) {
      setFormError("Preço inválido.");
      return;
    }
    setSubmitting(true);
    setFormError("");
    try {
      await onSubmit({ ...values, preco: String(precoNum) });
    } catch (e: any) {
      setFormError(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle = {
    backgroundColor: isEditing ? COLORS.background : COLORS.surfaceSecondary,
    borderRadius: 12,
    padding: 12,
    fontFamily: "Outfit_400Regular" as const,
    fontSize: 15,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  };

  return (
    <View style={{ gap: 12 }}>
      <View style={{ gap: 6 }}>
        <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 13, color: COLORS.text }}>
          Nome *
        </Text>
        <TextInput
          value={values.nome}
          onChangeText={(t) => set("nome", t)}
          placeholder="Ex: Frango Grelhado"
          placeholderTextColor={COLORS.textTertiary}
          style={inputStyle}
        />
      </View>

      <View style={{ gap: 6 }}>
        <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 13, color: COLORS.text }}>
          Descrição
        </Text>
        <TextInput
          value={values.descricao}
          onChangeText={(t) => set("descricao", t)}
          placeholder="Descrição do prato"
          placeholderTextColor={COLORS.textTertiary}
          multiline
          numberOfLines={2}
          style={[inputStyle, { minHeight: 64, textAlignVertical: "top" }]}
        />
      </View>

      <View style={{ gap: 6 }}>
        <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 13, color: COLORS.text }}>
          Preço (R$) *
        </Text>
        <TextInput
          value={values.preco}
          onChangeText={(t) => set("preco", t)}
          placeholder="0,00"
          placeholderTextColor={COLORS.textTertiary}
          keyboardType="decimal-pad"
          style={inputStyle}
        />
      </View>

      <View style={{ gap: 6 }}>
        <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 13, color: COLORS.text }}>
          Categoria
        </Text>
        <CategoryPicker
          categorias={categorias}
          selectedId={values.categoriaId}
          onSelect={(id) => set("categoriaId", id)}
          inputStyle={inputStyle}
        />
      </View>

      <View style={{ gap: 6 }}>
        <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 13, color: COLORS.text }}>
          Imagem
        </Text>
        <ImagePickerField
          imageUri={values.imagemUrl}
          onImagePicked={(uri) => set("imagemUrl", uri)}
          inputStyle={inputStyle}
        />
      </View>

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: isEditing ? COLORS.background : COLORS.surfaceSecondary,
          borderRadius: 12,
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderWidth: 1,
          borderColor: COLORS.border,
        }}
      >
        <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 14, color: COLORS.text }}>
          Disponível
        </Text>
        <Switch
          value={values.disponivel}
          onValueChange={(val) => {
            console.log("[GestaoPratos] Toggle disponivel in form:", val);
            set("disponivel", val);
          }}
          trackColor={{ false: COLORS.border, true: COLORS.primary + "80" }}
          thumbColor={values.disponivel ? COLORS.primary : COLORS.textTertiary}
        />
      </View>

      {formError ? (
        <Text
          style={{
            fontFamily: "Outfit_400Regular",
            fontSize: 13,
            color: COLORS.danger,
          }}
        >
          {formError}
        </Text>
      ) : null}

      <View style={{ flexDirection: "row", gap: 10 }}>
        {onCancel && (
          <AnimatedPressable
            onPress={() => {
              console.log("[GestaoPratos] Cancel form");
              onCancel();
            }}
            style={{
              flex: 1,
              height: 48,
              borderRadius: 14,
              backgroundColor: COLORS.surfaceSecondary,
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
              gap: 6,
            }}
          >
            <X size={14} color={COLORS.textSecondary} />
            <Text
              style={{
                fontFamily: "Outfit_600SemiBold",
                fontSize: 14,
                color: COLORS.textSecondary,
              }}
            >
              Cancelar
            </Text>
          </AnimatedPressable>
        )}
        <AnimatedPressable
          onPress={() => {
            console.log("[GestaoPratos] Submit form pressed:", submitLabel);
            handleSubmit();
          }}
          disabled={submitting}
          style={{
            flex: 1,
            height: 48,
            borderRadius: 14,
            backgroundColor: COLORS.primary,
            alignItems: "center",
            justifyContent: "center",
            opacity: submitting ? 0.7 : 1,
          }}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text
              style={{
                fontFamily: "Outfit_700Bold",
                fontSize: 15,
                color: "#fff",
              }}
            >
              {submitLabel}
            </Text>
          )}
        </AnimatedPressable>
      </View>
    </View>
  );
}

// ─── Prato Row ───────────────────────────────────────────────────────────────

function PratoRow({
  prato,
  categorias,
  isEditing,
  onEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  onToggle,
}: {
  prato: ApiPrato;
  categorias: ApiCategoria[];
  isEditing: boolean;
  onEdit: (p: ApiPrato) => void;
  onCancelEdit: () => void;
  onSaveEdit: (id: string, values: PratoFormValues) => Promise<void>;
  onDelete: (p: ApiPrato) => void;
  onToggle: (id: string, disponivel: boolean) => void;
}) {
  const COLORS = useColors();
  const imageUri = prato.imagem_url || getPicsumUrl(prato.id);
  const imageSource = resolveImageSource(imageUri);
  const disponivel = prato.disponivel ?? true;
  const categoriaNome = prato.categoria?.nome ?? "";
  const precoNum = Number(prato.preco);
  const precoDisplay = isNaN(precoNum) ? "0,00" : precoNum.toFixed(2).replace(".", ",");
  const precoText = `R$ ${precoDisplay}`;

  const editInitial: PratoFormValues = {
    nome: prato.nome,
    descricao: prato.descricao ?? "",
    preco: isNaN(precoNum) ? "0" : String(precoNum),
    categoriaId: prato.categoria_id ?? "",
    imagemUrl: prato.imagem_url ?? "",
    disponivel: prato.disponivel ?? true,
  };

  if (isEditing) {
    return (
      <View
        style={{
          backgroundColor: COLORS.primaryMuted,
          borderRadius: 16,
          padding: 16,
          marginHorizontal: 16,
          marginVertical: 5,
          borderWidth: 1.5,
          borderColor: COLORS.primary + "40",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              backgroundColor: COLORS.primary + "20",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Pencil size={13} color={COLORS.primary} />
          </View>
          <Text
            style={{
              fontFamily: "Outfit_600SemiBold",
              fontSize: 13,
              color: COLORS.primary,
            }}
          >
            Editando prato
          </Text>
        </View>
        <PratoForm
          initial={editInitial}
          categorias={categorias}
          onSubmit={async (values) => {
            await onSaveEdit(prato.id, values);
          }}
          onCancel={onCancelEdit}
          submitLabel="Salvar alterações"
          isEditing
        />
      </View>
    );
  }

  return (
    <View
      style={{
        backgroundColor: COLORS.surface,
        borderRadius: 16,
        marginHorizontal: 16,
        marginVertical: 5,
        borderWidth: 1,
        borderColor: COLORS.border,
        overflow: "hidden",
        opacity: disponivel ? 1 : 0.75,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 1,
      }}
    >
      <View style={{ flexDirection: "row" }}>
        <View
          style={{
            width: 80,
            height: 80,
            backgroundColor: COLORS.surfaceSecondary,
          }}
        >
          <Image
            source={imageSource}
            style={{ width: 80, height: 80 }}
            contentFit="cover"
            transition={200}
          />
        </View>

        <View style={{ flex: 1, padding: 10, gap: 3, justifyContent: "space-between" }}>
          <View style={{ gap: 2 }}>
            <Text
              numberOfLines={1}
              style={{
                fontFamily: "Outfit_600SemiBold",
                fontSize: 14,
                color: COLORS.text,
              }}
            >
              {prato.nome}
            </Text>
            {categoriaNome ? (
              <View
                style={{
                  backgroundColor: COLORS.primaryMuted,
                  borderRadius: 6,
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                  alignSelf: "flex-start",
                }}
              >
                <Text
                  style={{
                    fontFamily: "Outfit_600SemiBold",
                    fontSize: 10,
                    color: COLORS.primary,
                  }}
                >
                  {categoriaNome}
                </Text>
              </View>
            ) : null}
            <Text
              style={{
                fontFamily: "Outfit_700Bold",
                fontSize: 14,
                color: COLORS.primary,
              }}
            >
              {precoText}
            </Text>
          </View>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Text
                style={{
                  fontFamily: "Outfit_400Regular",
                  fontSize: 11,
                  color: COLORS.textSecondary,
                }}
              >
                Disponível
              </Text>
              <Switch
                value={disponivel}
                onValueChange={(val) => {
                  console.log("[GestaoPratos] Toggle disponivel:", prato.id, val);
                  onToggle(prato.id, val);
                }}
                trackColor={{ false: COLORS.border, true: COLORS.primary + "80" }}
                thumbColor={disponivel ? COLORS.primary : COLORS.textTertiary}
                style={{ transform: [{ scaleX: 0.75 }, { scaleY: 0.75 }] }}
              />
            </View>

            <View style={{ flexDirection: "row", gap: 6 }}>
              <AnimatedPressable
                onPress={() => {
                  console.log("[GestaoPratos] Edit pressed:", prato.id, prato.nome);
                  onEdit(prato);
                }}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  backgroundColor: COLORS.primaryMuted,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Pencil size={13} color={COLORS.primary} />
              </AnimatedPressable>
              <AnimatedPressable
                onPress={() => {
                  console.log("[GestaoPratos] Delete pressed:", prato.id, prato.nome);
                  onDelete(prato);
                }}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  backgroundColor: "#EF444418",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Trash2 size={13} color="#EF4444" />
              </AnimatedPressable>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function GestaoPratos() {
  const COLORS = useColors();
  const insets = useSafeAreaInsets();

  const [pratos, setPratos] = useState<ApiPrato[]>([]);
  const [categorias, setCategorias] = useState<ApiCategoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);

  const emptyForm: PratoFormValues = {
    nome: "",
    descricao: "",
    preco: "",
    categoriaId: "",
    imagemUrl: "",
    disponivel: true,
  };

  const fetchAll = useCallback(async () => {
    console.log("[GestaoPratos] GET /api/pratos + /api/categorias");
    try {
      const [pratosRes, categoriasRes] = await Promise.all([
        apiGet<any>("/api/pratos"),
        apiGet<any>("/api/categorias"),
      ]);
      const pratosList: ApiPrato[] = Array.isArray(pratosRes) ? pratosRes : (pratosRes.pratos ?? []);
      const categoriasList: ApiCategoria[] = Array.isArray(categoriasRes)
        ? categoriasRes
        : (categoriasRes.categorias ?? []);
      console.log("[GestaoPratos] Loaded", pratosList.length, "pratos,", categoriasList.length, "categorias");
      setPratos(pratosList);
      setCategorias(categoriasList);
      setError("");
    } catch (e: any) {
      console.error("[GestaoPratos] Error:", e instanceof Error ? e.message : String(e));
      setError("Não foi possível carregar os pratos.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleRefresh = () => {
    console.log("[GestaoPratos] Manual refresh");
    setRefreshing(true);
    fetchAll();
  };

  const handleCreate = async (values: PratoFormValues) => {
    const precoNum = parseFloat(values.preco.replace(",", "."));
    const body = {
      nome: values.nome.trim(),
      descricao: values.descricao.trim() || undefined,
      preco: precoNum,
      categoria_id: values.categoriaId || undefined,
      imagem_url: values.imagemUrl || DEFAULT_IMAGE,
      disponivel: values.disponivel,
    };
    console.log("[GestaoPratos] POST /api/pratos", body.nome);
    await apiPost("/api/pratos", body);
    console.log("[GestaoPratos] Prato created, resetting form and refreshing list");
    setFormKey((k) => k + 1);
    fetchAll();
  };

  const handleSaveEdit = async (id: string, values: PratoFormValues) => {
    const precoNum = parseFloat(values.preco.replace(",", "."));
    const body = {
      nome: values.nome.trim(),
      descricao: values.descricao.trim() || undefined,
      preco: precoNum,
      categoria_id: values.categoriaId || undefined,
      imagem_url: values.imagemUrl || DEFAULT_IMAGE,
      disponivel: values.disponivel,
    };
    console.log("[GestaoPratos] PUT /api/pratos/", id, body.nome);
    await apiPut(`/api/pratos/${id}`, body);
    console.log("[GestaoPratos] Prato updated:", id);
    setEditingId(null);
    fetchAll();
  };

  const handleDelete = (prato: ApiPrato) => {
    console.log("[GestaoPratos] Confirm delete prato:", prato.id, prato.nome);
    Alert.alert(
      "Excluir Prato",
      `Deseja excluir "${prato.nome}"?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: async () => {
            console.log("[GestaoPratos] DELETE /api/pratos/", prato.id);
            try {
              await apiDelete(`/api/pratos/${prato.id}`);
              console.log("[GestaoPratos] Prato deleted:", prato.id);
              setPratos((prev) => prev.filter((p) => p.id !== prato.id));
              if (editingId === prato.id) setEditingId(null);
            } catch (e: any) {
              console.error("[GestaoPratos] Delete error:", e instanceof Error ? e.message : String(e));
              Alert.alert("Erro", e instanceof Error ? e.message : "Não foi possível excluir o prato.");
            }
          },
        },
      ]
    );
  };

  const handleToggle = async (id: string, disponivel: boolean) => {
    console.log("[GestaoPratos] PUT /api/pratos/", id, "disponivel:", disponivel);
    try {
      await apiPut(`/api/pratos/${id}`, { disponivel });
      setPratos((prev) => prev.map((p) => (p.id === id ? { ...p, disponivel } : p)));
      console.log("[GestaoPratos] Toggle success:", id, disponivel);
    } catch (e: any) {
      console.error("[GestaoPratos] Toggle error:", e instanceof Error ? e.message : String(e));
      Alert.alert("Erro", "Não foi possível atualizar a disponibilidade.");
    }
  };

  const countText = `${pratos.length} prato${pratos.length !== 1 ? "s" : ""}`;

  return (
    <>
      <Stack.Screen
        options={{
          title: "Gerenciar Pratos",
          headerTintColor: COLORS.primary,
          headerBackButtonDisplayMode: "minimal",
          headerStyle: { backgroundColor: COLORS.surface },
          headerTitleStyle: { fontFamily: "Outfit_700Bold", color: COLORS.text },
        }}
      />

      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: COLORS.background }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={COLORS.primary}
            />
          }
          keyboardShouldPersistTaps="handled"
        >
          {/* Inline creation form */}
          <View
            style={{
              margin: 16,
              backgroundColor: COLORS.surface,
              borderRadius: 20,
              padding: 20,
              borderWidth: 1,
              borderColor: COLORS.border,
              gap: 0,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.06,
              shadowRadius: 8,
              elevation: 2,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor: COLORS.primaryMuted,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Plus size={18} color={COLORS.primary} />
              </View>
              <Text
                style={{
                  fontFamily: "Outfit_700Bold",
                  fontSize: 17,
                  color: COLORS.text,
                }}
              >
                Novo Prato
              </Text>
            </View>
            <PratoForm
              key={formKey}
              initial={emptyForm}
              categorias={categorias}
              onSubmit={handleCreate}
              submitLabel="Adicionar Prato"
            />
          </View>

          {/* Section header */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 20,
              paddingBottom: 8,
            }}
          >
            <Text
              style={{
                fontFamily: "Outfit_700Bold",
                fontSize: 16,
                color: COLORS.text,
              }}
            >
              Pratos Cadastrados
            </Text>
            <Text
              style={{
                fontFamily: "Outfit_400Regular",
                fontSize: 13,
                color: COLORS.textSecondary,
              }}
            >
              {countText}
            </Text>
          </View>

          {loading ? (
            <View style={{ alignItems: "center", paddingVertical: 48 }}>
              <ActivityIndicator color={COLORS.primary} size="large" />
            </View>
          ) : error ? (
            <View style={{ alignItems: "center", padding: 32, gap: 12 }}>
              <Text
                style={{
                  fontFamily: "Outfit_600SemiBold",
                  fontSize: 15,
                  color: COLORS.text,
                  textAlign: "center",
                }}
              >
                {error}
              </Text>
              <AnimatedPressable
                onPress={fetchAll}
                style={{
                  backgroundColor: COLORS.primary,
                  borderRadius: 12,
                  paddingHorizontal: 24,
                  paddingVertical: 12,
                }}
              >
                <Text
                  style={{ fontFamily: "Outfit_600SemiBold", fontSize: 15, color: "#fff" }}
                >
                  Tentar novamente
                </Text>
              </AnimatedPressable>
            </View>
          ) : pratos.length === 0 ? (
            <View style={{ alignItems: "center", padding: 48, gap: 12 }}>
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 18,
                  backgroundColor: COLORS.primaryMuted,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <UtensilsCrossed size={28} color={COLORS.primary} />
              </View>
              <Text
                style={{
                  fontFamily: "Outfit_600SemiBold",
                  fontSize: 16,
                  color: COLORS.text,
                }}
              >
                Nenhum prato cadastrado
              </Text>
              <Text
                style={{
                  fontFamily: "Outfit_400Regular",
                  fontSize: 13,
                  color: COLORS.textSecondary,
                  textAlign: "center",
                }}
              >
                Use o formulário acima para adicionar pratos
              </Text>
            </View>
          ) : (
            <View style={{ paddingTop: 4, paddingBottom: 8 }}>
              {pratos.map((prato) => (
                <PratoRow
                  key={prato.id}
                  prato={prato}
                  categorias={categorias}
                  isEditing={editingId === prato.id}
                  onEdit={(p) => {
                    console.log("[GestaoPratos] Start inline edit:", p.id);
                    setEditingId(p.id);
                  }}
                  onCancelEdit={() => {
                    console.log("[GestaoPratos] Cancel inline edit");
                    setEditingId(null);
                  }}
                  onSaveEdit={handleSaveEdit}
                  onDelete={handleDelete}
                  onToggle={handleToggle}
                />
              ))}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}
