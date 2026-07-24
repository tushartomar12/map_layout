import dynamic from "next/dynamic";
const PlotMap = dynamic(() => import("@/components/PlotMap"), { ssr: false });
import { getPlots } from "@/lib/plots";
import "./map.css";

export default function Home() {
  const plots = getPlots();

  return (
    <div className="map-root flex flex-col">
      <header className="map-header flex items-center border-b border-neutral-200 bg-white px-4">
        <h1 className="text-base font-semibold text-neutral-800">
          Plot Map Layout
        </h1>
      </header>
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
