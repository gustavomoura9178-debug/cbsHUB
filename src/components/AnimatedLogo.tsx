import React, { useId } from 'react';

export interface AnimatedLogoProps {
  className?: string;
  size?: number;
}

export const AnimatedLogo: React.FC<AnimatedLogoProps> = ({
  className = '',
  size = 64,
}) => {
  const uid = useId().replace(/:/g, '');
  const indigoMaskId = `cbs-mask-indigo-${uid}`;
  const tealMaskId = `cbs-mask-teal-${uid}`;

  return (
    <div
      className={`inline-flex items-center justify-center select-none ${className}`}
      style={{ width: size, height: Math.round(size * (1989 / 1817)) }}
      aria-label="cbsHUB Logo"
    >
      <style>{`
        @keyframes cbsFlowIndigo {
          0%, 5% {
            stroke-dashoffset: 1.2;
          }
          35%, 62% {
            stroke-dashoffset: 0;
          }
          85%, 100% {
            stroke-dashoffset: -1.2;
          }
        }

        @keyframes cbsFlowTeal {
          0%, 20% {
            stroke-dashoffset: 1.2;
          }
          50%, 75% {
            stroke-dashoffset: 0;
          }
          97%, 100% {
            stroke-dashoffset: -1.2;
          }
        }

        .cbs-logo-mask-indigo {
          stroke-dasharray: 1 2;
          stroke-dashoffset: 1.2;
          animation: cbsFlowIndigo 4.2s cubic-bezier(0.45, 0, 0.15, 1) infinite;
        }

        .cbs-logo-mask-teal {
          stroke-dasharray: 1 2;
          stroke-dashoffset: 1.2;
          animation: cbsFlowTeal 4.2s cubic-bezier(0.45, 0, 0.15, 1) infinite;
        }
      `}</style>

      <svg
        viewBox="0 0 1817 1989"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full overflow-visible"
      >
        <defs>
          {/* Máscara Fita Superior (Ponto 1 ao 2) */}
          <mask id={indigoMaskId} maskUnits="userSpaceOnUse">
            <path
              d="M1637.26 459.992C1637.26 428.802 1633.37 365.773 1630.39 342.159C1627.23 317.152 1590.32 283.346 1564.62 253.718C1541.65 227.253 1509.67 212.475 1469.4 194.728C1457.14 189.328 1441.04 186.886 1337.68 184.881C1234.32 182.877 1043.64 182.877 941.52 183.85C831.584 184.897 794.413 188.773 744.356 189.746C678.208 191.031 611.576 198.56 574.136 201.538C534.569 204.685 511.225 210.352 465.118 214.303C416.073 218.505 365.946 231.932 330.422 244.727C281.658 262.29 263.59 300.68 239.004 330.161C211.025 363.708 204.63 406.809 193.722 446.048C178.928 499.266 182.932 528.622 176.034 559.105C165.368 606.233 169.135 642.534 165.214 679.974C156.644 761.812 174.972 866.762 186.735 876.579C206.386 892.979 233.874 902.079 246.728 925.693C253.233 937.644 263.413 947.361 276.149 954.23C304.686 961.158 326.266 963.104 399.377 966.052C462.759 967.054 579.502 967.054 699.781 967.054"
              stroke="#ffffff"
              strokeWidth="520"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              pathLength={1}
              className="cbs-logo-mask-indigo"
            />
          </mask>

          {/* Máscara Fita Inferior (Ponto 3 ao 4) */}
          <mask id={tealMaskId} maskUnits="userSpaceOnUse">
            <path
              d="M1106.61 896.301C1106.61 894.355 1106.61 892.41 1164.98 891.407C1223.35 890.405 1340.09 890.405 1408.02 893.324C1491.89 896.927 1513.38 913.93 1525.14 925.693C1548.3 948.851 1546.81 992.407 1553.71 1023.92C1566.1 1080.51 1584.19 1132.03 1599.85 1160.53C1614.37 1186.98 1613.67 1344.99 1597.05 1437.65C1591.59 1468.07 1554.83 1481.9 1530.24 1497.64C1496.9 1518.99 1460.49 1536.97 1424.17 1549.73C1383.7 1563.96 1342.69 1560.55 1286.79 1567.45C1127.54 1587.1 1094.94 1556.66 1042.99 1551.77C963.574 1544.29 904.493 1537.09 845.444 1524.29C829.305 1520.79 812.161 1511.61 710.719 1507.61C609.277 1503.6 424.435 1503.6 326.295 1504.57C228.155 1505.54 222.318 1507.49 214.447 1508.49C206.575 1509.49 196.847 1509.49 186.823 1509.49"
              stroke="#ffffff"
              strokeWidth="520"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              pathLength={1}
              className="cbs-logo-mask-teal"
            />
          </mask>
        </defs>

        <g>
          {/* Fita Indigo */}
          <path
            d="M1392.06 0H424.944C175.839 0 0 182.805 0 449.266V796.285C0 1037.96 152.394 1208.37 380.984 1208.37H562.684C609.574 1208.37 653.534 1192.88 688.702 1158.8L993.489 861.352C1025.73 830.368 1005.21 774.597 961.252 774.597H495.279C457.181 774.597 424.944 740.515 424.944 700.235V539.119C424.944 480.25 468.903 433.774 524.586 433.774H1292.41C1330.51 433.774 1362.75 467.856 1362.75 508.135H1817V449.266C1817 182.805 1641.16 0 1392.06 0Z"
            fill="#29256B"
            mask={`url(#${indigoMaskId})`}
          />

          {/* Fita Teal */}
          <path
            d="M1254.32 697H1436.02C1664.61 697 1817 867.413 1817 1109.09V1301.19C1817 1567.66 1641.16 1750.46 1392.06 1750.46H729.731L348.747 1979.75C310.648 2004.53 263.758 1976.65 263.758 1930.17V1731.87C102.573 1682.3 0 1533.57 0 1332.18V1363.16H454.25V1242.32C454.25 1282.6 486.487 1316.68 524.586 1316.68H1292.41C1348.1 1316.68 1392.06 1270.21 1392.06 1211.34V1205.14C1392.06 1164.86 1359.82 1130.78 1321.72 1130.78H855.748C811.789 1130.78 791.274 1075.01 823.511 1044.02L1128.3 746.575C1163.47 712.492 1207.43 697 1254.32 697Z"
            fill="#12C9BD"
            mask={`url(#${tealMaskId})`}
          />
        </g>
      </svg>
    </div>
  );
};

export default AnimatedLogo;
