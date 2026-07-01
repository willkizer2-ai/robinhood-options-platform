import * as React from 'react';

/**
 * Props for the Web Trace action button.
 * @startingPoint section="Core" subtitle="Brand action button — 5 variants, 3 sizes" viewport="700x180"
 */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual style. `primary` = periwinkle accent, `danger` = magenta down-tone. */
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
  /** Control size. `md` and up keep a comfortable hit target. */
  size?: 'sm' | 'md' | 'lg';
  /** Icon node rendered before the label. */
  leftIcon?: React.ReactNode;
  /** Icon node rendered after the label. */
  rightIcon?: React.ReactNode;
  /** Stretch to fill the container width. */
  fullWidth?: boolean;
  children?: React.ReactNode;
}

/**
 * Primary action control for Web Trace.
 */
export function Button(props: ButtonProps): JSX.Element;
