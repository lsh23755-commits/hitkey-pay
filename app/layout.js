import "./globals.css";
import ServiceWorkerRegister from "./ServiceWorkerRegister";

export const metadata = {
  title: "히트키",
  description: "심플한 개인 가계부",
  manifest: "/manifest.json",
  icons: { icon: "/icon-192.png", apple: "/icon-192.png" },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#3182f6",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
