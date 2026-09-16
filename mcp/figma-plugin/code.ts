// Figma Slides MCP semantic beta plugin sandbox.
figma.showUI(__html__, { visible: false, width: 0, height: 0 });

type AnyNode = any;
const MAX_TEXT_CHARACTERS = 500;
const MAX_INSPECT_NODES = 200;
const UNRESIZABLE_TYPES = ["SLIDE", "SLIDE_ROW", "SLIDE_GRID"];

function serializeNode(node: AnyNode): Record<string, unknown> {
  const out: Record<string, unknown> = { id: node.id, name: node.name, type: node.type, x: node.x, y: node.y, width: node.width, height: node.height, visible: node.visible };
  if ("opacity" in node) out.opacity = node.opacity;
  if ("characters" in node) {
    const text = String(node.characters ?? "");
    out.characters = text.slice(0, MAX_TEXT_CHARACTERS);
    if (text.length > MAX_TEXT_CHARACTERS) out.charactersTruncated = true;
  }
  if ("fontName" in node) out.fontName = node.fontName;
  if ("fontSize" in node) out.fontSize = node.fontSize;
  if ("fills" in node) { try { out.fills = JSON.parse(JSON.stringify(node.fills)); } catch (_) {} }
  if ("strokes" in node) { try { out.strokes = JSON.parse(JSON.stringify(node.strokes)); } catch (_) {} }
  if ("rotation" in node) out.rotation = node.rotation;
  if (node.absoluteBoundingBox) out.absoluteBoundingBox = node.absoluteBoundingBox;
  if ("children" in node) out.childCount = node.children.length;
  return out;
}
function findSlides(): AnyNode[] {
  const slides: AnyNode[] = [];
  for (const child of figma.currentPage.children) if (child.type === "SLIDE_GRID" && "children" in child) for (const row of child.children) if (row.type === "SLIDE_ROW" && "children" in row) for (const slide of row.children) slides.push(slide);
  if (!slides.length) for (const child of figma.currentPage.children) if (child.type === "FRAME" || child.type === "SLIDE") slides.push(child);
  return slides;
}
function getSlide(index: number): AnyNode | null { return findSlides()[index] ?? null; }
function firstText(node: AnyNode): string | null { if (node.type === "TEXT" && node.characters?.trim()) return node.characters.trim().slice(0, MAX_TEXT_CHARACTERS); if ("children" in node) for (const child of node.children) { const text = firstText(child); if (text) return text; } return null; }
function walk(node: AnyNode, output: AnyNode[]): boolean {
  if (output.length >= MAX_INSPECT_NODES) return true;
  output.push(serializeNode(node));
  if ("children" in node) for (const child of node.children) if (walk(child, output)) return true;
  return false;
}
// Slide-only resolver: an id must name a presentation slide, never an arbitrary child node.
// Arbitrary-node behaviour, if ever wanted, belongs in separately named tools.
function resolveSlide(id?: string, index?: number): AnyNode | null {
  if (id === undefined) return getSlide(index as number);
  for (const slide of findSlides()) if (slide.id === id) return slide;
  return null;
}
function slideNotFound(id?: string, index?: number): { success: false; error: string } {
  return { success: false, error: id ? `No slide found with id ${id}. Use inspect_deck to list valid presentation slide IDs.` : `Slide at index ${index} not found` };
}

async function handleCommand(command: string, params: Record<string, unknown>): Promise<{ success: true; data?: unknown } | { success: false; error: string }> {
  try {
    if (command === "bridge_health") return { success: true, data: { fileName: figma.root.name, pageName: figma.currentPage.name, slideCount: findSlides().length } };
    if (command === "inspect_deck") {
      await figma.loadAllPagesAsync();
      return { success: true, data: findSlides().map((slide, index) => ({ index, id: slide.id, name: slide.name, title: firstText(slide), isSkippedSlide: !!slide.isSkippedSlide, width: slide.width, height: slide.height })) };
    }
    if (command === "inspect_slide") {
      await figma.loadAllPagesAsync();
      const slide = resolveSlide(params.id as string | undefined, params.index as number | undefined);
      if (!slide) return slideNotFound(params.id as string | undefined, params.index as number | undefined);
      const nodes: AnyNode[] = [];
      const truncated = walk(slide, nodes);
      return { success: true, data: { index: findSlides().findIndex(candidate => candidate.id === slide.id), id: slide.id, name: slide.name, title: firstText(slide), width: slide.width, height: slide.height, isSkippedSlide: !!slide.isSkippedSlide, nodes, truncated, nodeLimit: MAX_INSPECT_NODES } };
    }
    if (command === "inspect_nodes") {
      await figma.loadAllPagesAsync();
      const results = [];
      for (const id of params.ids as string[]) {
        const node = await figma.getNodeByIdAsync(id) as AnyNode | null;
        results.push(node ? serializeNode(node) : { id, missing: true });
      }
      return { success: true, data: results };
    }
    if (command === "resize_nodes") {
      const results = [];
      let partial = false;
      for (const item of params.nodes as Array<{ id: string; width: number; height: number }>) {
        try {
          const node = await figma.getNodeByIdAsync(item.id) as AnyNode | null;
          if (!node) { partial = true; results.push({ id: item.id, ok: false, error: "Node not found" }); continue; }
          if (UNRESIZABLE_TYPES.indexOf(node.type) >= 0) { partial = true; results.push({ id: item.id, ok: false, error: `Cannot resize ${node.type} nodes; slide and slide-container dimensions are controlled by the deck.` }); continue; }
          if (node.type === "TEXT") { partial = true; results.push({ id: item.id, ok: false, error: "Cannot resize TEXT nodes; change fontSize or textAutoResize via execute instead." }); continue; }
          if ("layoutMode" in node && node.layoutMode !== "NONE") { partial = true; results.push({ id: item.id, ok: false, error: `Cannot resize auto-layout node (layoutMode ${node.layoutMode}); its size is computed by its layout.` }); continue; }
          if (typeof node.resize !== "function") { partial = true; results.push({ id: item.id, ok: false, error: `Node type ${node.type} is not resizable` }); continue; }
          node.resize(item.width, item.height);
          results.push({ id: item.id, ok: true, requested: { width: item.width, height: item.height }, measured: { width: node.width, height: node.height } });
        } catch (error: any) {
          partial = true;
          results.push({ id: item.id, ok: false, error: error?.message || String(error) });
        }
      }
      return { success: true, data: { partial, results } };
    }
    if (command === "duplicate_slide") {
      await figma.loadAllPagesAsync();
      const source = resolveSlide(params.id as string | undefined, params.index as number | undefined);
      if (!source) return slideNotFound(params.id as string | undefined, params.index as number | undefined);
      const parent = source.parent as AnyNode;
      if (!parent || typeof parent.insertChild !== "function") return { success: false, error: "Slide parent does not support insertion" };
      const sourceIndex = parent.children.indexOf(source);
      const clone = source.clone();
      parent.insertChild(sourceIndex + 1, clone);
      return { success: true, data: { sourceId: source.id, newId: clone.id, index: findSlides().findIndex(slide => slide.id === clone.id), isSkippedSlide: !!clone.isSkippedSlide } };
    }
    if (command === "execute") {
      const code = params.code as string;
      if (!code) return { success: false, error: "No code provided" };
      const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
      const fn = new AsyncFunction("figma", "getSlide", "findSlides", "serialize", "loadFont", code);
      return { success: true, data: await fn(figma, getSlide, findSlides, serializeNode, (family: string, style = "Regular") => figma.loadFontAsync({ family, style })) };
    }
    if (command === "screenshot_slide") {
      await figma.loadAllPagesAsync();
      const id = params.id as string | undefined;
      const index = (params.index !== undefined ? params.index : params.slideIndex) as number | undefined;
      const slide = resolveSlide(id, index);
      if (!slide) return slideNotFound(id, index);
      const slideIndex = findSlides().findIndex((candidate: AnyNode) => candidate.id === slide.id);
      if (!("exportAsync" in slide) && "children" in slide) {
        const child = slide.children.find((candidate: AnyNode) => "exportAsync" in candidate);
        if (child) return exportSlide(child, params, slide.id, slideIndex);
      }
      return exportSlide(slide, params, slide.id, slideIndex);
    }
    return { success: false, error: `Unknown command: ${command}` };
  } catch (error: any) { return { success: false, error: error?.message || String(error) }; }
}
async function exportSlide(node: AnyNode, params: Record<string, unknown>, slideId: string, slideIndex: number): Promise<{ success: true; data: unknown } | { success: false; error: string }> {
  if (!("exportAsync" in node)) return { success: false, error: "Slide node type does not support export" };
  const bytes = await node.exportAsync({ format: "PNG", constraint: { type: "SCALE", value: (params.scale as number) ?? 1 } });
  return { success: true, data: { base64: figma.base64Encode(bytes), format: "png", id: slideId, index: slideIndex, slideIndex } };
}
figma.ui.onmessage = async (msg: { id: string; command: string; params: Record<string, unknown> }) => { if (!msg.id || !msg.command) return; figma.ui.postMessage({ id: msg.id, ...(await handleCommand(msg.command, msg.params || {})) }); };
