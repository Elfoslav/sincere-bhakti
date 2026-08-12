"use client";

import { useEffect, useRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const textareaVariants = cva(
  "flex w-full rounded-lg border border-input bg-background text-foreground outline-none transition-[border-color,box-shadow,background-color] placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-4 aria-invalid:ring-destructive/15 focus-visible:border-ring focus-visible:bg-card focus-visible:ring-4 focus-visible:ring-ring/25 dark:bg-input/30 dark:disabled:bg-input/80",
  {
    variants: {
      size: {
        // Compact field for forms (radius matches Input). text-base on mobile
        // (>=16px) prevents the iOS auto-zoom on focus; md:text-sm keeps
        // desktop forms tight.
        default: "min-h-20 resize-y px-3.5 py-2.5 text-base md:text-sm",
        // Modern post composer: generous padding + min-height, softer corners,
        // relaxed leading, no manual resizer (auto-grows). The mobile variant
        // is shorter with touch-friendly text-base; desktop gets extra room.
        compose:
          "min-h-28 resize-none rounded-xl px-4 py-3.5 text-base leading-relaxed shadow-sm md:min-h-40 md:px-5 md:py-4",
      },
    },
    defaultVariants: {
      size: "default",
    },
  },
)

interface TextareaProps
  extends React.ComponentProps<"textarea">,
    VariantProps<typeof textareaVariants> {
  /** Grow the field to fit its content instead of showing a scrollbar. */
  autoResize?: boolean
  /** Upper bound in px for auto-grow; taller content scrolls. Ignored without autoResize. */
  maxHeight?: number
}

function Textarea({ className, size, autoResize = false, maxHeight, onChange, ...props }: TextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null)

  // Keep the height in sync when the value changes programmatically (initial
  // render, form reset after submit) — onChange below handles typing.
  useEffect(() => {
    if (!autoResize || !ref.current) return
    const el = ref.current
    el.style.height = "auto"
    el.style.height = `${el.scrollHeight}px`
  }, [autoResize, props.value])

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    if (autoResize) {
      const el = e.currentTarget
      el.style.height = "auto"
      const height = maxHeight ? Math.min(el.scrollHeight, maxHeight) : el.scrollHeight
      el.style.height = `${height}px`
    }
    onChange?.(e)
  }

  const style: React.CSSProperties | undefined = autoResize
    ? { ...(maxHeight ? { maxHeight, overflowY: "auto" as const } : { overflow: "hidden" as const }) }
    : undefined

  return (
    <textarea
      ref={ref}
      data-slot="textarea"
      className={cn(textareaVariants({ size, className }))}
      style={style}
      onChange={handleChange}
      {...props}
    />
  )
}

export { Textarea }
