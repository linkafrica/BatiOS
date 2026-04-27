import { DashboardShell } from '@batios/design-system';

export default function Page() {
  return (
    <DashboardShell
      tone="pm"
      product="BatiOS PM"
      title="Project command center"
      subtitle="Track site progress, evidence readiness, approvals, and payment blockers across active public works packages."
      primaryQueueTitle="Evidence awaiting PM action"
      metrics={[
        { label: 'Active projects', value: '12', detail: '3 with critical blockers' },
        { label: 'Evidence packets', value: '48', detail: '11 awaiting review' },
        { label: 'Payment holds', value: '7', detail: 'GHS 2.4M under review' },
        { label: 'SLA risk', value: '5', detail: 'Due within 48 hours' },
      ]}
      primaryQueue={[
        {
          title: 'Kasoa drainage Lot A',
          meta: 'Culvert rebar evidence needs PM acceptance before concrete pour',
          status: 'Review',
        },
        {
          title: 'Tamale feeder road Section 2',
          meta: 'QS variation note attached; employer response pending',
          status: 'Blocked',
        },
        {
          title: 'Cape Coast market access road',
          meta: 'Field packet complete; payment certificate can be drafted',
          status: 'Ready',
        },
      ]}
      decisions={[
        { label: 'Approve Lot A pour readiness', owner: 'PM lead', due: 'Today' },
        { label: 'Escalate delayed employer sign-off', owner: 'Regional director', due: '24h' },
        { label: 'Release QS for certificate draft', owner: 'Project controller', due: 'Tomorrow' },
      ]}
    >
      <section className="batios-dashboard__workspace" aria-label="PM workspace shortcuts">
        <article className="batios-dashboard__workspace-card">
          <strong>Evidence review lane</strong>
          <p>Open packets sorted by contract item, custody status, and approval deadline.</p>
        </article>
        <article className="batios-dashboard__workspace-card">
          <strong>Payment readiness</strong>
          <p>Compare certified work, disputed quantities, and unresolved evidence gaps.</p>
        </article>
        <article className="batios-dashboard__workspace-card">
          <strong>Project health</strong>
          <p>Scan schedule risk, unresolved RFIs, and contract milestones by project.</p>
        </article>
      </section>
    </DashboardShell>
  );
}
