// --- Icon colors & defaults ---

const ICON_GRAY = "#9ca3af";
const ICON_BLUE = "#2563eb";
const URL_PATTERN_DEFAULTS = { urlPatterns: ["https://www.servicechannel.com/sc/wo/Workorders/list*"] };

// --- URL matching (duplicated from popup.js — service worker can't import it) ---

function wildcardToRegex(pattern) {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".");
  return new RegExp("^" + escaped + "$", "i");
}

function urlMatchesPatterns(url, patterns) {
  return patterns.some((p) => wildcardToRegex(p).test(url));
}

// --- Icon generation ---

function createIconImageData(color, size) {
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext("2d");

  // Rounded rectangle background
  const r = size * 0.2;
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(size - r, 0);
  ctx.quadraticCurveTo(size, 0, size, r);
  ctx.lineTo(size, size - r);
  ctx.quadraticCurveTo(size, size, size - r, size);
  ctx.lineTo(r, size);
  ctx.quadraticCurveTo(0, size, 0, size - r);
  ctx.lineTo(0, r);
  ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();

  // White "L" letter
  ctx.fillStyle = "#ffffff";
  ctx.font = `bold ${size * 0.6}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("L", size / 2, size / 2);

  return ctx.getImageData(0, 0, size, size);
}

function getIconImageDataMap(color) {
  return {
    16: createIconImageData(color, 16),
    24: createIconImageData(color, 24),
    32: createIconImageData(color, 32),
    48: createIconImageData(color, 48),
  };
}

// --- Icon update logic ---

async function updateIconForTab(tabId, url) {
  try {
    const config = await chrome.storage.sync.get(URL_PATTERN_DEFAULTS);
    const color = urlMatchesPatterns(url, config.urlPatterns) ? ICON_BLUE : ICON_GRAY;
    await chrome.action.setIcon({ tabId, imageData: getIconImageDataMap(color) });
  } catch {
    // Tab may have been closed or is a chrome:// URL — ignore
  }
}

async function updateAllTabs() {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (tab.id && tab.url) {
      updateIconForTab(tab.id, tab.url);
    }
  }
}

// --- Message handler ---

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "SCAN_TAB") {
    handleScanTab(sendResponse);
    return true;
  }

  if (message.type === "DOWNLOAD_FILES") {
    handleDownloadFiles(message.files, sendResponse);
    return true;
  }
});

async function handleScanTab(sendResponse) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab) {
      sendResponse({ success: false, error: "No active tab found." });
      return;
    }

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"],
    });

    const response = await chrome.tabs.sendMessage(tab.id, { type: "SCAN" });
    sendResponse({ success: true, files: response.files });
  } catch (err) {
    sendResponse({ success: false, error: err.message });
  }
}

async function handleDownloadFiles(files, sendResponse) {
  const results = [];

  for (const file of files) {
    try {
      const downloadId = await chrome.downloads.download({
        url: file.href,
        filename: file.filename || undefined,
      });
      results.push({ href: file.href, downloadId, success: true });
    } catch (err) {
      results.push({ href: file.href, success: false, error: err.message });
    }
  }

  sendResponse({ success: true, results });
}

// --- Icon event listeners ---

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url || changeInfo.status === "complete") {
    const url = changeInfo.url || tab.url;
    if (url) updateIconForTab(tabId, url);
  }
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab.url) updateIconForTab(tab.id, tab.url);
  } catch {
    // Tab may not exist anymore
  }
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes.urlPatterns) {
    updateAllTabs();
  }
});

chrome.runtime.onInstalled.addListener(() => updateAllTabs());
chrome.runtime.onStartup.addListener(() => updateAllTabs());
