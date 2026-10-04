import { useState, type ReactNode } from 'react';
import { Download, Save, Target } from 'lucide-react';
import { ModelTopic, normalizeResearchContext, researchBriefMarkdown, ResearchBrief, ResearchContext } from '../utils/marketIntelligence';
import { downloadFile } from '../utils/download';

export const ResearchQuestionEditor = ({ context, topics, onSave }: { context: ResearchContext; topics: ModelTopic[]; onSave: (next: ResearchContext) => void }) => {
  const [draft, setDraft] = useState(context);
  const changed = JSON.stringify(draft) !== JSON.stringify(context);
  return <section className="py-5 border-b border-gray-200">
    <details>
      <summary className="cursor-pointer text-sm font-semibold text-gray-900"><Target className="inline w-4 h-4 mr-2 text-teal-700" />Product question <span className="ml-2 font-normal text-gray-500">{context.question ? 'Saved' : 'Not set'}</span></summary>
      <form className="mt-4" onSubmit={event => { event.preventDefault(); const normalized = normalizeResearchContext(draft); setDraft(normalized); onSave(normalized); }}>
        <div className="grid md:grid-cols-2 gap-4">
          <label className="block text-sm font-medium text-gray-700">Your product
            <textarea aria-label="Your product" rows={2} maxLength={600} value={draft.product} onChange={event => setDraft({ ...draft, product: event.target.value })} placeholder="A photo backup app for families" className="block mt-2 w-full border border-gray-300 rounded p-2 text-sm font-normal resize-y" />
          </label>
          <label className="block text-sm font-medium text-gray-700">Current product question
            <textarea aria-label="Current product question" rows={2} maxLength={400} value={draft.question} onChange={event => setDraft({ ...draft, question: event.target.value })} placeholder="Should our next release prioritize backup reliability or sharing?" className="block mt-2 w-full border border-gray-300 rounded p-2 text-sm font-normal resize-y" />
          </label>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-3 mt-4">
          <label className="block text-sm font-medium text-gray-700">Focus topic
            <select aria-label="Focus topic" value={draft.focusTopic} onChange={event => setDraft({ ...draft, focusTopic: event.target.value })} className="block mt-2 border border-gray-300 rounded p-2 text-sm font-normal max-w-full"><option value="all">All topics</option>{draft.focusTopic !== 'all' && !topics.some(topic => topic.id === draft.focusTopic) && <option value={draft.focusTopic}>Previously selected theme unavailable</option>}{topics.map(topic => <option key={topic.id} value={topic.id}>{topic.name}</option>)}</select>
          </label>
          <button type="submit" disabled={!changed} className="inline-flex items-center gap-2 px-3 py-2 bg-teal-700 text-white rounded text-sm disabled:opacity-40"><Save className="w-4 h-4" />Save question</button>
        </div>
      </form>
    </details>
    {context.question && <p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap break-words">{context.question}</p>}
  </section>;
};

export const ResearchBriefPanel = ({ brief, children }: { brief: ResearchBrief; children: ReactNode }) => <section className="py-5">
  <div className="flex flex-wrap justify-between items-start gap-3">
    <div><h2 className="text-lg font-semibold">Product research brief</h2><p className="mt-1 text-sm text-gray-500">Last {brief.days} days · {brief.context.focusTopic === 'all' ? 'All topics' : brief.focusName} · manual preview</p></div>
    <button onClick={() => downloadFile('insightly-research-brief.md', researchBriefMarkdown(brief), 'text/markdown;charset=utf-8')} className="inline-flex items-center gap-2 border border-gray-300 rounded px-3 py-2 text-sm"><Download className="w-4 h-4" />Export brief</button>
  </div>
  {brief.apps.some(app => app.sample) && <p className="mt-3 text-sm text-amber-800">Illustrative sample data, not real user feedback.</p>}
  <dl className="grid md:grid-cols-2 gap-4 py-5 border-b border-gray-200 text-sm">
    <div><dt className="font-medium text-gray-900">Your product</dt><dd className="mt-1 text-gray-600 whitespace-pre-wrap break-words">{brief.context.product || 'Not provided'}</dd></div>
    <div><dt className="font-medium text-gray-900">Question to investigate</dt><dd className="mt-1 text-gray-600 whitespace-pre-wrap break-words">{brief.context.question || 'Not set'}</dd></div>
  </dl>
  <h3 className="font-medium text-gray-900 mt-5">Evidence to investigate</h3>
  <p className="mt-2 text-xs text-gray-500">Model-discovered themes and aspect judgments. {brief.pendingReviews} reviews awaiting classification. Reviews do not establish a competitive gap, willingness to switch, or roadmap priority.</p>
  {!brief.findings.length && <p className="mt-4 text-sm text-gray-600">No matching current-period topic evidence. This does not establish absence of user feedback.</p>}
  {children}
  <div className="pt-5 border-t border-gray-200 text-sm">
    <h3 className="font-medium mb-3">Coverage notes</h3>
    {brief.apps.map(app => <p key={app.id} className="mt-2 text-gray-600 break-words"><span className="font-medium">{app.name}</span> · {app.country} · {app.coverage.current.length} current / {app.coverage.previous.length} previous dated reviews · {app.coverage.comparable ? 'Comparable samples; completeness not established' : app.coverage.reason}</p>)}
  </div>
</section>;
