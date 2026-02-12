'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface DragPreview {
  dayKey: string;
  startSlot: number;
  endSlot: number; // exclusive
}

interface UseTimeGridDragOptions {
  selectionMap: Map<string, string>;
  onAdd: (dayKey: string, startSlot: number, endSlot: number) => void;
  onRemove: (id: string) => void;
}

export function useTimeGridDrag({
  selectionMap,
  onAdd,
  onRemove,
}: UseTimeGridDragOptions) {
  const dragStateRef = useRef<{
    dayKey: string;
    startSlot: number;
    currentSlot: number;
  } | null>(null);
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null);

  const onAddRef = useRef(onAdd);
  onAddRef.current = onAdd;

  const handleCellMouseDown = useCallback(
    (dayKey: string, slot: number, e: React.MouseEvent) => {
      e.preventDefault();

      const cellKey = `${dayKey}:${slot}`;
      const candidateId = selectionMap.get(cellKey);
      if (candidateId) {
        onRemove(candidateId);
        return;
      }

      dragStateRef.current = { dayKey, startSlot: slot, currentSlot: slot };
      setDragPreview({ dayKey, startSlot: slot, endSlot: slot + 1 });
    },
    [selectionMap, onRemove]
  );

  const handleCellMouseEnter = useCallback(
    (dayKey: string, slot: number) => {
      if (!dragStateRef.current) return;
      if (dayKey !== dragStateRef.current.dayKey) return;

      dragStateRef.current.currentSlot = slot;
      const s = dragStateRef.current.startSlot;
      const start = Math.min(s, slot);
      const end = Math.max(s, slot) + 1;
      setDragPreview({ dayKey, startSlot: start, endSlot: end });
    },
    []
  );

  useEffect(() => {
    const handleMouseUp = () => {
      const state = dragStateRef.current;
      if (!state) return;

      const start = Math.min(state.startSlot, state.currentSlot);
      const end = Math.max(state.startSlot, state.currentSlot) + 1;

      onAddRef.current(state.dayKey, start, end);

      dragStateRef.current = null;
      setDragPreview(null);
    };

    document.addEventListener('mouseup', handleMouseUp);
    return () => document.removeEventListener('mouseup', handleMouseUp);
  }, []);

  return {
    dragPreview,
    handleCellMouseDown,
    handleCellMouseEnter,
    isDragging: dragPreview !== null,
  };
}
