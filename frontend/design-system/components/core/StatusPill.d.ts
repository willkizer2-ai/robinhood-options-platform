import * as React from 'react';

export interface StatusPillProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: 'neutral' | 'up' | 'down' | 'gold' | 'accent';
  /** Show the leading status dot. */
  dot?: boolean;
  /** Animate the dot (blink) for live states. */
  pulse?: boolean;
  children?: React.ReactNode;
}

/** Pill with status dot for market state and live indicators. */
export function StatusPill(props: StatusPillProps): JSX.Element;
