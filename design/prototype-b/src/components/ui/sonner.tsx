import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CheckCircle, Info, Warning, Prohibit, CircleNotch } from "@phosphor-icons/react"

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      icons={{
        success: <CheckCircle weight="fill" className="size-5" />,
        info: <Info weight="fill" className="size-5" />,
        warning: <Warning weight="fill" className="size-5" />,
        error: <Prohibit weight="fill" className="size-5" />,
        loading: <CircleNotch className="size-5 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--ink)",
          "--normal-text": "var(--ink-foreground)",
          "--normal-border": "transparent",
          "--border-radius": "20px",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
