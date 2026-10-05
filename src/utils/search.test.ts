import { describe, expect, it } from 'vitest';
import { createDefaultData } from '../data/defaultData';
import { searchData } from './search';

describe('search', () => {
  it('finds tasks, topics, subjects and notes', () => {
    const data = createDefaultData();
    data.notes.push({ id: 'n', title: 'HashMap internals', content: 'buckets', category: 'java', date: '2026-10-05', updatedAt: '' });
    const types = new Set(searchData(data, 'hashmap', '2026-10-05').map((r) => r.type));
    expect(types).toEqual(new Set(['Topic', 'Note']));
    expect(searchData(data, 'gym', '2026-10-05')[0]).toMatchObject({ type: 'Repeating task', title: 'Gym' });
    expect(searchData(data, 'subject 9', '2026-10-05')[0]).toMatchObject({ type: 'Subject' });
    expect(searchData(data, 'a', '2026-10-05')).toEqual([]);
  });
});
