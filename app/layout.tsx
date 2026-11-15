import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Recallzy",
  description: "Upload your study material and practice with AI-generated quizzes that explain every answer.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
