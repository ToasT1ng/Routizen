import { build } from "esbuild";
import { readFileSync, rmSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url)));

// 이전 tsc 빌드가 남긴 다중 산출물(scheduler.js 등)이 클라우드에 함께 업로드되지 않도록
// 번들 전에 dist 를 비운다. esbuild 는 outfile 만 덮어쓰고 디렉터리를 청소하지 않는다.
rmSync(new URL("./dist", import.meta.url), { recursive: true, force: true });

// 클라우드(Cloud Functions)에서 npm install 로 해석되는 런타임 의존성은 external 로 두고,
// 워크스페이스 패키지(@routizen/core — devDependencies)만 번들에 인라인한다.
// 이렇게 하면 배포된 functions 가 미게시 워크스페이스 패키지를 require 하지 않는다.
const external = Object.keys(pkg.dependencies ?? {});

await build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  outfile: "dist/index.js",
  external,
  logLevel: "info",
});
