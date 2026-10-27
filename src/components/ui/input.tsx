import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { Eye, EyeOff } from "lucide-react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/** Shared text-field look; reused by controls that need their own element (e.g. comboboxes). */
export const inputClassName =
  "h-10 w-full min-w-0 rounded-lg border border-input bg-transparent px-3.5 py-2 text-base transition-colors outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-1 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40"

interface InputProps extends React.ComponentProps<"input"> {
  errorMessage?: string;
  maxLength?: number;
  minLengthHint?: number;
  revealPassword?: boolean;
}

function PasswordVisibilityToggle({ revealed, onToggle }: { revealed: boolean; onToggle: () => void }) {
  const t = useTranslations("Common");
  return <Button type="button" variant="icon" size="icon-lg" className="absolute right-1 top-0.5" aria-label={t(revealed ? "hidePassword" : "showPassword")} aria-pressed={revealed} onClick={onToggle} icon={revealed ? <EyeOff /> : <Eye />} />;
}

function Input({ className, type, errorMessage, maxLength, minLengthHint, onChange, defaultValue, minLength, revealPassword = false, ...props }: InputProps) {
  const errorId = React.useId();
  const [revealed, setRevealed] = React.useState(false);
  const canReveal = type === "password" && revealPassword;
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
      <div className="relative">
      <InputPrimitive
        type={canReveal && revealed ? "text" : type}
        data-slot="input"
        className={cn(inputClassName, canReveal && "pr-12", className)}
        maxLength={maxLength}
        minLength={minLength}
        defaultValue={defaultValue}
        onChange={handleChange}
        {...props}
        aria-invalid={errorMessage ? true : props["aria-invalid"]}
        aria-describedby={
          [props["aria-describedby"], errorMessage ? errorId : undefined].filter(Boolean).join(" ") || undefined
        }
      />
      {canReveal && (
        <PasswordVisibilityToggle revealed={revealed} onToggle={() => setRevealed((value) => !value)} />
      )}
      </div>
      {maxLength !== undefined && (
        <p className={cn("text-xs mt-1 tabular-nums", isBelowMin ? "text-primary" : "text-muted-foreground")}>
          {currentLength} / {maxLength}
          {minLengthHint !== undefined && <> (min {minLengthHint})</>}
        </p>
      )}
      {errorMessage && (
        <p id={errorId} className="text-destructive text-xs mt-1">
          {errorMessage}
        </p>
      )}
    </div>
  )
}

export { Input }
