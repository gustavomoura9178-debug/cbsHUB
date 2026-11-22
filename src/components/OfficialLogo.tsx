import React from "react";

export interface OfficialLogoProps {
  className?: string;
  decorative?: boolean;
  size?: number;
}

export function OfficialLogo({
  className = "",
  decorative = false,
  size = 20,
}: OfficialLogoProps) {
  return (
    <svg
      viewBox="0 0 1817 1989"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : "Logo oficial cbsHUB"}
      aria-hidden={decorative || undefined}
      className={`object-contain shrink-0 select-none ${className}`}
      style={{ width: size, height: size }}
    >
      {!decorative && <title>Logo oficial cbsHUB</title>}
      {/* Fita Indigo */}
      <path
        d="M1392.06 0H424.944C175.839 0 0 182.805 0 449.266V796.285C0 1037.96 152.394 1208.37 380.984 1208.37H562.684C609.574 1208.37 653.534 1192.88 688.702 1158.8L993.489 861.352C1025.73 830.368 1005.21 774.597 961.252 774.597H495.279C457.181 774.597 424.944 740.515 424.944 700.235V539.119C424.944 480.25 468.903 433.774 524.586 433.774H1292.41C1330.51 433.774 1362.75 467.856 1362.75 508.135H1817V449.266C1817 182.805 1641.16 0 1392.06 0Z"
        fill="#29256B"
      />
      {/* Fita Teal */}
      <path
        d="M1254.32 697H1436.02C1664.61 697 1817 867.413 1817 1109.09V1301.19C1817 1567.66 1641.16 1750.46 1392.06 1750.46H729.731L348.747 1979.75C310.648 2004.53 263.758 1976.65 263.758 1930.17V1731.87C102.573 1682.3 0 1533.57 0 1332.18V1363.16H454.25V1242.32C454.25 1282.6 486.487 1316.68 524.586 1316.68H1292.41C1348.1 1316.68 1392.06 1270.21 1392.06 1211.34V1205.14C1392.06 1164.86 1359.82 1130.78 1321.72 1130.78H855.748C811.789 1130.78 791.274 1075.01 823.511 1044.02L1128.3 746.575C1163.47 712.492 1207.43 697 1254.32 697Z"
        fill="#12C9BD"
      />
    </svg>
  );
}

export default OfficialLogo;
