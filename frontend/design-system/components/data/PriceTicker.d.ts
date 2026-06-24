import * as React from 'react';

export interface PriceTickerProps extends React.HTMLAttributes<HTMLDivElement> {
  ticker?: string;
  price: number | string;
  change?: number | string;
  changePct?: number | string;
  /** Show a blinking live dot beside the ticker. */
  live?: boolean;
  align?: 'left' | 'right';
}

/** Symbol + live price + signed change, tabular mono with teal/magenta change. */
export function PriceTicker(props: PriceTickerProps): JSX.Element;
