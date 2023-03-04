# Hugo Theme 'Heresy'

## Get Started

```sh
hugo new site new-site
cd new-site
git clone https://git.familie-haerer.de/david/heresy themes/heresy
echo "theme = 'heresy'" >> config.toml
```

## Features

## Custom Color

To use a custom color theme, you can copy the `themes/heresy/static/color.css` to `static/color.css` and update the color values for both dark and light mode.
The values are given as an HSL triplet so that the theme can apply custom transparency.

```css
:root {
  --foreground-light: 0, 100%, 0%;
  --background-light: 0, 100%, 100%;
  --accent-light: 30, 100%, 30%;
  
  --foreground-dark: 0, 100%, 100%;
  --background-dark: 0, 100%, 0%;
  --accent-dark: 30, 100%, 65%;
}
```

### Favicon

You can provide a custom `static/favicon.svg` file.

```toml
baseURL = "https://example.com"
languageCode = "en-us"
title = "Example"
theme = "heresy"

[params]
  favicon = "/favicon.svg"
```

### List Sorting

By default, list entries will be sorted by date.
You can specify `sortbytitle` in your `config.toml` to sort alphabetically by title.

```toml
baseURL = "https://example.com"
languageCode = "en-us"
title = "Example"
theme = "heresy"

[params]
  sortbytitle = true
```

### Header and Footer

You can provide a custom header and footer.
The header will only show up on the homepage.
The footer will show up on every page.
You can use HTML for markup.

```toml
baseURL = "https://example.com"
languageCode = "en-us"
title = "Example"
theme = "heresy"

[params]
  header = "Example website made by Alice."
  footer = "Contact by <a href='mailto:alice@example.com'>mail</a>."
```

### Math Rendering

You can use LaTeX math notation in a page, if you set `math: true` in the frontmatter.

```md
---
title: "Math"
math: true
---

Identity of $x$ is

$$
f(x) = x.
$$
```

### External Redirects

In the frontmatter of a page, you can use the `redirect` key to specify an URL, to which the page should redirect.
In a list, the page will have the ` [↪]` arrow to indicate, that it redirects to an external page.

```
---
title: "Example"
redirect: "https://example.com"
---
```

### Mermaid Diagrams

You can use mermaid diagrams with normal code blocks.
The color scheme of the diagram will depend on the users browser preference.

~~~
```mermaid
graph RD;
  A-->B;
  A-->C;
  B-->D;
  C-->D;
```
~~~

## Credits

Inspired by [LukeSmithxyz/lugo](https://github.com/LukeSmithxyz/lugo/).
