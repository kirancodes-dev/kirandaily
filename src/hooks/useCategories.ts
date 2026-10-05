import { useCallback, useMemo } from 'react';
import { useAppData } from './useAppData';
import type { CategoryDef } from '../types/task';

const FALLBACK: CategoryDef = { id: 'other', label: 'Other', isStudy: true, builtIn: true, color: 'slate' };

export function useCategories() {
  const { data } = useAppData();
  const map = useMemo(() => new Map(data.categories.map((c) => [c.id, c])), [data.categories]);
  const get = useCallback((id: string): CategoryDef => map.get(id) ?? { ...FALLBACK, id, label: id }, [map]);
  const studyCategories = useMemo(() => data.categories.filter((c) => c.isStudy), [data.categories]);
  return { categories: data.categories, studyCategories, get };
}

export function useSubjectName() {
  const { data } = useAppData();
  const map = useMemo(() => new Map(data.subjects.map((s) => [s.id, s.name])), [data.subjects]);
  return useCallback((id?: string) => (id ? map.get(id) : undefined), [map]);
}
