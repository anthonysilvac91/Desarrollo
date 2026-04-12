import React from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = "", error, ...props }, ref) => {
    return (
      <div className="w-full flex flex-col gap-1">
        <input
          ref={ref}
          className={`
            flex h-10 w-full rounded-md border bg-white px-3 py-2 text-sm 
            placeholder:text-gray-400 focus:outline-none focus:ring-2 
            disabled:cursor-not-allowed disabled:opacity-50 transition-shadow
            ${error ? "border-error focus:ring-error/10" : "border-border-theme focus:ring-brand/10 focus:border-brand"}
            ${className}
          `}
          {...props}
        />
        {error && <span className="text-xs text-error font-medium">{error}</span>}
      </div>
    );
  }
);
Input.displayName = "Input";
