import { expect } from 'chai';
import { LLM_PROVIDERS } from '../llmProviders.js';

// Fake GoogleGenerativeAI client: behaviour per model name.
function fakeClient(behaviour, calls) {
  return {
    getGenerativeModel({ model }) {
      return {
        async generateContentStream() {
          calls.push(model);
          const b = behaviour[model];
          if (b === 'fail') throw new Error(`[404 Not Found] models/${model} is not found`);
          return {
            stream: (async function* () {
              for (const t of b.chunks) yield { text: () => t };
              if (b.failAfter) throw new Error('stream broke');
            })(),
          };
        },
        async generateContent() {
          calls.push(model);
          if (behaviour[model] === 'fail') throw new Error('404');
          return { response: { text: () => behaviour[model].chunks.join('') } };
        },
      };
    },
  };
}

describe('gemini fallback', () => {
  const g = LLM_PROVIDERS.gemini;
  const orig = { createClient: g.createClient, defaultModel: g.defaultModel, fallbackModel: g.fallbackModel };
  afterEach(() => Object.assign(g, orig));
  const setup = (behaviour, calls) => {
    g.defaultModel = 'primary-model';
    g.fallbackModel = 'fallback-model';
    g.createClient = () => fakeClient(behaviour, calls);
  };

  it('defaults to gemini-3.6-flash and remaps deprecated 3.5-flash', () => {
    expect(orig.defaultModel).to.equal(process.env.GEMINI_MODEL || 'gemini-3.6-flash');
    expect(g.resolveModel('gemini-3.5-flash')).to.equal('gemini-3.6-flash');
  });

  it('uses primary when it succeeds', async () => {
    const calls = [];
    setup({ 'primary-model': { chunks: ['a', 'b'] } }, calls);
    const out = await g.streamResponse(undefined, 'p', () => {});
    expect(out).to.equal('ab');
    expect(calls).to.deep.equal(['primary-model']);
  });

  it('retries once with fallback when primary fails before output', async () => {
    const calls = []; const seen = [];
    setup({ 'primary-model': 'fail', 'fallback-model': { chunks: ['x'] } }, calls);
    const out = await g.streamResponse(undefined, 'p', (c) => seen.push(c));
    expect(out).to.equal('x');
    expect(seen).to.deep.equal(['x']);
    expect(calls).to.deep.equal(['primary-model', 'fallback-model']);
  });

  it('does not retry after output has started', async () => {
    const calls = [];
    setup({ 'primary-model': { chunks: ['partial'], failAfter: true }, 'fallback-model': { chunks: ['x'] } }, calls);
    let err;
    try { await g.streamResponse(undefined, 'p', () => {}); } catch (e) { err = e; }
    expect(err).to.be.an('error');
    expect(calls).to.deep.equal(['primary-model']);
  });

  it('propagates error if fallback also fails (single retry only)', async () => {
    const calls = [];
    setup({ 'primary-model': 'fail', 'fallback-model': 'fail' }, calls);
    let err;
    try { await g.generateResponse(undefined, 'p'); } catch (e) { err = e; }
    expect(err).to.be.an('error');
    expect(calls).to.deep.equal(['primary-model', 'fallback-model']);
  });
});
