/**
 * Safe DOM and SVG construction utilities.
 * Never uses innerHTML, outerHTML, insertAdjacentHTML, or document.write.
 */

const SVG_NS = "http://www.w3.org/2000/svg";

export function el(tag, options = {}, children = []) {
  const node = document.createElement(tag);
  if (options.className) {
    node.className = options.className;
  }
  if (options.text !== undefined && options.text !== null) {
    node.textContent = String(options.text);
  }
  if (options.attrs) {
    for (const [key, value] of Object.entries(options.attrs)) {
      if (value !== undefined && value !== null) {
        node.setAttribute(key, String(value));
      }
    }
  }
  if (options.onClick) {
    node.addEventListener("click", options.onClick);
  }
  for (const child of children) {
    if (child !== null && child !== undefined) {
      node.appendChild(
        typeof child === "string" ? document.createTextNode(child) : child
      );
    }
  }
  return node;
}

export function clear(node) {
  if (node) {
    node.replaceChildren();
  }
}

export function svgEl(tag, attrs = {}, text = null) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value !== undefined && value !== null) {
      node.setAttribute(key, String(value));
    }
  }
  if (text !== null && text !== undefined) {
    node.textContent = String(text);
  }
  return node;
}
