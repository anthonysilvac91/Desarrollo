import React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = "", variant = "primary", ...props }, ref) => {
    const baseClasses =
      "inline-flex items-center justify-center rounded-md text-sm font-medium focus:outline-none disabled:opacity-50 disabled:pointer-events-none transition-colors px-4 py-2";

    const variants = {
      primary: "bg-brand text-white hover:bg-brand/90 shadow-md shadow-brand/20",
      secondary: "bg-surface text-title border border-border-theme hover:bg-app-bg transition-all",
      danger: "bg-error text-white hover:bg-error/90 shadow-md shadow-error/20",
      ghost: "hover:bg-app-bg hover:text-brand bg-transparent transition-all",
    };

    return (
      <button
        ref={ref}
        className={`${baseClasses} ${variants[variant]} ${className}`}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
