import { forwardRef } from "react"
import { Link } from "@/i18n/navigation"
import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 cursor-pointer items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      // NOTE: `size` is declared BEFORE `variant` on purpose. cva emits classes
      // in definition order and `cn` (tailwind-merge) keeps the last conflicting
      // class — so pill variants (`rounded-full` on default/outline-deep) must
      // come after the size-level radius tweaks to win at every size.
      size: {
        default:
          "h-10 gap-1.5 px-4 text-base has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1 rounded-[min(var(--radius-md),12px)] px-3 text-sm in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-11 gap-1.5 px-5 text-base has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        xl: "h-12 gap-2 px-6 text-lg",
        xxl: "h-14 gap-2.5 px-8 text-xl",
        hero: "h-auto px-8 py-3 text-lg",
        icon: "size-8 [&_svg:not([class*='size-'])]:size-[18px]",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-9 [&_svg:not([class*='size-'])]:size-5",
      },
      variant: {
        default:
          "rounded-full bg-saffron text-white font-semibold shadow-[0_2px_8px_rgba(200,116,39,0.24)] hover:bg-saffron-dark hover:shadow-[0_3px_10px_rgba(200,116,39,0.28)] active:bg-saffron-dark",
        gold: "bg-gold hover:bg-gold-light text-deep font-medium",
        outline:
          "rounded-full border-border bg-background hover:bg-sand/40 hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        "outline-deep":
          "rounded-full border-[1.5px] border-brass/50 text-deep font-semibold hover:border-brass hover:bg-sand/40",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        icon:
          "text-deep/40 hover:bg-sand/40 hover:text-gold aria-expanded:bg-sand/40 aria-expanded:text-gold",
        "icon-destructive":
          "text-deep/40 hover:bg-destructive/10 hover:text-destructive aria-expanded:bg-destructive/10 aria-expanded:text-destructive",
        "icon-light":
          "text-white/70 hover:bg-white/10 hover:text-white aria-expanded:bg-white/10 aria-expanded:text-white",
        destructive:
          "rounded-full bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        link: "text-primary underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

interface ButtonProps
  extends React.ComponentProps<"button">,
    VariantProps<typeof buttonVariants> {
  href?: string
  icon?: React.ReactNode
  iconPosition?: "start" | "end"
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({
    children,
    className,
    icon,
    iconPosition = "start",
    variant,
    size,
    href,
    ...props
  }, ref) => {
    const iconOnly = !!icon && !children
    const classes = cn(buttonVariants({
      variant: variant ?? (iconOnly ? "icon" : "default"),
      size: size ?? (iconOnly ? "icon" : "default"),
      className,
    }))
    const iconNode = icon ? (
      <span
        data-icon={iconOnly ? "only" : iconPosition === "start" ? "inline-start" : "inline-end"}
        aria-hidden="true"
        className="contents"
      >
        {icon}
      </span>
    ) : null
    const content = iconPosition === "end" ? (
      <>
        {children}
        {iconNode}
      </>
    ) : (
      <>
        {iconNode}
        {children}
      </>
    )

    if (href) {
      return (
        <Link href={href} className={classes} {...(props as Omit<React.ComponentProps<typeof Link>, "href">)}>
          {content}
        </Link>
      )
    }

    return (
      <ButtonPrimitive
        ref={ref}
        data-slot="button"
        className={classes}
        {...props}
      >
        {content}
      </ButtonPrimitive>
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
