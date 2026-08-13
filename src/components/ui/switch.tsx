"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

type SwitchProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> & { checked: boolean; onCheckedChange?: (checked: boolean) => void }

const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(({ checked, onCheckedChange, className, disabled, ...props }, ref) => <button type="button" role="switch" aria-checked={checked} data-state={checked ? "checked" : "unchecked"} disabled={disabled} ref={ref} onClick={() => onCheckedChange?.(!checked)} className={cn("inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-transparent bg-muted-foreground/30 p-0.5 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary", className)} {...props}><span aria-hidden="true" data-state={checked ? "checked" : "unchecked"} className="pointer-events-none block size-5 rounded-full bg-foreground shadow-sm transition-transform duration-200 data-[state=checked]:translate-x-5" /></button>)
Switch.displayName = "Switch"

export { Switch }
