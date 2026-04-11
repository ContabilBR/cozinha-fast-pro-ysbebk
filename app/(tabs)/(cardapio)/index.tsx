import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  ScrollView,
  RefreshControl,
  Animated,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { CardSkeleton } from "@/components/SkeletonLoader";
import { Dish, Category } from "@/types";
import { apiGet } from "@/utils/api";
import { formatCurrency } from "@/utils/helpers";
import { Plus, Clock, UtensilsCrossed } from "lucide-react-native";

function resolveImageSource(source: string | undefined) {
  if (!source) return { uri: "" };
  return { uri: source };
}

function DishCard({ dish, onPress, index }: { dish: Dish; onPress: () => void; index: number }) {
  const COLORS = useColors();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 350, delay: index * 50, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 350, delay: index * 50, useNativeDriver: true }),
    ]).start();
  }, []);

  const price = formatCurrency(dish.price);
  const isActive = dish.active;

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
          boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)",
          opacity: isActive ? 1 : 0.6,
        }}
      >
        {/* Image */}
        <View style={{ height: 110, backgroundColor: COLORS.surfaceSecondary }}>
          {dish.image_url ? (
            <Image
              source={resolveImageSource(dish.image_url)}
              style={{ width: "100%", height: "100%" }}
              resizeMode="cover"
            />
          ) : (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              <UtensilsCrossed size={28} color={COLORS.textTertiary} />
            </View>
          )}
          {!isActive && (
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
                Inativo
              </Text>
            </View>
          )}
        </View>

        {/* Info */}
        <View style={{ padding: 12, gap: 4 }}>
          <Text
            numberOfLines={1}
            style={{ fontFamily: "Outfit_600SemiBold", fontSize: 14, color: COLORS.text }}
          >
            {dish.name}
          </Text>
          {dish.category && (
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
                {dish.category.name}
              </Text>
            </View>
          )}
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
            <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 15, color: COLORS.primary }}>
              {price}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
              <Clock size={11} color={COLORS.textSecondary} />
              <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 11, color: COLORS.textSecondary }}>
                {dish.prep_time_minutes}min
              </Text>
            </View>
          </View>
        </View>
      </AnimatedPressable>
    </Animated.View>
  );
}

export default function CardapioScreen() {
  const COLORS = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [dishes, setDishes] = useState<Dish[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const fetchData = useCallback(async () => {
    console.log("[Cardapio] Fetching dishes and categories");
    try {
      const [dishData, catData] = await Promise.all([
        apiGet<Dish[]>("/api/dishes"),
        apiGet<Category[]>("/api/categories"),
      ]);
      setDishes(dishData);
      setCategories(catData);
      setError("");
    } catch (e: any) {
      console.error("[Cardapio] Error:", e);
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

  const filteredDishes = selectedCategory
    ? dishes.filter((d) => d.category_id === selectedCategory)
    : dishes;

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      {/* Header */}
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
              {dishes.length} pratos
            </Text>
          </View>
        </View>

        {/* Category filter */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginTop: 12 }}
          contentContainerStyle={{ gap: 8 }}
        >
          <AnimatedPressable
            onPress={() => {
              console.log("[Cardapio] Category filter: all");
              setSelectedCategory(null);
            }}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 7,
              borderRadius: 20,
              backgroundColor: !selectedCategory ? COLORS.primary : COLORS.surfaceSecondary,
            }}
          >
            <Text
              style={{
                fontFamily: "Outfit_600SemiBold",
                fontSize: 13,
                color: !selectedCategory ? "#fff" : COLORS.textSecondary,
              }}
            >
              Todos
            </Text>
          </AnimatedPressable>
          {categories.map((cat) => (
            <AnimatedPressable
              key={cat.id}
              onPress={() => {
                console.log("[Cardapio] Category filter:", cat.name);
                setSelectedCategory(cat.id === selectedCategory ? null : cat.id);
              }}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 7,
                borderRadius: 20,
                backgroundColor: selectedCategory === cat.id ? COLORS.primary : COLORS.surfaceSecondary,
              }}
            >
              <Text
                style={{
                  fontFamily: "Outfit_600SemiBold",
                  fontSize: 13,
                  color: selectedCategory === cat.id ? "#fff" : COLORS.textSecondary,
                }}
              >
                {cat.name}
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
          data={filteredDishes}
          renderItem={({ item, index }) => (
            <DishCard
              dish={item}
              onPress={() => {
                console.log("[Cardapio] Dish pressed:", item.id);
                router.push(`/dish/${item.id}`);
              }}
              index={index}
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

      {/* FAB */}
      <AnimatedPressable
        onPress={() => {
          console.log("[Cardapio] FAB - new dish");
          router.push("/dish/new");
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
    </View>
  );
}
