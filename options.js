var DEFAULTS = {
  urlPatterns: ["https://www.servicechannel.com/sc/wo/Workorders/list*"],
  rowSelector: "div.WoRow",
  trackingNumberSelector: "a.WoRow_link--primary",
  elementSelector: "button.wo-attachments[data-content]",
  fileExtensions: ["pdf", "png", "jpg", "jpeg", "xlsx", "docx", "zip", "csv"]
};

function showStatus(msg, type) {
  var el = document.getElementById("status");
  el.textContent = msg;
  el.className = "status visible status-" + type;
  if (type === "success") {
    setTimeout(function () {
      el.className = "status";
    }, 3000);
  }
}

function populateForm(config) {
  document.getElementById("urlPatterns").value = config.urlPatterns.join("\n");
  document.getElementById("rowSelector").value = config.rowSelector;
  document.getElementById("trackingNumberSelector").value = config.trackingNumberSelector;
  document.getElementById("elementSelector").value = config.elementSelector;
  document.getElementById("fileExtensions").value = config.fileExtensions.join(", ");
}

function parseForm() {
  var patternsRaw = document.getElementById("urlPatterns").value.trim();
  var urlPatterns = patternsRaw
    .split("\n")
    .map(function (line) { return line.trim(); })
    .filter(function (line) { return line.length > 0; });

  var rowSel = document.getElementById("rowSelector").value.trim();
  var trackingSel = document.getElementById("trackingNumberSelector").value.trim();
  var selector = document.getElementById("elementSelector").value.trim();

  var extRaw = document.getElementById("fileExtensions").value.trim();
  var fileExtensions = extRaw
    .split(",")
    .map(function (e) { return e.trim().toLowerCase().replace(/^\./, ""); })
    .filter(function (e) { return e.length > 0; });

  return { urlPatterns: urlPatterns, rowSelector: rowSel, trackingNumberSelector: trackingSel, elementSelector: selector, fileExtensions: fileExtensions };
}

function validate(config) {
  if (config.urlPatterns.length === 0) {
    return "At least one URL pattern is required.";
  }
  if (!config.elementSelector) {
    return "Element selector cannot be empty.";
  }
  if ((config.rowSelector && !config.trackingNumberSelector) ||
      (!config.rowSelector && config.trackingNumberSelector)) {
    return "Both Row Selector and Tracking Number Selector must be set together, or both left empty.";
  }
  if (config.fileExtensions.length === 0) {
    return "At least one file extension is required.";
  }
  return null;
}

document.addEventListener("DOMContentLoaded", function () {
  chrome.storage.sync.get(DEFAULTS, function (config) {
    populateForm(config);
  });

  document.getElementById("saveBtn").addEventListener("click", function () {
    var config = parseForm();
    var error = validate(config);
    if (error) {
      showStatus(error, "error");
      return;
    }

    chrome.storage.sync.set(config, function () {
      if (chrome.runtime.lastError) {
        showStatus("Failed to save: " + chrome.runtime.lastError.message, "error");
        return;
      }
      showStatus("Settings saved.", "success");
    });
  });

  document.getElementById("resetBtn").addEventListener("click", function () {
    populateForm(DEFAULTS);
    chrome.storage.sync.set(DEFAULTS, function () {
      if (chrome.runtime.lastError) {
        showStatus("Failed to reset: " + chrome.runtime.lastError.message, "error");
        return;
      }
      showStatus("Settings reset to defaults.", "success");
    });
  });
});
