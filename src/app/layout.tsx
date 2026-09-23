import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Аким на 5 часов — Город ваших решений",
  description:
    "Интерактивный симулятор управления городом: пять решений, один бюджет и будущее Астаны.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
