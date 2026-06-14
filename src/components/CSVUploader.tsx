import React, { useState, useRef } from "react";
import Papa from "papaparse";
import { Upload, FileSpreadsheet, Check, AlertCircle, Info, ChevronRight } from "lucide-react";

interface CSVUploaderProps {
  onDataParsed: (data: {
    headers: string[];
    records: Record<string, string>[];
    emailFieldName: string;
    nameFieldName: string;
    fileName: string;
  }) => void;
  currentFileName: string;
  currentRecordCount: number;
}

export default function CSVUploader({ onDataParsed, currentFileName, currentRecordCount }: CSVUploaderProps) {
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<Record<string, string>[]>([]);
  const [selectedEmail, setSelectedEmail] = useState("");
  const [selectedName, setSelectedName] = useState("");
  const [tempRecords, setTempRecords] = useState<Record<string, string>[]>([]);
  const [tempFileName, setTempFileName] = useState("");
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
        if (cols.length === 0) {
          setError("No headers found in the uploaded CSV. Ensure it has a header row.");
          return;
        }

        if (results.data.length === 0) {
          setError("The CSV file parsed successfully but contains 0 contact rows.");
          return;
        }

        // Clean values of whitespace
        const parsedData = results.data.map((record) => {
          const cleaned: Record<string, string> = {};
          cols.forEach((col) => {
            cleaned[col] = (record[col] || "").trim();
          });
          return cleaned;
        });

        // Smart detect Email field
        const emailGuess = cols.find((c) => {
          const l = c.toLowerCase();
          return l.includes("email") || l.includes("mail") || l.includes("e-mail") || l.includes("id");
        }) || cols[0];

        // Smart detect Name field
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
      error: (err) => {
        setError(`CSV Parser Error: ${err.message}`);
      },
    });
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.name.endsWith(".csv") || file.type === "text/csv") {
        handleCSVParse(file);
      } else {
        setError("Invalid File Format. Please upload a structured .CSV file.");
      }
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleCSVParse(e.target.files[0]);
    }
  };

  const handleApplyMapping = () => {
    if (!selectedEmail) {
      setError("Please designate which field contains the Recipient's Email.");
      return;
    }
    onDataParsed({
      headers,
      records: tempRecords,
      emailFieldName: selectedEmail,
      nameFieldName: selectedName,
      fileName: tempFileName,
    });
    // Reset local wizard states
    setTempFileName("");
    setHeaders([]);
    setTempRecords([]);
    setPreviewRows([]);
  };

  return (
    <div id="csv-uploader" className="bg-[#0f0f10] border border-white/10 rounded-2xl shadow-sm overflow-hidden h-full">
      <div className="bg-[#0D0D0E] border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white/5 text-amber-500 rounded-xl border border-white/10">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-white text-base">Recipient CSV Upload</h3>
            <p className="text-xs text-gray-400">Import your list of up to 1000+ recipients</p>
          </div>
        </div>
        {currentRecordCount > 0 && (
          <span className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full text-xs font-semibold text-amber-400">
            <Check className="w-3.5 h-3.5" /> {currentRecordCount} Contacts Loaded
          </span>
        )}
      </div>

      <div className="p-6 space-y-6">
        {/* Drag and Drop Zone */}
        {headers.length === 0 && (
          <div
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`cursor-pointer border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center transition-all min-h-[220px] ${
              dragActive
                ? "border-amber-500 bg-amber-500/5"
                : "border-white/10 hover:border-amber-500/40 hover:bg-white/10"
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileInputChange}
              accept=".csv"
              className="hidden"
            />
            <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 mb-4 shadow-sm">
              <Upload className="w-5 h-5 text-amber-500" />
            </div>
            
            <h4 className="text-sm font-semibold text-white mb-1">
              Drag and drop your CSV list here, or <span className="text-amber-400 font-medium font-serif italic tracking-wide">browse files</span>
            </h4>
            <p className="text-xs text-gray-400 max-w-[280px] mx-auto mt-0.5">
              Supports standard commas, semi-colons or tab separators. Perfect for personalized batch fields.
            </p>

            {currentFileName && (
              <div className="mt-4 px-3 py-1.5 bg-[#0C0C0D] border border-white/5 rounded-xl max-w-sm text-xs truncate text-gray-300 font-mono">
                Active File: {currentFileName} ({currentRecordCount} rows)
              </div>
            )}
          </div>
        )}

        {/* Error Feedback */}
        {error && (
          <div className="flex items-start gap-2.5 p-3 bg-rose-950/40 border border-rose-500/20 rounded-xl text-rose-300 text-xs text-left">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Import Issue</p>
              <p className="text-rose-300/90">{error}</p>
            </div>
          </div>
        )}

        {/* Column Mapping Wizard (Visible after CSV parsed) */}
        {headers.length > 0 && (
          <div className="space-y-5 animate-fade-in text-left">
            <div className="p-3.5 bg-amber-550/10 border border-amber-500/20 bg-white/5 rounded-xl flex items-start gap-3">
              <Info className="w-4.5 h-4.5 text-amber-500 shrink-0 mt-0.5" />
              <div className="text-xs text-gray-300 leading-relaxed">
                <span className="font-semibold text-amber-400 font-serif italic tracking-wide">File Detected:</span> &ldquo;{tempFileName}&rdquo; contains{" "}
                <span className="font-bold text-white">{tempRecords.length} records</span> and{" "}
                <span className="font-bold text-white">{headers.length} columns</span>. Please confirm field roles to proceed.
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white/5 border border-white/10 p-4 rounded-xl">
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1.5">
                  Select Email Column <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedEmail}
                  onChange={(e) => setSelectedEmail(e.target.value)}
                  className="w-full text-xs select bg-[#141416] border border-white/10 text-white rounded-lg px-3 py-2 outline-none focus:border-amber-500 font-medium"
                >
                  <option value="">-- Select --</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-gray-400 mt-1">This field is required for deliverability links.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                  Select Recipient Name Column
                </label>
                <select
                  value={selectedName}
                  onChange={(e) => setSelectedName(e.target.value)}
                  className="w-full text-xs select bg-[#141416] border border-white/10 text-white rounded-lg px-3 py-2 outline-none focus:border-amber-500 font-medium"
                >
                  <option value="">-- Skip / No Name Column --</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-gray-400 mt-1">Used for salutations like "Hi {`{Name}`}".</p>
              </div>
            </div>

            {/* Micro Preview Grid */}
            <div>
              <h5 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Preview of first few contacts
              </h5>
              <div className="overflow-x-auto border border-white/10 rounded-xl bg-[#0C0C0D]">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#121214] border-b border-white/10 text-gray-300">
                      {headers.slice(0, 4).map((h) => (
                        <th key={h} className="px-3.5 py-2 font-semibold truncate max-w-[150px]">
                          {h}
                        </th>
                      ))}
                      {headers.length > 4 && (
                        <th className="px-3.5 py-2 font-semibold text-gray-400 italic">+{headers.length - 4} more</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, idx) => (
                      <tr key={idx} className="border-b last:border-0 border-white/5 hover:bg-white/5">
                        {headers.slice(0, 4).map((h) => (
                          <td key={h} className="px-3.5 py-2 text-gray-300 truncate max-w-[150px]">
                            {row[h] || "-"}
                          </td>
                        ))}
                        {headers.length > 4 && <td className="px-3.5 py-2 text-gray-400" />}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex gap-2.5 justify-end">
              <button
                type="button"
                onClick={() => {
                  setHeaders([]);
                  setTempRecords([]);
                }}
                className="px-4 py-2 border border-white/10 text-gray-300 rounded-lg text-xs font-semibold hover:bg-white/10 transition-all cursor-pointer"
              >
                Cancel and Reset
              </button>
              <button
                type="button"
                onClick={handleApplyMapping}
                className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-black px-5 py-2 rounded-lg text-xs font-semibold shadow-[0_4px_12px_rgba(245,158,11,0.15)] transition-all cursor-pointer"
              >
                Apply & Import List <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Post-Upload Information and Tags Guide */}
        {currentRecordCount > 0 && headers.length === 0 && (
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex gap-3 text-left">
            <div className="text-xs text-gray-300 space-y-1">
              <p className="font-semibold text-white">
                Active List: <span className="font-mono text-amber-400">{currentFileName}</span>
              </p>
              <p className="text-gray-400 leading-relaxed text-[11px]">
                You can insert any headers from this sheet into your subject or email text using curly braces. For example, use{" "}
                <span className="font-mono bg-white/5 border border-white/10 text-amber-500 px-1 py-0.5 rounded font-bold">{`{Name}`}</span>{" "}
                or{" "}
                <span className="font-mono bg-white/5 border border-white/10 text-amber-500 px-1 py-0.5 rounded font-bold">{`{Company}`}</span>.
                The system replaces these on the fly as it cycles through each person during transmission.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
