import type { ReactNode } from 'react';

type MainLayoutProps = {
  children: ReactNode;
};

export default function MainLayout({ children }: MainLayoutProps) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>DecorAPI SSR</title>
      </head>
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 0, padding: '1.5rem', lineHeight: 1.5 }}>
        <header style={{ marginBottom: '1.5rem' }}>
          <h1 style={{ marginBottom: '.75rem' }}>DecorAPI Pages</h1>
          <nav style={{ display: 'flex', gap: '1rem' }}>
            <a href="/">Home</a>
            <a href="/about">About</a>
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
