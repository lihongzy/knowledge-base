import { notFound } from "next/navigation";
import { TopicContent } from "@/components/topic-content";
import { topics } from "@/lib/navigation";
export const dynamicParams = false;
export function generateStaticParams() { return topics.map((topic) => ({ topic: topic.slug })); }
export default async function TopicPage({ params }: { params: Promise<{ topic: string }> }) {
  const { topic: slug } = await params;
  const topic = topics.find((item) => item.slug === slug);
  if (!topic) notFound();
  return <TopicContent topic={topic} />;
}
