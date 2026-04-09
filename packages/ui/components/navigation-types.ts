import type { LucideIcon } from "lucide-react";

export interface NavigationItem {
  /** Machine-readable key for identifying the active item */
  key: string;
  /** Human-visible label (PT-BR in consumer apps) */
  label: string;
  /** Target URL path */
  href: string;
  /** Default icon component from lucide-react */
  icon: LucideIcon;
  /** Icon shown when this item is active (falls back to icon if omitted) */
  activeIcon?: LucideIcon;
}
