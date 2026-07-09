import Link from 'next/link';
import type { ComponentProps } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

const BASE_CLASSES =
  'inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-symbolic-accent focus-visible:ring-offset-2 focus-visible:ring-offset-symbolic-bg disabled:cursor-not-allowed disabled:opacity-50';

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-symbolic-accent text-symbolic-bg hover:opacity-90',
  secondary:
    'border border-symbolic-border bg-symbolic-surface text-symbolic-text hover:border-symbolic-accent',
  ghost: 'text-symbolic-muted hover:text-symbolic-text',
  danger: 'bg-symbolic-danger text-symbolic-bg hover:opacity-90',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'px-4 py-2 text-sm',
  md: 'px-5 py-2.5 text-sm',
  lg: 'px-6 py-3 text-base',
};

function buttonClasses(options: {
  variant: ButtonVariant;
  size: ButtonSize;
  className?: string;
}) {
  return [
    BASE_CLASSES,
    VARIANT_CLASSES[options.variant],
    SIZE_CLASSES[options.size],
    options.className,
  ]
    .filter(Boolean)
    .join(' ');
}

type ButtonProps = ComponentProps<'button'> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function Button(props: ButtonProps) {
  // Destructure only to separate the styling props from the forwarded rest;
  // values are read via `props` per the project convention.
  const {
    variant: _variant,
    size: _size,
    className: _className,
    ...rest
  } = props;

  return (
    // Defaults to a non-submitting button; a caller-provided `type` in `rest`
    // overrides this literal.
    <button
      type="button"
      className={buttonClasses({
        variant: props.variant ?? 'secondary',
        size: props.size ?? 'md',
        className: props.className,
      })}
      {...rest}
    />
  );
}

type ButtonLinkProps = ComponentProps<typeof Link> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function ButtonLink(props: ButtonLinkProps) {
  const {
    variant: _variant,
    size: _size,
    className: _className,
    ...rest
  } = props;

  return (
    <Link
      className={buttonClasses({
        variant: props.variant ?? 'secondary',
        size: props.size ?? 'md',
        className: props.className,
      })}
      {...rest}
    />
  );
}
