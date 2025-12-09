import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";
import { cn } from "@/lib/utils";

type Props = React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root>;

export function ScrollArea({ className, children, ...props }: Props) {
  return (
    <ScrollAreaPrimitive.Root
      className={cn("relative overflow-hidden", className)}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit]">
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollAreaPrimitive.Scrollbar
        className="flex touch-none select-none rounded-full bg-zinc-200 p-0.5 dark:bg-zinc-800"
        orientation="vertical"
      >
        <ScrollAreaPrimitive.Thumb className="relative flex-1 rounded-full bg-zinc-400 dark:bg-zinc-600" />
      </ScrollAreaPrimitive.Scrollbar>
    </ScrollAreaPrimitive.Root>
  );
}

