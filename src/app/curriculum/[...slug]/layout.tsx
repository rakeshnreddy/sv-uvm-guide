import React from 'react';

export default function CurriculumLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="p-4 md:p-6">{children}</div>;
}
