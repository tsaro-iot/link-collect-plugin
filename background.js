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
