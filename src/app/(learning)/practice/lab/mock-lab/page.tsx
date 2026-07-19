"use client";

import React, { useState } from 'react';

const MockLabPage = () => {
  const [testResults, setTestResults] = useState('');

  const runTests = () => {
    setTestResults(`
      Test 'test_initial_state' passed.
      Test 'test_basic_input' passed.
      Test 'test_edge_cases' failed.
    `);
  };

  return (
    <div>
      <h1>Mock Lab Page</h1>
      <div className="monaco-editor" style={{ width: '800px', height: '600px', border: '1px solid #ccc' }}></div>
      <button onClick={runTests}>Run Tests</button>
      <pre>{testResults}</pre>
    </div>
  );
};

export default MockLabPage;
