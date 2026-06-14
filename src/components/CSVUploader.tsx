import React, { useState, useRef } from "react";
import Papa from "papaparse";
import { Upload, FileSpreadsheet, Check, AlertCircle, Info, ChevronRight, PenLine, Plus, Trash2, X } from "lucide-react";
import { Recipient } from "../types";

interface CSVUploaderProps {
  onDataParsed: (data: {
    headers: string[];
    records: Record<string, string>[];
    emailFieldName: string;
    nameFieldName: string;
    fileName: string;
  }) => void;
  onManualRecipients: (recipients: Recipient[]) => void;
  currentFileName: string;
  currentRecordCount: number;
}

export default function CSVUploader({ onDataParsed, onManualRecipients, currentFileName, currentRecordCount }: CSVUploaderProps) {
  const [mode, setMode] = useState<'upload' | 'manual'>('upload');
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<Record<string, string>[]>([]);
  const [selectedEmail, setSelectedEmail] = useState("");
  const [selectedName, setSelectedName] = useState("");
  const [tempRecords, setTempRecords] = useState<Record<string, string>[]>([]);
  const [tempFileName, setTempFileName] = useState("");

  // Manual entry state
  const [manualRows, setManualRows] = useState<{ email: string; name: string }[]>([
    { email: "", name: "" },
  ]);
  const [manualError, setManualError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCSVParse = (file: File) => {
    setError(null);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: "greedy",
      complete: (results) => {
        if (results.errors.length > 0 && results.data.length === 0) {
          setError(`Parsing Error: ${results.errors[0].message}`);
          return;
        }
        const cols = results.meta.fields || [];
        if (cols.length === 0) { setError("No headers found."); return; }
        if (results.data.length === 0) { setError("CSV has 0 contact rows."); return; }

        const parsedData = results.data.map((record) => {
          const cleaned: Record<string, string> = {};
          cols.forEach((col) => { cleaned[col] = (record[col] || "").trim(); });
          return cleaned;
        });

        const emailGuess = cols.find((c) => {
          const l = c.toLowerCase();
          return l.includes("email") || l.includes("mail") || l.includes("e-mail") || l.includes("id");
        }) || cols[0];
        const nameGuess = cols.find((c) => {
          const l = c.toLowerCase();
          return l.includes("name") || l.includes("first") || l.includes("customer") || l.includes("user");
        }) || cols[1] || cols[0];

        setHeaders(cols);
        setTempRecords(parsedData);
        setPreviewRows(parsedData.slice(0, 5));
        setSelectedEmail(emailGuess);
        setSelectedName(nameGuess);
        setTempFileName(file.name);
      },
      error: (err) => { setError(`CSV Parser Error: ${err.message}`); },
    });
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) {
      const file = e.dataTransfer.files[0];
      if (file.name.endsWith(".csv") || file.type === "text/csv") handleCSVParse(file);
      else setError("Invalid File Format. Please upload a .CSV file.");
    }
  };

  const handleApplyMapping = () => {
    if (!selectedEmail) { setError("Please select the Email field."); return; }
    onDataParsed({ headers, records: tempRecords, emailFieldName: selectedEmail, nameFieldName: selectedName, fileName: tempFileName });
    setTempFileName(""); setHeaders([]); setTempRecords([]); setPreviewRows([]);
  };

  const handleAddRow = () => setManualRows((prev) => [...prev, { email: "", name: "" }]);

  const handleRemoveRow = (idx: number) => {
    if (manualRows.length === 1) return;
    setManualRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleRowChange = (idx: number, field: "email" | "name", value: string) => {
    setManualRows((prev) => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  };

  const handleManualSubmit = () => {
    setManualError(null);
    const valid = manualRows.filter((r) => r.email.trim() !== "");
    if (valid.length === 0) { setManualError("Kam se kam 1 email address daalo."); return; }
    const invalid = valid.find((r) => !r.email.includes("@"));
    if (invalid) { setManualError(`Invalid email: ${invalid.email}`); return; }

    const recipients: Recipient[] = valid.map((r, i) => ({
      id: String(i + 1),
      email: r.email.trim(),
      row: { Email: r.email.trim(), Name: r.name.trim() },
      status: "idle",
    }));
    onManualRecipients(recipients);
    setManualRows([{ email: "", name: "" }]);
  };

  return (
    <div id="csv-uploader" className="bg-[#0f0f10] border border-white/10 rounded-2xl shadow-sm overflow-hidden h-full">
      <div className="bg-[#0D0D0E] border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white/5 text-amber-500 rounded-xl border border-white/10">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-white text-base">Recipients</h3>
            <p className="text-xs text-gray-400">CSV upload karo ya manually email daalo</p>
          </div>
        </div>
        {currentRecordCount > 0 && (
          <span className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full text-xs font-semibold text-amber-400">
            <Check className="w-3.5 h-3.5" /> {currentRecordCount} Loaded
          </span>
        )}
      </div>

      {/* Mode Toggle */}
      <div className="px-6 pt-5">
        <div className="flex gap-2 p-1 bg-white/5 border border-white/10 rounded-xl w-fit">
          <button
            type="button"
            onClick={() => { setMode('upload'); setError(null); }}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              mode === 'upload' ? 'bg-amber-500 text-black shadow-sm' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Upload className="w-3.5 h-3.5" /> CSV Upload
          </button>
          <button
            type="button"
            onClick={() => { setMode('manual'); setError(null); }}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              mode === 'manual' ? 'bg-amber-500 text-black shadow-sm' : 'text-gray-400 hover:text-white'
            }`}
          >
            <PenLine className="w-3.5 h-3.5" /> Manual Entry
          </button>
        </div>
      </div>

      <div className="p-6 space-y-5">
        {/* ── CSV UPLOAD MODE ── */}
        {mode === 'upload' && (
          <>
            {headers.length === 0 && (
              <div
                onDragEnter={handleDrag} onDragOver={handleDrag} onDragLeave={handleDrag} onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`cursor-pointer border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center transition-all min-h-[200px] ${
                  dragActive ? "border-amber-500 bg-amber-500/5" : "border-white/10 hover:border-amber-500/40 hover:bg-white/10"
                }`}
              >
                <input type="file" ref={fileInputRef} onChange={(e) => e.target.files?.[0] && handleCSVParse(e.target.files[0])} accept=".csv" className="hidden" />
                <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 mb-4 shadow-sm">
                  <Upload className="w-5 h-5 text-amber-500" />
                </div>
                <h4 className="text-sm font-semibold text-white mb-1">
                  Drag & drop CSV, ya <span className="text-amber-400 font-medium font-serif italic">browse karo</span>
                </h4>
                <p className="text-xs text-gray-400 max-w-[280px] mx-auto mt-0.5">
                  Comma, semicolon ya tab separated — sab support hai.
                </p>
                {currentFileName && (
                  <div className="mt-4 px-3 py-1.5 bg-[#0C0C0D] border border-white/5 rounded-xl max-w-sm text-xs truncate text-gray-300 font-mono">
                    Active: {currentFileName} ({currentRecordCount} rows)
                  </div>
                )}
              </div>
            )}

            {error && (
              <div className="flex items-start gap-2.5 p-3 bg-rose-950/40 border border-rose-500/20 rounded-xl text-rose-300 text-xs text-left">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {headers.length > 0 && (
              <div className="space-y-5 animate-fade-in text-left">
                <div className="p-3.5 bg-white/5 border border-amber-500/20 rounded-xl flex items-start gap-3">
                  <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <div className="text-xs text-gray-300 leading-relaxed">
                    <span className="font-semibold text-amber-400">File Detected:</span> &ldquo;{tempFileName}&rdquo; —{" "}
                    <span className="font-bold text-white">{tempRecords.length} records</span>, {" "}
                    <span className="font-bold text-white">{headers.length} columns</span>. Fields confirm karo.
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white/5 border border-white/10 p-4 rounded-xl">
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 mb-1.5">Email Column <span className="text-rose-500">*</span></label>
                    <select value={selectedEmail} onChange={(e) => setSelectedEmail(e.target.value)}
                      className="w-full text-xs bg-[#141416] border border-white/10 text-white rounded-lg px-3 py-2 outline-none focus:border-amber-500 font-medium">
                      <option value="">-- Select --</option>
                      {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5">Name Column</label>
                    <select value={selectedName} onChange={(e) => setSelectedName(e.target.value)}
                      className="w-full text-xs bg-[#141416] border border-white/10 text-white rounded-lg px-3 py-2 outline-none focus:border-amber-500 font-medium">
                      <option value="">-- Skip --</option>
                      {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <h5 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Preview (first 5)</h5>
                  <div className="overflow-x-auto border border-white/10 rounded-xl bg-[#0C0C0D]">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-[#121214] border-b border-white/10 text-gray-300">
                          {headers.slice(0, 4).map((h) => <th key={h} className="px-3.5 py-2 font-semibold truncate max-w-[150px]">{h}</th>)}
                          {headers.length > 4 && <th className="px-3.5 py-2 font-semibold text-gray-400 italic">+{headers.length - 4} more</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {previewRows.map((row, idx) => (
                          <tr key={idx} className="border-b last:border-0 border-white/5 hover:bg-white/5">
                            {headers.slice(0, 4).map((h) => <td key={h} className="px-3.5 py-2 text-gray-300 truncate max-w-[150px]">{row[h] || "-"}</td>)}
                            {headers.length > 4 && <td className="px-3.5 py-2 text-gray-400" />}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="flex gap-2.5 justify-end">
                  <button type="button" onClick={() => { setHeaders([]); setTempRecords([]); }}
                    className="px-4 py-2 border border-white/10 text-gray-300 rounded-lg text-xs font-semibold hover:bg-white/10 transition-all cursor-pointer">
                    Cancel
                  </button>
                  <button type="button" onClick={handleApplyMapping}
                    className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-black px-5 py-2 rounded-lg text-xs font-semibold shadow-[0_4px_12px_rgba(245,158,11,0.15)] transition-all cursor-pointer">
                    Import List <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {currentRecordCount > 0 && headers.length === 0 && (
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex gap-3 text-left">
                <div className="text-xs text-gray-300 space-y-1">
                  <p className="font-semibold text-white">
                    Active: <span className="font-mono text-amber-400">{currentFileName}</span>
                  </p>
                  <p className="text-gray-400 leading-relaxed text-[11px]">
                    Use {`{Name}`}, {`{Company}`} placeholders in your template — CSV columns se automatically replace honge.
                  </p>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── MANUAL ENTRY MODE ── */}
        {mode === 'manual' && (
          <div className="space-y-4">
            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {manualRows.map((row, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <input
                    type="email"
                    placeholder="email@example.com"
                    value={row.email}
                    onChange={(e) => handleRowChange(idx, "email", e.target.value)}
                    className="flex-1 text-sm border border-white/10 rounded-xl px-3 py-2.5 bg-white/5 focus:bg-white/10 focus:border-amber-500 text-white transition-all outline-none placeholder-gray-600"
                  />
                  <input
                    type="text"
                    placeholder="Name (optional)"
                    value={row.name}
                    onChange={(e) => handleRowChange(idx, "name", e.target.value)}
                    className="flex-1 text-sm border border-white/10 rounded-xl px-3 py-2.5 bg-white/5 focus:bg-white/10 focus:border-amber-500 text-white transition-all outline-none placeholder-gray-600"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveRow(idx)}
                    disabled={manualRows.length === 1}
                    className="p-2 text-gray-500 hover:text-rose-400 disabled:opacity-20 transition-all cursor-pointer rounded-lg hover:bg-rose-500/10"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            {manualError && (
              <div className="flex items-center gap-2 p-3 bg-rose-950/40 border border-rose-500/20 rounded-xl text-rose-300 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" /> {manualError}
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <button type="button" onClick={handleAddRow}
                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-amber-400 border border-white/10 hover:border-amber-500/30 px-3 py-2 rounded-lg transition-all cursor-pointer">
                <Plus className="w-3.5 h-3.5" /> Row Add Karo
              </button>
              <button type="button" onClick={handleManualSubmit}
                className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-black px-5 py-2 rounded-lg text-xs font-semibold shadow-[0_4px_12px_rgba(245,158,11,0.15)] transition-all cursor-pointer">
                <Check className="w-3.5 h-3.5" /> Add to Queue
              </button>
            </div>

            {currentRecordCount > 0 && (
              <div className="p-3 bg-emerald-950/30 border border-emerald-500/20 rounded-xl text-xs text-emerald-400">
                ✓ {currentRecordCount} recipients queued — ab Template tab pe jao
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}