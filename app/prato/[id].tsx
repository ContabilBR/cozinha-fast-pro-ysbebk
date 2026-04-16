import React, { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, RefreshControl } from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { Image } from "expo-image";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { CardSkeleton } from "@/components/SkeletonLoader";
import { Prato } from "@/types";
import { apiGet } from "@/utils/api";
import { formatCurrency, isAdmin } from "@/utils/helpers";
import { Clock, Pencil, UtensilsCrossed, Tag, AlertCircle, Plus } from "lucide-react-native";
import type { ImageSourcePropType } from "react-native";

function resolveImageSource(source: string | number | ImageSourcePropType | undefined): ImageSourcePropType {
  if (!source) return { uri: "" };
  if (typeof source === "string") return { uri: source };
  return source as ImageSourcePropType;
}

export default function PratoDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const COLORS = useColors();
  const router = useRouter();
  const { user } = useAuth();
  const role = (user as any)?.role;
  const canEdit = isAdmin(role);

  const [prato, setPrato] = useState<Prato | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const fetchPrato = useCallback(async () => {
    console.log("[PratoDetail] Fetching prato:", id);
    try {
      const res = await apiGet<any>(`/api/pratos/${id}`);
      const p: Prato = res.prato || res;
      setPrato(p);
      setError("");
    } catch (e: any) {
      console.error("[PratoDetail] Error:", e);
      setError("Não foi possível carregar o prato.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => { fetchPrato(); }, [fetchPrato]);

  const handleRefresh = () => {
    console.log("[PratoDetail] Manual refresh");
    setRefreshing(true);
    fetchPrato();
  };

  const price = formatCurrency(prato?.preco ?? 0);
  const imageSource = resolveImageSource(prato?.imagem_url);

  return (
    <>
      <Stack.Screen
        options={{
          title: prato?.nome ?? "Prato",
          headerTintColor: COLORS.primary,
          headerBackButtonDisplayMode: "minimal",
          headerRight: canEdit
            ? () => (
                <AnimatedPressable
                  onPress={() => {
                    console.log("[PratoDetail] Edit pressed:", id);
                    router.push(`/prato/editar/${id}`);
                  }}
                  style={{ padding: 8 }}
                >
                  <Pencil size={20} color={COLORS.primary} />
                </AnimatedPressable>
              )
            : undefined,
        }}
      />
      <View style={{ flex: 1, backgroundColor: COLORS.background }}>
        {loading ? (
          <View style={{ padding: 16, gap: 12 }}>
            {[0, 1, 2].map((i) => <CardSkeleton key={i} />)}
          </View>
        ) : error ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 }}>
            <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 17, color: COLORS.text }}>
              Erro ao carregar prato
            </Text>
            <AnimatedPressable
              onPress={fetchPrato}
              style={{ backgroundColor: COLORS.primary, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 }}
            >
              <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 15, color: "#fff" }}>
                Tentar novamente
              </Text>
            </AnimatedPressable>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={{ paddingBottom: 40 }}
            contentInsetAdjustmentBehavior="automatic"
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.primary} />
            }
          >
            {/* Hero image */}
            <View style={{ height: 240, backgroundColor: COLORS.surfaceSecondary }}>
              {prato?.imagem_url ? (
                <Image source={imageSource} style={{ width: "100%", height: "100%" }} contentFit="cover" />
              ) : (
                <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                  <UtensilsCrossed size={48} color={COLORS.textTertiary} />
                </View>
              )}
              {!prato?.disponivel && (
                <View
                  style={{
                    position: "absolute",
                    bottom: 12,
                    right: 12,
                    backgroundColor: COLORS.danger + "CC",
                    borderRadius: 10,
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                  }}
                >
                  <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 12, color: "#fff" }}>
                    Indisponível
                  </Text>
                </View>
              )}
            </View>

            <View style={{ padding: 20, gap: 16 }}>
              <View style={{ gap: 8 }}>
                <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 24, color: COLORS.text, letterSpacing: -0.3 }}>
                  {prato?.nome}
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 22, color: COLORS.primary }}>
                    {price}
                  </Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Clock size={14} color={COLORS.textSecondary} />
                    <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 13, color: COLORS.textSecondary }}>
                      {prato?.tempo_preparo}min
                    </Text>
                  </View>
                </View>
                {prato?.categoria && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Tag size={13} color={COLORS.primary} />
                    <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 13, color: COLORS.primary }}>
                      {prato.categoria.nome}
                    </Text>
                  </View>
                )}
              </View>

              {prato?.descricao ? (
                <View style={{ gap: 6 }}>
                  <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 15, color: COLORS.text }}>
                    Descrição
                  </Text>
                  <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 14, color: COLORS.textSecondary, lineHeight: 22 }}>
                    {prato.descricao}
                  </Text>
                </View>
              ) : null}

              {prato?.restricoes ? (
                <View
                  style={{
                    backgroundColor: COLORS.warning + "15",
                    borderRadius: 12,
                    padding: 14,
                    borderWidth: 1,
                    borderColor: COLORS.warning + "30",
                    flexDirection: "row",
                    gap: 10,
                    alignItems: "flex-start",
                  }}
                >
                  <AlertCircle size={16} color={COLORS.warning} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 13, color: COLORS.warning }}>
                      Restrições
                    </Text>
                    <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 13, color: COLORS.textSecondary, marginTop: 2 }}>
                      {prato.restricoes}
                    </Text>
                  </View>
                </View>
              ) : null}

              {prato?.adicionais ? (
                <View style={{ gap: 6 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Plus size={14} color={COLORS.primary} />
                    <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 15, color: COLORS.text }}>
                      Adicionais
                    </Text>
                  </View>
                  <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 14, color: COLORS.textSecondary, lineHeight: 22 }}>
                    {prato.adicionais}
                  </Text>
                </View>
              ) : null}
            </View>
          </ScrollView>
        )}
      </View>
    </>
  );
}
