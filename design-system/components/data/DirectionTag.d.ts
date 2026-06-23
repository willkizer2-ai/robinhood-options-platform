import * as React from 'react';

export interface DirectionTagProps extends React.HTMLAttributes<HTMLSpanElement> {
  direction?: 'CALL' | 'PUT' | string;
  size?: 'sm' | 'md';
}

/** CALL/PUT chip with directional caret — teal for CALL, magenta for PUT. */
export function DirectionTag(props: DirectionTagProps): JSX.Element;
