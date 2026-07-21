import { useMemo } from "react";

function base64ToBlobUrl(base64, mimeType = "application/pdf") {
  try {
    const byteChars = atob(base64);
    const byteNums = new Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) {
      byteNums[i] = byteChars.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNums);
    const blob = new Blob([byteArray], { type: mimeType });
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

export function PDFViewer({ pdfFile, title }) {
  const blobUrl = useMemo(() => {
    if (!pdfFile) return null;
    if (pdfFile.startsWith("data:")) {
      const base64 = pdfFile.split(",")[1];
      return base64ToBlobUrl(base64);
    }
    if (pdfFile.startsWith("http") || pdfFile.startsWith("/")) {
      return pdfFile;
    }
    return base64ToBlobUrl(pdfFile);
  }, [pdfFile]);

  if (!blobUrl) {
    return (
      <div className="flex items-center justify-center h-64 rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)]">
        <p className="text-sm text-[var(--text-muted)]">Nenhum PDF disponível para este livro.</p>
      </div>
    );
  }

  return (
    <div className="rounded-[12px] border border-[var(--border)] overflow-hidden bg-[var(--bg-card)]">
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border)] bg-[var(--hover-overlay)]">
        <span className="text-xs font-medium text-[var(--text-secondary)] truncate">{title || "Documento"}</span>
        <span className="text-[10px] text-[var(--text-muted)]">Visualização</span>
      </div>
      <div className="w-full" style={{ height: "calc(100vh - 280px)", minHeight: "500px" }}>
        <iframe
          src={blobUrl}
          title={title || "PDF"}
          className="w-full h-full border-0"
        />
      </div>
    </div>
  );
}
