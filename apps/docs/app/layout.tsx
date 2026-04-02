import { Footer, Layout, Navbar } from "nextra-theme-docs";
import { Head } from "nextra/components";
import { getPageMap } from "nextra/page-map";
import "nextra-theme-docs/style.css";

export const metadata = {
  title: "Texas Hold'em 文档",
  description: "开发文档与规划",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const navbar = (
    <Navbar
      logo={<span style={{ fontWeight: 800 }}>🃏 Texas Hold&apos;em</span>}
    />
  );
  const pageMap = await getPageMap();
  return (
    <html lang="zh" dir="ltr" suppressHydrationWarning>
      <Head />
      <body>
        <Layout
          navbar={navbar}
          footer={<Footer>Texas Hold&apos;em Poker</Footer>}
          pageMap={pageMap}
        >
          {children}
        </Layout>
      </body>
    </html>
  );
}
