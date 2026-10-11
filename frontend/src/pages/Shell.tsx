import type { ReactNode } from 'react';
import TopNav, { WaveLines } from '../components/TopNav';
import { Badge } from '../components/ui';
import { useStore } from '../store';

const PAGES: Record<string, { title: string; sub: string }> = {
  live: { title: 'Live routing', sub: 'Send a request and watch every routing decision as it is made.' },
  fleet: { title: 'Model fleet', sub: 'Every model endpoint with its limits, health and live telemetry.' },
  traces: { title: 'Request traces', sub: 'Each audited request, step by step, from estimate to ledger.' },
  policies: { title: 'Routing policies', sub: 'The rules the engine enforces, taken from its source code.' },
  lab: { title: 'Evaluation lab', sub: 'Compare routing preferences on the same set of requests.' },
  audit: { title: 'Audit & proofs', sub: 'Independent audit results and the hash-chained ledger behind them.' },
  keys: { title: 'API keys', sub: 'Connect hosted models with your provider keys.' },
  settings: { title: 'Settings', sub: 'Your profile, session counters and environment.' },
};

/** Workspace page frame: the shared top nav, a gradient header band, then the page. */
export default function Shell({ page, children }: { page: string; children: ReactNode }) {
  const { health } = useStore();
  const meta = PAGES[page] ?? PAGES.live;
  return (
    <div className="ws">
      <TopNav active={page} />
      <header className="ws-head">
        <WaveLines />
        <div className="ws-head-inner">
          <div>
            <h1>{meta.title}</h1>
            <p>{meta.sub}</p>
          </div>
          <div className="row wrap gap-s ws-status">
            {health && <Badge tone={health.chain_valid ? 'violet' : 'coral'}>ledger {health.chain_valid ? 'intact' : 'broken'} · {health.total_audited_requests}</Badge>}
          </div>
        </div>
      </header>
      <main className="ws-content" key={page}>
        {children}
      </main>
    </div>
  );
}
