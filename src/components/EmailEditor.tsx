import React, { useState, useRef } from "react";
import { EmailTemplate, AttachmentFile } from "../types";
import {
  FileText,
  Paperclip,
  X,
  Code,
  Sparkles,
  Search,
  Eye,
  Type,
  FileImage,
  AlertCircle,
  HelpCircle,
  Bold,
  Italic,
  Heading1,
  Heading2,
  List,
  Link,
  Minus,
  FileArchive,
  Upload,
} from "lucide-react";

interface EmailEditorProps {
  template: EmailTemplate;
  onChange: (template: EmailTemplate) => void;
  availableFields: string[]; // headers from the parsed CSV
  attachments: AttachmentFile[];
  onAddAttachment: (file: AttachmentFile) => void;
  onRemoveAttachment: (index: number) => void;
  sampleRecord?: Record<string, string>; // to show simulated live tags
  recipientNameField: string;
  recipientEmailField: string;
}

export default function EmailEditor({
  template,
  onChange,
  availableFields,
  attachments,
  onAddAttachment,
  onRemoveAttachment,
  sampleRecord,
  recipientNameField,
  recipientEmailField,
}: EmailEditorProps) {
  const [previewMode, setPreviewMode] = useState<"edit" | "preview">("edit");
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [dragActiveAtt, setDragActiveAtt] = useState(false);
  const bodyInputRef = useRef<HTMLTextAreaElement>(null);

  // Apply rich text formatting HTML tags around selection or at cursor
  const applyFormatting = (tagOpen: string, tagClose: string) => {
    const textarea = bodyInputRef.current;
    if (!textarea) return;

    const startPos = textarea.selectionStart;
    const endPos = textarea.selectionEnd;
    const text = textarea.value;
    const selectedText = text.substring(startPos, endPos);
    
    const formattedText = tagOpen + (selectedText || "") + tagClose;
    const newBody = text.substring(0, startPos) + formattedText + text.substring(endPos);
    
    onChange({
      ...template,
      body: newBody,
    });

    // Reset textarea focus and adjust cursor selection
    setTimeout(() => {
      textarea.focus();
      if (selectedText) {
        textarea.setSelectionRange(startPos, startPos + formattedText.length);
      } else {
        textarea.setSelectionRange(startPos + tagOpen.length, startPos + tagOpen.length);
      }
    }, 50);
  };

  // Drag & drop handlers for attachments
  const handleDragAtt = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActiveAtt(true);
    } else if (e.type === "dragleave") {
      setDragActiveAtt(false);
    }
  };

  const handleFileDropAtt = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActiveAtt(false);
    setAttachmentError(null);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      processAndAddFile(file);
    }
  };

  const processAndAddFile = (file: File) => {
    // Limit attachment size to 8MB in client side
    if (file.size > 8 * 1024 * 1024) {
      setAttachmentError(`File "${file.name}" exceeds the 8MB attachment limit.`);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      onAddAttachment({
        name: file.name,
        size: file.size,
        type: file.type || "application/octet-stream",
        content: reader.result as string, // base64 encoded data URI
      });
    };
    reader.onerror = () => {
      setAttachmentError("Failed to convert the uploaded document. Please retry.");
    };
    reader.readAsDataURL(file);
  };

  // Inserts a tag at the cursor position in the textarea
  const insertTag = (fieldName: string) => {
    const textarea = bodyInputRef.current;
    if (!textarea) return;

    const startPos = textarea.selectionStart;
    const endPos = textarea.selectionEnd;
    const text = textarea.value;
    const tag = `{${fieldName}}`;

    const newBody = text.substring(0, startPos) + tag + text.substring(endPos);
    onChange({
      ...template,
      body: newBody,
    });

    // Reset cursor position after state sync
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(startPos + tag.length, startPos + tag.length);
    }, 50);
  };

  // Process manual attachment
  const handleAttachmentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAttachmentError(null);
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];

      // Limit attachment size to 8MB in client side
      if (file.size > 8 * 1024 * 1024) {
        setAttachmentError("Single file attachment limit is 8MB to ensure smooth mailing.");
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        onAddAttachment({
          name: file.name,
          size: file.size,
          type: file.type,
          content: reader.result as string, // base64 encoded data URI
        });
      };
      reader.onerror = () => {
        setAttachmentError("Failed to convert attachment file. Please try another.");
      };
      reader.readAsDataURL(file);
    }
  };

  // Function to replace tags with sample contact details
  const renderCompiledText = (text: string) => {
    if (!text) return "";
    let compiled = text;
    
    // Convert newlines to HTML br for actual viewing
    compiled = compiled.replace(/\n/g, "<br />");

    if (sampleRecord) {
      Object.keys(sampleRecord).forEach((field) => {
        const regex = new RegExp(`{${field}}`, "g");
        compiled = compiled.replace(regex, `<span class="bg-amber-500/10 border border-amber-500/20 text-amber-400 font-semibold px-1 py-0.5 rounded text-[11px]">${sampleRecord[field]}</span>`);
      });
    }
    
    // Catch-all highlighted labels for empty tags that weren't resolved
    compiled = compiled.replace(/{([^}]+)}/g, '<span class="bg-rose-950/40 border border-rose-500/20 text-rose-400 px-1 py-0.5 rounded font-mono text-[11px] font-bold">Unresolved Tag: $1</span>');

    return compiled;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  return (
    <div id="email-editor" className="bg-[#0f0f10] border border-white/10 rounded-2xl shadow-sm overflow-hidden h-full flex flex-col">
      <div className="bg-[#0D0D0E] border-b border-white/10 px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white/5 text-amber-500 rounded-xl border border-white/10">
            <Type className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h3 className="font-semibold text-white text-base">Write & Personalize Mail</h3>
            <p className="text-xs text-gray-400">Design your customized copy template</p>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex bg-white/5 border border-white/10 p-0.5 rounded-lg text-xs font-semibold">
          <button
            type="button"
            onClick={() => setPreviewMode("edit")}
            className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${
              previewMode === "edit"
                ? "bg-amber-500 text-black shadow-sm"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Edit Template
          </button>
          <button
            type="button"
            onClick={() => setPreviewMode("preview")}
            className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1 cursor-pointer ${
              previewMode === "preview"
                ? "bg-amber-500 text-black shadow-sm"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <Eye className="w-3.5 h-3.5" /> Live Preview
          </button>
        </div>
      </div>

      <div className="p-6 space-y-5 flex-1 overflow-y-auto">
        {previewMode === "edit" ? (
          /* EDITING MODE PANEL */
          <div className="space-y-4">
            {/* Subject Input */}
            <div className="text-left font-sans">
              <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">
                Mail Subject Line
              </label>
              <input
                type="text"
                value={template.subject}
                onChange={(e) => onChange({ ...template, subject: e.target.value })}
                placeholder="Subject Line (e.g. Welcome {Name}! Check out your {Invoice})"
                className="w-full text-sm border border-white/10 rounded-xl px-4 py-2.5 bg-white/5 hover:bg-white/10 focus:bg-white/10 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all outline-none font-medium text-white"
              />
            </div>

            {/* Field Smart Chips Box */}
            <div className="text-left font-sans">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Insert Personalized Fields
                </label>
                <span className="text-[10px] text-gray-400 bg-white/5 px-2 py-0.5 rounded border border-white/5 font-semibold italic flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-500 animate-spin" /> Click to Insert Tag
                </span>
              </div>

              {availableFields.length === 0 ? (
                <div className="text-xs p-3.5 bg-white/5 text-gray-400 rounded-xl border border-white/10 text-center italic font-sans dark:text-gray-500">
                  Upload a CSV file first to populate your recipient database headers!
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5 p-3.5 bg-white/5 border border-white/10 rounded-xl" id="merge-tag-chips">
                  {availableFields.map((field) => {
                    const isEmail = field === recipientEmailField;
                    const isName = field === recipientNameField;
                    return (
                      <button
                        key={field}
                        type="button"
                        onClick={() => insertTag(field)}
                        className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1 cursor-pointer ${
                          isEmail
                            ? "bg-amber-500/20 border-amber-500/40 text-amber-300 hover:bg-amber-500/30"
                            : isName
                             ? "bg-amber-400/20 border-amber-400/40 text-amber-300 hover:bg-amber-400/30"
                             : "bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:border-white/20"
                        }`}
                      >
                        <Code className="w-3 h-3 text-amber-500" />
                        <span>{field}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Template Body Composer Input */}
            <div className="text-left font-sans">
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Email Message Body (Plain / Simple HTML)
                </label>
                <span className="text-[10px] text-gray-500 font-medium">Supports inline HTML like &lt;b&gt;, &lt;h2&gt;</span>
              </div>

              {/* Rich HTML Formatting Toolbar */}
              <div className="flex flex-wrap gap-1 p-1 bg-white/5 border border-white/10 rounded-t-xl border-b-0" id="rich-toolbar">
                <button
                  type="button"
                  onClick={() => applyFormatting("<b>", "</b>")}
                  className="p-1.5 hover:bg-white/10 rounded text-gray-300 hover:text-amber-500 transition-all font-semibold cursor-pointer"
                  title="Bold (<b>)"
                >
                  <Bold className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => applyFormatting("<i>", "</i>")}
                  className="p-1.5 hover:bg-white/10 rounded text-gray-300 hover:text-amber-500 transition-all cursor-pointer"
                  title="Italic (<i>)"
                >
                  <Italic className="w-4 h-4" />
                </button>
                <div className="w-[1px] h-4 bg-white/10 self-center mx-1" />
                <button
                  type="button"
                  onClick={() => applyFormatting("<h1>", "</h1>")}
                  className="p-1.5 hover:bg-white/10 rounded text-gray-300 hover:text-amber-500 transition-all cursor-pointer"
                  title="Heading 1 (<h1>)"
                >
                  <Heading1 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => applyFormatting("<h2>", "</h2>")}
                  className="p-1.5 hover:bg-white/10 rounded text-gray-300 hover:text-amber-500 transition-all cursor-pointer"
                  title="Heading 2 (<h2>)"
                >
                  <Heading2 className="w-4 h-4" />
                </button>
                <div className="w-[1px] h-4 bg-white/10 self-center mx-1" />
                <button
                  type="button"
                  onClick={() => applyFormatting("<ul>\n  <li>", "</li>\n</ul>")}
                  className="p-1.5 hover:bg-white/10 rounded text-gray-300 hover:text-amber-500 transition-all cursor-pointer"
                  title="List (<ul><li>)"
                >
                  <List className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => applyFormatting('<a href="https://example.com" target="_blank" class="text-amber-500 hover:underline">', "</a>")}
                  className="p-1.5 hover:bg-white/10 rounded text-gray-300 hover:text-amber-500 transition-all cursor-pointer"
                  title="Hyperlink (<a>)"
                >
                  <Link className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => applyFormatting("<hr />", "")}
                  className="p-1.5 hover:bg-white/10 rounded text-gray-300 hover:text-amber-500 transition-all cursor-pointer"
                  title="Divider (<hr />)"
                >
                  <Minus className="w-4 h-4" />
                </button>
              </div>

              <textarea
                ref={bodyInputRef}
                value={template.body}
                onChange={(e) => onChange({ ...template, body: e.target.value })}
                rows={9}
                placeholder={`Hi {Name},
 
We are happy to connect with you. Below are details regarding you or your company {Company}.
Please find the attached invoice or document with this email.
 
Thanks,
Mailing Team`}
                className="w-full text-sm font-sans border border-white/10 rounded-b-xl rounded-t-none p-4 bg-white/5 hover:bg-[#121214] focus:bg-[#121214] focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all outline-none leading-relaxed text-slate-100"
              />
            </div>
          </div>
        ) : (
          /* PREVIEW MODE PANEL */
          <div className="space-y-4 animate-fade-in text-left">
            {!sampleRecord ? (
              <div className="p-8 bg-white/5 border border-white/10 text-gray-400 text-center rounded-2xl italic text-xs font-sans">
                Upload a CSV in step 1 to see rich live data replacements! Using placeholders instead.
              </div>
            ) : (
              <div className="border border-white/10 rounded-2xl shadow-sm overflow-hidden bg-[#0A0A0B]">
                {/* Simulated Email Browser Header */}
                <div className="bg-[#0E0E0F] px-5 py-3.5 border-b border-white/10 flex items-center justify-between text-xs font-semibold text-gray-400">
                  <span className="flex items-center gap-1 text-gray-500">
                    <Search className="w-3.5 h-3.5" /> Outgoing Inspector
                  </span>
                  <span className="text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded font-semibold text-[11px]">
                    Merged Preview for row #1
                  </span>
                </div>

                {/* Sender/Recipient details */}
                <div className="px-5 py-4 space-y-2 text-xs border-b border-white/10 bg-white/5">
                  <div className="grid grid-cols-6 gap-1">
                    <span className="text-gray-500 font-medium col-span-1">From:</span>
                    <span className="text-gray-300 font-semibold col-span-5 truncate">
                      Mailing System Server &lt;simulations@express.server&gt;
                    </span>
                  </div>
                  <div className="grid grid-cols-6 gap-1">
                    <span className="text-gray-500 font-medium col-span-1">To:</span>
                    <span className="text-amber-400 font-semibold col-span-5 truncate">
                      {sampleRecord[recipientEmailField] || "recipient@domain.com"}
                    </span>
                  </div>
                  <div className="grid grid-cols-6 gap-1">
                    <span className="text-gray-500 font-medium col-span-1">Subject:</span>
                    <span className="text-white font-bold col-span-5">
                      {template.subject ? template.subject.replace(/{([^}]+)}/g, (match, field) => sampleRecord[field] || match) : "(No Subject Provided)"}
                    </span>
                  </div>
                </div>

                {/* Email Body HTML rendered wrapper */}
                <div className="p-6 bg-[#070708] min-h-[160px] text-sm text-gray-205 leading-relaxed max-h-[350px] overflow-y-auto">
                  {template.body ? (
                    <div
                      className="whitespace-pre-line break-words font-sans text-gray-300"
                      dangerouslySetInnerHTML={{
                        __html: renderCompiledText(template.body),
                      }}
                    />
                  ) : (
                    <p className="text-gray-500 italic text-xs text-center pt-8">No content written yet.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Attachment Upload Zone */}
        <div className="border-t border-white/10 pt-5 space-y-4">
          <div className="flex items-center justify-between font-sans">
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Files Attached (PDF, DOCX, Images, ZIP)
            </label>
            <span className="text-[10px] text-gray-500 font-semibold font-mono">Max size 8MB per file</span>
          </div>

          {attachmentError && (
            <div className="flex items-center gap-2 p-2.5 bg-rose-950/40 border border-rose-500/20 rounded-xl text-rose-300 text-[11px] text-left font-sans">
              <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span>{attachmentError}</span>
            </div>
          )}

          {/* Drag & Drop zone for attachments */}
          <div
            onDragEnter={handleDragAtt}
            onDragOver={handleDragAtt}
            onDragLeave={handleDragAtt}
            onDrop={handleFileDropAtt}
            onClick={() => {
              const input = document.createElement("input");
              input.type = "file";
              input.accept = "image/*,application/pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/zip,application/x-zip-compressed";
              input.onchange = (e) => {
                const target = e.target as HTMLInputElement;
                if (target.files && target.files[0]) {
                  processAndAddFile(target.files[0]);
                }
              };
              input.click();
            }}
            className={`border border-dashed rounded-xl p-5 flex flex-col items-center justify-center text-center transition-all cursor-pointer min-h-[110px] font-sans ${
              dragActiveAtt
                ? "border-amber-500 bg-amber-500/5 animate-pulse"
                : "border-white/10 hover:border-amber-500/40 hover:bg-white/5 bg-white/2"
            }`}
          >
            <Upload className="w-5 h-5 text-amber-500 mb-1.5" />
            <h5 className="text-[11px] font-semibold text-white">
              Drag & drop files here or <span className="text-amber-500 hover:underline">browse</span>
            </h5>
            <p className="text-[10px] text-gray-500 mt-1 uppercase font-mono tracking-wider">
              PDF, DOCX, ZIP, or PNG/JPG images
            </p>
          </div>

          {/* Attachments list with specific icons per file type */}
          {attachments.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-sans" id="current-attachments">
              {attachments.map((file, index) => {
                const isImg = file.type.startsWith("image/");
                const isZip = file.type.includes("zip") || file.name.endsWith(".zip");
                const isDocx = file.type.includes("word") || file.name.endsWith(".docx");
                
                return (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2.5 border border-white/10 rounded-xl bg-[#121214] hover:bg-white/5 transition-all text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="p-2 bg-black rounded-lg border border-white/5 text-gray-400 shrink-0">
                        {isImg ? (
                          <FileImage className="w-4 h-4 text-pink-400" />
                        ) : isZip ? (
                          <FileArchive className="w-4 h-4 text-violet-400" />
                        ) : isDocx ? (
                          <FileText className="w-4 h-4 text-sky-450" />
                        ) : (
                          <FileText className="w-4 h-4 text-amber-500" />
                        )}
                      </div>
                      <div className="min-w-0 text-left">
                        <p className="font-semibold text-white truncate" title={file.name}>{file.name}</p>
                        <p className="text-[10px] text-gray-500">{formatFileSize(file.size)}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemoveAttachment(index)}
                      className="p-1 hover:bg-white/10 text-gray-400 hover:text-white rounded-lg transition-all cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
