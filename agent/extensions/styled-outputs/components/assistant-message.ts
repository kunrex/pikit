import { Markdown, visibleWidth, wrapTextWithAnsi } from "@earendil-works/pi-tui";
import { CONFIG } from "../config.js";
import { getVisibleWidth, hasVisibleContent, currentTheme, applyColor } from "../utils.js";

const ASSISTANT_PREFIX_WIDTH = getVisibleWidth(CONFIG.assistantMessage.prefix) + 2;
const PADDING_PREFIX = " ".repeat(ASSISTANT_PREFIX_WIDTH);
const CODE_BLOCK_PADDING = "  ";
const CODE_BLOCK_BG = "customMessageBg";

type MessageSegment =
  | { type: "markdown"; md: Markdown }
  | { type: "code"; language: string; code: string };

export interface AssistantMessage {
  invalidate(): void;
  render(width: number): string[];
}

function parseSegments(text: string, markdownTheme: any): MessageSegment[] {
  const segments: MessageSegment[] = [];
  const textLines: string[] = [];
  const lines = text.split(/\r?\n/);
  let codeLines: string[] | undefined;
  let fenceChar = "`";
  let fenceLength = 3;
  let language = "";

  function flushText(): void {
    if (textLines.length === 0) return;
    const value = textLines.join("\n");
    if (value.length > 0) {
      segments.push({ type: "markdown", md: new Markdown(value, 0, 0, markdownTheme) });
    }
    textLines.length = 0;
  }

  function flushCode(): void {
    if (!codeLines) return;
    segments.push({ type: "code", language, code: codeLines.join("\n") });
    codeLines = undefined;
    language = "";
  }

  for (const line of lines) {
    if (!codeLines) {
      const opener = /^(\s*)(`{3,}|~{3,})(.*)$/.exec(line);
      if (opener) {
        flushText();
        fenceChar = opener[2][0];
        fenceLength = opener[2].length;
        language = opener[3].trim().split(/\s+/)[0] ?? "";
        codeLines = [];
      } else {
        textLines.push(line);
      }
      continue;
    }

    const closingPattern = new RegExp(`^\\s*\\${fenceChar}{${fenceLength},}\\s*$`);
    if (closingPattern.test(line)) {
      flushCode();
    } else {
      codeLines.push(line);
    }
  }

  flushCode();
  flushText();

  return segments.length > 0 ? segments : [{ type: "markdown", md: new Markdown(text, 0, 0, markdownTheme) }];
}

function padToWidth(line: string, width: number): string {
  return line + " ".repeat(Math.max(0, width - visibleWidth(line)));
}

function applyCodeBackground(line: string, width: number): string {
  const padded = padToWidth(line, width);
  if (!currentTheme) return padded;
  try {
    return currentTheme.bg(CODE_BLOCK_BG as any, padded);
  } catch {
    return padded;
  }
}

function renderCodeBlock(segment: Extract<MessageSegment, { type: "code" }>, width: number, markdownTheme: any): string[] {
  const contentWidth = Math.max(1, width - CODE_BLOCK_PADDING.length * 2);
  const label = segment.language || "code";
  const labelText = ` ${label} `;
  const styledLabel = markdownTheme.codeBlockBorder
    ? markdownTheme.codeBlockBorder(labelText)
    : labelText;
  const lines = [applyCodeBackground(padToWidth(styledLabel, contentWidth), width)];
  const highlightedLines = markdownTheme.highlightCode
    ? markdownTheme.highlightCode(segment.code, segment.language || undefined)
    : segment.code.split("\n").map((line: string) => markdownTheme.codeBlock ? markdownTheme.codeBlock(line) : line);

  for (const highlightedLine of highlightedLines) {
    const wrappedLines = wrapTextWithAnsi(highlightedLine, contentWidth);
    for (const wrappedLine of wrappedLines.length > 0 ? wrappedLines : [""]) {
      lines.push(applyCodeBackground(`${CODE_BLOCK_PADDING}${wrappedLine}`, width));
    }
  }

  return lines;
}

export function createAssistantMessage(text: string, markdownTheme: any): AssistantMessage {
  const segments = parseSegments(text, markdownTheme);
  let cachedWidth: number | undefined;
  let cachedLines: string[] | undefined;

  function invalidate(): void {
    cachedWidth = undefined;
    cachedLines = undefined;
    for (const segment of segments) {
      if (segment.type === "markdown") segment.md.invalidate();
    }
  }

  function render(width: number): string[] {
    if (cachedLines && cachedWidth === width) return cachedLines;

    if (width <= ASSISTANT_PREFIX_WIDTH) {
      cachedWidth = width;
      const prefix = currentTheme
        ? applyColor(currentTheme, CONFIG.assistantMessage.color, CONFIG.assistantMessage.prefix)
        : CONFIG.assistantMessage.prefix;
      cachedLines = [` ${prefix} `];
      return cachedLines;
    }

    const contentWidth = width - ASSISTANT_PREFIX_WIDTH;
    const contentLines = segments.flatMap((segment) => {
      if (segment.type === "markdown") return segment.md.render(contentWidth);
      return renderCodeBlock(segment, contentWidth, markdownTheme);
    });
    let dotPlaced = false;

    const rendered = contentLines.map((line: string) => {
      if (!dotPlaced && hasVisibleContent(line)) {
        dotPlaced = true;
        const prefix = currentTheme
          ? applyColor(currentTheme, CONFIG.assistantMessage.color, CONFIG.assistantMessage.prefix)
          : CONFIG.assistantMessage.prefix;
        return ` ${prefix} ${line}`;
      }
      return `${PADDING_PREFIX}${line}`;
    });

    cachedWidth = width;
    cachedLines = rendered;
    return rendered;
  }

  return { invalidate, render };
}
