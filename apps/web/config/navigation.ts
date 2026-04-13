import {
  Radar,
  CalendarDays,
  Route,
  UserCircle,
  MoreHorizontal,
} from "lucide-react";
import type { NavigationItem } from "@metanoia/ui";

export const navigationItems: NavigationItem[] = [
  { key: "radar", label: "Radar", href: "/app/gestao/radar", icon: Radar },
  {
    key: "reunioes",
    label: "Reuniões",
    href: "/app/gestao/reunioes",
    icon: CalendarDays,
  },
  {
    key: "trilhas",
    label: "Trilhas",
    href: "/app/gestao/trilhas",
    icon: Route,
  },
  { key: "perfil", label: "Perfil", href: "/app/perfil", icon: UserCircle },
  { key: "mais", label: "Mais", href: "/app/mais", icon: MoreHorizontal },
];
