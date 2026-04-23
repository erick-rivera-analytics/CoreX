"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";

import type { BalanzasNodeData } from "@/lib/postcosecha-balanzas";
import {
  CLEAN_FLOW_ASSET_PATH,
  findLaneBySelection,
  getProcessSelection,
  PROCESS_LANES,
  type BalanzasProcessSelection,
} from "@/modules/postcosecha/lib/balanzas-process-stages";
import { BalanzasProcessEngine, type ProcessEngineHandle } from "@/modules/postcosecha/components/balanzas-process-engine";
import {
  BalanzasProcessTopbar,
  type BalanzasProcessSearchResult,
} from "@/modules/postcosecha/components/balanzas-process-topbar";
import { BalanzasProcessStageNav } from "@/modules/postcosecha/components/balanzas-process-stage-nav";
import { BalanzasProcessNodePanel } from "@/modules/postcosecha/components/balanzas-process-node-panel";

function downloadSvg(svg: string, filename: string) {
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function BalanzasProcessDashboard({
  assetPath,
  metricLabel,
  nodes,
  selection,
  onSelectionChange,
  onExpandDetail,
}: {
  assetPath: string;
  metricLabel: string;
  nodes: BalanzasNodeData[];
  selection: BalanzasProcessSelection | null;
  onSelectionChange: (selection: BalanzasProcessSelection | null) => void;
  onExpandDetail: () => void;
}) {
  const engineRef = useRef<ProcessEngineHandle>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeStageId, setActiveStageId] = useState<string | null>(() => findLaneBySelection(selection)?.id ?? null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<BalanzasProcessSearchResult[]>([]);
  const [zoomPct, setZoomPct] = useState(100);
  const selectedNode = selection
    ? nodes.find((node) => node.key === selection.nodeKey) ?? null
    : null;

  function handleZoomChange(zoom: number) {
    setZoomPct(Math.round(zoom * 100));

    if (searchQuery.trim()) {
      setSearchResults(engineRef.current?.searchNodes(searchQuery) ?? []);
    }
  }

  function handleSearchChange(value: string) {
    setSearchQuery(value);

    if (!value.trim()) {
      setSearchResults([]);
      return;
    }

    setSearchResults(engineRef.current?.searchNodes(value) ?? []);
  }

  function handleStageClick(lane: (typeof PROCESS_LANES)[number]) {
    setActiveStageId(lane.id);
    engineRef.current?.scrollToLane(lane);
    onSelectionChange(lane.selection);
  }

  function handleSearchSelect(result: BalanzasProcessSearchResult) {
    const rawResult = searchResults.find((entry) => entry.id === result.id) ?? null;
    engineRef.current?.focusElement(result.id);
    setSearchQuery(result.name);
    setSearchResults([]);

    if (rawResult?.selection) {
      onSelectionChange(rawResult.selection);
      setActiveStageId(findLaneBySelection(rawResult.selection)?.id ?? null);
    }
  }

  async function handleExport() {
    try {
      const svg = await engineRef.current?.exportSVG();
      if (!svg) {
        return;
      }

      downloadSvg(svg, "flujo-postcosecha-balanzas.svg");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo exportar el BPMN.");
    }
  }

  function handleOpenCleanMap() {
    window.open(CLEAN_FLOW_ASSET_PATH, "_blank", "noopener,noreferrer");
  }

  return (
    <div
      className="starter-panel flex flex-col overflow-hidden border border-border/70 bg-card/92"
      style={{ height: "calc(100dvh - 172px)", minHeight: "600px" }}
    >
      <BalanzasProcessTopbar
        zoomPct={zoomPct}
        searchQuery={searchQuery}
        searchResults={searchResults}
        onSearchChange={handleSearchChange}
        onSearchSelect={handleSearchSelect}
        onZoomIn={() => handleZoomChange(engineRef.current?.zoomBy(0.1) ?? 1)}
        onZoomOut={() => handleZoomChange(engineRef.current?.zoomBy(-0.1) ?? 1)}
        onFit={() => handleZoomChange(engineRef.current?.fitViewport() ?? 1)}
        onExport={handleExport}
        onOpenCleanMap={handleOpenCleanMap}
      />

      <div className="flex min-h-0 flex-1">
        <BalanzasProcessStageNav
          stages={PROCESS_LANES}
          activeStageId={activeStageId}
          collapsed={sidebarCollapsed}
          onStageClick={handleStageClick}
          onToggleCollapse={() => setSidebarCollapsed((current) => !current)}
        />

        <div className="relative min-w-0 flex-1">
          <BalanzasProcessEngine
            ref={engineRef}
            assetPath={assetPath}
            nodes={nodes}
            selection={selection}
            onNodeSelect={(nextSelection) => {
              setActiveStageId(findLaneBySelection(nextSelection)?.id ?? null);
              onSelectionChange(nextSelection);
            }}
            onZoomChange={handleZoomChange}
          />
        </div>

        <BalanzasProcessNodePanel
          node={selectedNode}
          nodes={nodes}
          selection={selection}
          metricLabel={metricLabel}
          onExpand={onExpandDetail}
          onSelectNode={(nodeKey) => {
            const nextSelection = getProcessSelection(nodeKey);
            setActiveStageId(findLaneBySelection(nextSelection)?.id ?? null);
            onSelectionChange(nextSelection);
          }}
          onClose={() => {
            setActiveStageId(null);
            onSelectionChange(null);
          }}
        />
      </div>
    </div>
  );
}
