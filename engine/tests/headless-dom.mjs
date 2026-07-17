export class StubTextNode {
  constructor(text, ownerDocument) {
    this.ownerDocument = ownerDocument;
    this.parentNode = null;
    this.nodeType = 3;
    this._text = String(text);
  }

  get textContent() {
    return this._text;
  }

  set textContent(value) {
    this._text = String(value);
  }
}

export class StubNode {
  constructor(tag, ownerDocument) {
    this.tagName = String(tag || "div").toUpperCase();
    this.ownerDocument = ownerDocument;
    this.parentNode = null;
    this.children = [];
    this.className = "";
    this.hidden = false;
    this.disabled = false;
    this.value = "";
    this.type = "";
    this.id = "";
    this.maxLength = 0;
    this.required = false;
    this.checked = false;
    this.dataset = {};
    this.attributes = {};
    this.style = {};
    this._text = "";
    this._listeners = {};
  }

  appendChild(node) {
    node.parentNode = this;
    this.children.push(node);
    if (node.id) this.ownerDocument._byId.set(node.id, node);
    return node;
  }

  addEventListener(type, fn) {
    (this._listeners[type] = this._listeners[type] || []).push(fn);
  }

  dispatch(type, extra = {}) {
    for (const fn of this._listeners[type] || []) {
      fn({
        preventDefault() {},
        target: this,
        ...extra,
      });
    }
  }

  click() {
    this.dispatch("click");
  }

  focus() {
    this.ownerDocument.activeElement = this;
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
    if (name === "id") {
      this.id = String(value);
      this.ownerDocument._byId.set(this.id, this);
    }
    if (name.startsWith("data-")) {
      this.dataset[name.slice(5)] = String(value);
    }
  }

  getAttribute(name) {
    if (name === "id") return this.id || null;
    if (name.startsWith("data-")) return this.dataset[name.slice(5)] || null;
    return this.attributes[name] || null;
  }

  removeAttribute(name) {
    delete this.attributes[name];
  }

  closest(selector) {
    if (selector === ".verse-marker") {
      let node = this;
      while (node) {
        const classes = String(node.className || "").split(/\s+/).filter(Boolean);
        if (classes.includes("verse-marker")) return node;
        node = node.parentNode;
      }
      return null;
    }
    return null;
  }

  getBoundingClientRect() {
    return { left: 20, bottom: 40 };
  }

  get textContent() {
    const childText = this.children.map((child) => child.textContent).join("");
    return `${this._text}${childText}`;
  }

  set textContent(value) {
    this._text = String(value);
    this.children = [];
  }
}

export function makeDocument() {
  const doc = {
    _byId: new Map(),
    activeElement: null,
    _listeners: {},
    createElement(tag) {
      return new StubNode(tag, doc);
    },
    createTextNode(text) {
      return new StubTextNode(text, doc);
    },
    getElementById(id) {
      return doc._byId.get(id) || null;
    },
    addEventListener(type, fn) {
      (doc._listeners[type] = doc._listeners[type] || []).push(fn);
    },
    removeEventListener(type, fn) {
      doc._listeners[type] = (doc._listeners[type] || []).filter((entry) => entry !== fn);
    },
    dispatch(type, extra = {}) {
      for (const fn of doc._listeners[type] || []) {
        fn({ preventDefault() {}, ...extra });
      }
    },
  };
  return doc;
}

export function makeStorage() {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
  };
}
