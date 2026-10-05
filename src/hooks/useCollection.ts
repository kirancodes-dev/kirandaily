import { useCallback } from 'react';
import type { AppData } from '../types/app';
import { useAppData } from './useAppData';
import { uid } from '../utils/id';

type CollectionKey = 'projects' | 'goals' | 'notes';
type Item<K extends CollectionKey> = AppData[K][number];

/** Add / update / remove for simple id-based lists. */
export function useCollection<K extends CollectionKey>(key: K) {
  const { data, update } = useAppData();
  const items = data[key] as Item<K>[];
  const add = useCallback(
    (item: Omit<Item<K>, 'id'>) => update((d) => ({ ...d, [key]: [...d[key], { ...item, id: uid(key.slice(0, -1)) }] })),
    [update, key],
  );
  const save = useCallback(
    (item: Item<K>) => update((d) => ({ ...d, [key]: (d[key] as Item<K>[]).map((x) => (x.id === item.id ? item : x)) })),
    [update, key],
  );
  const remove = useCallback(
    (id: string) => update((d) => ({ ...d, [key]: (d[key] as Item<K>[]).filter((x) => x.id !== id) })),
    [update, key],
  );
  return { items, add, save, remove };
}
