// Basic CodeBlock Placeholder
export default function CodeBlock({ code }) {
  return (
    <pre style={{ backgroundColor: '#f0f0f0', border: '1px solid #ccc', padding: '10px', overflowX: 'auto' }}>
      <code>
        {code}
      </code>
    </pre>
  );
}
