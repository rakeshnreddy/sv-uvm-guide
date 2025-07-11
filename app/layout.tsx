import './globals.css'; // Import global styles
import React from 'react';
import Header from '@/app/components/Header'; // Import the Header component

export const metadata = {
  title: 'SystemVerilog & UVM Learning Platform',
  description: 'Interactive platform to master SystemVerilog and UVM.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* You can add more head elements here, like custom font links if needed */}
      </head>
      <body>
        <Header /> {/* Add the Header component here */}
        <main>
          {children}
        </main>
        {/*
          A Footer component could also be added here, e.g.:
          <footer>
            <p>&copy; {new Date().getFullYear()} LearnUVM. All rights reserved.</p>
          </footer>
        */}
      </body>
    </html>
  );
}
