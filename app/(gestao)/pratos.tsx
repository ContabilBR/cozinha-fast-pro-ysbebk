import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Switch,
} from "react-native";
import { Image } from "expo-image";
import { Stack, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { apiGet, apiPut, apiDelete } from "@/utils/api";
import { Plus, Pencil, Trash2, UtensilsCrossed } from "lucide-react-native";
import type { ImageSourcePropType } from "react-native";

function resolveImageSource(
  source: string | number | ImageSourcePropType | undefined
): ImageSourcePropType {
  if (!source) return { uri: "" };
  if (typeof source === "string") return { uri: source };
  return source as ImageSourcePropType;
}

function getPicsumUrl(id: string): string {
  const seed = id ? id.slice(0, 8) : "prato";
  return `https://picsum.photos/seed/${seed}/400/300`;
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

function PratoCard({
  prato,
  onEdit,
  onDelete,
  onToggle,
}: {
  prato: ApiPrato;
  onEdit: (p: ApiPrato) => void;
  onDelete: (p: ApiPrato) => void;
  onToggle: (id: string, disponivel: boolean) => void;
}) {
  const COLORS = useColors();
  const imageUri = prato.imagem_url || getPicsumUrl(prato.id);
  const imageSource = resolveImageSource(imageUri);
  const disponivel = prato.disponivel ?? true;
  const categoriaNome = prato.categoria?.nome;
  const precoNum = Number(prato.preco);
  const precoDisplay = isNaN(precoNum) ? "0,00" : precoNum.toFixed(2).replace(".", ",");

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
        opacity: disponivel ? 1 : 0.7,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 1,
      }}
    >
      <View style={{ flexDirection: "row" }}>
        {/* Image */}
        <View
          style={{
            width: 90,
            height: 90,
            backgroundColor: COLORS.surfaceSecondary,
          }}
        >
          <Image
            source={imageSource}
            style={{ width: 90, height: 90 }}
            contentFit="cover"
            transition={200}
          />
        </View>

        {/* Content */}
        <View style={{ flex: 1, padding: 12, gap: 4, justifyContent: "space-between" }}>
          <View style={{ gap: 3 }}>
            <Text
              numberOfLines={1}
              style={{
                fontFamily: "Outfit_600SemiBold",
                fontSize: 15,
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
                fontSize: 15,
                color: COLORS.primary,
              }}
            >
              R$ {precoDisplay}
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
                style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
              />
            </View>

            <View style={{ flexDirection: "row", gap: 6 }}>
              <AnimatedPressable
                onPress={() => {
                  console.log("[GestaoPratos] Edit pressed:", prato.id, prato.nome);
                  onEdit(prato);
                }}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 9,
                  backgroundColor: COLORS.primaryMuted,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Pencil size={14} color={COLORS.primary} />
              </AnimatedPressable>
              <AnimatedPressable
                onPress={() => {
                  console.log("[GestaoPratos] Delete pressed:", prato.id, prato.nome);
                  onDelete(prato);
                }}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 9,
                  backgroundColor: "#EF444418",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Trash2 size={14} color="#EF4444" />
              </AnimatedPressable>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

export default function GestaoPratos() {
  const COLORS = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [pratos, setPratos] = useState<ApiPrato[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const fetchPratos = useCallback(async () => {
    console.log("[GestaoPratos] GET /api/pratos");
    try {
      const res = await apiGet<any>("/api/pratos");
      const list: ApiPrato[] = Array.isArray(res) ? res : (res.pratos ?? []);
      console.log("[GestaoPratos] Loaded", list.length, "pratos");
      setPratos(list);
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
    fetchPratos();
  }, [fetchPratos]);

  const handleRefresh = () => {
    console.log("[GestaoPratos] Manual refresh");
    setRefreshing(true);
    fetchPratos();
  };

  const handleEdit = (prato: ApiPrato) => {
    console.log("[GestaoPratos] Navigate to edit prato:", prato.id);
    router.push(`/prato/editar/${prato.id}`);
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
      setPratos((prev) =>
        prev.map((p) => (p.id === id ? { ...p, disponivel } : p))
      );
      console.log("[GestaoPratos] Toggle success:", id, disponivel);
    } catch (e: any) {
      console.error("[GestaoPratos] Toggle error:", e instanceof Error ? e.message : String(e));
      Alert.alert("Erro", "Não foi possível atualizar a disponibilidade.");
    }
  };

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

      <View style={{ flex: 1, backgroundColor: COLORS.background }}>
        {loading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator color={COLORS.primary} size="large" />
          </View>
        ) : error ? (
          <View
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              padding: 32,
              gap: 12,
            }}
          >
            <Text
              style={{
                fontFamily: "Outfit_600SemiBold",
                fontSize: 17,
                color: COLORS.text,
                textAlign: "center",
              }}
            >
              {error}
            </Text>
            <AnimatedPressable
              onPress={fetchPratos}
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
        ) : (
          <FlatList
            data={pratos}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingTop: 12, paddingBottom: insets.bottom + 100 }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={COLORS.primary}
              />
            }
            renderItem={({ item }) => (
              <PratoCard
                prato={item}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onToggle={handleToggle}
              />
            )}
            ListEmptyComponent={
              <View
                style={{
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 48,
                  gap: 12,
                }}
              >
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
                <Text
                  style={{
                    fontFamily: "Outfit_600SemiBold",
                    fontSize: 17,
                    color: COLORS.text,
                  }}
                >
                  Nenhum prato cadastrado
                </Text>
                <Text
                  style={{
                    fontFamily: "Outfit_400Regular",
                    fontSize: 14,
                    color: COLORS.textSecondary,
                    textAlign: "center",
                  }}
                >
                  Toque no botão + para adicionar pratos
                </Text>
              </View>
            }
          />
        )}

        {/* FAB */}
        <AnimatedPressable
          onPress={() => {
            console.log("[GestaoPratos] FAB - novo prato");
            router.push("/prato/novo");
          }}
          style={{
            position: "absolute",
            bottom: insets.bottom + 24,
            right: 20,
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: COLORS.primary,
            alignItems: "center",
            justifyContent: "center",
            shadowColor: COLORS.primary,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.4,
            shadowRadius: 8,
            elevation: 6,
          }}
        >
          <Plus size={24} color="#fff" />
        </AnimatedPressable>
      </View>
    </>
  );
}
