import * as React from 'react';

/**
 * Props for StatTile.
 * @startingPoint section="Data" subtitle="Dashboard metric tile" viewport="700x180"
 */
export interface StatTileProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: React.ReactNode;
  /** Signed delta, number or string (e.g. -8.1 or "+12.4%"). */
  delta?: React.ReactNode;
  /** Force delta direction; otherwise inferred from sign. */
  deltaDirection?: 'up' | 'down';
  suffix?: React.ReactNode;
  tone?: 'default' | 'up' | 'down' | 'accent';
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Labelled metric tile with a large mono value and optional signed delta.
 */
export function StatTile(props: StatTileProps): JSX.Element;
