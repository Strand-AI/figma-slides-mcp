---
marp: true
theme: default
paginate: true
header: "Marp Demo"
footer: "Created with Marp CLI"
---

# Welcome to Marp

A markdown-based slide deck

---

## What is Marp?

- Write slides in **Markdown**
- Export to HTML, PDF, or PPTX
- Theme with CSS
- Live preview in VS Code

---

## Code Blocks

```python
def hello(name: str) -> str:
    return f"Hello, {name}!"

print(hello("world"))
```

Syntax highlighting works out of the box.

---

## Images & Layout

![bg right:40%](https://picsum.photos/720/480)

You can use background images with simple directives:

- `![bg](url)` — full background
- `![bg right:40%](url)` — split layout
- `![bg left](url)` — left split

---

## Styling with Directives

<!-- _class: lead -->
<!-- _backgroundColor: #1a1a2e -->
<!-- _color: #eee -->

### You can style individual slides
### using HTML comments as directives

---

## Math Support

Inline math: $E = mc^2$

Block math:

$$
\int_0^\infty e^{-x^2} dx = \frac{\sqrt{\pi}}{2}
$$

---

## Building Your Deck

```bash
# Live preview server
npm run dev

# Export to HTML
npm run build

# Export to PDF
npm run pdf

# Export to PowerPoint
npm run pptx
```

---

<!-- _class: lead -->
<!-- _backgroundColor: #16213e -->
<!-- _color: #eee -->

# That's it!

Start editing `slides.md` and run `npm run dev`
