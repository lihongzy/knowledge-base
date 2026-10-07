import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig = (phase: string): NextConfig => ({
  // 开发服务可使用独立缓存；静态导出固定使用默认的 out/。
  distDir: phase === PHASE_DEVELOPMENT_SERVER ? (process.env.NEXT_DEV_DIR ?? ".next") : ".next",
  // Next 15 的开发期 export 参数检查无法正确匹配 URL 编码的中文路径。
  // 生产构建仍执行静态导出，开发期使用正常的路由解析。
  output: phase === PHASE_DEVELOPMENT_SERVER ? undefined : "export",
  basePath,
  images: { unoptimized: true },
  trailingSlash: true,
});

export default nextConfig;
