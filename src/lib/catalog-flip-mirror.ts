/**
 * Curl modunda geri çevirme: kütüphane singlePage'de BACK'i animasyonsuz yapıyor.
 * swipe/ok → bizim CSS rulo callback'imize yönlendirilir.
 */

type PageFlipLike = {
  flipPrev?: (corner?: string) => void;
  turnToPrevPage?: () => void;
  turnToPage?: (page: number) => void;
  __cssPrevPatched?: boolean;
};

export function patchCatalogFlipPrev(
  pageFlip: PageFlipLike | null | undefined,
  onPrev: () => void,
) {
  if (!pageFlip || pageFlip.__cssPrevPatched) return;
  if (typeof pageFlip.flipPrev !== "function") return;

  pageFlip.flipPrev = () => {
    onPrev();
  };
  pageFlip.__cssPrevPatched = true;
}
