import React from "react";
import { View } from "react-native";
import { Slot, Redirect } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import FloatingTabBar, { TabBarItem } from "@/components/FloatingTabBar";
import { useColors } from "@/hooks/useColors";
import { UserRole } from "@/types";

function getTabsForRole(role: UserRole): TabBarItem[] {
  const perfilTab: TabBarItem = { name: "perfil", route: "/(tabs)/(perfil)", icon: "account_circle", label: "Perfil" };

  switch (role) {
    case "garcom":
      return [
        { name: "mesas", route: "/(tabs)/(mesas)", icon: "grid_view", label: "Mesas" },
        { name: "comandas", route: "/(tabs)/(comandas)", icon: "receipt_long", label: "Comandas" },
        { name: "cardapio", route: "/(tabs)/(cardapio)", icon: "restaurant_menu", label: "Cardápio" },
        perfilTab,
      ];
    case "administrador":
      return [
        { name: "mesas", route: "/(tabs)/(mesas)", icon: "grid_view", label: "Mesas" },
        { name: "cardapio", route: "/(tabs)/(cardapio)", icon: "restaurant_menu", label: "Cardápio" },
        { name: "usuarios", route: "/(tabs)/(usuarios)", icon: "group", label: "Usuários" },
        perfilTab,
      ];
    case "gerente":
      return [
        { name: "dashboard", route: "/(tabs)/(dashboard)", icon: "bar_chart", label: "Dashboard" },
        { name: "relatorios", route: "/(tabs)/(relatorios)", icon: "pie_chart", label: "Relatórios" },
        { name: "historico", route: "/(tabs)/(historico)", icon: "history", label: "Histórico" },
        { name: "cardapio", route: "/(tabs)/(cardapio)", icon: "restaurant_menu", label: "Cardápio" },
        perfilTab,
      ];
    case "cozinheiro":
      return [
        { name: "cozinha", route: "/(tabs)/(cozinha)", icon: "local_fire_department", label: "Fila" },
        { name: "historico", route: "/(tabs)/(historico)", icon: "history", label: "Histórico" },
        { name: "cardapio", route: "/(tabs)/(cardapio)", icon: "restaurant_menu", label: "Cardápio" },
        perfilTab,
      ];
    default:
      return [
        { name: "mesas", route: "/(tabs)/(mesas)", icon: "grid_view", label: "Mesas" },
        perfilTab,
      ];
  }
}

export default function TabLayout() {
  const { user, loading } = useAuth();
  const COLORS = useColors();

  if (loading) return null;
  if (!user) return <Redirect href="/auth-screen" />;

  const role = ((user as any).role as UserRole) || "garcom";
  const tabs = getTabsForRole(role);
  const tabCount = tabs.length;
  const containerWidth = Math.min(60 + tabCount * 72, 380);

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <Slot />
      <FloatingTabBar tabs={tabs} containerWidth={containerWidth} />
    </View>
  );
}
