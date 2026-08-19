export type ProjectImportFile = { size: number; text: () => Promise<string> };

export async function readProjectImportFile(file: ProjectImportFile, maximumBytes = 5_000_000): Promise<string> {
  if (file.size > maximumBytes) throw new Error("PROJECT_FILE_TOO_LARGE");
  const content = await file.text();
  if (!content.trim()) throw new Error("PROJECT_FILE_EMPTY");
  return content;
}

export type BrowserDownloadEnvironment = {
  createBlob: (content: string, contentType: string) => Blob;
  createObjectUrl: (blob: Blob) => string;
  revokeObjectUrl: (url: string) => void;
  createAnchor: () => { href: string; download: string; click: () => void };
};

function browserEnvironment(): BrowserDownloadEnvironment {
  return {
    createBlob: (content, contentType) => new Blob([content], { type: contentType }),
    createObjectUrl: (blob) => URL.createObjectURL(blob),
    revokeObjectUrl: (url) => URL.revokeObjectURL(url),
    createAnchor: () => document.createElement("a"),
  };
}

export function triggerProjectFileDownload(content: string, fileName = "takeoff-project.json", environment = browserEnvironment()) {
  const blob = environment.createBlob(content, "application/json;charset=utf-8");
  const url = environment.createObjectUrl(blob);
  const anchor = environment.createAnchor();
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  environment.revokeObjectUrl(url);
}
