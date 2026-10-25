import type { filterReviews } from './reviewExplorer';
import type { OpportunityEvidence } from './marketOpportunities';

export function buildProblems(rows: ReturnType<typeof filterReviews>) {
  const groups = new Map<string, { id: string; title: string; topic: string; topicId: string; intent: string; rows: typeof rows; quotes: string[] }>();
  rows.forEach(row => {
    for (const label of row.analysis?.labels || []) {
      if (!['complaint', 'request'].includes(label.intent) || !label.issue.trim()) continue;
      const id = JSON.stringify([row.app.id, label.topic.id, label.intent, label.issue.trim().toLowerCase()]);
      const group = groups.get(id) || { id, title: label.issue.trim(), topic: label.topic.name, topicId: label.topic.id, intent: label.intent, rows: [], quotes: [] };
      if (!group.rows.includes(row)) group.rows.push(row);
      if (label.evidence && !group.quotes.includes(label.evidence)) group.quotes.push(label.evidence);
      groups.set(id, group);
    }
  });
  return [...groups.values()].sort((a, b) => b.rows.length - a.rows.length || a.title.localeCompare(b.title));
}

export function problemHasEvidence(problem: ReturnType<typeof buildProblems>[number], evidence: OpportunityEvidence[]) {
  return evidence.some(ref => ref.topic === problem.topic && ref.intent === problem.intent && problem.rows.some(row =>
    row.app.id === ref.appId && row.analysis?.labels.some(label => label.topic.id === problem.topicId && label.intent === problem.intent && label.issue.trim().toLowerCase() === problem.title.toLowerCase() && label.evidence === ref.quote)
  ));
}

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
