import type { PluginClientContext } from "@getpaseo/plugin/client";

// Palette from the "Retro" Terminal.app profile (Downloads/Retro.terminal):
// Colors are sampled from how that profile actually renders: its translucent, blurred
// window turns the near-black background into graphite and the neon text into soft mint.
export default function contribute(client: PluginClientContext) {
  client.addTheme({
    id: "retro-phosphor",
    name: "Retro Phosphor",
    appearance: "dark",
    colors: {
      background: "#111412",
      foreground: "#7af687",
      raised: "#171b18",
      control: "#1f2420",
      border: "#1d221e",
      accent: "#7af687",
      mutedForeground: "#5fae6b",
      ring: "#4a6b52",
    },
  });
  return () => {};
}
