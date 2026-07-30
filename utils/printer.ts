import { Platform, Alert } from "react-native";

let ThermalPrinterModule: any = null;

export async function loadPrinterModule() {
  try {
    ThermalPrinterModule = require("react-native-thermal-printer").default;
  } catch (e) {
    console.log("Módulo de impressora não disponível");
  }
}

export async function printBluetooth(payload: string): Promise<boolean> {
  await loadPrinterModule();
  if (!ThermalPrinterModule) {
    Alert.alert("Impressora", "Módulo de impressora não disponível. Use um build de desenvolvimento.");
    return false;
  }
  try {
    await ThermalPrinterModule.printBluetooth({ payload, printerWidthMM: 58 });
    return true;
  } catch (err: any) {
    if (err?.message?.includes("No bluetooth device")) {
      Alert.alert("Impressora", "Nenhuma impressora Bluetooth pareada. Pareie uma impressora nas configurações do celular.");
    } else {
      Alert.alert("Erro de impressão", err?.message || "Erro desconhecido");
    }
    return false;
  }
}

export function formatReceipt(params: { restaurante?: string; mesa?: number | string; itens: Array<{ quantidade: number; nome: string; preco: number }>; subtotal: number; gorjeta: number; total: number; }): string {
  const lines: string[] = [];
  const w = 32;
  const center = (text: string) => { const pad = Math.max(0, Math.floor((w - text.length) / 2)); return " ".repeat(pad) + text; };
  const line = () => "━".repeat(w);
  const row = (left: string, right: string) => { const space = Math.max(1, w - left.length - right.length); return left + " ".repeat(space) + right; };

  lines.push(center(params.restaurante || "Cozinha Fast Pro"));
  lines.push(center("CONFERÊNCIA DE CONTA"));
  if (params.mesa) lines.push(center("Mesa " + params.mesa));
  lines.push(line());

  for (const item of params.itens) {
    lines.push(row(item.quantidade + "x " + item.nome.slice(0, 20), "R$ " + item.preco.toFixed(2)));
  }

  lines.push(line());
  lines.push(row("Subtotal:", "R$ " + params.subtotal.toFixed(2)));
  if (params.gorjeta > 0) lines.push(row("Gorjeta:", "R$ " + params.gorjeta.toFixed(2)));
  lines.push(row("TOTAL:", "R$ " + params.total.toFixed(2)));
  lines.push(line());
  lines.push(center(new Date().toLocaleString("pt-BR")));
  lines.push("");
  lines.push("");
  lines.push("");

  return lines.join("\n");
}
