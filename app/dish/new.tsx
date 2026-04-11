import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Switch,
  ActivityIndicator,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { Category } from "@/types";
import { apiGet, apiPost } from "@/utils/api";
import { UtensilsCrossed } from "lucide-react-native";

function resolveImageSource(source: string | undefined) {
  if (!source) return { uri: "" };
  return { uri: source };
}

function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: any;
}) {
  const COLORS = useColors();
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 14, color: COLORS.text }}>
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textTertiary}
        multiline={multiline}
        keyboardType={keyboardType}
        style={{
          backgroundColor: COLORS.surfaceSecondary,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: COLORS.border,
          padding: 14,
          fontFamily: "Outfit_400Regular",
          fontSize: 15,
          color: COLORS.text,
          minHeight: multiline ? 80 : 52,
          textAlignVertical: multiline ? "top" : "center",
        }}
      />
    </View>
  );
}

export default function NewDishScreen() {
  const COLORS = useColors();
  const router = useRouter();

  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [prepTime, setPrepTime] = useState("15");
  const [imageUrl, setImageUrl] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [active, setActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    console.log("[NewDish] Fetching categories");
    apiGet<Category[]>("/api/categories")
      .then(setCategories)
      .catch((e) => console.error("[NewDish] Error fetching categories:", e));
  }, []);

  const handleSave = async () => {
    if (!name.trim()) { setError("Nome é obrigatório."); return; }
    if (!price.trim() || isNaN(Number(price))) { setError("Preço inválido."); return; }
    console.log("[NewDish] Creating dish:", name);
    setError("");
    setSubmitting(true);
    try {
      await apiPost("/api/dishes", {
        name: name.trim(),
        description: description.trim() || undefined,
        price: Number(price),
        prep_time_minutes: Number(prepTime) || 15,
        image_url: imageUrl.trim() || undefined,
        category_id: categoryId || undefined,
        active,
      });
      console.log("[NewDish] Dish created successfully");
      router.back();
    } catch (e: any) {
      console.error("[NewDish] Error:", e);
      setError("Não foi possível criar o prato.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: COLORS.background }}
      contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
    >
      {/* Image preview */}
      <View
        style={{
          height: 160,
          borderRadius: 16,
          backgroundColor: COLORS.surfaceSecondary,
          overflow: "hidden",
          borderWidth: 1,
          borderColor: COLORS.border,
        }}
      >
        {imageUrl ? (
          <Image source={resolveImageSource(imageUrl)} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
        ) : (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 8 }}>
            <UtensilsCrossed size={32} color={COLORS.textTertiary} />
            <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 13, color: COLORS.textTertiary }}>
              Sem imagem
            </Text>
          </View>
        )}
      </View>

      <FormField label="URL da Imagem" value={imageUrl} onChangeText={setImageUrl} placeholder="https://..." />
      <FormField label="Nome *" value={name} onChangeText={setName} placeholder="Ex: Frango Grelhado" />
      <FormField label="Descrição" value={description} onChangeText={setDescription} placeholder="Descrição do prato..." multiline />

      {/* Category */}
      <View style={{ gap: 8 }}>
        <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 14, color: COLORS.text }}>
          Categoria
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {categories.map((cat) => (
            <AnimatedPressable
              key={cat.id}
              onPress={() => {
                console.log("[NewDish] Category selected:", cat.name);
                setCategoryId(cat.id);
              }}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 20,
                backgroundColor: categoryId === cat.id ? COLORS.primary : COLORS.surfaceSecondary,
              }}
            >
              <Text
                style={{
                  fontFamily: "Outfit_600SemiBold",
                  fontSize: 13,
                  color: categoryId === cat.id ? "#fff" : COLORS.textSecondary,
                }}
              >
                {cat.name}
              </Text>
            </AnimatedPressable>
          ))}
        </ScrollView>
      </View>

      <View style={{ flexDirection: "row", gap: 12 }}>
        <View style={{ flex: 1 }}>
          <FormField label="Preço (R$) *" value={price} onChangeText={setPrice} placeholder="0.00" keyboardType="decimal-pad" />
        </View>
        <View style={{ flex: 1 }}>
          <FormField label="Preparo (min)" value={prepTime} onChangeText={setPrepTime} placeholder="15" keyboardType="number-pad" />
        </View>
      </View>

      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          backgroundColor: COLORS.surface,
          borderRadius: 12,
          padding: 16,
          borderWidth: 1,
          borderColor: COLORS.border,
        }}
      >
        <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 15, color: COLORS.text }}>
          Prato ativo
        </Text>
        <Switch
          value={active}
          onValueChange={(v) => {
            console.log("[NewDish] Active toggle:", v);
            setActive(v);
          }}
          trackColor={{ false: COLORS.border, true: COLORS.primary + "80" }}
          thumbColor={active ? COLORS.primary : COLORS.textTertiary}
        />
      </View>

      {!!error && (
        <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 13, color: COLORS.danger }}>
          {error}
        </Text>
      )}

      <AnimatedPressable
        onPress={handleSave}
        disabled={submitting}
        style={{
          backgroundColor: COLORS.primary,
          borderRadius: 14,
          height: 52,
          alignItems: "center",
          justifyContent: "center",
          marginTop: 8,
        }}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 16, color: "#fff" }}>
            Criar prato
          </Text>
        )}
      </AnimatedPressable>
    </ScrollView>
  );
}
