export interface FuzzyMatchResult<T> {
  item: T
  score: number
}

export const removeScore = <T>(result: FuzzyMatchResult<T>): T => result.item

export const fuzzyMatch = <T extends { id: string; name?: string }>(
  query: string,
  list: T[],
): FuzzyMatchResult<T>[] => {
  const results: FuzzyMatchResult<T>[] = []

  list.forEach((item) => {
    let score = 0
    const _search = item.name || item.id
    const itemArr = _search.toLowerCase().split('')
    const queryArr = query.toLowerCase().split('')

    for (const element of itemArr) {
      if (element === queryArr[score]) {
        score++
      }
    }

    if (score === queryArr.length) {
      results.push({ item, score })
    }
  })

  results.sort((a, b) => b.score - a.score)

  return results
}
