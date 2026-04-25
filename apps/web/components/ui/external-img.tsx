"use client";

/**
 * ExternalImg — wrapper around <img> for external URLs that can't use Next.js Image.
 * Using raw <img> is intentional here since:
 * 1. These are third-party/external URLs outside our image domain configuration
 * 2. Next.js Image requires explicit domain allowlist per next.config.js
 *
 * Usage: <ExternalImg src={url} alt={alt} className="..." />
 */
export function ExternalImg({
  src,
  alt,
  className,
  ...props
}: React.ImgHTMLAttributes<HTMLImageElement>) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={className} {...props} />
  );
}
