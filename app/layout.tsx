import './globals.css';
import { LanguageProvider } from './language';
export const metadata = {
  title: 'Planning Club · Scrum Poker',
  icons: { icon: '/favicon.svg' },
  description:
    'Estimate together. Plan better. Live Scrum Poker for your team.',
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
