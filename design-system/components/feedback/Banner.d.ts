import * as React from 'react';

export interface BannerProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: 'info' | 'success' | 'danger' | 'warn' | 'neutral';
  icon?: React.ReactNode;
  /** Filled background instead of soft tint. */
  solid?: boolean;
  align?: 'center' | 'left';
  children?: React.ReactNode;
}

/** Status strip used as the headline state on cards and sections. */
export function Banner(props: BannerProps): JSX.Element;
