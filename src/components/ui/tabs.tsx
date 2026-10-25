import * as React from "react"
import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"
import { cva } from "class-variance-authority"

import { cn } from "@/lib/utils"

const listVariants = cva(
  "flex flex-wrap gap-2 sm:gap-6 border-b border-sand rounded-none bg-transparent p-0",
  {
    variants: {
      orientation: {
        horizontal: "flex-row",
        vertical: "flex-col",
      },
    },
    defaultVariants: {
      orientation: "horizontal",
    },
  }
)

const tabVariants = cva(
  "min-h-11 pb-2.5 px-1 rounded-none bg-transparent shadow-none text-sm font-medium text-muted-foreground hover:text-deep transition-all border-b-2 border-transparent data-[active]:text-gold data-[active]:border-gold data-[active]:bg-transparent data-[active]:shadow-none",
  {
    variants: {},
    defaultVariants: {},
  }
)

function TabsRoot({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs-root"
      className={className}
      {...props}
    />
  )
}

function TabsList({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(listVariants({}), className)}
      {...props}
    />
  )
}

function TabsTab({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof TabsPrimitive.Tab>) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-tab"
      className={cn(tabVariants({}), className)}
      {...props}
    />
  )
}

function TabsPanel({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof TabsPrimitive.Panel>) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-panel"
      className={cn("mt-4 outline-none", className)}
      {...props}
    />
  )
}

export { TabsRoot, TabsList, TabsTab, TabsPanel }
