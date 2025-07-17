"use client";

import React, { useState } from "react";
import Editor from "@monaco-editor/react";

const LabPage = ({ params }: { params: { labId: string } }) => {
  const [selectedFile, setSelectedFile] = useState("file1.sv");
  const [code, setCode] = useState("// file1.sv content");
  const [consoleOutput, setConsoleOutput] = useState("");

  const files = ["file1.sv", "file2.sv"]; // Mock files

  const handleFileSelect = (file: string) => {
    setSelectedFile(file);
    // In a real app, you would fetch the file content here
    setCode(`// ${file} content`);
  };

  const runTests = async () => {
    setConsoleOutput("Running tests...");
    const response = await fetch("/api/labs/run", {
      method: "POST",
      body: JSON.stringify({ code }),
    });
    const result = await response.text();
    setConsoleOutput(result);
  };

  return (
    <div className="flex h-screen">
      <div className="w-1/4 bg-gray-800 text-white p-4">
        <h2 className="text-xl font-bold mb-4">Files</h2>
        <ul>
          {files.map((file) => (
            <li
              key={file}
              className={`cursor-pointer ${
                selectedFile === file ? "font-bold" : ""
              }`}
              onClick={() => handleFileSelect(file)}
            >
              {file}
            </li>
          ))}
        </ul>
      </div>
      <div className="w-3/4 flex flex-col">
        <div className="flex-1">
          <Editor
            height="100%"
            language="systemverilog"
            value={code}
            onChange={(value) => setCode(value || "")}
            theme="vs-dark"
          />
        </div>
        <div className="h-1/4 bg-gray-900 p-4">
          <button
            onClick={runTests}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mb-4"
          >
            Run Tests
          </button>
          <pre className="text-white">{consoleOutput}</pre>
        </div>
      </div>
    </div>
  );
};

export default LabPage;
