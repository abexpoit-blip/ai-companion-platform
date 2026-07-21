import { createFileRoute } from "@tanstack/react-router";
import { ChatWorkspace } from "@/components/ChatWorkspace";

export const Route = createFileRoute("/")({
  component: ChatWorkspace,
  head: () => ({
    meta: [
      { title: "CodeAxis Studio AI — Chat Workspace" },
      { name: "description", content: "A sleek AI chat workspace by CodeAxis Studio." },
      { property: "og:title", content: "CodeAxis Studio AI" },
      { property: "og:description", content: "A sleek AI chat workspace by CodeAxis Studio." },
    ],
  }),
});
