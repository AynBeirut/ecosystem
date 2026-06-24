
import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "@/lib/utils"

const TabsContext = React.createContext<{ value: string | null; defaultValue: string | null }>({
  value: null,
  defaultValue: null
})

// Export the provider for use in testing
export const TabsContextProvider = TabsContext.Provider

const Tabs = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Root>
>(({ className, defaultValue, value, ...props }, ref) => {
  // Store the values in context so we can check them in TabsContent
  const contextValue = React.useMemo(() => ({
    value: value || null,
    defaultValue: defaultValue || null
  }), [value, defaultValue]);

  return (
    <TabsContextProvider value={contextValue}>
      <TabsPrimitive.Root
        ref={ref}
        className={cn("", className)}
        defaultValue={defaultValue}
        value={value}
        {...props}
      />
    </TabsContextProvider>
  )
})
Tabs.displayName = TabsPrimitive.Root.displayName

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground",
      className
    )}
    {...props}
  />
))
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm",
      className
    )}
    {...props}
  />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => {
  // Use the context to check if we're inside a Tabs component
  const context = React.useContext(TabsContext)
  
  // If context values are null, we're not inside a Tabs component
  if (context.value === null && context.defaultValue === null) {
    console.warn(
      "TabsContent must be used within a Tabs component. " +
      "Rendering as a regular div instead."
    )
    
    // Return a regular div with the same props and children
    return <div 
      ref={ref as React.RefObject<HTMLDivElement>} 
      className={cn("mt-2", className)} 
      {...props} 
    />;
  }
  
  // Normal rendering when inside Tabs
  return (
    <TabsPrimitive.Content
      ref={ref}
      className={cn(
        "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className
      )}
      {...props}
    />
  )
})
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
