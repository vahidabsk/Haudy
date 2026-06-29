import { HTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export function DialogPanel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-lg bg-white p-6 shadow-2xl", className)} {...props} />;
}
