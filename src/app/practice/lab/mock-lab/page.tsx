import React from 'react';

const MockLabPage = () => {
  return (
    <div>
      <h1>Mock Lab Page</h1>
      <div className="monaco-editor" style={{ width: '800px', height: '600px', border: '1px solid #ccc' }}></div>
      <button>Run Tests</button>
      <pre></pre>
    </div>
  );
};

export default MockLabPage;
