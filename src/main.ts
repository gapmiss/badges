import { MarkdownPostProcessor, Plugin, setIcon, PluginManifest } from 'obsidian';
import { BADGE_TYPES } from './constants';

export default class BadgesPlugin extends Plugin {
  plugin: Plugin;
  manifest: PluginManifest;

  async onload() {		
		this.registerMarkdownPostProcessor(
			buildPostProcessor()
		);
		console.log("Badges plugin loaded");
	}

  onunload() {
		console.log("Badges plugin unloaded");
	}
}

export function buildPostProcessor(): MarkdownPostProcessor {
	return (el) => {
    el.findAll("code").forEach(
			(code) => {
				let text:string|undefined = code.innerText.trim();
				// matches
				if (text !== undefined && text.startsWith('[!!') && text.endsWith(']')) {
					// trim syntax chars from text
					let part:string = text.substring(2);
					let content:string = part.substring(part.length-1,1).trim();
					// split on ":"
					let parts:any[] = content.split(':');
					// return if NO CONTENT
					if (parts.length < 2) {
						return;
					}
					// define type of badge
					let badgeType:string = parts[0].trim();
					// build and check for extras
					let extras:any[] = badgeType.split("|");
					let hasExtra:boolean = extras.length > 1;
					// title value for badge
					let badgeContent:string = parts[1].trim();
					// HTML Elements
					let newEl:HTMLElement = document.createElement("span");
					let iconEl:HTMLElement = document.createElement("span");
					let titleEl:HTMLElement = document.createElement("span");
					let textEl:HTMLElement = document.createElement("span");
					let attrType:any = "";
					// custom badge
					if (extras.length == 3) {
						// icon
						iconEl.addClass("inline-badge-icon");
						attrType = 'customized';
						setIcon(iconEl, extras[1]);
						iconEl.setAttr("aria-label", extras[2]);
						// title/color
						let styles:any[] = parts[1].split("|");
						let title:string = styles[0].trim();
						let color:string = styles[1].trim();
						// title
						titleEl.addClass("inline-badge-title-inner");
						titleEl.setText(title);
						newEl.addClass('inline-badge');
						newEl.setAttr("data-inline-badge", attrType.toLowerCase());
						// color
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
					// replace code with newEl
					code.replaceWith(newEl);
				}
			}
		)
	}
}