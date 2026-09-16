import Link from "next/link";
import { pageHref } from "@/lib/site";

export default function NotFound() {
  return (
    <div className="mx-auto my-[16vh] w-[min(600px,calc(100%_-_48px))]">
      <h1 className="text-[42px]">页面不存在</h1>
      <Link href={pageHref("/")}>返回知识库</Link>
    </div>
  );
}
