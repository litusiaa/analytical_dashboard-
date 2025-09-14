import { Slot } from '@radix-ui/react-slot';
import clsx from 'clsx';
import React from 'react';

type CardProps = React.HTMLAttributes<HTMLDivElement> & { asChild?: boolean };

export function Card({ className, asChild, ...props }: CardProps) {
  const Comp = asChild ? Slot : 'div';
  return (
    <Comp
      className={clsx('rounded-lg border bg-white shadow-sm p-4', className)}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx('mb-2 text-sm font-medium text-gray-500', className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={clsx('text-lg font-semibold text-gray-900', className)} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx('text-gray-900', className)} {...props} />;
}

