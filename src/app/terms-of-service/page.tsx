import InfoPage from '@/components/templates/InfoPage';

const commitments = [
  {
    heading: 'Using the Platform',
    points: [
      'You may access the curriculum, labs, and visual assets for personal or organizational learning.',
      'Accounts must belong to real people; automated scraping or credential sharing is not permitted.',
      'Downloaded lab material keeps its open-source license; credit the project when you redistribute changes.',
    ],
  },
  {
    heading: 'Contributor Responsibilities',
    points: [
      'Follow the style guide and Definition of Done before submitting pull requests.',
      'Do not upload proprietary RTL or verification IP unless you own the rights to share it.',
      'Disclose simulated data or anonymized logs that originate from real silicon projects.',
    ],
  },
  {
    heading: 'Availability & Updates',
    points: [
      'We aim for 99.5% uptime; planned maintenance windows are announced in the community channel.',
      'Feature flags may hide beta functionality until the curriculum steward approves a release.',
      'Breaking changes to API contracts or schema migrations are documented two sprints in advance.',
    ],
  },
  {
    heading: 'Termination',
    points: [
      'We reserve the right to disable access that violates the code of conduct or endangers learners.',
      'You may delete your account at any time; feedback helps us resolve issues before departure.',
      'Inactive beta accounts are purged after 12 months to protect learner data.',
    ],
  },
];

export default function TermsOfServicePage() {
  return (
    <InfoPage
      title="Terms of Service"
      description="Guidelines for engaging with the SystemVerilog &amp; UVM learning platform."
    >
      <div className="space-y-10">
        <p className="text-sm text-foreground/80">Last updated: October 7, 2025</p>
        {commitments.map((section) => (
          <section key={section.heading} className="space-y-4">
            <h2 className="text-2xl font-semibold text-primary">{section.heading}</h2>
            <ul className="list-disc space-y-2 pl-6 text-foreground/90">
              {section.points.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </InfoPage>
  );
}
