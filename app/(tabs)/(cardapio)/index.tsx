import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  ScrollView,
  RefreshControl,
  Animated,
  Switch,
} from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { CardSkeleton } from "@/components/SkeletonLoader";
import { apiGet, apiPut } from "@/utils/api";
import { formatCurrency } from "@/utils/helpers";
import { Plus, UtensilsCrossed, Pencil } from "lucide-react-native";
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
  categoria_id?: string;
  categoria?: { id: string; nome: string };
  disponivel?: boolean;
}

interface ApiCategoria {
  id: string;
  nome: string;
  descricao?: string;
}

function DishCard({
  prato,
  onPress,
  index,
  canEdit,
  onToggle,
}: {
  prato: ApiPrato;
  onPress: () => void;
  index: number;
  canEdit: boolean;
  onToggle: (id: string, disponivel: boolean) => void;
}) {
  const COLORS = useColors();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 350, delay: index * 50, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 350, delay: index * 50, useNativeDriver: true }),
    ]).start();
  }, [index, opacity, translateY]);

  const price = formatCurrency(prato.preco);
  const imageSource = resolveImageSource(prato.imagem_url);
  const disponivel = prato.disponivel ?? true;
  const categoriaNome = prato.categoria?.nome;

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }], flex: 1, margin: 6 }}>
      <AnimatedPressable
        onPress={onPress}
        style={{
          backgroundColor: COLORS.surface,
          borderRadius: 16,
          overflow: "hidden",
          borderWidth: 1,
          borderColor: COLORS.border,
          opacity: disponivel ? 1 : 0.65,
        }}
      >
        <View style={{ height: 130, backgroundColor: COLORS.surfaceSecondary }}>
          {prato.imagem_url ? (
            <Image
              source={imageSource}
              style={{ width: "100%", height: "100%" }}
              contentFit="cover"
              transition={200}
            />
          ) : (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              <UtensilsCrossed size={28} color={COLORS.textTertiary} />
            </View>
          )}
          {!disponivel && (
            <View
              style={{
                position: "absolute",
                top: 8,
                right: 8,
                backgroundColor: COLORS.danger + "CC",
                borderRadius: 8,
                paddingHorizontal: 6,
                paddingVertical: 2,
              }}
            >
              <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 10, color: "#fff" }}>
                Indisponível
              </Text>
            </View>
          )}
          {canEdit && (
            <View
              style={{
                position: "absolute",
                top: 8,
                left: 8,
                width: 30,
                height: 30,
                borderRadius: 8,
                backgroundColor: "rgba(0,0,0,0.45)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Pencil size={14} color="#fff" />
            </View>
          )}
        </View>

        <View style={{ padding: 12, gap: 4 }}>
          <Text numberOfLines={1} style={{ fontFamily: "Outfit_600SemiBold", fontSize: 14, color: COLORS.text }}>
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
              <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 10, color: COLORS.primary }}>
                {categoriaNome}
              </Text>
            </View>
          ) : null}
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
            <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 15, color: COLORS.primary }}>
              {price}
            </Text>
          </View>
          {canEdit && (
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: COLORS.divider }}>
              <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 12, color: COLORS.textSecondary }}>
                Disponível
              </Text>
              <Switch
                value={disponivel}
                onValueChange={(val) => {
                  console.log("[Cardapio] Toggle disponivel:", prato.id, val);
                  onToggle(prato.id, val);
                }}
                trackColor={{ false: COLORS.border, true: COLORS.primary + "80" }}
                thumbColor={disponivel ? COLORS.primary : COLORS.textTertiary}
              />
            </View>
          )}
        </View>
      </AnimatedPressable>
    </Animated.View>
  );
}

export default function CardapioScreen() {
  const COLORS = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const role = user?.role;
  const canEdit = role === "admin" || role === "administrador" || role === "gerente";

  const [pratos, setPratos] = useState<ApiPrato[]>([]);
  const [categorias, setCategorias] = useState<ApiCategoria[]>([]);
  const [selectedCategoria, setSelectedCategoria] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const fetchData = useCallback(async () => {
    console.log("[Cardapio] Fetching pratos and categorias");
    try {
      const [pratosRes, catsRes] = await Promise.all([
        apiGet<any>("/api/pratos"),
        apiGet<any>("/api/categorias"),
      ]);
      const pratoList: ApiPrato[] = Array.isArray(pratosRes) ? pratosRes : (pratosRes.pratos ?? []);
      const catList: ApiCategoria[] = Array.isArray(catsRes) ? catsRes : (catsRes.categorias ?? []);
      console.log("[Cardapio] Loaded", pratoList.length, "pratos,", catList.length, "categorias");
      setPratos(pratoList);
      setCategorias(catList);
      setError("");
    } catch (e: any) {
      console.error("[Cardapio] Error:", e instanceof Error ? e.message : String(e));
      setError("Não foi possível carregar o cardápio.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleRefresh = () => {
    console.log("[Cardapio] Manual refresh");
    setRefreshing(true);
    fetchData();
  };

  const handleToggleDisponivel = async (id: string, disponivel: boolean) => {
    console.log("[Cardapio] PUT disponivel:", id, disponivel);
    try {
      await apiPut(`/api/pratos/${id}`, { disponivel });
      setPratos((prev) => prev.map((p) => p.id === id ? { ...p, disponivel } : p));
    } catch (e) {
      console.error("[Cardapio] Toggle error:", e);
    }
  };

  const filteredPratos = selectedCategoria
    ? pratos.filter((p) => p.categoria_id === selectedCategoria)
    : pratos;

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <View
        style={{
          paddingTop: insets.top + 12,
          paddingHorizontal: 20,
          paddingBottom: 12,
          backgroundColor: COLORS.surface,
          borderBottomWidth: 1,
          borderBottomColor: COLORS.border,
        }}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View>
            <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 26, color: COLORS.text, letterSpacing: -0.3 }}>
              Cardápio
            </Text>
            <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 13, color: COLORS.textSecondary }}>
              {pratos.length} pratos
            </Text>
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginTop: 12 }}
          contentContainerStyle={{ gap: 8 }}
        >
          <AnimatedPressable
            onPress={() => {
              console.log("[Cardapio] Filtro: todos");
              setSelectedCategoria(null);
            }}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 7,
              borderRadius: 20,
              backgroundColor: !selectedCategoria ? COLORS.primary : COLORS.surfaceSecondary,
            }}
          >
            <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 13, color: !selectedCategoria ? "#fff" : COLORS.textSecondary }}>
              Todos
            </Text>
          </AnimatedPressable>
          {categorias.map((cat) => (
            <AnimatedPressable
              key={cat.id}
              onPress={() => {
                console.log("[Cardapio] Filtro categoria:", cat.nome);
                setSelectedCategoria(cat.id === selectedCategoria ? null : cat.id);
              }}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 7,
                borderRadius: 20,
                backgroundColor: selectedCategoria === cat.id ? COLORS.primary : COLORS.surfaceSecondary,
              }}
            >
              <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 13, color: selectedCategoria === cat.id ? "#fff" : COLORS.textSecondary }}>
                {cat.nome}
              </Text>
            </AnimatedPressable>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={{ paddingHorizontal: 12, paddingTop: 8 }}>
          {[0, 1, 2].map((i) => <CardSkeleton key={i} />)}
        </View>
      ) : error ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 }}>
          <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 17, color: COLORS.text }}>
            Erro ao carregar cardápio
          </Text>
          <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 14, color: COLORS.textSecondary, textAlign: "center" }}>
            {error}
          </Text>
          <AnimatedPressable
            onPress={fetchData}
            style={{ backgroundColor: COLORS.primary, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 }}
          >
            <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 15, color: "#fff" }}>
              Tentar novamente
            </Text>
          </AnimatedPressable>
        </View>
      ) : (
        <FlatList
          data={filteredPratos}
          renderItem={({ item, index }) => (
            <DishCard
              prato={item}
              onPress={() => {
                console.log("[Cardapio] Prato pressed:", item.id, "canEdit:", canEdit);
                if (canEdit) {
                  router.push(`/prato/editar/${item.id}`);
                } else {
                  router.push(`/prato/${item.id}`);
                }
              }}
              index={index}
              canEdit={canEdit}
              onToggle={handleToggleDisponivel}
            />
          )}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={{ padding: 6, paddingBottom: 120 }}
          contentInsetAdjustmentBehavior="automatic"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.primary} />
          }
          ListEmptyComponent={
            <View style={{ alignItems: "center", justifyContent: "center", padding: 48, gap: 12 }}>
              <View
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 20,
                  backgroundColor: COLORS.primaryMuted,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <UtensilsCrossed size={32} color={COLORS.primary} />
              </View>
              <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 17, color: COLORS.text }}>
                Nenhum prato encontrado
              </Text>
            </View>
          }
        />
      )}

      {canEdit && (
        <AnimatedPressable
          onPress={() => {
            console.log("[Cardapio] FAB - novo prato");
            router.push("/prato/novo");
          }}
          style={{
            position: "absolute",
            bottom: insets.bottom + 90,
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
      )}
    </View>
  );
}
