import { Metadata } from "next";

export const DEFAULT_METADATA: Metadata = {
  title: "ReviewMe - Onchain Reviews for Real People",
  description:
    "Write heartfelt reviews about people you know on Base. More reviews, more demand for $RM.",
  icons: {
    icon: "/icon.png",
  },
  openGraph: {
    title: "ReviewMe - Onchain Reviews for Real People",
    description:
      "Write heartfelt reviews about people you know on Base. More reviews, more demand for $RM.",
    images: [
      {
        url: "https://reviewme.fun/og-image.png",
        width: 1200,
        height: 630,
        alt: "ReviewMe - Onchain Reviews for Real People",
      },
    ],
    siteName: "ReviewMe",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ReviewMe - Onchain Reviews for Real People",
    description:
      "Write heartfelt reviews about people you know on Base. More reviews, more demand for $RM.",
    images: ["https://reviewme.fun/og-image.png"],
  },
  other: {
    "fc:miniapp": JSON.stringify({
      version: "1",
      imageUrl: "https://reviewme.fun/og-image.png",
      button: {
        title: "Open ReviewMe",
        action: {
          type: "launch_frame",
          name: "ReviewMe",
          url: "https://reviewme.fun",
          splashImageUrl: "https://reviewme.fun/splash-image.png",
          splashBackgroundColor: "#ec4899",
        },
      },
    }),
  },
};

interface GenerateMetadataProps {
  title?: string;
  description?: string;
  path?: string;
  imageUrl?: string;
  frameButtonTitle?: string;
}

export function constructMetadata({
  title,
  description,
  path = "",
  imageUrl,
  frameButtonTitle = "Open ReviewMe",
}: GenerateMetadataProps = {}): Metadata {
  // Use environment variable for base URL, fallback to production URL
  let baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://reviewme.fun";

  const fullUrl = path ? `${baseUrl}${path}` : baseUrl;
  const image = imageUrl || `${baseUrl}/og-image.png`;

  // Clean up title if it's passed (don't append suffix if it's the default title)
  const effectiveTitle = title
    ? title.includes("| ReviewMe")
      ? title
      : `${title} | ReviewMe`
    : (DEFAULT_METADATA.title as string);

  const effectiveDesc = description || (DEFAULT_METADATA.description as string);

  return {
    ...DEFAULT_METADATA,
    title: effectiveTitle,
    description: effectiveDesc,
    openGraph: {
      ...DEFAULT_METADATA.openGraph,
      title: title || (DEFAULT_METADATA.openGraph?.title as string),
      description: effectiveDesc,
      url: fullUrl,
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: title || "ReviewMe",
        },
      ],
    },
    twitter: {
      ...DEFAULT_METADATA.twitter,
      title: title || (DEFAULT_METADATA.twitter?.title as string),
      description: effectiveDesc,
      images: [image],
    },
    other: {
      "fc:miniapp": JSON.stringify({
        version: "1",
        imageUrl: image,
        button: {
          title: frameButtonTitle,
          action: {
            type: "launch_frame",
            name: "ReviewMe",
            url: fullUrl,
            splashImageUrl: `${baseUrl}/splash-image.png`,
            splashBackgroundColor: "#ec4899",
          },
        },
      }),
    },
  };
}
