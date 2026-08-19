import { canClaimPendingWin } from "../src/lib/wheel";

const now = Date.now();
const liveWin = {
  won: true,
  claimedAt: null,
  cancelledAt: null,
  createdAt: new Date(now - 60_000),
  claimDeadline: new Date(now + 30_000),
};

const expiredWin = {
  won: true,
  claimedAt: null,
  cancelledAt: null,
  createdAt: new Date(now - 10 * 60_000),
  claimDeadline: new Date(now - 5_000),
};

if (!canClaimPendingWin(liveWin as any, 5, now)) {
  throw new Error("Aktif ödülün alınabilirliği false dönmemeli.");
}

if (canClaimPendingWin(expiredWin as any, 5, now)) {
  throw new Error("Süresi dolmuş ödül alınabilir olarak işaretlenmemeli.");
}

console.log("wheel claim regression ok");
