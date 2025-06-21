document.addEventListener("DOMContentLoaded", () => {
  // Elements
  const enableToggle = document.getElementById("enableToggle")
  const tabSettings = document.getElementById("tab-settings")
  const tabBookmarks = document.getElementById("tab-bookmarks")
  const settingsContent = document.getElementById("settings-content")
  const bookmarksContent = document.getElementById("bookmarks-content")
  const bookmarksLoading = document.getElementById("bookmarks-loading")
  const noBookmarks = document.getElementById("no-bookmarks")
  const bookmarkList = document.getElementById("bookmark-list")
  const refreshBookmarksBtn = document.getElementById("refresh-bookmarks")
  const deleteAllBookmarksBtn = document.getElementById("delete-all-bookmarks")

  // Tab switching
  tabSettings.addEventListener("click", () => {
    tabSettings.classList.add("tab-active")
    tabBookmarks.classList.remove("tab-active")
    settingsContent.classList.remove("hidden")
    bookmarksContent.classList.add("hidden")
  })

  tabBookmarks.addEventListener("click", () => {
    tabBookmarks.classList.add("tab-active")
    tabSettings.classList.remove("tab-active")
    bookmarksContent.classList.remove("hidden")
    settingsContent.classList.add("hidden")
    loadBookmarks()
  })

  // Toggle functionality
  console.log("Popup loaded, getting current state")

  // Get current state from storage
  chrome.storage.sync.get(["timestampBookmarkerEnabled"], (result) => {
    const isEnabled = result.timestampBookmarkerEnabled !== false
    console.log("Current state from storage:", isEnabled)

    // Set the toggle's checked state to match the stored state
    enableToggle.checked = isEnabled

    // Also update the toggle's appearance manually to ensure it reflects the state
    updateToggleAppearance(isEnabled)
  })

  // Update state when toggle is clicked
  enableToggle.addEventListener("click", () => {
    const isEnabled = enableToggle.checked
    console.log("Toggle clicked, new state:", isEnabled)

    // Update toggle appearance
    updateToggleAppearance(isEnabled)

    // Save to storage
    chrome.storage.sync.set({ timestampBookmarkerEnabled: isEnabled }, () => {
      console.log("Saved state to storage:", isEnabled)
    })

    // Send message to active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].url.includes("youtube.com")) {
        console.log("Sending state update to content script")
        chrome.tabs.sendMessage(
          tabs[0].id,
          {
            action: "setState",
            isEnabled: isEnabled,
          },
          (response) => {
            console.log("Response from content script:", response)
          },
        )
      }
    })
  })

  // Bookmark management
  refreshBookmarksBtn.addEventListener("click", loadBookmarks)

  deleteAllBookmarksBtn.addEventListener("click", () => {
    if (confirm("Are you sure you want to delete all bookmarks created by this extension?")) {
      deleteAllBookmarks()
    }
  })

  // Load bookmarks initially
  if (!bookmarksContent.classList.contains("hidden")) {
    loadBookmarks()
  }

  // Helper function to update toggle appearance
  function updateToggleAppearance(isEnabled) {
    const toggleSlider = document.querySelector(".toggle-slider")
    if (toggleSlider) {
      if (isEnabled) {
        toggleSlider.classList.add("bg-red-600")
        toggleSlider.classList.remove("bg-gray-200")
      } else {
        toggleSlider.classList.remove("bg-red-600")
        toggleSlider.classList.add("bg-gray-200")
      }
    }
  }

  // Function to load bookmarks
  function loadBookmarks() {
    bookmarksLoading.classList.remove("hidden")
    bookmarkList.classList.add("hidden")
    noBookmarks.classList.add("hidden")
    bookmarkList.innerHTML = ""

    chrome.runtime.sendMessage({ action: "getBookmarks" }, (response) => {
      bookmarksLoading.classList.add("hidden")

      if (response && response.bookmarks && response.bookmarks.length > 0) {
        bookmarkList.classList.remove("hidden")

        response.bookmarks.forEach((bookmark) => {
          const bookmarkItem = createBookmarkItem(bookmark)
          bookmarkList.appendChild(bookmarkItem)
        })
      } else {
        noBookmarks.classList.remove("hidden")
      }
    })
  }

  // Function to create a bookmark item element
  function createBookmarkItem(bookmark) {
    const item = document.createElement("div")
    item.className = "bookmark-item p-2 border-b border-gray-100 last:border-b-0"

    // Extract video title and timestamp from bookmark
    const videoTitle = bookmark.title
    let timestamp = ""

    // Try to extract timestamp from URL
    if (bookmark.url) {
      const url = new URL(bookmark.url)
      const tParam = url.searchParams.get("t")
      if (tParam) {
        const seconds = Number.parseInt(tParam.replace("s", ""))
        timestamp = formatTime(seconds)
      }
    }

    item.innerHTML = `
      <div class="flex justify-between items-center">
        <div class="flex-1 truncate">
          <a href="${bookmark.url}" target="_blank" class="text-sm font-medium hover:text-red-600 truncate block" title="${videoTitle}">
            ${videoTitle}
          </a>
          ${timestamp ? `<span class="text-xs text-gray-500">at ${timestamp}</span>` : ""}
        </div>
        <button class="delete-bookmark ml-2 text-gray-400 hover:text-red-500" data-id="${bookmark.id}">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 6h18"></path>
            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
          </svg>
        </button>
      </div>
    `

    // Add delete event listener
    const deleteBtn = item.querySelector(".delete-bookmark")
    deleteBtn.addEventListener("click", (e) => {
      e.preventDefault()
      const bookmarkId = deleteBtn.getAttribute("data-id")
      deleteBookmark(bookmarkId, item)
    })

    return item
  }

  // Function to delete a bookmark
  function deleteBookmark(bookmarkId, element) {
    chrome.runtime.sendMessage({ action: "deleteBookmark", bookmarkId }, (response) => {
      if (response && response.success) {
        // Remove from UI
        element.remove()

        // Check if there are any bookmarks left
        if (bookmarkList.children.length === 0) {
          bookmarkList.classList.add("hidden")
          noBookmarks.classList.remove("hidden")
        }
      }
    })
  }

  // Function to delete all bookmarks
  function deleteAllBookmarks() {
    chrome.runtime.sendMessage({ action: "deleteAllBookmarks" }, (response) => {
      if (response && response.success) {
        // Clear UI
        bookmarkList.innerHTML = ""
        bookmarkList.classList.add("hidden")
        noBookmarks.classList.remove("hidden")
      }
    })
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
})
