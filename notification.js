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

// Listen for notification messages from background script
if (typeof chrome !== "undefined" && chrome.runtime) {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "showNotification") {
      showNotification(message.message)
    }
    return true
  })
}
