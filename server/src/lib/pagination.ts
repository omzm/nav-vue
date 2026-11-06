import type { SupabaseClient } from '@supabase/supabase-js';

/** Explicit ranges avoid PostgREST's default row cap. Stable tie-breakers avoid duplicates. */
export async function readAllRows<T>(
  client: SupabaseClient,
  table: string,
  columns = '*',
): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ;) {
    const { data, error, count } = await client
      .from(table)
      .select(columns, { count: 'exact' })
      .order('order', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + 499);
    if (error) throw error;
    if (!data?.length) {
      if (count !== null && offset < count) throw new Error('数据分页不完整');
      break;
    }
    rows.push(...(data as T[]));
    offset += data.length;
    if (count !== null && offset >= count) break;
    if (rows.length > 100000) throw new Error('数据量过大，请缩小查询范围');
  }
  return rows;
}
