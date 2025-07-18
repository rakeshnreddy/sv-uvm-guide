"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Textarea } from '@/components/ui/Textarea';

// Mock data for notebook entries
const mockNotebookEntries = [
  { id: '1', title: 'UVM Phases', content: 'The UVM phases are...' },
  { id: '2', title: 'TLM FIFO', content: 'The TLM FIFO is used for...' },
];

export default function NotebookPage() {
  const [selectedEntry, setSelectedEntry] = useState(mockNotebookEntries[0]);
  const [feedback, setFeedback] = useState<{ score: number; feedback: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleFeedbackSubmit = async () => {
    setIsLoading(true);
    setFeedback(null);
    const response = await fetch('/api/ai/feynman-feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: selectedEntry.content }),
    });
    const data = await response.json();
    setFeedback(data);
    setIsLoading(false);
  };

  return (
    <div className="container mx-auto py-10 grid md:grid-cols-3 gap-6">
      <div className="md:col-span-1">
        <Card>
          <CardHeader>
            <CardTitle>Notebook Entries</CardTitle>
          </CardHeader>
          <CardContent>
            <ul>
              {mockNotebookEntries.map((entry) => (
                <li
                  key={entry.id}
                  className={`cursor-pointer p-2 rounded ${
                    selectedEntry.id === entry.id ? 'bg-gray-200' : ''
                  }`}
                  onClick={() => setSelectedEntry(entry)}
                >
                  {entry.title}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
      <div className="md:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>{selectedEntry.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={selectedEntry.content}
              onChange={(e) =>
                setSelectedEntry({ ...selectedEntry, content: e.target.value })
              }
              className="min-h-[300px] w-full"
            />
            <Button onClick={handleFeedbackSubmit} disabled={isLoading} className="mt-4">
              {isLoading ? 'Getting Feedback...' : 'Submit for AI Feedback'}
            </Button>
            {feedback && (
              <div className="mt-4 p-4 bg-gray-100 rounded">
                <h3 className="font-bold">AI Feedback (Score: {feedback.score})</h3>
                <p>{feedback.feedback}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
