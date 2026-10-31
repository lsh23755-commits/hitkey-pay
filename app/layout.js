import "./globals.css";

export const metadata = {
  title: "히트키",
  description: "심플한 개인 가계부",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
