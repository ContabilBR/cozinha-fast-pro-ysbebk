import React from "react";
import { View } from "react-native";
import { Slot, Redirect } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import FloatingTabBar, { TabBarItem } from "@/components/FloatingTabBar";
import { useColors } from "@/hooks/useColors";

function getTabsForRole(role: string): TabBarItem[] {
  const perfilTab: TabBarItem = {
    name: "perfil",
    route: "/(tabs)/(perfil)",
    icon: "account-circle",
    label: "Perfil",
  };

  switch (role) {
    case "garcom":
      return [
        { name: "mesas", route: "/(tabs)/(mesas)", icon: "grid-view", label: "Mesas" },
        { name: "comandas", route: "/(tabs)/(comandas)", icon: "receipt-long", label: "Comandas" },
        { name: "pedidos", route: "/(tabs)/(pedidos)", icon: "list-alt", label: "Pedidos" },
        perfilTab,
      ];
    case "cozinheiro":
      return [
        { name: "cozinha", route: "/(tabs)/(cozinha)", icon: "local-fire-department", label: "Cozinha" },
        { name: "cardapio", route: "/(tabs)/(cardapio)", icon: "restaurant-menu", label: "Cardápio" },
        perfilTab,
      ];
    case "gerente":
    case "administrador":
    case "admin":
      return [
        { name: "dashboard", route: "/(tabs)/(dashboard)", icon: "bar-chart", label: "Dashboard" },
        { name: "mesas", route: "/(tabs)/(mesas)", icon: "grid-view", label: "Mesas" },
        { name: "comandas", route: "/(tabs)/(comandas)", icon: "receipt-long", label: "Comandas" },
        { name: "cardapio", route: "/(tabs)/(cardapio)", icon: "restaurant-menu", label: "Cardápio" },
        { name: "gestao", route: "/(tabs)/(gestao)", icon: "settings", label: "Gestão" },
        perfilTab,
      ];
    default:
      return [
        { name: "mesas", route: "/(tabs)/(mesas)", icon: "grid-view", label: "Mesas" },
        perfilTab,
      ];
  }
}

export default function TabLayout() {
  const { user, loading } = useAuth();
  const COLORS = useColors();

  if (loading) return null;
  if (!user) return <Redirect href="/auth-screen" />;

  const role = user.role || "garcom";
  const tabs = getTabsForRole(role);
  const tabCount = tabs.length;
  const containerWidth = Math.min(60 + tabCount * 72, 420);

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <Slot />
      <FloatingTabBar tabs={tabs} containerWidth={containerWidth} />
    </View>
  );
}
