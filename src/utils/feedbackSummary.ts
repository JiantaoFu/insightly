import type { filterReviews } from './reviewExplorer';

export function summarizeFeedback(rows: ReturnType<typeof filterReviews>, intent: string) {
  const groups = new Map<string, { id: string; name: string; reviews: Set<number>; issues: Map<string, { text: string; reviews: Set<number> }> }>();
  rows.forEach((row, index) => {
    for (const label of row.analysis?.labels || []) {
      if (label.intent !== intent) continue;
      const group = groups.get(label.topic.id) || { id: label.topic.id, name: label.topic.name, reviews: new Set<number>(), issues: new Map() };
      group.reviews.add(index);
      const text = label.issue.trim();
      if (text) {
        const key = text.toLocaleLowerCase();
        const issue = group.issues.get(key) || { text, reviews: new Set<number>() };
        issue.reviews.add(index);
        group.issues.set(key, issue);
      }
      groups.set(group.id, group);
    }
  });
  return [...groups.values()].map(group => ({ id: group.id, name: group.name, count: group.reviews.size,
    issues: [...group.issues.values()].map(issue => ({ text: issue.text, count: issue.reviews.size })).sort((a, b) => b.count - a.count),
  })).sort((a, b) => b.count - a.count);
}
