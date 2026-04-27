import type { ReactNode } from 'react';

export type DashboardTone = 'admin' | 'pm' | 'qs';

export interface DashboardMetric {
  label: string;
  value: string;
  detail: string;
}

export interface DashboardWorkItem {
  title: string;
  meta: string;
  status: string;
}

export interface DashboardDecision {
  label: string;
  owner: string;
  due: string;
}

export interface DashboardShellProps {
  tone: DashboardTone;
  product: string;
  title: string;
  subtitle: string;
  metrics: readonly DashboardMetric[];
  primaryQueueTitle: string;
  primaryQueue: readonly DashboardWorkItem[];
  decisions: readonly DashboardDecision[];
  children?: ReactNode;
}

export function DashboardShell({
  tone,
  product,
  title,
  subtitle,
  metrics,
  primaryQueueTitle,
  primaryQueue,
  decisions,
  children,
}: DashboardShellProps) {
  return (
    <main className={`batios-dashboard batios-dashboard--${tone}`}>
      <style>{dashboardShellCss}</style>

      <section className="batios-dashboard__topbar" aria-label={`${product} overview`}>
        <div>
          <p className="batios-dashboard__eyebrow">{product}</p>
          <h1>{title}</h1>
          <p className="batios-dashboard__subtitle">{subtitle}</p>
        </div>
        <div className="batios-dashboard__status" aria-label="Workspace status">
          <span aria-hidden="true" />
          Live workspace
        </div>
      </section>

      <section className="batios-dashboard__metrics" aria-label="Operational metrics">
        {metrics.map((metric) => (
          <article key={metric.label} className="batios-dashboard__metric">
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <small>{metric.detail}</small>
          </article>
        ))}
      </section>

      <section className="batios-dashboard__grid" aria-label="Operational work">
        <article className="batios-dashboard__panel batios-dashboard__panel--wide">
          <div className="batios-dashboard__panel-heading">
            <div>
              <p className="batios-dashboard__eyebrow">Primary queue</p>
              <h2>{primaryQueueTitle}</h2>
            </div>
            <span>{primaryQueue.length} active</span>
          </div>
          <ol className="batios-dashboard__queue">
            {primaryQueue.map((item) => (
              <li key={item.title}>
                <div>
                  <strong>{item.title}</strong>
                  <span>{item.meta}</span>
                </div>
                <mark>{item.status}</mark>
              </li>
            ))}
          </ol>
        </article>

        <aside className="batios-dashboard__panel">
          <div className="batios-dashboard__panel-heading">
            <div>
              <p className="batios-dashboard__eyebrow">Decisions</p>
              <h2>Needs attention</h2>
            </div>
          </div>
          <dl className="batios-dashboard__decisions">
            {decisions.map((decision) => (
              <div key={decision.label}>
                <dt>{decision.label}</dt>
                <dd>
                  {decision.owner} · {decision.due}
                </dd>
              </div>
            ))}
          </dl>
        </aside>
      </section>

      {children}
    </main>
  );
}

const dashboardShellCss = `
:root {
  color-scheme: light;
}

* {
  box-sizing: border-box;
}

html,
body {
  min-height: 100%;
  margin: 0;
}

body {
  background: #f7f9f8;
  color: #18221e;
  font-family:
    Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.batios-dashboard {
  --accent: #126b5b;
  --accent-strong: #0a433a;
  --accent-soft: #e7f2ee;
  --line: #d7ded8;
  --muted: #60716a;
  --panel: #ffffff;
  --shadow: 0 16px 40px rgb(23 36 31 / 9%);
  display: flex;
  min-height: 100vh;
  flex-direction: column;
  gap: 18px;
  padding: 18px;
}

.batios-dashboard--pm {
  --accent: #2f5f98;
  --accent-strong: #183b63;
  --accent-soft: #eaf1fa;
}

.batios-dashboard--qs {
  --accent: #7a5a12;
  --accent-strong: #4d3909;
  --accent-soft: #f8efd7;
}

.batios-dashboard--admin {
  --accent: #6f3f87;
  --accent-strong: #452356;
  --accent-soft: #f2eaf7;
}

.batios-dashboard__topbar,
.batios-dashboard__metrics,
.batios-dashboard__grid,
.batios-dashboard__workspace {
  width: min(1180px, 100%);
  margin: 0 auto;
}

.batios-dashboard__topbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  border-bottom: 1px solid var(--line);
  padding-bottom: 18px;
}

.batios-dashboard__eyebrow {
  margin: 0 0 7px;
  color: var(--muted);
  font-size: 0.76rem;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.batios-dashboard h1,
.batios-dashboard h2 {
  margin: 0;
  line-height: 1.08;
  letter-spacing: 0;
}

.batios-dashboard h1 {
  max-width: 780px;
  font-size: clamp(2rem, 7vw, 3.8rem);
}

.batios-dashboard h2 {
  font-size: 1.15rem;
}

.batios-dashboard__subtitle {
  max-width: 720px;
  margin: 10px 0 0;
  color: var(--muted);
  font-weight: 750;
  line-height: 1.5;
}

.batios-dashboard__status {
  display: inline-flex;
  min-width: 144px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--panel);
  box-shadow: var(--shadow);
  color: var(--accent-strong);
  padding: 10px 14px;
  font-weight: 900;
}

.batios-dashboard__status span {
  width: 9px;
  height: 9px;
  border-radius: 999px;
  background: var(--accent);
}

.batios-dashboard__metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.batios-dashboard__metric,
.batios-dashboard__panel,
.batios-dashboard__workspace-card {
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel);
  box-shadow: var(--shadow);
}

.batios-dashboard__metric {
  min-height: 120px;
  padding: 16px;
}

.batios-dashboard__metric span,
.batios-dashboard__metric small {
  display: block;
  color: var(--muted);
  font-weight: 800;
}

.batios-dashboard__metric strong {
  display: block;
  margin: 10px 0;
  color: var(--accent-strong);
  font-size: 2rem;
  line-height: 1;
}

.batios-dashboard__grid {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(300px, 0.65fr);
  gap: 18px;
  align-items: start;
}

.batios-dashboard__panel {
  padding: 18px;
}

.batios-dashboard__panel-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.batios-dashboard__panel-heading > span {
  flex: 0 0 auto;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent-strong);
  padding: 7px 10px;
  font-size: 0.8rem;
  font-weight: 900;
}

.batios-dashboard__queue {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.batios-dashboard__queue li {
  display: flex;
  min-height: 72px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #f9fbfa;
  padding: 12px;
}

.batios-dashboard__queue strong,
.batios-dashboard__queue span {
  display: block;
}

.batios-dashboard__queue span,
.batios-dashboard__decisions dd,
.batios-dashboard__workspace-card p {
  margin-top: 4px;
  color: var(--muted);
  font-weight: 750;
}

.batios-dashboard__queue mark {
  flex: 0 0 auto;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent-strong);
  padding: 7px 10px;
  font-size: 0.74rem;
  font-weight: 900;
}

.batios-dashboard__decisions {
  display: grid;
  gap: 10px;
  margin: 0;
}

.batios-dashboard__decisions div {
  border-left: 4px solid var(--accent);
  border-radius: 8px;
  background: #f9fbfa;
  padding: 12px;
}

.batios-dashboard__decisions dt {
  font-weight: 900;
}

.batios-dashboard__decisions dd {
  margin-left: 0;
}

.batios-dashboard__workspace {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.batios-dashboard__workspace-card {
  min-height: 140px;
  padding: 16px;
}

.batios-dashboard__workspace-card strong {
  display: block;
  font-size: 1.05rem;
}

@media (max-width: 900px) {
  .batios-dashboard__metrics,
  .batios-dashboard__grid,
  .batios-dashboard__workspace {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 620px) {
  .batios-dashboard {
    padding: 14px;
  }

  .batios-dashboard__topbar,
  .batios-dashboard__panel-heading,
  .batios-dashboard__queue li {
    align-items: stretch;
    flex-direction: column;
  }

  .batios-dashboard__status {
    width: 100%;
  }
}
`;
