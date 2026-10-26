import type { PluginClientContext } from "@getpaseo/plugin/client";

// A warm-neutral near-black theme built on common dark-UI guidance: a tinted dark gray instead
// of pure black, off-white text instead of pure white, a monochrome near-white accent (as Vercel
// and Vesper Black do), and panels set apart by slightly lighter surfaces rather than lines.
// No blue hues.
//
// The theme API carries colors only, so the layout tweaks are a stylesheet keyed on Paseo's test
// ids and accessibility labels: the composer's text area starts at one line and grows with its
// content, and the composer and the pills above it
// (subagents, diff stat) share one narrower, centered column, and the
// chat has wider side margins. In the sidebar a project reads as the header of its group: its row
// and every other row share one height and one step, its workspaces are indented beneath it;
// project names are muted, the Workspaces header is smaller and dimmer still, and project icons are hidden.
// Dividers that only repeat what spacing already shows are removed: under the window controls, under
// the sidebar navigation, in the sidebar footer and between the workspace header and its tabs. The
// sidebar, the settings sidebar and the file explorer have no edge line either: they sit on a shade lighter surface
// instead. Below the tabs, pills, the open-in-editor button and expanded tool cards use surfaces
// instead of outlines; the composer and pills are raised by
// shading instead of a border. Project names are set in small capitals as group headers. The workspace title is a step brighter
// than its project name. It depends on Paseo's markup and may need a fix after an update.
// Depth in the manner of Perplexity's dark theme: a raised surface (the composer, the pills, the selected
// workspace and tab, an expanded tool card, the user's message, the commit button) has a faint light edge along its
// top and a hairline ring instead of a border, and soft dark shadows below it; the deeper it floats,
// the wider the shadow.
const EDGE = "inset 0 1px 0 0 rgba(255, 255, 255, 0.06), inset 0 0 0 1px rgba(255, 255, 255, 0.06)";
const RAISED_SHADOW = `${EDGE}, 0 1px 2px 0 rgba(0, 0, 0, 0.45), 0 1px 5px -1px rgba(0, 0, 0, 0.35)`;
const COMPOSER_SHADOW = `${EDGE}, 0 1px 3px 0 rgba(0, 0, 0, 0.5), 0 4px 14px -2px rgba(0, 0, 0, 0.5), 0 14px 32px -8px rgba(0, 0, 0, 0.55)`;
const COMPOSER_SHADOW_FOCUS = `inset 0 1px 0 0 rgba(255, 255, 255, 0.08), inset 0 0 0 1px rgba(255, 255, 255, 0.11), 0 1px 3px 0 rgba(0, 0, 0, 0.5), 0 4px 14px -2px rgba(0, 0, 0, 0.55), 0 14px 32px -8px rgba(0, 0, 0, 0.6)`;
// A field the user types into is pressed into the surface instead: a dark inner shadow along its top.
const RECESSED_SHADOW = "inset 0 1px 2px 0 rgba(0, 0, 0, 0.55), inset 0 0 0 1px rgba(255, 255, 255, 0.05)";
const RECESSED_SHADOW_FOCUS =
  "inset 0 1px 2px 0 rgba(0, 0, 0, 0.55), inset 0 0 0 1px rgba(255, 255, 255, 0.12)";
const FLOATING_SHADOW = `${EDGE}, 0 2px 8px 0 rgba(0, 0, 0, 0.5), 0 14px 36px -6px rgba(0, 0, 0, 0.6)`;

const LAYOUT_CSS = `
[data-testid="message-input-root"] textarea {
  field-sizing: content !important;
  height: auto !important;
  min-height: 1lh !important;
  max-height: 40vh !important;
}
[data-midnight-anchor~="composer-frame"] {
  padding-top: 10px !important;
  padding-bottom: 6px !important;
  gap: 4px !important;
}
[data-testid="message-input-root"],
[data-midnight-anchor~="pill-row"] {
  width: 100% !important;
  max-width: 630px !important;
  align-self: center !important;
  margin-left: auto !important;
  margin-right: auto !important;
}
[data-midnight-anchor~="diff-row"] {
  padding-left: 0 !important;
  padding-right: 0 !important;
}
[data-testid="agent-chat-scroll"] {
  padding-left: 24px !important;
  padding-right: 24px !important;
  box-sizing: border-box !important;
}
[data-testid="sidebar-global-new-workspace"],
[data-testid="sidebar-sessions"],
[data-testid="sidebar-search"],
[data-testid="sidebar-schedules"] {
  min-height: 32px !important;
  padding-top: 6px !important;
  padding-bottom: 6px !important;
}
[data-testid^="sidebar-project-row-"] {
  min-height: 32px !important;
  padding-top: 4px !important;
  padding-bottom: 4px !important;
  margin-bottom: 2px !important;
}
[data-midnight-anchor~="list-header"] {
  height: 32px !important;
  min-height: 32px !important;
  margin-top: 0 !important;
  margin-bottom: 2px !important;
}
[data-testid^="sidebar-workspace-row-"] {
  min-height: 32px !important;
  padding-top: 6px !important;
  padding-bottom: 6px !important;
}
[data-midnight-anchor~="project-group"] {
  padding-top: 0 !important;
  padding-bottom: 0 !important;
  margin-top: 0 !important;
  margin-bottom: 0 !important;
}
[data-midnight-anchor~="sidebar-nav"] {
  padding-bottom: 0 !important;
}
[data-testid^="sidebar-workspace-row-"] {
  margin-left: 14px !important;
}
[data-testid^="sidebar-project-row-"] [dir="auto"] {
  color: #8f8c87 !important;
  font-size: 12px !important;
  text-transform: uppercase !important;
  letter-spacing: 0.06em !important;
}
[data-testid^="sidebar-project-row-"] [data-testid^="project-icon"] {
  display: none !important;
}
[data-midnight-anchor~="list-header-label"] {
  text-transform: uppercase !important;
  font-size: 10.5px !important;
  letter-spacing: 0.1em !important;
  color: #575450 !important;
}
[data-midnight-anchor~="no-divider"] {
  border-bottom-width: 0 !important;
}
[data-testid="sidebar-footer"] {
  border-top-width: 0 !important;
}
[data-testid="workspace-header-title"] {
  color: #f2f0ed !important;
}
[data-testid="workspace-header-subtitle"] {
  color: #5f5c58 !important;
}
[data-testid="settings-sidebar"],
[data-testid="settings-sidebar"] * {
  border-color: transparent !important;
}
[data-testid="settings-sidebar"] {
  background-color: #151514 !important;
}
[data-testid="workspace-explorer-sidebar"],
[data-testid="workspace-explorer-sidebar"] * {
  border-color: transparent !important;
}
[data-testid="workspace-explorer-sidebar"] {
  background-color: #151514 !important;
}
[data-testid="workspace-tabs-row"] {
  border-bottom-width: 0 !important;
}
[data-midnight-anchor~="editor-button"],
[data-midnight-anchor~="editor-frame"],
[data-testid="workspace-open-in-editor-caret"] {
  border-color: transparent !important;
}
[data-testid="subagents-track-header"],
[data-testid="composer-diff-stat-pill"] {
  border-color: transparent !important;
  background-color: #1a1918 !important;
}
[data-testid="tool-call-badge"],
[data-testid="tool-call-badge"] * {
  border-color: transparent !important;
}
[data-midnight-anchor~="sidebar"] {
  border-right-width: 0 !important;
  background-color: #151514 !important;
}
[data-testid="sidebar-footer-separator"] {
  display: none !important;
}
[data-midnight-anchor~="composer"] {
  border-color: transparent !important;
  background-color: #191817 !important;
  box-shadow: ${COMPOSER_SHADOW} !important;
  transition: box-shadow 150ms ease-out !important;
}
[data-midnight-anchor~="composer"]:focus-within {
  box-shadow: ${COMPOSER_SHADOW_FOCUS} !important;
}
[data-testid="subagents-track-header"],
[data-testid="composer-diff-stat-pill"],
[data-testid="composer-import-agent-pill"],
[data-midnight-anchor~="editor-button"],
[data-testid^="sidebar-workspace-row-"][aria-selected="true"],
[data-testid="workspace-tabs-row"] button[aria-selected="true"] {
  box-shadow: ${RAISED_SHADOW} !important;
}
[data-testid="composer-autocomplete-popover"],
[data-testid="message-input-attachment-menu"],
[data-testid="combobox-desktop-container"],
[data-testid="command-center-panel"],
[role="menu"] {
  border-color: transparent !important;
  background-color: #191817 !important;
  box-shadow: ${FLOATING_SHADOW} !important;
}
[data-testid="command-center-panel"] {
  border-radius: 14px !important;
}
[data-testid="command-center-header"] {
  border-bottom-width: 0 !important;
}
[data-testid="command-center-results"] div:empty:not(button *) {
  background-color: transparent !important;
}
[data-testid="command-center-results"] button {
  border-radius: 8px !important;
  margin-left: 6px !important;
  margin-right: 6px !important;
  width: auto !important;
}
[data-midnight="card"],
[data-midnight="control"] {
  border-color: transparent !important;
  background-color: #191817 !important;
  box-shadow: ${RAISED_SHADOW} !important;
}
[data-midnight="card"] {
  border-radius: 12px !important;
}
[data-midnight-menu-row] {
  border-radius: 8px !important;
  margin-left: 6px !important;
  margin-right: 6px !important;
  width: auto !important;
  align-self: stretch !important;
}
[data-midnight="control"]:disabled,
[data-midnight="control"][aria-disabled="true"] {
  background-color: transparent !important;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.06) !important;
  opacity: 1 !important;
  color: #5c5954 !important;
}
[data-midnight="control"]:disabled *,
[data-midnight="control"][aria-disabled="true"] * {
  color: #5c5954 !important;
}
[data-midnight="key"],
[data-midnight-selected],
[data-midnight-hover],
[role="button"][aria-selected="true"],
[role="tab"][aria-selected="true"] {
  box-shadow: ${RAISED_SHADOW} !important;
}
[data-midnight="chip"] {
  border-color: transparent !important;
}
[data-midnight="field"] {
  border-color: transparent !important;
  background-color: #0b0b0a !important;
  box-shadow: ${RECESSED_SHADOW} !important;
}
[data-midnight="field"]:focus-within {
  box-shadow: ${RECESSED_SHADOW_FOCUS} !important;
}
[data-testid="tool-call-badge"]:has(> :nth-child(2)) {
  border-radius: 10px !important;
  overflow: hidden !important;
  background-color: #191817 !important;
  box-shadow: ${RAISED_SHADOW} !important;
}
[data-testid="tool-call-badge"]:has(> :nth-child(2)) > button {
  background-color: transparent !important;
}
[data-testid="user-message"] > div > div {
  box-shadow: ${RAISED_SHADOW} !important;
}
[data-midnight-anchor~="commit-button"] {
  border-color: transparent !important;
  box-shadow: ${RAISED_SHADOW} !important;
}
[aria-label="Stop agent"] {
  box-shadow: inset 0 1px 0 0 rgba(255, 255, 255, 0.22), 0 1px 2px 0 rgba(0, 0, 0, 0.5), 0 2px 8px -1px rgba(220, 38, 38, 0.35) !important;
}
[data-testid="composer-dock-header"] > div > div {
  border-bottom-width: 0 !important;
}
[data-testid^="agent-row-project-"] + div {
  display: none !important;
}
[data-testid^="agent-row-project-"],
[data-testid^="agent-row-branch-"] {
  width: 104px !important;
}
[data-testid^="agent-row-srv"] > div:nth-child(2) {
  padding-left: 16px !important;
}
[data-testid^="agent-row-workspace-"] {
  flex-shrink: 0 !important;
  max-width: 150px !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  white-space: nowrap !important;
}
[data-midnight-anchor~="new-workspace-column"] {
  max-width: 662px !important;
  width: 100% !important;
  margin-left: auto !important;
  margin-right: auto !important;
}
[data-midnight-anchor~="new-workspace-column"] > div:first-child {
  padding-left: 16px !important;
  padding-right: 16px !important;
}
[data-midnight-anchor~="new-workspace-column"] > div:first-child > div > div:first-child,
[data-testid="new-workspace-ref-picker-row"] {
  padding-left: 0 !important;
  padding-right: 0 !important;
}
[data-midnight-hidden] {
  display: none !important;
}
`;

// Surfaces Paseo draws with a plain outline and no test id of their own are found by their computed
// style anywhere outside the chat: an outlined block becomes a raised card, an outlined button a raised
// control, an outlined label a borderless chip, and an outlined box around a text field a recessed
// field. Each element is inspected once. A selected or hovered row in the settings sidebar and the
// command palette is marked too, since Paseo shows that selection only as a background color.
const SKIP_ROOTS = '[data-testid="agent-chat-scroll"], [data-testid="message-input-root"]';
const SELECTABLE_ROOTS = '[data-testid="settings-sidebar"], [data-testid="command-center-results"]';
const KEY_BACKGROUND = "rgb(38, 37, 35)";

export default function contribute(client: PluginClientContext) {
  const cleanupTheme = client.addTheme({
    id: "midnight",
    name: "Midnight",
    appearance: "dark",
    colors: {
      background: "#0e0e0d",
      foreground: "#dddbd7",
      raised: "#161615",
      control: "#1f1e1c",
      border: "#262523",
      accent: "#f5f4f1",
      mutedForeground: "#8f8c87",
      ring: "#5c5a56",
    },
  });

  const style = typeof document === "undefined" ? null : document.createElement("style");
  if (style) {
    style.dataset.plugin = "paseo-midnight-theme";
    style.textContent = LAYOUT_CSS;
    document.head.appendChild(style);
  }

  // Elements Paseo gives no test id are marked through a nearby one, so the stylesheet can use plain
  // attribute selectors: a rule like "a block that contains X" is re-checked by the browser on every
  // change to the page, which is constant while an agent streams.
  const tag = (el: Element | null | undefined, name: string) => {
    if (!(el instanceof HTMLElement)) return;
    const names = el.dataset.midnightAnchor?.split(" ") ?? [];
    if (!names.includes(name)) el.dataset.midnightAnchor = [...names, name].join(" ");
  };
  const all = (selector: string) => document.querySelectorAll(selector);
  // Marks every ancestor of el, starting at from, until one that contains the stop element.
  const tagUpTo = (el: Element | null, from: number, stop: string, name: string) => {
    if (el?.hasAttribute("data-midnight-chain")) return;
    el?.setAttribute("data-midnight-chain", "");
    let node = el?.parentElement ?? null;
    for (let depth = 1; node && node !== document.body && !node.querySelector(stop); depth++) {
      if (depth >= from) tag(node, name);
      node = node.parentElement;
    }
  };
  const markAnchors = () => {
    all('[data-testid="message-input-root"]').forEach((root) => {
      const frame = Array.from(root.children).find((child) => child.querySelector("textarea"));
      tag(frame, "composer-frame");
      const inner = frame && Array.from(frame.children).find((child) => child.querySelector("textarea"));
      tag(inner && Array.from(inner.children).find((child) => child.querySelector("textarea")), "composer");
    });
    all('[data-testid="subagents-track-header"], [data-testid="composer-import-agent-pill"]').forEach((el) =>
      tag(el.parentElement, "pill-row"),
    );
    all('[data-testid="composer-diff-stat-pill"]').forEach((el) => {
      for (const node of [el.parentElement, el.parentElement?.parentElement]) {
        tag(node, "pill-row");
        tag(node, "diff-row");
      }
    });
    all('[data-testid^="sidebar-project-row-"]').forEach((el) =>
      tag(el.parentElement?.parentElement, "project-group"),
    );
    all('[data-testid="sidebar-schedules"]').forEach((el) =>
      tag(el.parentElement?.parentElement?.parentElement, "sidebar-nav"),
    );
    all(
      '[data-testid="sidebar-project-workspace-list-scroll"] > div > div:first-child > [dir="auto"]',
    ).forEach((el) => {
      if (el.children.length > 0 || el.closest('[data-testid^="sidebar-project-row-"]')) return;
      tag(el, "list-header-label");
      tag(el.parentElement, "list-header");
    });
    all('[data-testid="sidebar-global-new-workspace"], [data-testid="sidebar-close"]').forEach((el) =>
      tagUpTo(el, 1, '[data-testid="sidebar-footer"]', "no-divider"),
    );
    all('[data-testid="workspace-header-title"]').forEach((el) =>
      tagUpTo(el, 2, '[data-testid="workspace-tabs-row"]', "no-divider"),
    );
    all('[data-testid="sidebar-footer"]').forEach((el) =>
      tagUpTo(el, 1, '[data-testid="workspace-tabs-row"]', "sidebar"),
    );
    all('[data-testid="workspace-open-in-editor-caret"]').forEach((el) => {
      tag(el.parentElement, "editor-button");
      tag(el.parentElement?.parentElement, "editor-frame");
    });
    all('[data-testid="changes-primary-cta"]').forEach((el) => tag(el.parentElement, "commit-button"));
    all('[data-testid="new-workspace-import-session"]').forEach((el) =>
      tag(el.parentElement?.parentElement?.parentElement, "new-workspace-column"),
    );
  };

  // The composer's "⌘L to focus" hint has no test id or label to select it by, so it is hidden by its text.
  const hideFocusHint = () => {
    all('[data-testid="message-input-root"]').forEach((root) => {
      if (root.querySelector("[data-midnight-hidden]")) return;
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (!/to focus/.test(node.textContent ?? "")) continue;
        let el = node.parentElement;
        while (el && el !== root && getComputedStyle(el).position !== "absolute") el = el.parentElement;
        if (el && el !== root) el.dataset.midnightHidden = "";
      }
    });
  };

  const FLOATING_ROOTS = '[data-testid="combobox-desktop-container"], [role="menu"]';
  const inspected = new WeakSet<Element>();
  const watchedRoots = new WeakSet<Element>();
  const outlined = (cs: CSSStyleDeclaration) =>
    cs.borderTopWidth !== "0px" &&
    cs.borderBottomWidth !== "0px" &&
    cs.borderLeftWidth !== "0px" &&
    cs.borderTopColor !== "rgba(0, 0, 0, 0)";
  const markSurfaces = () => {
    all(SELECTABLE_ROOTS).forEach((root) => {
      if (watchedRoots.has(root)) return;
      watchedRoots.add(root);
      selectionObserver?.observe(root, { attributes: true, attributeFilter: ["class"], subtree: true });
    });
    document.querySelectorAll<HTMLElement>("div, button").forEach((el) => {
      if (inspected.has(el)) return;
      inspected.add(el);
      if (el.closest(SKIP_ROOTS)) return;
      if (el.tagName === "BUTTON") {
        const menu = el.closest(FLOATING_ROOTS);
        if (menu && el.getBoundingClientRect().width >= menu.getBoundingClientRect().width - 4)
          el.dataset.midnightMenuRow = "";
      }
      const cs = getComputedStyle(el);
      if (outlined(cs)) {
        const height = el.getBoundingClientRect().height;
        if (
          height <= 60 &&
          el.querySelector(":scope > input, :scope > * > input, :scope > textarea, :scope > * > textarea")
        )
          el.dataset.midnight = "field";
        else if (el.tagName === "BUTTON" || el.getAttribute("role") === "button")
          el.dataset.midnight = "control";
        else if (parseFloat(cs.borderTopLeftRadius) >= 999 && height <= 28 && el.textContent)
          el.dataset.midnight = "chip";
        else if (height >= 40) el.dataset.midnight = "card";
      } else if (cs.backgroundColor === KEY_BACKGROUND && el.textContent && el.closest("button")) {
        el.dataset.midnight = "key";
      }
    });
    markSelection();
  };
  const markSelection = () => {
    document
      .querySelectorAll<HTMLElement>(
        '[data-testid="settings-sidebar"] button, [data-testid="command-center-results"] button',
      )
      .forEach((el) => {
        const selected = getComputedStyle(el).backgroundColor !== "rgba(0, 0, 0, 0)";
        if (selected !== "midnightSelected" in el.dataset) {
          if (selected) el.dataset.midnightSelected = "";
          else delete el.dataset.midnightSelected;
        }
      });
  };
  const throttle = (run: () => void) => {
    let scheduled = false;
    return () => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        run();
      });
    };
  };
  const selectionObserver =
    typeof MutationObserver === "undefined" ? null : new MutationObserver(throttle(markSelection));
  // Paseo shows a hovered button only by tinting its background, so a button that gains a tint under
  // the pointer is raised like a selected one.
  let hovered: HTMLElement | null = null;
  const clearHover = () => {
    if (hovered) delete hovered.dataset.midnightHover;
    hovered = null;
  };
  const onPointerOver = (event: Event) => {
    const target = (event.target as Element | null)?.closest<HTMLElement>('button, [role="button"]') ?? null;
    if (target === hovered) return;
    clearHover();
    if (!target) return;
    hovered = target;
    const check = () => {
      if (hovered !== target) return;
      if (getComputedStyle(target).backgroundColor !== "rgba(0, 0, 0, 0)") target.dataset.midnightHover = "";
    };
    requestAnimationFrame(check);
    setTimeout(check, 150);
  };
  // Anchors are set within the frame so a new screen never shows its original outline; the wider
  // scan for outlined surfaces runs at most a few times a second.
  let surfacesTimer: ReturnType<typeof setTimeout> | null = null;
  const scheduleSurfaces = () => {
    if (surfacesTimer) return;
    surfacesTimer = setTimeout(() => {
      surfacesTimer = null;
      markSurfaces();
    }, 200);
  };
  const refresh = () => {
    markAnchors();
    hideFocusHint();
    scheduleSurfaces();
  };
  const observer = typeof MutationObserver === "undefined" ? null : new MutationObserver(throttle(refresh));
  if (style && observer) {
    observer.observe(document.body, { childList: true, subtree: true });
    refresh();
    document.addEventListener("pointerover", onPointerOver);
    document.addEventListener("pointerleave", clearHover);
  }

  return () => {
    observer?.disconnect();
    selectionObserver?.disconnect();
    if (surfacesTimer) clearTimeout(surfacesTimer);
    document.removeEventListener("pointerover", onPointerOver);
    document.removeEventListener("pointerleave", clearHover);
    clearHover();
    style?.remove();
    cleanupTheme();
  };
}
