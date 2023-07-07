export interface FuzzyMatchResult<T> {
  item: T;
  score: number;
}

export const fuzzyMatch = <T extends { name?: string; id: string }>(
  query: string,
  list: T[]
): FuzzyMatchResult<T>[] => {
  const results: FuzzyMatchResult<T>[] = [];

  list.forEach((item) => {
    let score = 0;
    const _search = item.name || item.id;
    const itemArr = _search.toLowerCase().split("");
    const queryArr = query.toLowerCase().split("");

    for (let i = 0; i < itemArr.length; i++) {
      if (itemArr[i] === queryArr[score]) {
        score++;
      }
    }

    if (score === queryArr.length) {
      results.push({ item, score });
    }
  });

  results.sort((a, b) => b.score - a.score);

  return results;
};
