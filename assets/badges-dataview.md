#### Example regex

```js
let regex = /`\[!!info\:(.+?)\]`/gm
let regex = /`\[!!\|ghb>(.+?)\]`/gm
let regex = /`\[!!\|ghs>(.+?)\]`/gm
let regex = /`\[!!\|plus\-square(.+?)\]`/gm
```

#### info

````
```dataviewjs
const pages = dv.pages();
let regex = /`\[!!info\:(.+?)\]`/gm
const rows = []
for (const page of pages) {
	const file = app.vault.getAbstractFileByPath(page.file.path)
	if (file.extension == "md") {
		const contents = await app.vault.read(file)
		for (const badge of contents.match(new RegExp(regex, 'g')) || []) {
			const match = badge.match(new RegExp(regex, 's')) 
			rows.push([match[1], page.file.link])
		}
	}
}
dv.table(['Badge', 'Link'], rows)
```
````

#### github

````
```dataviewjs
const pages = dv.pages();
let regex = /`\[!!\|ghb>(.+?)\]`/gm
const rows = []
for (const page of pages) {
	const file = app.vault.getAbstractFileByPath(page.file.path)
	if (file.extension == "md") {
		const contents = await app.vault.read(file)
		for (const badge of contents.match(new RegExp(regex, 'g')) || []) {
			const match = badge.match(new RegExp(regex, 's')) 
			rows.push([match[1], page.file.link])
		}
	}
}
dv.table(['Badge', 'Link'], rows)
```
````

#### github success

````
```dataviewjs
const pages = dv.pages();
let regex = /`\[!!\|ghs>(.+?)\]`/gm
const rows = []
for (const page of pages) {
	const file = app.vault.getAbstractFileByPath(page.file.path)
	if (file.extension == "md") {
		const contents = await app.vault.read(file)
		for (const badge of contents.match(new RegExp(regex, 'g')) || []) {
			const match = badge.match(new RegExp(regex, 's')) 
			rows.push([match[1], page.file.link])
		}
	}
}
dv.table(['Badge', 'Link'], rows)
```
````

#### custom

````
```dataviewjs
const pages = dv.pages();
let regex = /`\[!!\|plus\-square(.+?)\]`/gm
const rows = []
for (const page of pages) {
	const file = app.vault.getAbstractFileByPath(page.file.path)
	if (file.extension == "md") {
		const contents = await app.vault.read(file)
		for (const badge of contents.match(new RegExp(regex, 'g')) || []) {
			const match = badge.match(new RegExp(regex, 's')) 
			rows.push([
				match[1].split("|")[1].split(":")[0],
				match[1].split("|")[1].split(":")[1],
				page.file.link
			])
		}
	}
}
dv.table(['Key', 'Value', 'Link'], rows)
```
````