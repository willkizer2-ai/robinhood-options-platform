import * as React from 'react';

export interface TabItem {
  id?: string;
  label: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
}
export interface TabsProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  tabs: TabItem[];
  value: string;
  onChange?: (id: string) => void;
}

/** Horizontal tab bar with underline indicator and optional count badges. */
export function Tabs(props: TabsProps): JSX.Element;
