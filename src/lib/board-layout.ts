import sharp from "sharp";
import { generateMarkerPng } from "@/lib/marker";
import {
  BOARD_GAP_FACTOR,
  MEDIA_WIDTH_IN_MARKER,
} from "@/lib/marker-constants";

export type BoardCampaign = {
  slug: string;
  name: string;
  wheelEnabled?: boolean;
};

type Composite = {
  input: Buffer;
  left: number;
  top: number;
};

/**
 * Ofsetli ızgara (serpilmiş). minGap medya taşması üst üste binmesin diye.
 */
export async function generateBoardPng(
  campaigns: BoardCampaign[],
  opts?: { cellSize?: number; cols?: number },
) {
  if (campaigns.length === 0) {
    throw new Error("En az bir kampanya gerekli");
  }

  const cellSize = opts?.cellSize ?? 900;
  const cols = Math.min(
    opts?.cols ?? Math.ceil(Math.sqrt(campaigns.length)),
    campaigns.length,
  );
  const rows = Math.ceil(campaigns.length / cols);

  const pitch = Math.ceil(cellSize * MEDIA_WIDTH_IN_MARKER * BOARD_GAP_FACTOR);
  const margin = Math.round(cellSize * 0.35);
  const boardW =
    margin * 2 + pitch * (cols - 1) + cellSize + Math.round(pitch / 2);
  const boardH = margin * 2 + pitch * (rows - 1) + cellSize;

  const markers = await Promise.all(
    campaigns.map(async (c) => ({
      ...c,
      buf: await generateMarkerPng(c.slug, cellSize, {
        wheelEnabled: Boolean(c.wheelEnabled),
      }),
    })),
  );

  const composites: Composite[] = [];
  markers.forEach((m, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const offsetX = row % 2 === 1 ? Math.round(pitch / 2) : 0;
    const maxX = boardW - margin - cellSize;
    const x = Math.min(margin + col * pitch + offsetX, maxX);
    const y = margin + row * pitch;
    composites.push({
      input: m.buf,
      left: Math.max(0, x),
      top: Math.max(0, y),
    });
  });

  const bg = sharp({
    create: {
      width: boardW,
      height: boardH,
      channels: 3,
      background: { r: 245, g: 242, b: 235 },
    },
  });

  return bg.composite(composites).png().toBuffer();
}
