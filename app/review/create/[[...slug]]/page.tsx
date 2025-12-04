import { Metadata } from "next";
import { constructMetadata } from "@/lib/metadata";
import ReviewCreateClient from "./ReviewCreateClient";

interface Props {
  params: { slug?: string[] };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  // Build the path based on slug
  let path = "/review/create";
  if (params.slug && params.slug.length > 0) {
    path = `/review/create/${params.slug[0]}`;
  }

  return constructMetadata({
    title: "Write a Review",
    description: "Share your authentic feedback and earn ReviewMe tokens",
    path,
  });
}

export default function ReviewCreatePage() {
  return <ReviewCreateClient />;
}
