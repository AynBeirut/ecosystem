export type RankedSearchOption = {
  value: string;
  label: string;
  keywords?: string;
};

/** Lower rank = closer match. Names that start with the query come first. Ids are not searched. */
export function searchRank(option: RankedSearchOption, query: string): number | null {
  const label = option.label.toLowerCase();
  const keywords = (option.keywords || '').toLowerCase();
  const words = `${label} ${keywords}`.split(/[^a-z0-9]+/).filter(Boolean);
  if (label.startsWith(query) || words.some((word) => word.startsWith(query))) return 0;
  if (label.includes(query) || keywords.includes(query)) return 1;
  return null;
}

export function rankSearchOptions<T extends RankedSearchOption>(options: T[], query: string, limit = 40): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return options;
  return options
    .map((option, index) => ({ option, index, rank: searchRank(option, q) }))
    .filter((row): row is { option: T; index: number; rank: number } => row.rank !== null)
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .slice(0, limit)
    .map((row) => row.option);
}
