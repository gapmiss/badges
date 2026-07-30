import { App, Editor, FuzzySuggestModal, FuzzyMatch, Plugin, MarkdownPostProcessor, setIcon, editorLivePreviewField } from 'obsidian'
import { RangeSetBuilder } from "@codemirror/state"
import { ViewPlugin, WidgetType, EditorView, ViewUpdate, Decoration, DecorationSet } from '@codemirror/view'
import { BADGE_TYPES, BadgeType } from './constants';

const REGEXP = /(`\[!!(.*?)\]`)/gm;

export default class BadgesPlugin extends Plugin {
  async onload() {
    this.registerMarkdownPostProcessor(
			buildPostProcessor()
		);
    this.registerEditorExtension(viewPlugin)
    this.addCommand({
      id: 'insert-badge',
      name: 'Insert badge',
      editorCallback: (editor: Editor) => {
        new BadgePickerModal(this.app, editor).open();
        }
    });
  }
}

function buildPostProcessor(): MarkdownPostProcessor {
	return (el) => {
    el.findAll("code").forEach(
			(code) => {
				const text = code.innerText.trim();
				if (text.startsWith('[!!') && text.endsWith(']')) {
          code.replaceWith(buildBadge(text));
				}
			}
		)
	}
}

class BadgeWidget extends WidgetType {
  readonly text: string;

  constructor(badge: string[]) {
    super()
    this.text = badge[0].substring(1).substring(badge[0].length-2,0);
  }

  eq(other: BadgeWidget): boolean {
    return this.text === other.text;
  }

  toDOM(_view: EditorView): HTMLElement {
    return buildBadge(this.text);
  }
}

const viewPlugin = ViewPlugin.fromClass(class {
  decorations: DecorationSet;

  constructor(view: EditorView) {
    this.decorations = this.buildDecorations(view);
  }

  update(update: ViewUpdate) {
    // Rebuild unconditionally. Gating on docChanged/viewportChanged/selectionSet
    // misses the update where Obsidian turns live preview on, and once this
    // plugin has reported Decoration.none for those ranges CodeMirror never
    // redraws them — badges stay stuck as plain inline code. Widget churn is
    // handled by BadgeWidget.eq() instead.
    this.decorations = this.buildDecorations(update.view);
  }

  buildDecorations(view: EditorView): DecorationSet {
    if (!view.state.field(editorLivePreviewField)) {
      return Decoration.none;
    }
    let builder = new RangeSetBuilder<Decoration>();
    let lines: number[] = [];
    if (view.state.doc.length > 0) {
      lines = Array.from(
        { length: view.state.doc.lines },
        (_, i) => i + 1,
      );
    }

    const currentSelections = [...view.state.selection.ranges];

    for (let n of lines) {
      const line = view.state.doc.line(n);
      let matches = Array.from(line.text.matchAll(REGEXP))
      for (const match of matches) {
        let add = true
        const from = match.index != undefined ? match.index + line.from : -1
        const to = from + match[0].length
        if ((to-from) === 6) {
          add = false
        }
        currentSelections.forEach((r) => {
          if (r.to >= from && r.from <= to) {
            add = false
          }
        })
        if (add) {
          // inclusiveStart gives the decoration a negative startSide. Without it,
          // when the editor is reconfigured on a live view (enabling/disabling a
          // plugin), CodeMirror's redraw range starts inside the replaced span and
          // it emits a continueWidget placeholder instead of the badge, leaving a
          // blank gap. Decoration.widget used to avoid this via its -1e8 startSide.
          builder.add(from, to, Decoration.replace({ widget: new BadgeWidget(match), inclusiveStart: true }))
        }
      }
    }
    return builder.finish();
  }
}, {
  decorations: (v) => v.decorations,
})

function buildBadge(text: string): HTMLSpanElement | HTMLAnchorElement {
  const newEl = createSpan();
  const iconEl = createSpan();
  const titleEl = createSpan();
  const textEl = createSpan();
  let attrType = "";
  const part = text.substring(2);
  // Support escaped pipes (\|) for use inside Markdown tables
  let content = part.substring(part.length-1,1).trim().replace(/\\\|/g, '|');
  if (!content.length) {
    newEl.setText("Badges syntax error");
    return newEl;
  }
  // Parse optional link syntax: >>[[wikilink]] or >>https://...
  let linkTarget: string | null = null;
  let isWikilink = false;
  const linkMatch = content.match(/>>(\[\[.+?\]\]|.+)$/);
  if (linkMatch) {
    const rawLink = linkMatch[1].trim();
    if (rawLink.startsWith('[[') && rawLink.endsWith(']]')) {
      linkTarget = rawLink.slice(2, -2);
      isWikilink = true;
    } else {
      linkTarget = rawLink;
    }
    content = content.slice(0, content.lastIndexOf('>>')).trim();
  }
  // Split on the first colon only, so content is free to contain colons of its
  // own. Splitting on every colon silently dropped everything after the second.
  const sepIndex = content.indexOf(':');
  const badgeType = (sepIndex === -1 ? content : content.slice(0, sepIndex)).trim();
  const rawContent = sepIndex === -1 ? null : content.slice(sepIndex + 1);
  let badgeContent: string;
  // Support shorthand syntax for known types: [!!success] instead of [!!success:Success]
  if (rawContent === null) {
    const knownType = BADGE_TYPES.find((el) => el[0] === badgeType.toLowerCase());
    if (knownType) {
      badgeContent = knownType[1];
    } else {
      newEl.setText("❌ Badges syntax error");
      newEl.setAttr("style", "color:var(--text-error)")
      return newEl;
    }
  } else {
    badgeContent = rawContent.trim();
  }
  const extras = badgeType.split("|");
  const hasExtra = extras.length > 1;
  if (extras.length == 3) {
    iconEl.addClass("inline-badge-icon");
    attrType = 'customized';
    setIcon(iconEl, extras[1]);
    iconEl.setAttr("aria-label", extras[2]);
    const details = (rawContent ?? '').split("|");
    const title = details[0].trim();
    titleEl.addClass("inline-badge-title-inner");
    titleEl.setText(title);
    newEl.addClass('inline-badge');
    newEl.setAttr("data-inline-badge", attrType.toLowerCase());
    let color = 'currentColor';
    if (details[1]) {
      color = details[1].trim();
    }
    newEl.setAttr("style", "--customize-badge-color: "+color+";");
    newEl.appendChild(iconEl);
    if (textEl.getText() != "") {
      newEl.appendChild(textEl);
    }
    newEl.appendChild(titleEl);
  } else {
    if (hasExtra) {
      if (extras[1].startsWith('ghb>') || extras[1].startsWith('ghs>')) {
        const ghType = extras[1].split('>')[1].trim();
        setIcon(iconEl, "github");
        iconEl.addClass("inline-badge-icon");
        iconEl.setAttr("aria-label", "Github");
        textEl.addClass("gh-type");
        textEl.setText(ghType);
        attrType = (extras[1].startsWith('ghb>')) ? 'github' : 'github-success';
      } else {
        iconEl.addClass("inline-badge-extra");
        const badgeTypeText = badgeType.split("|")[1].trim();
        iconEl.setText(badgeTypeText);
        iconEl.dataset.badgeType = badgeTypeText;
        attrType = 'text';
      }
    } else {
      iconEl.addClass("inline-badge-icon");
      attrType = badgeType.trim();
      const knownType = BADGE_TYPES.find((el) => el[0] === badgeType.toLowerCase() && el[2].length > 0);
      if (knownType) {
        setIcon(iconEl, knownType[2]);
      } else {
        setIcon(iconEl, badgeType.trim());
      }
      iconEl.setAttr("aria-label", badgeType.trim());
    }
    titleEl.addClass("inline-badge-title-inner");
    titleEl.setText(badgeContent);
    newEl.addClass('inline-badge');
    newEl.setAttr("data-inline-badge", attrType.toLowerCase());
    newEl.appendChild(iconEl);
    if (textEl.getText() != "") {
      newEl.appendChild(textEl);
    }
    newEl.appendChild(titleEl);
  }
  // Wrap in anchor if link was specified
  if (linkTarget) {
    const anchor = createEl('a');
    anchor.addClass('badge-link');
    if (isWikilink) {
      anchor.addClass('internal-link');
      anchor.setAttr('data-href', linkTarget);
      anchor.setAttr('href', linkTarget);
      anchor.setAttr('data-tooltip-position', 'top');
    } else {
      anchor.addClass('external-link');
      anchor.setAttr('href', linkTarget);
      anchor.setAttr('target', '_blank');
      anchor.setAttr('rel', 'noopener');
      anchor.setAttr('aria-label', linkTarget);
      anchor.setAttr('data-tooltip-position', 'top');
    }
    anchor.appendChild(newEl);
    return anchor;
  }
  return newEl;
}

// Modal for inserting badges
class BadgePickerModal extends FuzzySuggestModal<BadgeType> {
  private readonly editor: Editor;

  constructor(app: App, editor: Editor) {
    super(app);
    this.editor = editor;
    this.setPlaceholder('Choose a badge type…');
  }

  getItems(): BadgeType[] {
    return BADGE_TYPES;
  }

  getItemText(item: BadgeType): string {
    return item[0];
  }

  renderSuggestion(match: FuzzyMatch<BadgeType>, el: HTMLElement): void {
    el.addClass('badge-picker-suggestion');
    const iconEl = el.createSpan({ cls: 'badge-picker-icon' });
    setIcon(iconEl, match.item[2]);
    super.renderSuggestion(match, el.createSpan());
  }

  onChooseItem(item: BadgeType): void {
    const key = item[0];
    // Collapse newlines, escape pipes so a badge dropped into a table cell does
    // not split the row, and drop backticks so the inline code span survives.
    const value = this.editor.getSelection()
      .replace(/\s*\n\s*/g, ' ')
      .replace(/`/g, '')
      .replace(/\|/g, '\\|')
      .trim();
    const start = this.editor.getCursor('from');
    this.editor.replaceSelection(`\`[!!${key}:${value || ' '}]\``);
    if (!value) {
      // Select the lone placeholder space so typing a label replaces it.
      // Arrowing past or clicking away keeps the space, leaving an icon-only
      // badge. Adding a label is the common case, and it is the one that costs
      // navigation if the cursor lands outside the badge instead.
      const ch = start.ch + 5 + key.length;
      this.editor.setSelection(
        { line: start.line, ch },
        { line: start.line, ch: ch + 1 }
      );
    }
  }
}

