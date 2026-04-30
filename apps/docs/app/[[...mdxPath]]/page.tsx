import { generateStaticParamsFor, importPage } from "nextra/pages";
import { useMDXComponents } from "../../mdx-components";
import { use } from "react";

export const generateStaticParams = generateStaticParamsFor("mdxPath");

type Props = {
  params: Promise<{ mdxPath: string[] }>;
};

export async function generateMetadata(props: Props) {
  const params = await props.params;
  const { metadata } = await importPage(params.mdxPath);
  return metadata;
}

function MDXWrapper({ toc, metadata, sourceCode, children, params }: any) {
  const { wrapper } = useMDXComponents();
   
  const Content = wrapper;
  return (
    <Content toc={toc} metadata={metadata} sourceCode={sourceCode}>
      {children}
    </Content>
  );
}

export default function Page(props: Props) {
  const params = use(props.params);
  const result = use(importPage(params.mdxPath));
  const { default: MDXContent, toc, metadata, sourceCode } = result;
  return (
    <MDXWrapper
      toc={toc}
      metadata={metadata}
      sourceCode={sourceCode}
      params={params}
    >
      <MDXContent {...props} params={params} />
    </MDXWrapper>
  );
}
