// Track if the extension is enabled
let isEnabled = true
const lastPauseTime = 0
let debounceTimer = null

// Initialize by checking storage for enabled state
if (typeof chrome !== "undefined" && chrome.storage) {
  chrome.storage.sync.get(["timestampBookmarkerEnabled"], (result) => {
    isEnabled = result.timestampBookmarkerEnabled !== false // Default to true if not set
    console.log("Extension enabled state:", isEnabled)
  })
} else {
  console.warn("Chrome storage API not available.")
}

// Listen for messages from popup or background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Content script received message:", message)

  if (message.action === "getState") {
    sendResponse({ isEnabled })
  } else if (message.action === "setState") {
    isEnabled = message.isEnabled
    console.log("Extension state updated to:", isEnabled)
    chrome.storage.sync.set({ timestampBookmarkerEnabled: isEnabled })

    // Show notification about state change
    showNotification(isEnabled ? "YouTube Timestamp Bookmarker enabled" : "YouTube Timestamp Bookmarker disabled")

    sendResponse({ success: true })
  } else if (message.action === "showNotification") {
    showNotification(message.message)
  }
  return true
})

// Function to get current video time in seconds
function getCurrentTime() {
  const video = document.querySelector("video")
  return video ? Math.floor(video.currentTime) : 0
}

// Function to get video ID from URL
function getVideoId() {
  const urlParams = new URLSearchParams(window.location.search)
  return urlParams.get("v")
}

// Function to update bookmark with current timestamp
function updateBookmark() {
  if (!isEnabled) {
    console.log("Extension is disabled, not updating bookmark")
    return
  }

  const currentTime = getCurrentTime()
  const videoId = getVideoId()

  // Avoid updates if no video ID or same timestamp
  if (!videoId) return

  // Send message to background script to update bookmark
  console.log("Sending update bookmark message with timestamp:", currentTime)
  chrome.runtime.sendMessage({
    action: "updateBookmark",
    videoId: videoId,
    timestamp: currentTime,
    title: document.title,
    url: window.location.href,
  })
}

// Initialize video event listeners
function initializeVideoListeners() {
  const video = document.querySelector("video")
  if (!video) {
    // If video element isn't available yet, try again in 1 second
    setTimeout(initializeVideoListeners, 1000)
    return
  }

  console.log("Video listeners initialized")

  // Listen for pause events
  video.addEventListener("pause", () => {
    console.log("Video paused at:", getCurrentTime())
    // Debounce the pause event to avoid multiple rapid updates
    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(updateBookmark, 500)
  })

  // Also update when user seeks to a different position
  video.addEventListener("seeked", () => {
    if (video.paused) {
      console.log("Video seeked to:", getCurrentTime())
      clearTimeout(debounceTimer)
      debounceTimer = setTimeout(updateBookmark, 500)
    }
  })
}

// Create and show a notification
function showNotification(message) {
  // Create notification element if it doesn't exist
  let notification = document.getElementById("yt-timestamp-notification")
  if (!notification) {
    notification = document.createElement("div")
    notification.id = "yt-timestamp-notification"
    notification.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background-color: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 10px 15px;
      border-radius: 4px;
      z-index: 9999;
      font-size: 14px;
      transition: opacity 0.3s ease-in-out;
      opacity: 0;
    `
    document.body.appendChild(notification)
  }

  // Set message and show notification
  notification.textContent = message
  notification.style.opacity = "1"

  // Hide after 3 seconds
  setTimeout(() => {
    notification.style.opacity = "0"
  }, 3000)
}

// Initialize when page loads
console.log("YouTube Timestamp Bookmarker content script loaded")
initializeVideoListeners()

// Re-initialize when navigating between YouTube videos (SPA behavior)
let lastUrl = location.href
new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href
    console.log("URL changed, reinitializing listeners")
    initializeVideoListeners()
  }
}).observe(document, { subtree: true, childList: true })
