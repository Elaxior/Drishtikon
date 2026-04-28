import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-xl text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-accent text-white shadow-sm hover:-translate-y-0.5 hover:bg-accent-hover hover:shadow-editorial",
        secondary:
          "bg-parchment-dark text-ink hover:-translate-y-0.5 hover:bg-parchment-300 dark:bg-[#1d212a] dark:text-[#eef1f8] dark:hover:bg-[#2a313d]",
        ghost:
          "text-ink-secondary hover:bg-parchment-dark hover:text-ink dark:text-[#adb7c7] dark:hover:bg-[#1d212a] dark:hover:text-[#eef1f8]",
        outline:
          "border border-parchment-300 bg-transparent text-ink-secondary hover:bg-parchment-dark hover:text-ink dark:border-[#2a313d] dark:text-[#adb7c7] dark:hover:bg-[#1d212a] dark:hover:text-[#eef1f8]",
        tertiary:
          "bg-white/70 text-ink hover:bg-white dark:bg-[#161a22] dark:text-[#eef1f8] dark:hover:bg-[#1d212a]",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-lg px-3",
        lg: "h-11 rounded-xl px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
