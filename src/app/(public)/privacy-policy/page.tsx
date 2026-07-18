import InfoPage from '@/components/templates/InfoPage';

const sections = [
  {
    heading: 'Information We Collect',
    body: (
      <ul>
        <li>Account basics (name, email) supplied during onboarding or single-sign-on.</li>
        <li>Learning telemetry such as module completions, quiz attempts, and exercise feedback.</li>
        <li>Optional community content that you author inside discussion forums or reviews.</li>
        <li>Technical diagnostics including browser metadata needed to improve accessibility.</li>
      </ul>
    ),
  },
  {
    heading: 'How We Use Your Data',
    body: (
      <ul>
        <li>Personalize the dashboard, placement guidance, and recommended learning paths.</li>
        <li>Surface regressions in curriculum quality through anonymized engagement analytics.</li>
        <li>Support collaborative features like code reviews, peer feedback, and mentorship matching.</li>
        <li>Maintain security, detect misuse, and satisfy compliance or legal obligations.</li>
      </ul>
    ),
  },
  {
    heading: 'Retention & Control',
    body: (
      <ul>
        <li>Telemetry is retained while your account is active so you can track mastery progress.</li>
        <li>You may export or request deletion of your personal data at any time via Settings.</li>
        <li>Redacted backups are stored for disaster recovery and removed on a rolling 30 day schedule.</li>
      </ul>
    ),
  },
  {
    heading: 'Cookies & Third Parties',
    body: (
      <ul>
        <li>Session cookies keep you signed in and remember theme preferences.</li>
        <li>Analytics scripts run locally; no advertising trackers are loaded.</li>
        <li>Verified partners (CI providers, cloud labs) receive the minimum metadata needed to execute jobs.</li>
      </ul>
    ),
  },
  {
    heading: 'Questions or Requests',
    body: (
      <p>
        Contact <a href="mailto:privacy@sv-uvm-guide.dev" className="text-primary hover:underline">privacy@sv-uvm-guide.dev</a> for data access, corrections, or removal.
      </p>
    ),
  },
];

export default function PrivacyPolicyPage() {
  return (
    <InfoPage
      title="Privacy Policy"
      description="We collect the minimum information required to personalize the SystemVerilog &amp; UVM learning experience."
    >
      <div className="space-y-10">
        <p className="text-sm text-foreground/80">Last updated: October 7, 2025</p>
        {sections.map((section) => (
          <section key={section.heading} className="space-y-4">
            <h2 className="text-2xl font-semibold text-primary">{section.heading}</h2>
            <div className="prose prose-invert max-w-none text-foreground/90">{section.body}</div>
          </section>
        ))}
      </div>
    </InfoPage>
  );
}
