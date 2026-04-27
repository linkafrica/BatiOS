import { DashboardShell } from '@batios/design-system';

export default function Page() {
  return (
    <DashboardShell
      tone="admin"
      product="BatiOS Admin"
      title="Platform operations console"
      subtitle="Manage tenant readiness, access controls, compliance posture, and operational exceptions from one controlled workspace."
      primaryQueueTitle="Platform operations queue"
      metrics={[
        { label: 'Organisations', value: '31', detail: '6 pending onboarding' },
        { label: 'Access reviews', value: '14', detail: 'Due this week' },
        { label: 'Compliance alerts', value: '3', detail: 'No critical rejects' },
        { label: 'Open support', value: '19', detail: 'Median age 7h' },
      ]}
      primaryQueue={[
        {
          title: 'Approve employer organisation setup',
          meta: 'Ghana Highway Authority workspace requires final role mapping',
          status: 'Access',
        },
        {
          title: 'Review cross-project custody grant',
          meta: 'External engineer requested read access on two active projects',
          status: 'Policy',
        },
        {
          title: 'Resolve failed evidence sync report',
          meta: 'Field device EV-1048 submitted duplicate idempotency key',
          status: 'Support',
        },
      ]}
      decisions={[
        { label: 'Confirm onboarding roles', owner: 'Platform admin', due: 'Today' },
        { label: 'Approve external custody access', owner: 'Compliance lead', due: '24h' },
        { label: 'Triage sync exception', owner: 'Support lead', due: 'Today' },
      ]}
    >
      <section className="batios-dashboard__workspace" aria-label="Admin workspace shortcuts">
        <article className="batios-dashboard__workspace-card">
          <strong>Tenant onboarding</strong>
          <p>Provision organisations, users, projects, and custody policies with audit context.</p>
        </article>
        <article className="batios-dashboard__workspace-card">
          <strong>Access governance</strong>
          <p>Review role grants, project parties, and exceptional access requests.</p>
        </article>
        <article className="batios-dashboard__workspace-card">
          <strong>Compliance monitor</strong>
          <p>Track architectural gates, support incidents, and evidence integrity alerts.</p>
        </article>
      </section>
    </DashboardShell>
  );
}
