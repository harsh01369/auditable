/**
 * Page capture.
 *
 * Everything the judgement pass is allowed to reason about comes from here, and
 * nothing else. Keeping capture as the single source of truth is what makes
 * verification meaningful later: a model finding can be re-checked against the
 * exact DOM that was captured, rather than against a page that has since moved.
 *
 * Selectors are generated in the page and proven unique before being recorded.
 * A selector that matches zero or several elements is never emitted, because a
 * finding anchored to an ambiguous selector cannot be verified or fixed.
 */

import type { Page } from 'playwright';
import type { AccessibilityNode, ElementEvidence, PageSnapshot } from '../core/types';

/** Elements worth reasoning about: interactive, structural, or media. */
const SELECTOR_OF_INTEREST = [
  'a[href]',
  'button',
  'input',
  'select',
  'textarea',
  'img',
  'svg[role]',
  'iframe',
  'video',
  'audio',
  'h1, h2, h3, h4, h5, h6',
  'label',
  'form',
  'table',
  '[role]',
  '[tabindex]',
  '[onclick]',
].join(',');

const MAX_HTML = 600;
const MAX_ELEMENTS = 220;

export interface CaptureOptions {
  /** Viewport used for the capture. Reflow checks want a narrow one too. */
  viewport?: { width: number; height: number };
  screenshot?: boolean;
}

export async function capturePage(
  page: Page,
  options: CaptureOptions = {},
): Promise<PageSnapshot> {
  const viewport = options.viewport ?? { width: 1280, height: 900 };
  await page.setViewportSize(viewport);
  await page.waitForLoadState('domcontentloaded');
  // Give client-rendered content a chance to settle without hanging on
  // long-polling or analytics sockets, which never reach networkidle.
  await page.waitForTimeout(900);

  // esbuild (via tsx) compiles named functions with a `__name` helper that does
  // not exist inside the page. Passing this as a string keeps esbuild from
  // rewriting it, and defining the identity shim lets evaluated code run.
  await page.evaluate('globalThis.__name = globalThis.__name || ((fn) => fn)');

  const elements = await page.evaluate(
    ({ interest, maxHtml, maxElements }) => {
      /** Build a selector and prove it resolves to exactly this element. */
      function uniqueSelector(el: Element): string | null {
        if (el.id && document.querySelectorAll(`#${CSS.escape(el.id)}`).length === 1) {
          return `#${CSS.escape(el.id)}`;
        }
        const parts: string[] = [];
        let node: Element | null = el;
        while (node && node.nodeType === 1 && parts.length < 6) {
          const tag = node.tagName.toLowerCase();
          if (node.id && document.querySelectorAll(`#${CSS.escape(node.id)}`).length === 1) {
            parts.unshift(`#${CSS.escape(node.id)}`);
            break;
          }
          const parent: Element | null = node.parentElement;
          if (!parent) {
            parts.unshift(tag);
            break;
          }
          const siblings = Array.from(parent.children).filter(
            (c) => c.tagName === node!.tagName,
          );
          parts.unshift(
            siblings.length > 1 ? `${tag}:nth-of-type(${siblings.indexOf(node) + 1})` : tag,
          );
          node = parent;
        }
        const selector = parts.join(' > ');
        try {
          const matched = document.querySelectorAll(selector);
          return matched.length === 1 && matched[0] === el ? selector : null;
        } catch {
          return null;
        }
      }

      /**
       * Approximation of the accessible name computation. It covers the cases
       * that matter for the criteria we judge; it is not the full accname spec,
       * and the report says so rather than overclaiming.
       */
      function accessibleName(el: Element): string {
        const labelledby = el.getAttribute('aria-labelledby');
        if (labelledby) {
          const text = labelledby
            .split(/\s+/)
            .map((id) => document.getElementById(id)?.textContent?.trim() ?? '')
            .filter(Boolean)
            .join(' ');
          if (text) return text;
        }
        const ariaLabel = el.getAttribute('aria-label');
        if (ariaLabel?.trim()) return ariaLabel.trim();

        if (el instanceof HTMLImageElement) {
          const alt = el.getAttribute('alt');
          if (alt !== null) return alt.trim();
        }
        if (
          el instanceof HTMLInputElement ||
          el instanceof HTMLSelectElement ||
          el instanceof HTMLTextAreaElement
        ) {
          if (el.labels && el.labels.length > 0) {
            return Array.from(el.labels)
              .map((l) => l.textContent?.trim() ?? '')
              .filter(Boolean)
              .join(' ');
          }
          const title = el.getAttribute('title');
          if (title?.trim()) return title.trim();
          return '';
        }
        const text = (el as HTMLElement).innerText?.trim() ?? el.textContent?.trim() ?? '';
        if (text) return text;
        return el.getAttribute('title')?.trim() ?? '';
      }

      function implicitRole(el: Element): string {
        const explicit = el.getAttribute('role');
        if (explicit) return explicit;
        const tag = el.tagName.toLowerCase();
        const map: Record<string, string> = {
          a: el.hasAttribute('href') ? 'link' : 'generic',
          button: 'button',
          img: el.getAttribute('alt') === '' ? 'presentation' : 'img',
          h1: 'heading',
          h2: 'heading',
          h3: 'heading',
          h4: 'heading',
          h5: 'heading',
          h6: 'heading',
          select: 'combobox',
          textarea: 'textbox',
          table: 'table',
          form: 'form',
          iframe: 'iframe',
        };
        if (tag === 'input') {
          const type = (el as HTMLInputElement).type;
          const inputRoles: Record<string, string> = {
            checkbox: 'checkbox',
            radio: 'radio',
            button: 'button',
            submit: 'button',
            reset: 'button',
            range: 'slider',
            search: 'searchbox',
          };
          return inputRoles[type] ?? 'textbox';
        }
        return map[tag] ?? 'generic';
      }

      const seen = new Set<Element>();
      const out: {
        selector: string;
        html: string;
        text: string;
        accessibleName: string;
        role: string;
        box?: { x: number; y: number; width: number; height: number };
      }[] = [];

      for (const el of Array.from(document.querySelectorAll(interest))) {
        if (out.length >= maxElements) break;
        if (seen.has(el)) continue;
        seen.add(el);

        const selector = uniqueSelector(el);
        if (!selector) continue;

        const rect = el.getBoundingClientRect();
        out.push({
          selector,
          html: el.outerHTML.slice(0, maxHtml),
          text: ((el as HTMLElement).innerText ?? el.textContent ?? '').trim().slice(0, 200),
          accessibleName: accessibleName(el).slice(0, 200),
          role: implicitRole(el),
          box:
            rect.width > 0 || rect.height > 0
              ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
              : undefined,
        });
      }
      return out;
    },
    { interest: SELECTOR_OF_INTEREST, maxHtml: MAX_HTML, maxElements: MAX_ELEMENTS },
  );

  const accessibilityTree = await captureAxTree(page);

  return {
    url: page.url(),
    title: await page.title(),
    capturedAt: new Date().toISOString(),
    html: await page.content(),
    accessibilityTree,
    elements: elements as ElementEvidence[],
    screenshot: options.screenshot
      ? (await page.screenshot({ type: 'png', fullPage: false })).toString('base64')
      : undefined,
    lang: (await page.getAttribute('html', 'lang')) ?? undefined,
    viewport,
  };
}

/** A node as the Chrome DevTools Protocol reports it. */
interface CdpAxNode {
  nodeId: string;
  ignored?: boolean;
  role?: { value?: string };
  name?: { value?: string };
  properties?: { name: string; value?: { value?: unknown } }[];
  childIds?: string[];
}

/**
 * Read the accessibility tree the browser itself computed.
 *
 * This is worth the extra machinery: names here are the real computed
 * accessible names, resolved through the full accname algorithm including
 * aria-labelledby chains and hidden-text rules. The per-element names captured
 * in the page are an approximation, and the report says so; these are not.
 */
async function captureAxTree(page: Page): Promise<AccessibilityNode[]> {
  try {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Accessibility.enable');
    const { nodes } = (await cdp.send('Accessibility.getFullAXTree')) as { nodes: CdpAxNode[] };
    await cdp.detach().catch(() => {});
    if (!nodes || nodes.length === 0) return [];

    const byId = new Map(nodes.map((n) => [n.nodeId, n]));
    const childIds = new Set(nodes.flatMap((n) => n.childIds ?? []));
    const roots = nodes.filter((n) => !childIds.has(n.nodeId));

    const build = (node: CdpAxNode, depth: number): AccessibilityNode | null => {
      if (depth > 25) return null;
      const children = (node.childIds ?? [])
        .map((id) => byId.get(id))
        .filter((n): n is CdpAxNode => !!n)
        .map((n) => build(n, depth + 1))
        .filter((n): n is AccessibilityNode => !!n);

      // Skip ignored wrappers but keep whatever they contained.
      if (node.ignored) return children.length === 1 ? children[0]! : null;

      const prop = (name: string) =>
        node.properties?.find((p) => p.name === name)?.value?.value;

      return {
        role: node.role?.value ?? 'unknown',
        name: node.name?.value || undefined,
        level: typeof prop('level') === 'number' ? (prop('level') as number) : undefined,
        disabled: prop('disabled') === true ? true : undefined,
        focusable: prop('focusable') === true ? true : undefined,
        children: children.length > 0 ? children : undefined,
      };
    };

    return roots
      .map((r) => build(r, 0))
      .filter((n): n is AccessibilityNode => !!n);
  } catch {
    // A missing tree degrades the judgement pass; it must not fail the audit.
    return [];
  }
}

/** Flatten the tree for prompting, where nesting costs tokens without adding much. */
export function flattenAxTree(nodes: AccessibilityNode[], depth = 0): string[] {
  const lines: string[] = [];
  for (const n of nodes) {
    const label = n.name ? ` "${n.name}"` : '';
    const level = n.level ? ` level=${n.level}` : '';
    lines.push(`${'  '.repeat(depth)}${n.role}${label}${level}`);
    if (n.children) lines.push(...flattenAxTree(n.children, depth + 1));
  }
  return lines;
}
