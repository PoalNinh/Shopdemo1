import * as React from "react"
import { cn } from "../../lib/utils"

const DatePicker = React.forwardRef(({ className, ...props }, ref) => {
  return (
    <input
      type="date"
      ref={ref}
      className={cn(
        "flex h-10 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-950 disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
})

DatePicker.displayName = "DatePicker"

export { DatePicker }