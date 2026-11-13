"use client";

import { Select } from "@/components/erp-ui/Select";

import { useEffect, useRef, useState } from "react";
import {
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Link2,
  Unlink,
  ImagePlus,
  Table2,
  Undo2,
  Redo2,
  RemoveFormatting,
  Code2,
  Indent,
  Outdent,
} from "lucide-react";
import { Button } from "@/components/erp-ui/Button";
import { Input, Textarea } from "@/components/erp-ui/Input";
import { Field } from "@/components/erp-ui/Field";
import { Modal } from "@/components/erp-ui/Modal";
import { descriptionText, safeEditorHtml } from "@/lib/erp/richText";

export function RichTextEditor({
  value,
  onChange,
  disabled = false,
  images = [],
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  images?: string[];
}) {
  const editor = useRef<HTMLDivElement>(null);
  const emitted = useRef<string | null>(null);
  const selection = useRef<Range | null>(null);
  const [source, setSource] = useState(false);
  const [insert, setInsert] = useState<"link" | "image" | null>(null);
  const [url, setUrl] = useState("");
  const [urlError, setUrlError] = useState("");
  const [active, setActive] = useState<string[]>([]);
  const [block, setBlock] = useState("p");
  const publish = () => {
    if (!editor.current) return;
    const html = editor.current.innerHTML;
    emitted.current = html;
    onChange(html);
  };
  useEffect(() => {
    if (!source && editor.current && emitted.current !== value)
      editor.current.innerHTML = safeEditorHtml(value);
  }, [value, source]);
  useEffect(() => {
    const track = () => {
      const selected = window.getSelection();
      if (
        !selected?.rangeCount ||
        !editor.current?.contains(selected.anchorNode)
      )
        return;
      selection.current = selected.getRangeAt(0).cloneRange();
      setActive(
        [
          "bold",
          "italic",
          "underline",
          "insertUnorderedList",
          "insertOrderedList",
        ].filter((command) => document.queryCommandState(command)),
      );
      const format = document.queryCommandValue("formatBlock").toLowerCase();
      setBlock(
        ["p", "h1", "h2", "h3", "blockquote"].includes(format) ? format : "p",
      );
    };
    document.addEventListener("selectionchange", track);
    return () => document.removeEventListener("selectionchange", track);
  }, []);
  const command = (name: string, argument?: string) => {
    if (disabled || !editor.current) return;
    editor.current.focus();
    if (
      selection.current &&
      editor.current.contains(selection.current.commonAncestorContainer)
    ) {
      const selected = window.getSelection();
      selected?.removeAllRanges();
      selected?.addRange(selection.current);
    }
    // Native editing preserves browser undo/redo and selection across toolbar actions.
    document.execCommand(name, false, argument);
    publish();
  };
  const tool = (
    label: string,
    name: string,
    icon: React.ReactNode,
    argument?: string,
  ) => (
    <button
      key={name}
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active.includes(name)}
      disabled={disabled || source}
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => command(name, argument)}
      className={`rounded p-1.5 text-ink-600 hover:bg-black/5 disabled:opacity-40 ${active.includes(name) ? "bg-brand-100 text-brand-700" : ""}`}
    >
      {icon}
    </button>
  );
  const openInsert = (kind: "link" | "image") => {
    setUrl("");
    setUrlError("");
    setInsert(kind);
  };
  const addUrl = () => {
    const cleaned = url.trim();
    if (
      !/^(https?:\/\/|\/(?!\/)|mailto:)/i.test(cleaned) ||
      (insert === "image" && /^mailto:/i.test(cleaned))
    ) {
      setUrlError("Enter a valid HTTPS URL or a relative URL starting with /.");
      return;
    }
    command(insert === "image" ? "insertImage" : "createLink", cleaned);
    setInsert(null);
  };
  return (
    <div className="overflow-hidden rounded-md border border-line bg-card shadow-[var(--shadow-sm)] focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-100">
      <div
        role="toolbar"
        aria-label="Description formatting"
        className="flex flex-wrap items-center gap-0.5 border-b border-line bg-paper/70 px-2 py-1.5"
      >
        <Select
          aria-label="Text style"
          value={block}
          disabled={disabled || source}
          onMouseDown={() => {
            const selected = window.getSelection();
            if (
              selected?.rangeCount &&
              editor.current?.contains(selected.anchorNode)
            )
              selection.current = selected.getRangeAt(0).cloneRange();
          }}
          onValueChange={(value) => {
            setBlock(value);
            command("formatBlock", value);
          }}
          className="mr-1 h-7 w-[115px] rounded border-0 bg-transparent px-1 py-1 text-xs shadow-none"
        >
          <option value="p">Paragraph</option>
          <option value="h1">Heading 1</option>
          <option value="h2">Heading 2</option>
          <option value="h3">Heading 3</option>
          <option value="blockquote">Quote</option>
        </Select>
        <span className="mx-1 h-5 border-l border-line" />
        {tool("Bold", "bold", <Bold size={15} />)}
        {tool("Italic", "italic", <Italic size={15} />)}
        {tool("Underline", "underline", <Underline size={15} />)}
        <label
          title="Text color"
          className="relative flex h-7 w-7 items-center justify-center text-sm font-semibold"
        >
          A
          <input
            type="color"
            aria-label="Text color"
            disabled={disabled || source}
            defaultValue="#333333"
            onChange={(event) => command("foreColor", event.target.value)}
            className="absolute bottom-0 h-1.5 w-5 cursor-pointer border-0 p-0"
          />
        </label>
        <span className="mx-1 h-5 border-l border-line" />
        {tool("Align left", "justifyLeft", <AlignLeft size={15} />)}
        {tool("Align center", "justifyCenter", <AlignCenter size={15} />)}
        {tool("Align right", "justifyRight", <AlignRight size={15} />)}
        <button
          type="button"
          aria-label="Insert link"
          title="Insert link"
          disabled={disabled || source}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => openInsert("link")}
          className="rounded p-1.5 text-ink-600 hover:bg-black/5 disabled:opacity-40"
        >
          <Link2 size={15} />
        </button>
        {tool("Remove link", "unlink", <Unlink size={15} />)}
        <button
          type="button"
          aria-label="Insert image"
          title="Insert image"
          disabled={disabled || source}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => openInsert("image")}
          className="rounded p-1.5 text-ink-600 hover:bg-black/5 disabled:opacity-40"
        >
          <ImagePlus size={15} />
        </button>
        {tool(
          "Insert table",
          "insertHTML",
          <Table2 size={15} />,
          "<table><tbody><tr><th>Heading</th><th>Heading</th></tr><tr><td>Text</td><td>Text</td></tr></tbody></table><p><br></p>",
        )}
        <span className="mx-1 h-5 border-l border-line" />
        {tool("Bullet list", "insertUnorderedList", <List size={15} />)}
        {tool("Numbered list", "insertOrderedList", <ListOrdered size={15} />)}
        {tool("Decrease indent", "outdent", <Outdent size={15} />)}
        {tool("Increase indent", "indent", <Indent size={15} />)}
        {tool(
          "Clear formatting",
          "removeFormat",
          <RemoveFormatting size={15} />,
        )}
        {tool("Undo", "undo", <Undo2 size={15} />)}
        {tool("Redo", "redo", <Redo2 size={15} />)}
        <button
          type="button"
          aria-label="Edit HTML"
          title="Edit HTML"
          aria-pressed={source}
          disabled={disabled}
          onClick={() => {
            if (source) onChange(safeEditorHtml(value));
            emitted.current = null;
            setSource((current) => !current);
          }}
          className={`rounded p-1.5 text-ink-600 hover:bg-black/5 ${source ? "bg-brand-100" : ""}`}
        >
          <Code2 size={15} />
        </button>
      </div>
      {source ? (
        <Textarea
          aria-label="Description HTML"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          rows={12}
          className="border-0 font-mono text-xs shadow-none"
        />
      ) : (
        <div
          ref={editor}
          id="product-description"
          role="textbox"
          aria-label="Description"
          aria-multiline="true"
          contentEditable={!disabled}
          suppressContentEditableWarning
          onInput={publish}
          onPaste={(event) => {
            event.preventDefault();
            const html = event.clipboardData.getData("text/html");
            command(
              "insertHTML",
              safeEditorHtml(html || event.clipboardData.getData("text/plain")),
            );
          }}
          className="rich-description min-h-[300px] px-4 py-3 text-sm leading-relaxed outline-none"
        />
      )}
      <div className="border-t border-line px-3 py-1.5 text-right text-[11px] text-ink-400">
        {descriptionText(value).length.toLocaleString("en-IN")} characters
      </div>
      <Modal
        open={insert !== null}
        title={insert === "image" ? "Insert image" : "Insert link"}
        width="md"
        onClose={() => setInsert(null)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setInsert(null)}>
              Cancel
            </Button>
            <Button onClick={addUrl} disabled={!url.trim()}>
              Insert
            </Button>
          </>
        }
      >
        <Field label="URL" htmlFor="description-url" error={urlError}>
          <Input
            id="description-url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://…"
          />
        </Field>
        {insert === "image" && images.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {images.map((image, index) => (
              <Button
                key={image}
                variant="secondary"
                onClick={() => setUrl(image)}
              >
                Product image {index + 1}
              </Button>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
