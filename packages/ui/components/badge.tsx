import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/utils';

const badgeVariants = cva(
  'inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-xs font-semibold motion-safe:transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--ring)] focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[var(--primary)]/80',
        destructive:
          'border-transparent bg-[var(--destructive)] text-[var(--destructive-foreground)] hover:bg-[var(--destructive)]/80',
        outline: 'text-[var(--foreground)]',
        secondary:
          'border-transparent bg-[var(--secondary)] text-[var(--secondary-foreground)] hover:bg-[var(--secondary)]/80',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
