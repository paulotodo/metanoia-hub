import {
  Radar,
  CalendarDays,
  Route,
  UserCircle,
  MoreHorizontal,
} from "lucide-react";
import type { NavigationItem } from "@metanoia/ui";

export const navigationItems: NavigationItem[] = [
  { key: "radar", label: "Radar", href: "/radar", icon: Radar },
  { key: "reunioes", label: "Reuniões", href: "/reunioes", icon: CalendarDays },
  { key: "trilhas", label: "Trilhas", href: "/trilhas", icon: Route },
  { key: "perfil", label: "Perfil", href: "/perfil", icon: UserCircle },
  { key: "mais", label: "Mais", href: "/mais", icon: MoreHorizontal },
];
