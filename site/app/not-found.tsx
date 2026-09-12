import Link from "next/link";
import { siteHref } from "@/lib/site";

export default function NotFound() {
  return <div className="not-found"><h1>页面不存在</h1><Link href={siteHref("/")}>返回知识库</Link></div>;
}
