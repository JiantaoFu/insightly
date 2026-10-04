import { BrainCircuit, RefreshCw } from 'lucide-react';

export interface ClassifierProfile {
  version: string;
  provider: string;
  model: string;
  configured: boolean;
  message: string | null;
}

const MarketModelControls = ({ profile, checking, busy, progress, classified, total, error, onCheck, onClassify }: {
  profile: ClassifierProfile | null; checking: boolean; busy: boolean; progress: string | null;
  classified: number; total: number; error: string | null; onCheck: () => void; onClassify: () => void;
}) => {
  const pending = total - classified;
  return <section className="py-4 border-b border-gray-200">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-sm font-semibold flex items-center gap-2"><BrainCircuit className="w-4 h-4 text-teal-700" />Model-discovered themes</h2>
        <p className="text-xs text-gray-500 mt-2">{classified} classified / {total} real reviews · {pending} pending</p>
        <p className={`text-xs mt-1 ${profile?.configured ? 'text-gray-500' : 'text-amber-800'}`}>{checking ? 'Checking model configuration...' : profile?.configured ? `Gemini · ${profile.model}` : profile?.message || 'Model service unavailable.'}</p>
      </div>
      <div className="flex gap-2 items-center">
        <button title="Refresh model configuration" aria-label="Refresh model configuration" disabled={checking || busy} onClick={onCheck} className="p-2 border border-gray-300 rounded disabled:opacity-40"><RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} /></button>
        <button onClick={onClassify} disabled={busy || checking || !profile?.configured || pending === 0} className="inline-flex items-center gap-2 px-3 py-2 bg-teal-700 text-white rounded text-sm disabled:opacity-40"><BrainCircuit className="w-4 h-4" />{progress ? 'Classifying...' : pending > 120 ? 'Classify next 120' : 'Classify reviews'}</button>
      </div>
    </div>
    {progress && <p role="status" className="text-sm text-teal-800 mt-3">{progress}</p>}
    {error && <p role="alert" className="text-sm text-red-700 mt-3 break-words">{error}</p>}
  </section>;
};

export default MarketModelControls;
