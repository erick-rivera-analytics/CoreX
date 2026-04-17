import type { KeyboardEvent, ReactNode, HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type ClickableTableRowProps = Omit<HTMLAttributes<HTMLTableRowElement>, "children"> & {
  children: ReactNode;
  isClickable?: boolean;
  onSelect?: () => void;
};

export function ClickableTableRow({
  children,
  isClickable = true,
  onSelect,
  className,
  ...props
}: ClickableTableRowProps) {
  const interactive = isClickable && typeof onSelect === "function";

  function handleKeyDown(event: KeyboardEvent<HTMLTableRowElement>) {
    if (!interactive) {
      props.onKeyDown?.(event);
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect();
      return;
    }

    props.onKeyDown?.(event);
  }

  return (
    <tr
      {...props}
      role={interactive ? "button" : props.role}
      tabIndex={interactive ? 0 : props.tabIndex}
      onClick={interactive ? () => onSelect() : props.onClick}
      onKeyDown={handleKeyDown}
      className={cn(
        interactive && "group cursor-pointer transition-colors hover:bg-primary/6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
        className,
      )}
    >
      {children}
    </tr>
  );
}
