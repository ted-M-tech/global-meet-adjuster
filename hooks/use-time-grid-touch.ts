'use client';

import { useCallback } from 'react';

interface UseTimeGridTouchOptions {
  selectionMap: Map<string, string>;
  duration: number;
  onAdd: (dayKey: string, startSlot: number, endSlot: number) => void;
  onRemove: (id: string) => void;
}

export function useTimeGridTouch({
  selectionMap,
  duration,
  onAdd,
  onRemove,
}: UseTimeGridTouchOptions) {
  const handleCellClick = useCallback(
    (dayKey: string, slot: number) => {
      const cellKey = `${dayKey}:${slot}`;
      const candidateId = selectionMap.get(cellKey);
      if (candidateId) {
        onRemove(candidateId);
        return;
      }

      const durationSlots = Math.ceil(duration / 30);
      const endSlot = Math.min(slot + durationSlots, 48);
      onAdd(dayKey, slot, endSlot);
    },
    [selectionMap, duration, onAdd, onRemove]
  );

  return { handleCellClick };
}
