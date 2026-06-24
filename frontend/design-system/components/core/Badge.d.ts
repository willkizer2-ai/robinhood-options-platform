import * as React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Semantic color. */
  tone?: 'neutral' | 'accent' | 'up' | 'down' | 'gold';
  /** Fill weight. */
  variant?: 'soft' | 'solid' | 'outline';
  size?: 'sm' | 'md';
  /** Optional leading icon node. */
  icon?: React.ReactNode;
  children?: React.ReactNode;
}

/**
 * Compact uppercase status / category label.
 * @startingPoint section="Core" subtitle="Status & category badges" viewport="700x150"
 */
export function Badge(props: BadgeProps): JSX.Element;
