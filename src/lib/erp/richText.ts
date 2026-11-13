export function descriptionText(value: string): string {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function safeEditorHtml(value: string): string {
  const allowed = new Set(
    "p div span strong b em i u s strike a ul ol li blockquote br hr h1 h2 h3 h4 h5 h6 table thead tbody tfoot tr th td img code pre font".split(
      " ",
    ),
  );
  const drop = new Set([
    "SCRIPT",
    "STYLE",
    "IFRAME",
    "OBJECT",
    "EMBED",
    "SVG",
    "MATH",
    "TEMPLATE",
  ]);
  const escape = (text: string) =>
    text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  if (!/<[a-z][^>]*>/i.test(value))
    return value
      .split(/\n\n+/)
      .map((paragraph) => `<p>${escape(paragraph).replace(/\n/g, "<br>")}</p>`)
      .join("");
  const parsed = new DOMParser().parseFromString(value, "text/html");
  const safeUrl = (url: string) =>
    /^(https?:\/\/|mailto:|\/(?!\/)|#)/i.test(
      url.replace(/[\x00-\x20\x7f]/g, ""),
    );
  const clean = (node: Node): Node[] => {
    if (node.nodeType === Node.TEXT_NODE)
      return [document.createTextNode(node.textContent ?? "")];
    if (!(node instanceof HTMLElement) || drop.has(node.tagName)) return [];
    const children = Array.from(node.childNodes).flatMap(clean);
    if (!allowed.has(node.tagName.toLowerCase())) return children;
    const element = document.createElement(
      node.tagName === "FONT" ? "span" : node.tagName.toLowerCase(),
    );
    const styles = node.style;
    if (["left", "right", "center", "justify"].includes(styles.textAlign))
      element.style.textAlign = styles.textAlign;
    if (["bold", "normal", "400", "700"].includes(styles.fontWeight))
      element.style.fontWeight = styles.fontWeight;
    if (["italic", "normal"].includes(styles.fontStyle))
      element.style.fontStyle = styles.fontStyle;
    if (["underline", "line-through", "none"].includes(styles.textDecoration))
      element.style.textDecoration = styles.textDecoration;
    if (styles.color) element.style.color = styles.color;
    if (node.tagName === "FONT" && node.getAttribute("color"))
      element.style.color = node.getAttribute("color")!;
    if (node.tagName === "A" && safeUrl(node.getAttribute("href") ?? "")) {
      element.setAttribute("href", node.getAttribute("href")!);
      element.setAttribute("rel", "noopener noreferrer");
    }
    if (node.tagName === "IMG") {
      if (!/^(https?:\/\/|\/(?!\/))/i.test(node.getAttribute("src") ?? ""))
        return [];
      element.setAttribute("src", node.getAttribute("src")!);
      element.setAttribute("alt", node.getAttribute("alt") ?? "");
    }
    element.append(...children);
    return [element];
  };
  const output = document.createElement("div");
  output.append(...Array.from(parsed.body.childNodes).flatMap(clean));
  return output.innerHTML;
}
