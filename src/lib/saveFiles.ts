import JSZip from "jszip";

export type BundleFile = { name: string; data: Blob | Uint8Array | string };

// File System Access API -- Chromium only, so callers must feature-detect before offering the
// "save straight into a folder" option and fall back to a zip everywhere else.
export function canSaveToFolder(): boolean {
  return typeof window !== "undefined" && "showDirectoryPicker" in window;
}

// Must be called straight from a click handler (before any await) -- the browser only allows the
// folder picker while the click's user activation is still alive.
export function pickFolder(): Promise<FileSystemDirectoryHandle> {
  return (
    window as unknown as { showDirectoryPicker: () => Promise<FileSystemDirectoryHandle> }
  ).showDirectoryPicker();
}

// Writes every file into one subfolder (created if needed) of the picked folder, so one batch's
// models, shipping CSV and summary PDF all end up together instead of mixed in with other batches.
export async function writeFilesToFolder(
  parent: FileSystemDirectoryHandle,
  subfolderName: string | null,
  files: BundleFile[]
): Promise<void> {
  const dir = subfolderName
    ? await parent.getDirectoryHandle(subfolderName, { create: true })
    : parent;
  for (const file of files) {
    const handle = await dir.getFileHandle(file.name, { create: true });
    const writable = await handle.createWritable();
    await writable.write(file.data as FileSystemWriteChunkType);
    await writable.close();
  }
}

// folderName null puts the files at the zip's root; otherwise they're all nested in one folder.
export async function downloadFilesAsZip(
  zipFilename: string,
  folderName: string | null,
  files: BundleFile[]
): Promise<void> {
  const zip = new JSZip();
  const folder = (folderName ? zip.folder(folderName) : null) ?? zip;
  for (const file of files) folder.file(file.name, file.data);
  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = zipFilename;
  a.click();
  URL.revokeObjectURL(url);
}
