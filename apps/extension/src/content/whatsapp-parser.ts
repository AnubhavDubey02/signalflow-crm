export interface ParsedMessage {
  id: string;
  sender: 'AGENT' | 'LEAD';
  text: string;
  rawTimestamp: string;
  normalizedTimestamp: string;
}

export interface SelectorTestResult {
  selectorName: string;
  selector: string;
  count: number;
}

export interface Diagnostics {
  headerFound: boolean;
  messagesFound: number;
  selectorsHealthy: boolean;
  currentSelectorUsed: string;
  matchedCount: number;
  matchedSnippets: string[];
  selectorTests: SelectorTestResult[];
}

// Selector Registry & Fallback System
const SELECTOR_REGISTRY = {
  mainContainer: ['#main'],
  chatHeader: ['header .copyable-text span[dir="auto"]', 'header span[title]', '#main header span']
};

export class WhatsAppParser {
  private static findElement(selectors: string[], parent: Element | Document = document): Element | null {
    for (const selector of selectors) {
      const el = parent.querySelector(selector);
      if (el) return el;
    }
    return null;
  }

  // Chat Header Detection
  public static getActiveLeadName(): string | null {
    const main = this.findElement(SELECTOR_REGISTRY.mainContainer);
    if (!main) return null;
    
    const header = this.findElement(SELECTOR_REGISTRY.chatHeader, main);
    return header ? header.textContent : null;
  }

  // Active Phone Number Detection (checks if header is formatted like a phone number)
  public static getActivePhoneNumber(): string | null {
    const leadName = this.getActiveLeadName();
    if (!leadName) return null;
    
    const cleaned = leadName.replace(/[\s\-\(\)\+]/g, '');
    const isPhone = /^[0-9]{10,15}$/.test(cleaned);
    if (isPhone) {
      const hasPlus = leadName.trim().startsWith('+');
      return (hasPlus ? '+' : '') + cleaned;
    }
    
    return null;
  }

  // Selector Diagnostics
  public static runSelectorDiagnostics(): SelectorTestResult[] {
    const main = document.querySelector('#main') || document;
    const selectors = [
      { name: 'data-pre-plain-text', query: '[data-pre-plain-text]' },
      { name: 'message-in', query: '.message-in' },
      { name: 'message-out', query: '.message-out' },
      { name: 'role=row', query: '[role="row"]' },
      { name: 'selectable-text', query: '.selectable-text' }
    ];
    return selectors.map(s => {
      const count = main.querySelectorAll(s.query).length;
      return { selectorName: s.name, selector: s.query, count };
    });
  }

  // Get active selector based on match count
  public static getActiveSelectorAndNodes(): { selector: string; nodes: Element[] } {
    const main = document.querySelector('#main') || document;
    
    const candidates = [
      { name: 'data-pre-plain-text', query: '[data-pre-plain-text]' },
      { name: 'message-in / message-out', query: '.message-in, .message-out' },
      { name: 'role=row', query: '[role="row"]' },
      { name: 'selectable-text', query: '.selectable-text' }
    ];

    for (const cand of candidates) {
      const nodes = Array.from(main.querySelectorAll(cand.query));
      if (nodes.length > 0) {
        return { selector: cand.name, nodes };
      }
    }

    return { selector: 'None', nodes: [] };
  }

  // Normalize a raw timestamp string to a valid ISO datetime string
  public static normalizeTimestamp(raw: string): string {
    if (!raw) return new Date().toISOString();
    let dt = new Date();
    try {
      if (raw.includes(',')) {
        // format e.g. "11:23 AM, 5/29/2026"
        const cleanRaw = raw.replace(/[\[\]]/g, '').trim();
        const parts = cleanRaw.split(',');
        const timePart = parts[0].trim();
        const datePart = parts[1].trim();
        dt = new Date(`${datePart} ${timePart}`);
      } else {
        // format e.g. "5:39 pm" -> parse as today's time
        const match = raw.match(/(\d{1,2}):(\d{2})\s*([aApP][mM])?/);
        if (match) {
          let hours = parseInt(match[1]);
          const minutes = parseInt(match[2]);
          const ampm = match[3];
          if (ampm) {
            if (ampm.toLowerCase() === 'pm' && hours < 12) hours += 12;
            if (ampm.toLowerCase() === 'am' && hours === 12) hours = 0;
          }
          dt.setHours(hours, minutes, 0, 0);
        } else {
          dt = new Date(raw);
        }
      }
    } catch (e) {
      dt = new Date();
    }
    if (isNaN(dt.getTime())) {
      dt = new Date();
    }
    return dt.toISOString();
  }

  // Parse a DOM node to ParsedMessage
  public static parseNodeToMessage(el: Element, leadName: string | null): ParsedMessage | null {
    // 1. Text
    let text = '';
    const selectable = el.classList.contains('selectable-text') ? el : el.querySelector('.selectable-text');
    if (selectable) {
      text = selectable.textContent || '';
    } else {
      const copyable = el.classList.contains('copyable-text') ? el : el.querySelector('.copyable-text');
      text = copyable ? copyable.textContent || '' : el.textContent || '';
    }
    
    text = text.trim();
    if (!text) return null;

    // Clean text and extract timestamp from body if present
    let extractedTime: string | null = null;
    const timeRegex = /\s*((?:\d{1,2}:\d{2}(?:\s*[aApP][mM])?)|(?:\d{1,2}:\d{2}))\s*[✓✔]*$/;
    const match = text.match(timeRegex);
    if (match) {
      const candidateText = text.slice(0, -match[0].length).trim();
      if (candidateText.length > 0) {
        extractedTime = match[1];
        text = candidateText;
      }
    }

    // 2. Sender
    let sender: 'AGENT' | 'LEAD' = 'LEAD';
    const isOutgoing = !!(
      el.closest('.message-out') || 
      el.classList.contains('message-out') ||
      el.closest('[data-id*="true_"]') ||
      el.querySelector('[data-id*="true_"]') ||
      el.outerHTML.includes('message-out')
    );
    
    if (isOutgoing) {
      sender = 'AGENT';
    } else {
      const isIncoming = !!(
        el.closest('.message-in') || 
        el.classList.contains('message-in') ||
        el.closest('[data-id*="false_"]') ||
        el.querySelector('[data-id*="false_"]') ||
        el.outerHTML.includes('message-in')
      );
      if (isIncoming) {
        sender = 'LEAD';
      } else {
        const prePlainTextEl = el.hasAttribute('data-pre-plain-text') ? el : el.querySelector('[data-pre-plain-text]');
        if (prePlainTextEl) {
          const metaText = prePlainTextEl.getAttribute('data-pre-plain-text');
          if (metaText && leadName) {
            const parts = metaText.split(']');
            if (parts.length > 1) {
              const senderName = parts[1].replace(':', '').trim();
              if (senderName.toLowerCase() === leadName.toLowerCase()) {
                sender = 'LEAD';
              } else {
                sender = 'AGENT';
              }
            }
          }
        }
      }
    }

    // 3. Timestamp
    let rawTimestamp = extractedTime || '';
    if (!rawTimestamp) {
      const prePlainTextEl = el.hasAttribute('data-pre-plain-text') ? el : el.querySelector('[data-pre-plain-text]');
      if (prePlainTextEl) {
        const metaText = prePlainTextEl.getAttribute('data-pre-plain-text');
        if (metaText) {
          const match = metaText.match(/\[([^\]]+)\]/);
          if (match) {
            rawTimestamp = match[1];
          } else {
            rawTimestamp = metaText.replace('[', '').split(']')[0];
          }
        }
      }
    }
    
    if (!rawTimestamp) {
      const timeEl = el.querySelector('span[data-testid="msg-meta"], .copyable-text + div span, span[dir="auto"]');
      if (timeEl) {
        const txt = (timeEl.textContent || '').trim();
        if (txt && (txt.includes(':') || txt.toLowerCase().includes('am') || txt.toLowerCase().includes('pm'))) {
          rawTimestamp = txt;
        }
      }
    }
    
    if (!rawTimestamp) {
      rawTimestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    const normalizedTimestamp = this.normalizeTimestamp(rawTimestamp);

    return {
      id: `msg_${Math.random().toString(36).substr(2, 9)}`,
      sender,
      text,
      rawTimestamp,
      normalizedTimestamp
    };
  }

  // Message Extraction
  public static extractMessages(limit: number = 1000): ParsedMessage[] {
    const leadName = this.getActiveLeadName();
    const { nodes } = this.getActiveSelectorAndNodes();
    
    if (nodes.length === 0) return [];
    
    const recentNodes = nodes.slice(-limit);
    const parsed: ParsedMessage[] = [];
    
    for (const node of recentNodes) {
      const msg = this.parseNodeToMessage(node, leadName);
      if (msg) {
        parsed.push(msg);
      }
    }
    
    return parsed;
  }

  public static getDiagnostics(): Diagnostics {
    const leadName = this.getActiveLeadName();
    const { selector, nodes } = this.getActiveSelectorAndNodes();
    const msgs = this.extractMessages(10);
    
    const matchedSnippets = nodes.slice(0, 3).map(el => {
      const tag = el.tagName.toLowerCase();
      const className = el.className ? `.${el.className.split(' ').filter(Boolean).join('.')}` : '';
      const id = el.id ? `#${el.id}` : '';
      const text = el.textContent ? el.textContent.trim().slice(0, 40) : '';
      const hasPre = el.hasAttribute('data-pre-plain-text') || el.querySelector('[data-pre-plain-text]') ? ' [pre]' : '';
      return `<${tag}${id}${className}${hasPre}> text: "${text}"`;
    });

    const selectorTests = this.runSelectorDiagnostics();

    return {
      headerFound: !!leadName,
      messagesFound: msgs.length,
      selectorsHealthy: !!leadName && msgs.length > 0,
      currentSelectorUsed: selector,
      matchedCount: nodes.length,
      matchedSnippets,
      selectorTests
    };
  }
}
