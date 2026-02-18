(() => {
  if (window.__linkFetcherInjected) return;
  window.__linkFetcherInjected = true;

  const DEFAULT_CONFIG = {
    rowSelector: "div.WoRow",
    trackingNumberSelector: "a.WoRow_link--primary",
    elementSelector: "button.wo-attachments[data-content]",
    fileExtensions: ["pdf", "png", "jpg", "jpeg", "xlsx", "docx", "zip", "csv"],
  };

  function decodeHtmlEntities(raw) {
    const textarea = document.createElement("textarea");
    textarea.innerHTML = raw;
    return textarea.value;
  }

  function extractFilenameFromUrl(url) {
    try {
      const pathname = new URL(url).pathname;
      const segments = pathname.split("/");
      return decodeURIComponent(segments[segments.length - 1]) || null;
    } catch {
      return null;
    }
  }

  function matchesExtension(href, title, extensions) {
    const candidates = [href.toLowerCase(), (title || "").toLowerCase()];
    return extensions.some((ext) =>
      candidates.some((c) => c.includes("." + ext))
    );
  }

  function extractFilesFromElement(el, trackingNumber, config, seen) {
    const raw = el.getAttribute("data-content");
    if (!raw) return [];

    const decoded = decodeHtmlEntities(raw);
    const doc = new DOMParser().parseFromString(decoded, "text/html");
    const anchors = doc.querySelectorAll("a[href]");
    const files = [];

    for (const anchor of anchors) {
      const href = anchor.getAttribute("href");
      if (!href || seen.has(href)) continue;

      const title = anchor.getAttribute("title") || anchor.textContent.trim();
      if (!matchesExtension(href, title, config.fileExtensions)) continue;

      seen.add(href);

      const baseName = title || extractFilenameFromUrl(href);
      const filename = trackingNumber ? trackingNumber + "_" + baseName : baseName;

      files.push({ href, title, filename, trackingNumber });
    }

    return files;
  }

  function extractFiles(config) {
    const seen = new Set();
    const files = [];

    // Row-aware mode: group attachments by their containing row and prefix with tracking number
    if (config.rowSelector && config.trackingNumberSelector) {
      const rows = document.querySelectorAll(config.rowSelector);
      for (const row of rows) {
        const trackingEl = row.querySelector(config.trackingNumberSelector);
        const trackingNumber = trackingEl ? trackingEl.textContent.trim() : null;
        const attachmentEls = row.querySelectorAll(config.elementSelector);
        for (const el of attachmentEls) {
          files.push(...extractFilesFromElement(el, trackingNumber, config, seen));
        }
      }
      if (files.length > 0) return files;
    }

    // Fallback: scan the whole page without tracking number prefix
    for (const el of document.querySelectorAll(config.elementSelector)) {
      files.push(...extractFilesFromElement(el, null, config, seen));
    }

    return files;
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type !== "SCAN") return;

    chrome.storage.sync.get(DEFAULT_CONFIG, (config) => {
      const files = extractFiles(config);
      sendResponse({ files });
    });

    return true;
  });
})();
