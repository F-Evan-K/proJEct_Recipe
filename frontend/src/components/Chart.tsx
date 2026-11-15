export function Chart({ period }: { period: string }) {
  const past = period === "Minggu lalu";
  return (
    <div className="chart">
      <div className="legend">
        <span>
          <i />
          Aktual demo
        </span>
        <span>
          <i className="forecast-line" />
          Estimasi demo
        </span>
      </div>
      <div className="chart-plot">
        <div className="y-labels">
          <span>300</span>
          <span>225</span>
          <span>150</span>
          <span>75</span>
          <span>0</span>
        </div>
        <svg
          viewBox="0 0 700 210"
          preserveAspectRatio="none"
          role="img"
          aria-label="Grafik ilustrasi penjualan aktual dan estimasi, bukan output model"
        >
          <defs>
            <linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#a7bb9d" stopOpacity=".35" />
              <stop offset="100%" stopColor="#a7bb9d" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[15, 60, 105, 150, 195].map((y) => (
            <line
              key={y}
              x1="0"
              x2="700"
              y1={y}
              y2={y}
              stroke="#edf0ea"
              strokeDasharray="4 4"
            />
          ))}
          <path
            d={
              past
                ? "M0 155 C40 155 65 100 115 110 S190 160 230 120 S305 140 345 90 S420 80 460 60 S530 115 575 70 S655 110 700 80 L700 210 L0 210Z"
                : "M0 145 C40 145 65 85 115 105 S190 165 230 115 S305 120 345 78 S420 102 460 58 S530 95 575 50 S655 92 700 43 L700 210 L0 210Z"
            }
            fill="url(#area)"
          />
          <path
            d={
              past
                ? "M0 155 C40 155 65 100 115 110 S190 160 230 120 S305 140 345 90 S420 80 460 60 S530 115 575 70 S655 110 700 80"
                : "M0 145 C40 145 65 85 115 105 S190 165 230 115 S305 120 345 78 S420 102 460 58 S530 95 575 50 S655 92 700 43"
            }
            fill="none"
            stroke="#52745d"
            strokeWidth="3"
          />
          <path
            d="M0 160 C40 145 65 110 115 120 S190 135 230 100 S305 110 345 93 S420 77 460 75 S530 70 575 68 S655 65 700 30"
            fill="none"
            stroke="#b9a56e"
            strokeWidth="2.5"
            strokeDasharray="6 6"
          />
        </svg>
      </div>
      <div className="x-labels">
        {[
          "Sen, 9",
          "Sel, 10",
          "Rab, 11",
          "Kam, 12",
          "Jum, 13",
          "Sab, 14",
          "Min, 15",
        ].map((s) => (
          <span key={s}>{s}</span>
        ))}
      </div>
    </div>
  );
}
