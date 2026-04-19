import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { Image } from "expo-image";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { apiGet } from "@/utils/api";
import { UtensilsCrossed } from "lucide-react-native";

interface Prato {
  id: string;
  nome: string;
  descricao?: string;
  preco: number;
  imagem_url?: string;
  disponivel?: boolean;
  categoria?: { nome: string };
}

interface PratoGroup {
  categoria: string;
  pratos: Prato[];
}

function formatPreco(preco: number): string {
  return `R$ ${Number(preco).toFixed(2).replace(".", ",")}`;
}

export default function CardapioScreen() {
  const COLORS = useColors();
  const insets = useSafeAreaInsets();
  const [groups, setGroups] = useState<PratoGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const fetchPratos = useCallback(async () => {
    try {
      const res = await apiGet<any>("/api/pratos");
      const list: Prato[] = Array.isArray(res) ? res : (res.pratos ?? []);
      const map = new Map<string, Prato[]>();
      for (const p of list) {
        const key = p.categoria?.nome ?? "Sem categoria";
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(p);
      }
      setGroups(Array.from(map.entries()).map(([categoria, pratos]) => ({ categoria, pratos })));
      setError("");
    } catch (e: any) {
      setError("Não foi possível carregar o cardápio.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    fetchPratos();
  }, [fetchPratos]));

  const totalPratos = groups.reduce((s, g) => s + g.pratos.length, 0);
  const subtitleText = loading ? "Carregando..." : `${totalPratos} pratos`;

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      {/* Header */}
      <View style={{
        paddingTop: insets.top + 12,
        paddingHorizontal: 20,
        paddingBottom: 14,
        backgroundColor: COLORS.surface,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
      }}>
        <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 26, color: COLORS.text, letterSpacing: -0.3 }}>
          Cardápio
        </Text>
        <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 13, color: COLORS.textSecondary, marginTop: 2 }}>
          {subtitleText}
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator style={{ flex: 1 }} color={COLORS.primary} />
      ) : error ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 }}>
          <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 16, color: COLORS.text, textAlign: "center" }}>{error}</Text>
          <Pressable
            onPress={() => { setLoading(true); fetchPratos(); }}
            style={{ backgroundColor: COLORS.primary, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 }}
          >
            <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 15, color: "#fff" }}>Tentar novamente</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 120 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchPratos(); }} tintColor={COLORS.primary} />}
        >
          {groups.length === 0 ? (
            <View style={{ alignItems: "center", justifyContent: "center", padding: 48, gap: 12, marginTop: 40 }}>
              <UtensilsCrossed size={40} color={COLORS.textTertiary} />
              <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 17, color: COLORS.text }}>Nenhum prato disponível</Text>
            </View>
          ) : (
            groups.map((group) => (
              <View key={group.categoria}>
                <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 }}>
                  <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 15, color: COLORS.text, letterSpacing: -0.2 }}>
                    {group.categoria}
                  </Text>
                  <View style={{ height: 2, width: 28, backgroundColor: COLORS.primary, borderRadius: 2, marginTop: 4 }} />
                </View>
                {group.pratos.map((prato) => {
                  const precoDisplay = formatPreco(prato.preco);
                  const cardOpacity = prato.disponivel === false ? 0.5 : 1;
                  return (
                    <View key={prato.id} style={{
                      flexDirection: "row",
                      alignItems: "center",
                      marginHorizontal: 16,
                      marginBottom: 8,
                      backgroundColor: COLORS.surface,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: COLORS.border,
                      padding: 12,
                      gap: 12,
                      opacity: cardOpacity,
                    }}>
                      {prato.imagem_url ? (
                        <Image
                          source={{ uri: prato.imagem_url }}
                          style={{ width: 68, height: 68, borderRadius: 10 }}
                          contentFit="cover"
                        />
                      ) : (
                        <View style={{ width: 68, height: 68, borderRadius: 10, backgroundColor: COLORS.surfaceSecondary, alignItems: "center", justifyContent: "center" }}>
                          <UtensilsCrossed size={24} color={COLORS.textTertiary} />
                        </View>
                      )}
                      <View style={{ flex: 1, gap: 3 }}>
                        <Text numberOfLines={1} style={{ fontFamily: "Outfit_700Bold", fontSize: 15, color: COLORS.text }}>
                          {prato.nome}
                        </Text>
                        {!!prato.descricao && (
                          <Text numberOfLines={1} style={{ fontFamily: "Outfit_400Regular", fontSize: 12, color: COLORS.textSecondary }}>
                            {prato.descricao}
                          </Text>
                        )}
                        <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 15, color: "#22C55E" }}>
                          {precoDisplay}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}
