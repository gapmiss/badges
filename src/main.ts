import { Plugin, MarkdownPostProcessor, MarkdownPostProcessorContext, setIcon, editorLivePreviewField } from 'obsidian'
import { RangeSetBuilder } from "@codemirror/state"
import { ViewPlugin, WidgetType, EditorView, ViewUpdate, Decoration, DecorationSet } from '@codemirror/view'
import { BADGE_TYPES } from './constants';

const REGEXP = /(`\[!!([^\]]*)\]`)/gm;
const TAGS = 'code'

export default class BadgesPlugin extends Plugin {
  public postprocessor: MarkdownPostProcessor = (el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
    const blockToReplace = el.querySelectorAll(TAGS)
    if (blockToReplace.length === 0) return

    function replace(node: Node) {
      const childrenToReplace: Text[] = []
      node.childNodes.forEach(child => {
        if (child.nodeType === 3) {
          childrenToReplace.push(child as Text)
        }
      })
      childrenToReplace.forEach((child) => {
        child.replaceWith(child);
      })
    }

    blockToReplace.forEach(block => {
      replace(block)
    })
  }

  async onload() {
    this.registerMarkdownPostProcessor(
			buildPostProcessor()
		);
    this.registerEditorExtension(viewPlugin)
    console.log('Badges plugin loaded')
  }

  onunload() {
    console.log('Badges plugin loaded')
  }
}

function buildPostProcessor(): MarkdownPostProcessor {
	return (el) => {
    el.findAll("code").forEach(
			(code) => {
				let text:string|undefined = code.innerText.trim();
				if (text !== undefined && text.startsWith('[!!') && text.endsWith(']')) {
          let newEl = buildBadge(text);
          if (newEl !== undefined) {
            code.replaceWith(newEl);
          }
				}
			}
		)
	}
}

class BadgeWidget extends WidgetType {
  constructor(readonly badge: string[]) {
    super()
  }

  toDOM(view: EditorView): HTMLElement {
    let text:string = this.badge[0].substring(1).substring(this.badge[0].length-2,0);
      return buildBadge(text);
  }
}

const viewPlugin = ViewPlugin.fromClass(class {
  decorations: DecorationSet;

  constructor(view: EditorView) {
    this.decorations = this.buildDecorations(view);
  }

  update(update: ViewUpdate) {
    this.decorations = this.buildDecorations(update.view);
  }

  destroy() { }

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
      const startOfLine = line.from;
      const endOfLine = line.to;
      
      let currentLine = false;
      currentSelections.forEach((r) => {
        if (r.to >= startOfLine && r.from <= endOfLine) {
          currentLine = true;
          return;
        }
      });

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
          builder.add(from, to, Decoration.widget({ widget: new BadgeWidget(match) }))
        }
      }
    }
    return builder.finish();
  }
}, {
  decorations: (v) => v.decorations,
})

function buildBadge(text: string) {
  // HTML Elements
  let newEl:HTMLElement = document.createElement("span");
  let iconEl:HTMLElement = document.createElement("span");
  let titleEl:HTMLElement = document.createElement("span");
  let textEl:HTMLElement = document.createElement("span");
  let attrType:any = "";
	let part:string = text.substring(2);
  let content:string = part.substring(part.length-1,1).trim();
  // no content
  if (!content.length) { 
		newEl.setText("Badges syntax error");
		return newEl;
	}
  let parts:any[] = content.split(':');
  // return if NO CONTENT
  if (parts.length < 2) {
		newEl.setText("❌ Badges syntax error");
		newEl.setAttr("style", "color:var(--text-error)")
		return newEl;
	}
  // type of badge
  let badgeType:string = parts[0].trim();
  // build and check for extras
  let extras:any[] = badgeType.split("|");
  let hasExtra:boolean = extras.length > 1;
  // title value for badge
  let badgeContent:string = parts[1].trim();
  // custom badge
  if (extras.length == 3) {
    // icon
    iconEl.addClass("inline-badge-icon");
    attrType = 'customized';
    setIcon(iconEl, extras[1]);
    iconEl.setAttr("aria-label", extras[2]);
    // details
    let details:any[] = parts[1].split("|");
    // title
    let title:string = details[0].trim();
    titleEl.addClass("inline-badge-title-inner");
    titleEl.setText(title);
    newEl.addClass('inline-badge');
    newEl.setAttr("data-inline-badge", attrType.toLowerCase());
    // color
    let color:string = 'currentColor';
    if (details[1]) {
      color = details[1].trim();
    }
    newEl.setAttr("style", "--customize-badge-color: "+color+";");
    // render
    newEl.appendChild(iconEl);
    if (textEl.getText() != "") {
      newEl.appendChild(textEl);
    }
    newEl.appendChild(titleEl);
    // set attrType to custom "key"
    attrType = extras.join("|");
  } else {
    if (hasExtra) {
      // Github badges
      if (extras[1].startsWith('ghb>') || extras[1].startsWith('ghs>')) {
        let ghType:string = extras[1].split('>')[1].trim();
        setIcon(iconEl, "github");
        iconEl.addClass("inline-badge-icon");
        iconEl.setAttr("aria-label", "Github");
        textEl.addClass("gh-type");
        textEl.setText(ghType);
        iconEl.appendChild(textEl);
        attrType = (extras[1].startsWith('ghb>')) ? 'github' : 'github-success';
        badgeType = (extras[1].startsWith('ghb>')) ? 'github' : 'github-success';
      // NO icon, text-only
      } else {
        iconEl.addClass("inline-badge-extra");
        iconEl.setText(badgeType.split("|")[1].trim());
        attrType = 'text';
        badgeType = 'text';
      }
    // non-Github
    } else {
      iconEl.addClass("inline-badge-icon");
      attrType = badgeType.trim();
      BADGE_TYPES.forEach((el) => {
        if (el.indexOf(badgeType.toLowerCase()) === 0 && el[2].length > 0) {
          setIcon(iconEl, el[2]);
          iconEl.setAttr("aria-label", badgeType.trim());
        }
      });
    }
    // render
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
  return newEl;
}
