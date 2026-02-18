const DEFAULTS = {
  urlPatterns: ["*://*.servicechannel.com/*"],
  elementSelector: "button[data-content]",
  fileExtensions: ["pdf", "png", "jpg", "jpeg", "xlsx", "docx", "zip", "csv"]
};

const BADGE_CLASSES = {
  pdf: "badge-pdf",
  png: "badge-png",
  jpg: "badge-jpg",
  jpeg: "badge-jpeg",
  xlsx: "badge-xlsx",
  docx: "badge-docx"
};

let discoveredFiles = [];

// --- Helpers ---

function wildcardToRegex(pattern) {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".");
  return new RegExp("^" + escaped + "$", "i");
}

function urlMatchesPatterns(url, patterns) {
  return patterns.some(function (p) {
    return wildcardToRegex(p).test(url);
  });
}

function getExtension(filename) {
  const parts = filename.split(".");
  return parts.length > 1 ? parts.pop().toLowerCase() : "";
}

function badgeClass(ext) {
  return BADGE_CLASSES[ext] || "badge-default";
}

function showStatus(msg, type) {
  const el = document.getElementById("status");
  el.textContent = msg;
  el.className = "status visible status-" + type;
}

function hideStatus() {
  document.getElementById("status").className = "status";
}

function updateSelectionUI() {
  const boxes = document.querySelectorAll("#fileList input[type='checkbox']");
  const checked = document.querySelectorAll("#fileList input[type='checkbox']:checked");
  document.getElementById("selectedCount").textContent =
    checked.length + " of " + boxes.length + " file" + (boxes.length !== 1 ? "s" : "") + " selected";
  document.getElementById("downloadBtn").disabled = checked.length === 0;
}

function renderFiles(files) {
  const container = document.getElementById("fileListContainer");
  const list = document.getElementById("fileList");
  list.innerHTML = "";

  files.forEach(function (file, i) {
    const ext = getExtension(file.filename);
    const item = document.createElement("label");
    item.className = "file-item";

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = true;
    cb.dataset.index = i;
    cb.addEventListener("change", updateSelectionUI);

    const name = document.createElement("span");
    name.className = "filename";
    name.textContent = file.filename;
    name.title = file.filename;

    const badge = document.createElement("span");
    badge.className = "badge " + badgeClass(ext);
    badge.textContent = ext || "file";

    item.appendChild(cb);
    item.appendChild(name);
    item.appendChild(badge);
    list.appendChild(item);
  });

  container.classList.add("visible");
  updateSelectionUI();
}

function globToRegex(pattern) {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".");
  return new RegExp(escaped, "i");
}

function applyExcludeFilter(pattern) {
  const regex = globToRegex(pattern.trim());
  let excluded = 0;
  document.querySelectorAll("#fileList input[type='checkbox']").forEach(function (cb) {
    const idx = parseInt(cb.dataset.index, 10);
    const filename = discoveredFiles[idx].filename || "";
    if (regex.test(filename)) {
      cb.checked = false;
      cb.closest(".file-item").classList.add("excluded");
      excluded++;
    }
  });
  const filterStatus = document.getElementById("filterStatus");
  filterStatus.textContent = excluded > 0
    ? excluded + " file" + (excluded !== 1 ? "s" : "") + " excluded by filter."
    : "No files matched the exclusion pattern.";
  filterStatus.className = "filter-status visible";
  document.getElementById("clearFilter").style.display = "";
  updateSelectionUI();
}

function clearExcludeFilter() {
  document.querySelectorAll("#fileList input[type='checkbox']").forEach(function (cb) {
    cb.checked = true;
    cb.closest(".file-item").classList.remove("excluded");
  });
  document.getElementById("excludePattern").value = "";
  document.getElementById("filterStatus").className = "filter-status";
  document.getElementById("clearFilter").style.display = "none";
  updateSelectionUI();
}

// --- Event handlers ---

document.addEventListener("DOMContentLoaded", function () {
  chrome.storage.sync.get(DEFAULTS, function (config) {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (!tabs[0]) {
        showStatus("Unable to access the current tab.", "error");
        return;
      }

      const tabUrl = tabs[0].url || "";
      if (!urlMatchesPatterns(tabUrl, config.urlPatterns)) {
        showStatus("Not a configured page. Open Settings to add URL patterns.", "info");
        document.getElementById("scanBtn").style.display = "none";
        return;
      }
    });
  });

  // Open options page
  document.getElementById("openOptions").addEventListener("click", function (e) {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });

  // Scan button
  document.getElementById("scanBtn").addEventListener("click", function () {
    var btn = this;
    btn.disabled = true;
    btn.textContent = "Scanning...";
    hideStatus();

    chrome.runtime.sendMessage({ type: "SCAN_TAB" }, function (response) {
      btn.disabled = false;
      btn.textContent = "Scan Page";

      if (chrome.runtime.lastError) {
        showStatus("Error: " + chrome.runtime.lastError.message, "error");
        return;
      }

      if (!response || response.error) {
        showStatus(response ? response.error : "No response from background.", "error");
        return;
      }

      document.getElementById("excludePattern").value = "";
      document.getElementById("filterStatus").className = "filter-status";
      document.getElementById("clearFilter").style.display = "none";
      discoveredFiles = response.files || [];
      if (discoveredFiles.length === 0) {
        showStatus("No downloadable files found on this page.", "info");
        return;
      }

      showStatus("Found " + discoveredFiles.length + " file" + (discoveredFiles.length !== 1 ? "s" : "") + ".", "success");
      renderFiles(discoveredFiles);
    });
  });

  // Exclude filter
  document.getElementById("applyFilter").addEventListener("click", function () {
    var pattern = document.getElementById("excludePattern").value.trim();
    if (pattern) applyExcludeFilter(pattern);
  });

  document.getElementById("excludePattern").addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      var pattern = this.value.trim();
      if (pattern) applyExcludeFilter(pattern);
    }
  });

  document.getElementById("clearFilter").addEventListener("click", clearExcludeFilter);

  // Select All
  document.getElementById("selectAll").addEventListener("click", function () {
    document.querySelectorAll("#fileList input[type='checkbox']").forEach(function (cb) {
      cb.checked = true;
    });
    updateSelectionUI();
  });

  // Deselect All
  document.getElementById("deselectAll").addEventListener("click", function () {
    document.querySelectorAll("#fileList input[type='checkbox']").forEach(function (cb) {
      cb.checked = false;
    });
    updateSelectionUI();
  });

  // Download Selected
  document.getElementById("downloadBtn").addEventListener("click", function () {
    var btn = this;
    var selected = [];
    document.querySelectorAll("#fileList input[type='checkbox']:checked").forEach(function (cb) {
      var idx = parseInt(cb.dataset.index, 10);
      selected.push(discoveredFiles[idx]);
    });

    if (selected.length === 0) return;

    btn.disabled = true;
    btn.textContent = "Downloading...";

    chrome.runtime.sendMessage({ type: "DOWNLOAD_FILES", files: selected }, function (response) {
      btn.textContent = "Download Selected";
      updateSelectionUI();

      if (chrome.runtime.lastError) {
        showStatus("Download error: " + chrome.runtime.lastError.message, "error");
        return;
      }

      if (!response || response.error) {
        showStatus(response ? response.error : "Download failed.", "error");
        return;
      }

      showStatus("Started downloading " + selected.length + " file" + (selected.length !== 1 ? "s" : "") + ".", "success");
    });
  });
});
