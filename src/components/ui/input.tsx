import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

interface InputProps extends React.ComponentProps<"input"> {
  errorMessage?: string;
  maxLength?: number;
  minLengthHint?: number;
}

function Input({ className, type, errorMessage, maxLength, minLengthHint, onChange, defaultValue, minLength, ...props }: InputProps) {
  const [internalValue, setInternalValue] = React.useState(
    defaultValue?.toString() ?? ""
  );

  const value = props.value !== undefined ? props.value : internalValue;
  const currentLength = String(value).length;

  const isBelowMin = minLengthHint !== undefined && currentLength > 0 && currentLength < minLengthHint;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (props.value === undefined) {
      setInternalValue(e.target.value);
    }
    onChange?.(e);
  };

  return (
    <div>
      <InputPrimitive
        type={type}
        data-slot="input"
        className={cn(
          "h-10 w-full min-w-0 rounded-lg border border-input bg-transparent px-3.5 py-2 text-base transition-colors outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-[#999] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
          className
        )}
        maxLength={maxLength}
        minLength={minLength}
        defaultValue={defaultValue}
        onChange={handleChange}
        {...props}
      />
      {maxLength !== undefined && (
        <p className={cn("text-xs mt-1 tabular-nums", isBelowMin ? "text-amber-600" : "text-deep/50")}>
          {currentLength} / {maxLength}
          {minLengthHint !== undefined && <> (min {minLengthHint})</>}
        </p>
      )}
      {errorMessage && <p className="text-red-500 text-xs mt-1">{errorMessage}</p>}
    </div>
  )
}

export { Input }
