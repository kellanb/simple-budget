import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>;

export function Checkbox({ className, ...props }: Props) {
  return (
    <CheckboxPrimitive.Root
      className={cn(
        "flex h-5 w-5 items-center justify-center rounded border border-zinc-300 bg-white text-white shadow-sm transition hover:border-zinc-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600 dark:border-zinc-700 dark:bg-zinc-900 dark:data-[state=checked]:border-blue-500 dark:data-[state=checked]:bg-blue-500",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator>
        <Check className="h-3.5 w-3.5 stroke-[3]" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

