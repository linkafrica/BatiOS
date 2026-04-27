import { DashboardShell } from '@batios/design-system';

export default function Page() {
  return (
    <DashboardShell
      tone="qs"
      product="BatiOS QS"
      title="Quantity verification desk"
      subtitle="Review measured work, reconcile field evidence, and prepare certificate-ready quantities without losing custody context."
      primaryQueueTitle="Measurement checks"
      metrics={[
        { label: 'Bills in review', value: '9', detail: 'Across 5 projects' },
        { label: 'Variance flags', value: '16', detail: '4 above threshold' },
        { label: 'Ready for cert', value: '22', detail: 'Items with complete evidence' },
        { label: 'Pending field notes', value: '8', detail: 'Need supervisor clarification' },
      ]}
      primaryQueue={[
        {
          title: 'Drainage excavation chainage 2+450',
          meta: 'Measured 148m vs contract 136m; evidence packet complete',
          status: 'Variance',
        },
        {
          title: 'Culvert reinforcement Lot A-14',
          meta: 'Spacing photos and delivery note ready for quantity sign-off',
          status: 'Ready',
        },
        {
          title: 'Concrete pour ticket reconciliation',
          meta: 'Two delivery notes missing supplier stamp',
          status: 'Clarify',
        },
      ]}
      decisions={[
        { label: 'Accept excavation variance', owner: 'Senior QS', due: 'Today' },
        { label: 'Request stamped delivery note', owner: 'Site QS', due: '24h' },
        { label: 'Package certificate draft', owner: 'Commercial lead', due: 'Tomorrow' },
      ]}
    >
      <section className="batios-dashboard__workspace" aria-label="QS workspace shortcuts">
        <article className="batios-dashboard__workspace-card">
          <strong>Measurement book</strong>
          <p>Work items grouped by bill item, chainage, evidence completeness, and variance.</p>
        </article>
        <article className="batios-dashboard__workspace-card">
          <strong>Evidence match</strong>
          <p>Spot missing photos, notes, and delivery records before certification.</p>
        </article>
        <article className="batios-dashboard__workspace-card">
          <strong>Certificate prep</strong>
          <p>Build a clean payment certificate queue from accepted measured work.</p>
        </article>
      </section>
    </DashboardShell>
  );
}
