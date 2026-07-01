import * as React from 'react';

/**
 * Props for Panel.
 * @startingPoint section="Layout" subtitle="Card / panel container" viewport="700x240"
 */
export interface PanelProps extends React.HTMLAttributes<HTMLElement> {
  eyebrow?: React.ReactNode;
  title?: React.ReactNode;
  /** Right-aligned header slot (buttons, status). */
  action?: React.ReactNode;
  /** Top accent line tone. */
  accent?: 'accent' | 'up' | 'down' | 'gold';
  /** Pad the body (default true). */
  padded?: boolean;
  children?: React.ReactNode;
}

/**
 * Standard surface container — charcoal card, hairline border, optional header.
 */
export function Panel(props: PanelProps): JSX.Element;
