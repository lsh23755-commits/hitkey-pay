import { Jua } from "next/font/google";
import "./globals.css";
import ServiceWorkerRegister from "./ServiceWorkerRegister";

const jua = Jua({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-kitsch",
});

export const metadata = {
  title: "히트키",
  description: "심플한 개인 가계부",
  manifest: "/manifest.json",
  icons: { icon: "/icon-192.png", apple: "/icon-192.png" },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ff6fae",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko" className={jua.variable}>
      <body>
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
