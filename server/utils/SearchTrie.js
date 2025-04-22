class TrieNode {
  constructor() {
    this.children = new Map();
    this.results = null;
    this.timestamp = null;
  }
}

export class SearchTrie {
  constructor(ttlMinutes = 60) {
    this.root = new TrieNode();
    this.ttlMs = ttlMinutes * 60 * 1000;
  }

  insert(query, results) {
    let node = this.root;
    const normalizedQuery = query.toLowerCase();

    for (const char of normalizedQuery) {
      if (!node.children.has(char)) {
        node.children.set(char, new TrieNode());
      }
      node = node.children.get(char);
    }

    node.results = results;
    node.timestamp = Date.now();
  }

  search(query) {
    let node = this.root;
    const normalizedQuery = query.toLowerCase();

    for (const char of normalizedQuery) {
      if (!node.children.has(char)) {
        return null;
      }
      node = node.children.get(char);
    }

    if (!node.results || !node.timestamp) {
      return null;
    }

    // Check if results are expired
    if (Date.now() - node.timestamp > this.ttlMs) {
      node.results = null;
      node.timestamp = null;
      return null;
    }

    return node.results;
  }

  cleanup() {
    this._cleanupNode(this.root);
  }

  _cleanupNode(node) {
    if (!node) return true;

    // Check if this node's results are expired
    if (node.timestamp && Date.now() - node.timestamp > this.ttlMs) {
      node.results = null;
      node.timestamp = null;
    }

    // Recursively cleanup children
    for (const [char, childNode] of node.children.entries()) {
      if (this._cleanupNode(childNode)) {
        node.children.delete(char);
      }
    }

    // Return true if this node can be removed (no results and no children)
    return !node.results && node.children.size === 0;
  }
}
