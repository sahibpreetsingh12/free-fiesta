import "./globals.css";

export const metadata = {
  title: "Free Fiesta – Model Comparison",
  description: "Compare Qwen models side-by-side in parallel",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

