import { Head, Html, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="en" data-theme="night">
      <Head>
        <link rel="icon" type="image/svg+xml" href="/swuni.svg" />
      </Head>
      <body>
        <Main />
        <NextScript />
        <script src="https://cdn.jsdelivr.net/npm/@tailwindplus/elements@1" type="module" />
      </body>
    </Html>
  );
}