import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

export function SheetContent({
  className,
  children,
  title,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
  title?: string;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=open]:fade-in" />
      <DialogPrimitive.Content
        aria-describedby={undefined}
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-md rounded-t-3xl border border-zinc-200 bg-white p-4 shadow-xl data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom dark:border-zinc-800 dark:bg-zinc-900",
          className,
        )}
        {...props}
      >
        <div className="mb-2 flex items-center justify-between">
          <DialogPrimitive.Title className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
            {title}
          </DialogPrimitive.Title>
          <DialogPrimitive.Close className="rounded-full p-1 hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:hover:bg-zinc-800">
            <X className="h-5 w-5" />
          </DialogPrimitive.Close>
        </div>
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export const SheetHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("mb-3 space-y-1", className)} {...props} />
);

export const SheetTitle = ({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>) => (
  <DialogPrimitive.Title
    className={cn(
      "text-lg font-semibold leading-none tracking-tight text-zinc-900 dark:text-zinc-50",
      className,
    )}
    {...props}
  />
);

