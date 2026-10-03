import { Badge } from "@krakow-bez-barier/ui";
import { cn } from "@/lib/utils";
import { CalendarBlank, CheckCircle, Clock, MinusCircle } from "@phosphor-icons/react/ssr";

export type ChipStatus = "done" | "inProgress" | "planned" | "notPlanned";

const CHIPS = {
  done: { variant: "secondary", tone: "", Icon: CheckCircle },
  inProgress: { variant: "outline", tone: "border-primary text-primary", Icon: Clock },
  planned: { variant: "outline", tone: "", Icon: CalendarBlank },
  notPlanned: { variant: "outline", tone: "text-muted-foreground", Icon: MinusCircle },
} as const;

/** Status as icon plus text, never colour alone. */
export function StatusChip({ status, label }: { status: ChipStatus; label: string }) {
  const { variant, tone, Icon } = CHIPS[status];
  return (
    <Badge variant={variant} className={cn("h-auto min-h-6 px-2.5 text-caption font-semibold", tone)}>
      <Icon weight="fill" className="size-4!" aria-hidden />
      {label}
    </Badge>
  );
}
