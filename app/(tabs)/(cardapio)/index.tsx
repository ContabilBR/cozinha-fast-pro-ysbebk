import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  ScrollView,
  RefreshControl,
  Animated,
  Switch,
  Pressable,
} from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { CardSkeleton } from "@/components/SkeletonLoader";
import { apiGet, apiPut } from "@/utils/api";
import { formatCurrency } from "@/utils/helpers";
import { Plus, UtensilsCrossed, Pencil, Users } from "lucide-react-native";
import type { ImageSourcePropType } from "react-native";

function resolveImageSource(source: string | number | ImageSourcePropType | undefined): ImageSourcePropType {
  if (!source) return { uri: "" };
  if (typeof source === "string") return { uri: source };
  return source as ImageSourcePropType;
}

function getPlaceholderUrl(id: string): string {
  const seed = id ? id.slice(0, 8) : "prato";
  return `https://picsum.photos/seed/${seed}/400/300`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

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

interface ApiMesa {
  id: string;
  numero: number;
  capacidade: number;
  status: string;
  comanda_id?: string;
}

// ─── Mesa helpers ─────────────────────────────────────────────────────────────

function getMesaStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    disponivel: "Disponível",
    livre: "Disponível",
    free: "Disponível",
    ocupada: "Ocupada",
    occupied: "Ocupada",
    reservada: "Reservada",
    reserved: "Reservada",
  };
  return labels[status] || String(status);
}

function getMesaStatusColor(status: string): string {
  const map: Record<string, string> = {
    disponivel: "#22C55E",
    livre: "#22C55E",
    free: "#22C55E",
    ocupada: "#E8521A",
    occupied: "#E8521A",
    reservada: "#F59E0B",
    reserved: "#F59E0B",
  };
  return map[status] || "#94A3B8";
}

function isDisponivel(status: string): boolean {
  return status === "disponivel" || status === "livre" || status === "free";
}

// ─── Mesa Card ────────────────────────────────────────────────────────────────

function MesaCard({ mesa, onPress, index }: { mesa: ApiMesa; onPress: () => void; index: number }) {
  const COLORS = useColors();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(14)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 320, delay: index * 50, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 320, delay: index * 50, useNativeDriver: true }),
    ]).start();
  }, [index, opacity, translateY]);

  const statusColor = getMesaStatusColor(mesa.status);
  const statusLabel = getMesaStatusLabel(mesa.status);
  const livre = isDisponivel(mesa.status);

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }], flex: 1, margin: 6 }}>
      <AnimatedPressable
        onPress={onPress}
        style={{
          backgroundColor: COLORS.surface,
          borderRadius: 16,
          padding: 16,
          borderWidth: 2,
          borderColor: livre ? COLORS.border : statusColor + "50",
          minHeight: 130,
          justifyContent: "space-between",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.04,
          shadowRadius: 4,
          elevation: 1,
        }}
      >
        <View style={{ position: "absolute", top: 10, right: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: statusColor }} />

        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
          <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: statusColor + "18", alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 20, color: statusColor }}>
              {mesa.numero}
            </Text>
          </View>
          <View style={{ backgroundColor: statusColor + "20", borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 }}>
            <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 10, color: statusColor }}>
              {statusLabel}
            </Text>
          </View>
        </View>

        <View style={{ gap: 4, marginTop: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Users size={13} color={COLORS.textSecondary} />
            <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 12, color: COLORS.textSecondary }}>
              {mesa.capacidade} lugares
            </Text>
          </View>
        </View>
      </AnimatedPressable>
    </Animated.View>
  );
}

// ─── Garçom: Mesa List ────────────────────────────────────────────────────────

function GarcomMesaList() {
  const COLORS = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [mesas, setMesas] = useState<ApiMesa[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const fetchMesas = useCallback(async () => {
    console.log("[Cardapio/Garcom] GET /api/mesas");
    try {
      const res = await apiGet<any>("/api/mesas");
      const list: ApiMesa[] = Array.isArray(res) ? res : (res.mesas || []);
      console.log("[Cardapio/Garcom] Mesas carregadas:", list.length);
      setMesas(list);
      setError("");
    } catch (e: any) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[Cardapio/Garcom] Erro:", msg);
      setError("Não foi possível carregar as mesas.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchMesas(); }, [fetchMesas]));

  const handleRefresh = () => {
    console.log("[Cardapio/Garcom] Refresh manual");
    setRefreshing(true);
    fetchMesas();
  };

  const handleMesaPress = (mesa: ApiMesa) => {
    console.log("[Cardapio/Garcom] Mesa pressionada:", mesa.numero, "status:", mesa.status);
    router.push(`/comanda/nova?mesa_id=${mesa.id}&mesa_numero=${mesa.numero}`);
  };

  const livreCount = mesas.filter((m) => isDisponivel(m.status)).length;
  const ocupadaCount = mesas.filter((m) => !isDisponivel(m.status)).length;

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
        <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 26, color: COLORS.text, letterSpacing: -0.3 }}>
          Cardápio
        </Text>
        <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 13, color: COLORS.textSecondary, marginTop: 2 }}>
          Selecione uma mesa para abrir o cardápio
        </Text>

        {/* Stats */}
        <View style={{ flexDirection: "row", marginTop: 10, gap: 16 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#22C55E" }} />
            <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 12, color: COLORS.textSecondary }}>
              {livreCount} disponíveis
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#E8521A" }} />
            <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 12, color: COLORS.textSecondary }}>
              {ocupadaCount} ocupadas
            </Text>
          </View>
        </View>
      </View>

      {loading ? (
        <View style={{ padding: 12, gap: 8 }}>
          {[0, 1, 2, 3].map((i) => <CardSkeleton key={i} />)}
        </View>
      ) : error ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 14 }}>
          <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 17, color: COLORS.text, textAlign: "center" }}>
            Erro ao carregar mesas
          </Text>
          <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 14, color: COLORS.textSecondary, textAlign: "center" }}>
            {error}
          </Text>
          <Pressable
            onPress={() => { console.log("[Cardapio/Garcom] Tentar novamente pressionado"); setLoading(true); fetchMesas(); }}
            style={({ pressed }) => ({
              backgroundColor: COLORS.primary,
              borderRadius: 12,
              paddingHorizontal: 28,
              paddingVertical: 13,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 15, color: "#fff" }}>Tentar novamente</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={mesas}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={{ padding: 6, paddingBottom: 120 }}
          contentInsetAdjustmentBehavior="automatic"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.primary} />}
          renderItem={({ item, index }) => (
            <MesaCard mesa={item} onPress={() => handleMesaPress(item)} index={index} />
          )}
          ListEmptyComponent={
            <View style={{ alignItems: "center", justifyContent: "center", padding: 48, gap: 12 }}>
              <View style={{ width: 72, height: 72, borderRadius: 20, backgroundColor: COLORS.primaryMuted, alignItems: "center", justifyContent: "center" }}>
                <Users size={32} color={COLORS.primary} />
              </View>
              <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 17, color: COLORS.text }}>
                Nenhuma mesa cadastrada
              </Text>
              <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 14, color: COLORS.textSecondary, textAlign: "center" }}>
                As mesas do restaurante aparecerão aqui
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

// ─── Dish Card (for cozinheiro/admin) ─────────────────────────────────────────

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
  const imageUri = prato.imagem_url || getPlaceholderUrl(prato.id);
  const imageSource = resolveImageSource(imageUri);
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
          <Image
            source={imageSource}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
            transition={200}
          />
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

// ─── Admin/Cozinheiro: Dish Management ────────────────────────────────────────

function DishManagementScreen({ canEdit }: { canEdit: boolean }) {
  const COLORS = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();

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

  const pratosCount = pratos.length;

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
              {pratosCount} pratos
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

// ─── Root export ──────────────────────────────────────────────────────────────

export default function CardapioScreen() {
  const { user } = useAuth();
  const role = user?.role;
  const isGarcom = role === "garcom";
  const canEdit = role === "admin" || role === "administrador" || role === "gerente";

  if (isGarcom) {
    return <GarcomMesaList />;
  }

  return <DishManagementScreen canEdit={canEdit} />;
}
