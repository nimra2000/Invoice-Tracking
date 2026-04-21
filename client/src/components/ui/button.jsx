import { forwardRef } from 'react';

const Button = forwardRef(({ className = '', variant, size, ...props }, ref) => {
  const baseStyles = 'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50';

  const variantStyles =
    variant === 'ghost'
      ? 'hover:bg-slate-100'
      : variant === 'outline'
      ? 'border border-slate-200 bg-white hover:bg-slate-50 text-slate-900'
      : variant === 'destructive'
      ? 'bg-red-600 text-white hover:bg-red-700'
      : 'bg-slate-900 text-white shadow hover:bg-slate-800';

  const sizeStyles = size === 'icon' ? 'h-9 w-9' : size === 'sm' ? 'h-8 px-3 text-xs' : 'h-9 px-4 py-2';

  return (
    <button
      ref={ref}
      className={`${baseStyles} ${variantStyles} ${sizeStyles} ${className}`}
      {...props}
    />
  );
});

Button.displayName = 'Button';

export { Button };
