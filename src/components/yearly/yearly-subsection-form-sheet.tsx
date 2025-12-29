"use client";

import { useState, useEffect } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { YearlySubsection, SubsectionFormValues } from "./types";

type YearlySubsectionFormSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: SubsectionFormValues) => Promise<void>;
  onDelete?: () => Promise<void>;
  subsection: YearlySubsection | null;
};

export function YearlySubsectionFormSheet({
  open,
  onOpenChange,
  onSubmit,
  onDelete,
  subsection,
}: YearlySubsectionFormSheetProps) {
  const [title, setTitle] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when subsection changes
  useEffect(() => {
    if (open) {
      setTitle(subsection?.title ?? "");
    }
  }, [open, subsection]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    try {
      await onSubmit({ title: title.trim() });
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    
    // Confirm deletion (subsections cascade delete items)
    const confirmed = window.confirm(
      "Delete this subsection? All items in this subsection will also be deleted."
    );
    if (!confirmed) return;

    setIsSubmitting(true);
    try {
      await onDelete();
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isEditing = subsection !== null;
  const formTitle = isEditing ? "Edit Subsection" : "Add Subsection";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent title={formTitle}>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1">
            <label className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
              Subsection Title
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Non-Discretionary, Quarterly Bills"
              required
              autoFocus
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between gap-2 pt-2">
            {onDelete && (
              <Button
                type="button"
                variant="outline"
                className="text-rose-600 hover:bg-rose-50"
                onClick={handleDelete}
                disabled={isSubmitting}
              >
                Delete
              </Button>
            )}
            <Button
              type="submit"
              className="ml-auto"
              disabled={!title.trim() || isSubmitting}
            >
              {isSubmitting ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

