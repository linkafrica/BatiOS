import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'BatiOS PM',
  description: 'Project management dashboard',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
