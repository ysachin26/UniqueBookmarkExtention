// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Background script received message:", message)

  if (message.action === "updateBookmark") {
    updateYouTubeBookmark(message.videoId, message.timestamp, message.title, sender.tab.id, message.url)
  } else if (message.action === "getBookmarks") {
    getExtensionBookmarks().then((bookmarks) => {
      sendResponse({ bookmarks })
    })
    return true // Required for async sendResponse
  } else if (message.action === "deleteBookmark") {
    deleteBookmark(message.bookmarkId).then((result) => {
      sendResponse({ success: result })
    })
    return true // Required for async sendResponse
  } else if (message.action === "deleteAllBookmarks") {
    deleteAllExtensionBookmarks().then((result) => {
      sendResponse({ success: result, count: result.length })
    })
    return true // Required for async sendResponse
  }
  return true
})

// Function to update or create a YouTube bookmark with timestamp
async function updateYouTubeBookmark(videoId, timestamp, title, tabId, currentUrl) {
  // Create the URL with timestamp
  const url = `https://www.youtube.com/watch?v=${videoId}&t=${timestamp}s`

  console.log("Updating bookmark for video:", videoId, "with timestamp:", timestamp)

  try {
    // Search for existing bookmarks for this video
    const bookmarks = await chrome.bookmarks.search({
      query: `youtube.com/watch?v=${videoId}`,
    })

    console.log("Found bookmarks:", bookmarks)

    // Filter for actual YouTube bookmarks for this video
    const matchingBookmarks = bookmarks.filter(
      (bookmark) => bookmark.url && bookmark.url.includes(`watch?v=${videoId}`),
    )

    if (matchingBookmarks.length > 0) {
      // Update the first matching bookmark
      console.log("Updating existing bookmark:", matchingBookmarks[0])
      await chrome.bookmarks.update(matchingBookmarks[0].id, {
        url: url,
      })

      // Mark this as an extension-created bookmark if not already marked
      await markAsExtensionBookmark(matchingBookmarks[0].id)

      // Show notification
      chrome.tabs.sendMessage(tabId, {
        action: "showNotification",
        message: `Bookmark updated with timestamp: ${formatTime(timestamp)}`,
      })
    } else {
      // No existing bookmark found, create a new one
      // First get the Bookmarks bar folder
      const bookmarkTree = await chrome.bookmarks.getTree()
      const bookmarksBar = bookmarkTree[0].children.find((node) => node.id === "1")

      if (bookmarksBar) {
        // Create new bookmark in the Bookmarks bar
        console.log("Creating new bookmark")
        const newBookmark = await chrome.bookmarks.create({
          parentId: bookmarksBar.id,
          title: title || `YouTube: ${videoId} at ${formatTime(timestamp)}`,
          url: url,
        })

        // Mark this as an extension-created bookmark
        await markAsExtensionBookmark(newBookmark.id)

        // Show notification
        chrome.tabs.sendMessage(tabId, {
          action: "showNotification",
          message: `New bookmark created at: ${formatTime(timestamp)}`,
        })
      }
    }
  } catch (error) {
    console.error("Error updating bookmark:", error)
  }
}

// Mark a bookmark as created by this extension
async function markAsExtensionBookmark(bookmarkId) {
  try {
    // Get current list of extension bookmarks
    const { extensionBookmarkIds = [] } = await chrome.storage.local.get("extensionBookmarkIds")

    // Add this bookmark ID if not already in the list
    if (!extensionBookmarkIds.includes(bookmarkId)) {
      extensionBookmarkIds.push(bookmarkId)
      await chrome.storage.local.set({ extensionBookmarkIds })
    }
  } catch (error) {
    console.error("Error marking bookmark:", error)
  }
}

// Get all bookmarks created by this extension
async function getExtensionBookmarks() {
  try {
    // Get list of extension bookmark IDs
    const { extensionBookmarkIds = [] } = await chrome.storage.local.get("extensionBookmarkIds")

    // Get details for each bookmark
    const bookmarks = []
    for (const id of extensionBookmarkIds) {
      try {
        const bookmark = await chrome.bookmarks.get(id)
        if (bookmark && bookmark.length > 0) {
          bookmarks.push(bookmark[0])
        }
      } catch (e) {
        // Bookmark might have been deleted manually, ignore
      }
    }

    return bookmarks
  } catch (error) {
    console.error("Error getting extension bookmarks:", error)
    return []
  }
}

// Delete a specific bookmark
async function deleteBookmark(bookmarkId) {
  try {
    // Remove from Chrome bookmarks
    await chrome.bookmarks.remove(bookmarkId)

    // Remove from our extension bookmarks list
    const { extensionBookmarkIds = [] } = await chrome.storage.local.get("extensionBookmarkIds")
    const updatedIds = extensionBookmarkIds.filter((id) => id !== bookmarkId)
    await chrome.storage.local.set({ extensionBookmarkIds: updatedIds })

    return true
  } catch (error) {
    console.error("Error deleting bookmark:", error)
    return false
  }
}

// Delete all bookmarks created by this extension
async function deleteAllExtensionBookmarks() {
  try {
    // Get list of extension bookmark IDs
    const { extensionBookmarkIds = [] } = await chrome.storage.local.get("extensionBookmarkIds")

    // Delete each bookmark
    const deletedIds = []
    for (const id of extensionBookmarkIds) {
      try {
        await chrome.bookmarks.remove(id)
        deletedIds.push(id)
      } catch (e) {
        // Bookmark might have been deleted manually, ignore
      }
    }

    // Clear our extension bookmarks list
    await chrome.storage.local.set({ extensionBookmarkIds: [] })

    return deletedIds
  } catch (error) {
    console.error("Error deleting all bookmarks:", error)
    return []
  }
}

// Format seconds to MM:SS or HH:MM:SS
function formatTime(seconds) {
  if (isNaN(seconds)) return "00:00"

  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  if (hours > 0) {
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  } else {
    return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }
}

// Initialize extension
console.log("YouTube Timestamp Bookmarker background script loaded")
