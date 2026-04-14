"use client";

import { Toaster as SonnerToaster, toast, type ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <SonnerToaster
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-[var(--background)] group-[.toaster]:text-[var(--foreground)] group-[.toaster]:border-[var(--border)] group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-[var(--muted-foreground)]",
          actionButton:
            "group-[.toast]:bg-[var(--primary)] group-[.toast]:text-[var(--primary-foreground)]",
          cancelButton:
            "group-[.toast]:bg-[var(--muted)] group-[.toast]:text-[var(--muted-foreground)]",
          error:
            "group-[.toaster]:border-[var(--destructive)] group-[.toaster]:text-[var(--destructive)]",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
