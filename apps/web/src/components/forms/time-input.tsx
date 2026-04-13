import * as React from "react";
import { Input, cn } from "@metanoia/ui";

interface TimeInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  /** HH:mm 24h. Empty string means "not set". */
  value: string;
  onValueChange: (value: string) => void;
}

/**
 * Thin wrapper around <Input type="time"> for spec 05.5.
 * Kept as a named component to centralize future touches (masks,
 * clock-picker fallback for older browsers, etc.).
 */
export const TimeInput = React.forwardRef<HTMLInputElement, TimeInputProps>(
  function TimeInput(
    { value, onValueChange, className, onChange, ...props },
    ref,
  ) {
    return (
      <Input
        {...props}
        ref={ref}
        type="time"
        value={value}
        onChange={(event) => {
          onValueChange(event.target.value);
          onChange?.(event);
        }}
        className={cn(className)}
      />
    );
  },
);
