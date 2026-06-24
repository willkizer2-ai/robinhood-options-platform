import * as React from 'react';

export interface ConfidenceMeterProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 0–100. */
  value?: number;
  showValue?: boolean;
  width?: number;
  label?: string;
}

/** Confidence score (0–100) with a color-stepped progress bar. */
export function ConfidenceMeter(props: ConfidenceMeterProps): JSX.Element;
