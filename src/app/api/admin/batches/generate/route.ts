import { NextResponse, type NextRequest } from "next/server";
import { verifyAdminRequest } from "@/lib/adminAuth";
import { buildGridSequence, MAX_CAPACITY } from "@/lib/batches";
import { adminDb } from "@/lib/firebaseAdmin";
import { buildBatchEntry, itemQuantity } from "@/lib/batchEntries";
import type { ColorQuantities } from "@/types/order";
import type { PrintBatchOrderEntry } from "@/types/batch";

export async function POST(request: NextRequest) {
  const admin = await verifyAdminRequest(request);
  if (!admin) {
    return NextResponse.json({ error: "管理者権限が必要です" }, { status: 403 });
  }

  // Manual mode: admin picked specific pending items on /admin/batches instead of using the
  // auto-fill button. Same grouping logic below, but skips the MAX_CAPACITY trim -- a deliberate
  // manual selection shouldn't get silently truncated (buildGridSequence already handles more
  // cells than MAX_CAPACITY via its own Math.max()).
  let requestedItemIds: string[] | undefined;
  try {
    const body = await request.json();
    if (Array.isArray(body?.itemIds) && body.itemIds.every((v: unknown) => typeof v === "string")) {
      requestedItemIds = body.itemIds;
    }
  } catch {
    // No/empty body -- normal auto-generate request.
  }
  const isManual = !!requestedItemIds && requestedItemIds.length > 0;

  try {
    // Normalize both sources to the same {id, data} shape up front -- adminDb.getAll() returns
    // DocumentSnapshot (data() possibly undefined) while a query's .docs are QueryDocumentSnapshot
    // (data() always defined); unifying here avoids threading that distinction through every
    // .data() access below.
    type Candidate = { id: string; data: FirebaseFirestore.DocumentData };
    let candidates: Candidate[];
    if (isManual) {
      const snaps = await adminDb.getAll(
        ...requestedItemIds!.map((itemId) => adminDb.collection("order_items").doc(itemId))
      );
      candidates = snaps
        .filter((d) => d.exists && d.data()?.status === "pending" && !!d.data()?.scaledModelUrl)
        .map((d) => ({ id: d.id, data: d.data()! }));
    } else {
      const snap = await adminDb
        .collection("order_items")
        .where("status", "==", "pending")
        .orderBy("createdAt", "asc")
        .limit(MAX_CAPACITY * 2)
        .get();
      candidates = snap.docs
        .filter((d) => !!d.data().scaledModelUrl)
        .map((d) => ({ id: d.id, data: d.data() }));
    }

    // Group by orderId first -- a customer's whole set (every design in one order) always lands
    // in the same batch/plate together, never split across two, even if that means a batch runs
    // over the normal MAX_CAPACITY target (the physical plate packing in plateLayout.ts handles
    // any actual size overflow by spanning extra physical plates; this is just about keeping one
    // order's paper work-sheet cells and hollow/hole handling together in one pass).
    type CandidateGroup = { orderId: string; docs: Candidate[] };
    const groupsByOrderId = new Map<string, CandidateGroup>();
    const groupOrder: CandidateGroup[] = [];
    for (const candidate of candidates) {
      const orderId = (candidate.data.orderId as string) ?? candidate.id;
      let group = groupsByOrderId.get(orderId);
      if (!group) {
        group = { orderId, docs: [] };
        groupsByOrderId.set(orderId, group);
        groupOrder.push(group);
      }
      group.docs.push(candidate);
    }

    // Each order_item is one DESIGN, hollowed/hole-cut once -- but a customer can order several
    // physical copies of that same design (colorQuantities summing to >1), and each copy needs
    // its own spot on the print plate. Fill grid cells by physical unit count, not by design
    // count, so a "10個" order actually reserves 10 cells instead of 1.
    function groupQuantity(group: CandidateGroup): number {
      return group.docs.reduce(
        (sum, candidate) => sum + itemQuantity(candidate.data.colorQuantities as ColorQuantities),
        0
      );
    }

    let plannedCells = 0;
    const includedGroups: CandidateGroup[] = [];
    for (const group of groupOrder) {
      const quantity = groupQuantity(group);
      // Always take the very first group even if it alone exceeds MAX_CAPACITY (a single
      // oversized order should never be stuck waiting forever) -- every group after that only
      // joins if it fully fits in what's left, same "don't split, skip and keep looking for a
      // smaller one that fits" behavior as before, just applied per-order instead of per-design.
      // Manual selections skip this trim entirely -- the admin explicitly chose these orders, so
      // none of them should be silently dropped.
      if (!isManual && includedGroups.length > 0 && plannedCells + quantity > MAX_CAPACITY) continue;
      includedGroups.push(group);
      plannedCells += quantity;
    }

    const gridSequence = buildGridSequence(Math.max(MAX_CAPACITY, plannedCells));
    const entries: PrintBatchOrderEntry[] = [];
    let nextGridIndex = 0;
    for (const group of includedGroups) {
      for (const candidate of group.docs) {
        const data = candidate.data;
        const quantity = itemQuantity(data.colorQuantities as ColorQuantities);
        for (let i = 0; i < quantity; i++) {
          entries.push(buildBatchEntry(candidate.id, data, gridSequence[nextGridIndex]));
          nextGridIndex++;
        }
      }
    }

    if (entries.length === 0) {
      return NextResponse.json(
        { error: "バッチ生成対象の未処理アイテムがありません" },
        { status: 400 }
      );
    }

    const batchRef = adminDb.collection("print_batches").doc();
    const writeBatch = adminDb.batch();

    writeBatch.set(batchRef, {
      entries,
      totalCount: entries.length,
      completedCells: [],
      createdAt: new Date(),
    });

    const gridIdsByItem = new Map<string, string[]>();
    for (const entry of entries) {
      const list = gridIdsByItem.get(entry.itemId) ?? [];
      list.push(entry.gridId);
      gridIdsByItem.set(entry.itemId, list);
    }
    for (const [itemId, gridIds] of gridIdsByItem) {
      writeBatch.update(adminDb.collection("order_items").doc(itemId), {
        status: "batched",
        batchId: batchRef.id,
        // A design occupying multiple cells (quantity > 1) stores all of them here, comma
        // joined -- this field is just an admin display convenience; print_batches.entries is
        // the real source of truth for the itemId <-> gridId mapping.
        gridId: gridIds.join(","),
      });
    }

    await writeBatch.commit();

    return NextResponse.json({ batchId: batchRef.id, totalCount: entries.length });
  } catch (error) {
    console.error("batch generation failed", error);
    return NextResponse.json({ error: "バッチ生成に失敗しました" }, { status: 500 });
  }
}
