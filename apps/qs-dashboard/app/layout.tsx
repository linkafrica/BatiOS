import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'BatiOS QS',
  description: 'Quantity surveying dashboard',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
