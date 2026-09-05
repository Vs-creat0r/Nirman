import type { Metadata } from "next";
import "@/lib/env";
import { ConvexClientProvider } from "@/components/providers/convex-client-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nirman ERP",
  description: "Construction Site ERP & Procurement Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="theme-brand h-full antialiased" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                function shouldIgnore(err, msg, filename, stack) {
                  var str = [
                    msg,
                    filename,
                    stack,
                    err ? err.stack : '',
                    err ? err.message : '',
                    err ? String(err) : ''
                  ].filter(Boolean).join(' ');

                  return (
                    str.indexOf('chrome-extension://') !== -1 ||
                    str.indexOf('moz-extension://') !== -1 ||
                    str.indexOf('safari-extension://') !== -1 ||
                    str.indexOf('safari-web-extension://') !== -1 ||
                    str.indexOf('M_ID') !== -1 ||
                    str.indexOf('eppiocemhmnlbhjplcgkofciiegomcon') !== -1
                  );
                }

                window.addEventListener('error', function(event) {
                  if (shouldIgnore(event.error, event.message, event.filename, event.error ? event.error.stack : '')) {
                    event.preventDefault();
                    event.stopImmediatePropagation();
                  }
                }, true);

                window.addEventListener('unhandledrejection', function(event) {
                  var reason = event.reason;
                  var stack = reason ? (reason.stack || reason.toString()) : '';
                  var message = reason ? reason.message : '';
                  if (shouldIgnore(reason, message, '', stack)) {
                    event.preventDefault();
                    event.stopImmediatePropagation();
                  }
                }, true);

                var origConsoleError = console.error;
                console.error = function() {
                  var text = Array.prototype.slice.call(arguments).map(function(a) {
                    return typeof a === 'object' && a !== null ? (a.stack || a.message || JSON.stringify(a)) : String(a);
                  }).join(' ');

                  if (
                    text.indexOf('chrome-extension://') !== -1 ||
                    text.indexOf('moz-extension://') !== -1 ||
                    text.indexOf('safari-extension://') !== -1 ||
                    text.indexOf('M_ID') !== -1 ||
                    text.indexOf('eppiocemhmnlbhjplcgkofciiegomcon') !== -1
                  ) {
                    return;
                  }
                  origConsoleError.apply(console, arguments);
                };
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground font-sans" suppressHydrationWarning>
        <ConvexClientProvider>{children}</ConvexClientProvider>
      </body>
    </html>
  );
}

