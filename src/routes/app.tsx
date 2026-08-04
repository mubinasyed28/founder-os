import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/os/app-shell";

export const Route = createFileRoute("/app")({
  head: () => ({
    meta: [
      { title: "Workspace — Cofoundr OS" },
      { name: "description", content: "Your AI co-founder workspace: health, memory, agents, simulations and decisions." },
      { property: "og:title", content: "Workspace — Cofoundr OS" },
      { property: "og:description", content: "Persistent company memory and a multi-agent decision engine." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AppShell,
});
