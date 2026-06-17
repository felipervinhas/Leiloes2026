import React from 'react';
import { Resizable } from 'react-resizable';

export default function ResizableTitle({ onResize, width, ...rest }: any) {
  if (!onResize || !width) return <th {...rest} />;
  return (
    <Resizable
      width={width}
      height={0}
      handle={<span className="react-resizable-handle" onClick={e => e.stopPropagation()} />}
      onResize={onResize}
      draggableOpts={{ enableUserSelectHack: false }}
    >
      <th {...rest} />
    </Resizable>
  );
}
