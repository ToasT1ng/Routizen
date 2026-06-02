/** @type {import('next').NextConfig} */
const nextConfig = {
  // 동일 번들을 웹/Tauri/Capacitor가 공유하기 위한 정적 내보내기(SPA) — 기획 3.1
  output: "export",
  reactStrictMode: true,
  images: { unoptimized: true },
  // 모노레포 워크스페이스 패키지(@routizen/core) 트랜스파일
  transpilePackages: ["@routizen/core"],
  // core 의 ESM ".js" 확장자 import 를 ".ts" 소스로 해석하도록 (TS NodeNext 스타일)
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js", ".jsx"],
    };
    return config;
  },
};

export default nextConfig;
