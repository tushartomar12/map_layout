import dynamic from "next/dynamic";
const PlotMap = dynamic(() => import("@/components/PlotMap"), { ssr: false });
import { getPlots } from "@/lib/plots";
import "./map.css";

export default function Home() {
  const plots = getPlots();

  return (
    <div className="map-root flex flex-col">

      <main className="map-main">
        <PlotMap
          plots={plots}
          showLegend={false}
          enableZoom={false}
          showFilters
          backgroundImageUrl="/background"
        />
      </main>
    </div>
  );
}
