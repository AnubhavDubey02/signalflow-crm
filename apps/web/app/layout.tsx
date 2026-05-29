import React from 'react';

export const metadata = {
  title: 'SignalFlow CRM Lab',
  description: 'AI-powered CRM integration QA Console',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
