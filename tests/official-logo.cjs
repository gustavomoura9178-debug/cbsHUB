const fs = require("node:fs"),
  crypto = require("node:crypto"),
  assert = require("node:assert/strict");

const EXPECTED_VIEWBOX = "0 0 1817 1989";
const EXPECTED_INDIGO_PATH =
  "M1392.06 0H424.944C175.839 0 0 182.805 0 449.266V796.285C0 1037.96 152.394 1208.37 380.984 1208.37H562.684C609.574 1208.37 653.534 1192.88 688.702 1158.8L993.489 861.352C1025.73 830.368 1005.21 774.597 961.252 774.597H495.279C457.181 774.597 424.944 740.515 424.944 700.235V539.119C424.944 480.25 468.903 433.774 524.586 433.774H1292.41C1330.51 433.774 1362.75 467.856 1362.75 508.135H1817V449.266C1817 182.805 1641.16 0 1392.06 0Z";
const EXPECTED_TEAL_PATH =
  "M1254.32 697H1436.02C1664.61 697 1817 867.413 1817 1109.09V1301.19C1817 1567.66 1641.16 1750.46 1392.06 1750.46H729.731L348.747 1979.75C310.648 2004.53 263.758 1976.65 263.758 1930.17V1731.87C102.573 1682.3 0 1533.57 0 1332.18V1363.16H454.25V1242.32C454.25 1282.6 486.487 1316.68 524.586 1316.68H1292.41C1348.1 1316.68 1392.06 1270.21 1392.06 1211.34V1205.14C1392.06 1164.86 1359.82 1130.78 1321.72 1130.78H855.748C811.789 1130.78 791.274 1075.01 823.511 1044.02L1128.3 746.575C1163.47 712.492 1207.43 697 1254.32 697Z";

(async () => {
  // 1. Validate brand package assets & ICO integrity
  const source = fs
      .readFileSync("public/brand/logo.svg", "utf8")
      .replace(/\r\n/g, "\n"),
    manifest = require("../public/brand/manifest.json");
  assert.equal(
    manifest.sourceSha256,
    crypto.createHash("sha256").update(source).digest("hex"),
  );

  const ico = fs.readFileSync("public/brand/app.ico");
  assert.equal(ico.readUInt16LE(2), 1);
  assert.equal(ico.readUInt16LE(4), 7);
  for (let i = 0; i < 7; i++) {
    const p = 6 + i * 16,
      size = ico.readUInt32LE(p + 8),
      offset = ico.readUInt32LE(p + 12);
    assert(offset + size <= ico.length);
    assert.equal(
      ico.subarray(offset, offset + 8).toString("hex"),
      "89504e470d0a1a0a",
    );
    assert.equal(ico.readUInt32BE(offset + 16), manifest.icoFrames[i]);
    assert.equal(ico.readUInt32BE(offset + 20), manifest.icoFrames[i]);
  }

  for (const size of manifest.sizes) {
    const png = fs.readFileSync(`public/brand/logo-${size}.png`);
    assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
    assert.equal(png.readUInt32BE(16), size);
    assert.equal(png.readUInt32BE(20), size);
  }

  // 2. Validate AnimatedLogo.tsx & OfficialLogo.tsx geometric alignment & animation masks
  const animatedSrc = fs.readFileSync("src/components/AnimatedLogo.tsx", "utf8");
  const officialSrc = fs.readFileSync("src/components/OfficialLogo.tsx", "utf8");
  const connectionSrc = fs.readFileSync(
    "src/components/ConnectionScreen.tsx",
    "utf8",
  );

  assert(
    animatedSrc.includes(`viewBox="${EXPECTED_VIEWBOX}"`),
    "AnimatedLogo must use viewBox 0 0 1817 1989",
  );
  assert(
    officialSrc.includes(`viewBox="${EXPECTED_VIEWBOX}"`),
    "OfficialLogo must use viewBox 0 0 1817 1989",
  );

  // Both components must share the exact same 2 ribbon geometry paths and colors
  for (const [name, content] of [
    ["AnimatedLogo.tsx", animatedSrc],
    ["OfficialLogo.tsx", officialSrc],
  ]) {
    assert(
      content.includes(EXPECTED_INDIGO_PATH),
      `${name} must contain the exact Indigo ribbon path`,
    );
    assert(
      content.includes(EXPECTED_TEAL_PATH),
      `${name} must contain the exact Teal ribbon path`,
    );
    assert(
      content.includes('fill="#29256B"'),
      `${name} must use #29256B for Indigo ribbon`,
    );
    assert(
      content.includes('fill="#12C9BD"'),
      `${name} must use #12C9BD for Teal ribbon`,
    );
  }

  // AnimatedLogo specific checks (useId masks, strokeWidth 520, pathLength 1, keyframes 4.2s cubic-bezier)
  assert(
    animatedSrc.includes("useId") &&
      animatedSrc.includes("cbs-mask-indigo-") &&
      animatedSrc.includes("cbs-mask-teal-"),
    "AnimatedLogo must generate dynamic mask IDs via useId()",
  );
  assert(
    animatedSrc.includes('strokeWidth="520"') &&
      animatedSrc.includes("pathLength={1}"),
    "AnimatedLogo masks must configure strokeWidth=520 and pathLength=1",
  );
  assert(
    animatedSrc.includes("@keyframes cbsFlowIndigo") &&
      animatedSrc.includes("@keyframes cbsFlowTeal") &&
      animatedSrc.includes("4.2s cubic-bezier(0.45, 0, 0.15, 1) infinite"),
    "AnimatedLogo must define continuous 4.2s cubic-bezier flow keyframes",
  );

  // Static OfficialLogo must NOT include animation masks
  assert(
    !officialSrc.includes("<mask") && !officialSrc.includes("cbsFlowIndigo"),
    "OfficialLogo must remain a static geometric SVG without animation masks",
  );

  // ConnectionScreen usage verification
  assert(
    connectionSrc.includes("<AnimatedLogo") &&
      /size=\{(88|96)\}/.test(connectionSrc),
    "ConnectionScreen must render centered <AnimatedLogo /> with size 88 or 96",
  );

  console.log(
    "PASS AnimatedLogo (4.2s flow masks 1->2 & 3->4), OfficialLogo static 1817x1989 geometric alignment, ConnectionScreen integration, and brand PNG/ICO assets",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
