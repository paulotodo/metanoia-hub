"use client";

import { Radar, CalendarDays, Route, BarChart3 } from "lucide-react";
import type { NavigationItem } from "@metanoia/ui";

// Leader (gestao) navigation. Every href must resolve to a real route under
// app/(authenticated)/app/gestao to avoid RSC prefetch 404s. The previous
// entries (/app/gestao/trilhas, /app/perfil, /app/mais) had no matching page.
export const navigationItems: NavigationItem[] = [
  { key: "radar", label: "Radar", href: "/app/gestao/radar", icon: Radar },
  {
    key: "reunioes",
    label: "Reuniões",
    href: "/app/gestao/reunioes",
    icon: CalendarDays,
  },
  {
    key: "relatorios",
    label: "Relatórios",
    href: "/app/gestao/relatorios/lider",
    icon: BarChart3,
  },
  {
    key: "trilhas",
    label: "Trilhas",
    href: "/app/gestao/relatorios/trilhas",
    icon: Route,
  },
];
