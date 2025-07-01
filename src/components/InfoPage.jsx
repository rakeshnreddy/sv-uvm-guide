// Basic InfoPage Template

export default function InfoPage({ title, content, children }) {
  return (
    <div>
      <h1>{title}</h1>
      {content && <div dangerouslySetInnerHTML={{ __html: content }} />}
      {children}
      {/* Placeholder for specific embeds like timeline or diagrams */}
      {title === "/history" && <p>[Interactive Timeline Chart Placeholder]</p>}
      {title === "/learning-strategies" && <p>[Spaced Repetition Visual Diagram Placeholder]</p>}
    </div>
  );
}

// Example Usage (will be removed from here and used in actual page files)
/*
<InfoPage
  title="About Us"
  content="<p>This is the about us page content. It can contain <strong>HTML</strong>.</p>"
/>

<InfoPage title="/history">
  <p>Some introductory text for the history page.</p>
  {/* Specific components for history page can be children */}
</InfoPage>
*/
