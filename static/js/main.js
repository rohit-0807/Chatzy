// Global variables
let isLoading = false;
let messageHistory = [];

// Initialize app when DOM is loaded
document.addEventListener("DOMContentLoaded", function () {
  initializeApp();
});

function initializeApp() {
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("overlay");
  const menuToggle = document.getElementById("menuToggle");
  const historyToggleBtn = document.getElementById("historyToggleBtn");
  const mainContent = document.getElementById("mainContent");
  const chatInput = document.getElementById("chatInput");
  const chatForm = document.getElementById("chatForm");
  const sendBtn = document.getElementById("sendBtn");
  const chatContainer = document.getElementById("chatContainer");
  const welcomeSection = document.getElementById("welcomeSection");
  const messagesContainer = document.getElementById("messagesContainer");

  // Load existing chat history
  loadServerHistory();

  // Check for server output and display it
  const serverOutput = document.getElementById("server-output");
  if (serverOutput && serverOutput.textContent.trim()) {
    removeLoadingMessage();
    addMessageToUI("bot", serverOutput.textContent.trim());
    resetFormState();
    loadServerHistory();
  }

  // Event listeners
  if (menuToggle) menuToggle.addEventListener("click", toggleSidebar);
  if (historyToggleBtn)
    historyToggleBtn.addEventListener("click", toggleSidebar);
  const closeSidebarBtn = document.getElementById("closeSidebarBtn");
  if (closeSidebarBtn) closeSidebarBtn.addEventListener("click", closeSidebar);
  overlay.addEventListener("click", closeSidebar);
  // Close sidebar when a history item is clicked on mobile screens
  sidebar.addEventListener("click", function (e) {
    if (
      window.innerWidth <= 768 &&
      e.target.classList.contains("history-item")
    ) {
      closeSidebar();
    }
  });

  chatInput.addEventListener("input", handleInputResize);
  chatInput.addEventListener("keydown", handleKeyDown);
  chatForm.addEventListener("submit", handleFormSubmit);

  // Window resize handler
  window.addEventListener("resize", handleWindowResize);

  // Keyboard shortcuts
  document.addEventListener("keydown", handleGlobalKeyDown);

  // Auto-focus input on load
  chatInput.focus();
}

// Sidebar functionality
function toggleSidebar() {
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("overlay");
  const mainContent = document.getElementById("mainContent");
  const inputContainer = document.querySelector(".input-section-container");

  sidebar.classList.toggle("open");
  overlay.classList.toggle("active");
  mainContent.classList.toggle("sidebar-open");

  // Toggle blur and dim effect on input when sidebar opens
  if (sidebar.classList.contains("open")) {
    inputContainer.classList.add("blur-input");
  } else {
    inputContainer.classList.remove("blur-input");
  }
}

function closeSidebar() {
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("overlay");
  const mainContent = document.getElementById("mainContent");
  const inputContainer = document.querySelector(".input-section-container");

  sidebar.classList.remove("open");
  overlay.classList.remove("active");
  mainContent.classList.remove("sidebar-open");
  inputContainer.classList.remove("blur-input");
}

// Input handling
function handleInputResize() {
  const chatInput = document.getElementById("chatInput");
  chatInput.style.height = "auto";
  chatInput.style.height = Math.min(chatInput.scrollHeight, 200) + "px";
}

function handleKeyDown(e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    if (e.target.value.trim() && !isLoading) {
      document.getElementById("chatForm").dispatchEvent(new Event("submit"));
    }
  }
}

function handleGlobalKeyDown(e) {
  // Escape to close sidebar
  if (e.key === "Escape") {
    closeSidebar();
  }

  // Ctrl/Cmd + K for new chat
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
    startNewChat();
  }

  // Ctrl/Cmd + / to toggle sidebar
  if ((e.ctrlKey || e.metaKey) && e.key === "/") {
    e.preventDefault();
    toggleSidebar();
  }
}

function handleWindowResize() {
  if (window.innerWidth > 768) {
    // Desktop: remove overlay if active
    document.getElementById("overlay").classList.remove("active");
  }
}

// Form submission
function handleFormSubmit(e) {
  e.preventDefault();
  const chatInput = document.getElementById("chatInput");
  const userMessage = chatInput.value.trim();

  if (!userMessage || isLoading) {
    return;
  }

  // Add user message to UI immediately
  addMessageToUI("user", userMessage);

  // Show loading indicator
  showLoadingMessage();

  // Update UI state
  isLoading = true;
  const sendBtn = document.getElementById("sendBtn");
  sendBtn.innerHTML = '<i class="fas fa-spinner spin"></i>';
  sendBtn.disabled = true;
  chatInput.value = "";
  chatInput.style.height = "auto";

  // Hide welcome section on first message
  if (document.getElementById("welcomeSection").style.display !== "none") {
    document.getElementById("welcomeSection").style.display = "none";
    document.getElementById("chatContainer").classList.add("has-messages");
  }

  // Send message to backend via fetch
  fetch("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message: userMessage }),
  })
    .then((response) => response.json())
    .then((data) => {
      removeLoadingMessage();
      if (data.status === "success") {
        addMessageToUI("bot", data.response);
        // refresh sidebar history
        loadServerHistory();
      } else {
        addMessageToUI("bot", data.response || "Error processing the message");
      }
    })
    .catch((error) => {
      console.error("Error:", error);
      removeLoadingMessage();
      addMessageToUI("bot", "Error communicating with server");
    })
    .finally(() => {
      resetFormState();
    });
}

// Message handling
function addMessageToUI(type, content) {
  const messagesContainer = document.getElementById("messagesContainer");
  const messageEl = document.createElement("div");
  messageEl.className = "message";

  const now = new Date();
  const timeString = now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  messageEl.innerHTML = `
        <div class="message-header">
            <div class="message-avatar ${
              type === "user" ? "user-avatar" : "bot-avatar"
            }">
                ${type === "user" ? "U" : "CZY"}
            </div>
            <span class="message-author">${
              type === "user" ? "You" : "Chatzy"
            }</span>
            <span class="message-time">${timeString}</span>
        </div>
        <div class="message-content">
            <div class="message-actions">
                <button class="action-icon" onclick="copyMessage(this)" title="Copy message">
                    <i class="fas fa-copy"></i>
                </button>
            </div>
            <div class="message-text">${escapeHtml(content)}</div>
        </div>
    `;

  messagesContainer.appendChild(messageEl);
  messageEl.scrollIntoView({ behavior: "smooth", block: "end" });

  // Add to local history
  messageHistory.push({ type, content, time: timeString });

  // Update breadcrumb with first user message
  if (type === "user" && messageHistory.length === 1) {
    const preview =
      content.length > 50 ? content.substring(0, 50) + "..." : content;
    document.getElementById("breadcrumbText").textContent = preview;
  }
}

function showLoadingMessage() {
  const messagesContainer = document.getElementById("messagesContainer");
  const loadingEl = document.createElement("div");
  loadingEl.className = "message";
  loadingEl.id = "loading-message";

  loadingEl.innerHTML = `
        <div class="message-header">
            <div class="message-avatar bot-avatar">TB</div>
            <span class="message-author">Chatzy</span>
        </div>
        <div class="message-content">
            <div class="loading-indicator">
                <div class="loading-dots">
                    <div class="loading-dot"></div>
                    <div class="loading-dot"></div>
                    <div class="loading-dot"></div>
                </div>
                <span>Thinking...</span>
            </div>
        </div>
    `;

  messagesContainer.appendChild(loadingEl);
  loadingEl.scrollIntoView({ behavior: "smooth", block: "end" });
}

function removeLoadingMessage() {
  const loadingMsg = document.getElementById("loading-message");
  if (loadingMsg) {
    loadingMsg.remove();
  }
}

function resetFormState() {
  isLoading = false;
  const sendBtn = document.getElementById("sendBtn");
  sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
  sendBtn.disabled = false;
}

// History management
async function loadServerHistory() {
  try {
    const response = await fetch("/api/history");
    if (!response.ok) {
      throw new Error("Failed to fetch history");
    }
    const history = await response.json();
    displaySidebarHistory(history);
  } catch (error) {
    console.error("Error loading history:", error);
    showNotification("Failed to load chat history", "error");
  }
}

function displaySidebarHistory(history) {
  const historyList = document.getElementById("historyList");

  if (!history || history.length === 0) {
    historyList.innerHTML = `
            <div style="padding: 2rem 1rem; text-align: center; color: var(--text-muted);">
                <i class="fas fa-comments" style="display: block; margin-bottom: 1rem; font-size: 2rem; opacity: 0.3;"></i>
                <p style="font-size: 0.9rem;">No conversations yet</p>
                <p style="font-size: 0.8rem; margin-top: 0.5rem;">Start a new chat to begin</p>
            </div>
        `;
    return;
  }

  historyList.innerHTML = "";

  // Display recent conversations (newest first)
  const recentHistory = history.slice().reverse().slice(0, 20);

  recentHistory.forEach((item, index) => {
    const originalIndex = history.length - 1 - index;
    const historyItem = document.createElement("div");
    historyItem.className = "history-item";
    historyItem.onclick = () => loadConversation(item);

    const preview =
      item.user_input.length > 60
        ? item.user_input.substring(0, 60) + "..."
        : item.user_input;

    // Format timestamp
    const timestamp = formatTimestamp(item.timestamp);

    historyItem.innerHTML = `
            <div class="history-preview">${escapeHtml(preview)}</div>
            <div class="history-time">${timestamp}</div>
            <button class="delete-btn" onclick="event.stopPropagation(); deleteConversation(${originalIndex})" title="Delete conversation">
                <i class="fas fa-trash"></i>
            </button>
        `;

    historyList.appendChild(historyItem);
  });
}

function formatTimestamp(timestamp) {
  try {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString();
  } catch (error) {
    return timestamp;
  }
}

function loadConversation(conversation) {
  // Clear current messages
  const messagesContainer = document.getElementById("messagesContainer");
  messagesContainer.innerHTML = "";
  messageHistory = [];

  // Hide welcome section
  const welcomeSection = document.getElementById("welcomeSection");
  welcomeSection.style.display = "none";
  document.getElementById("chatContainer").classList.add("has-messages");

  // Add conversation messages
  addMessageToUI("user", conversation.user_input);
  addMessageToUI("bot", conversation.bot_response);

  // Close sidebar on mobile
  if (window.innerWidth <= 768) {
    closeSidebar();
  }

  // Focus input
  document.getElementById("chatInput").focus();
}

async function clearHistory() {
  if (
    !confirm(
      "Are you sure you want to clear all chat history? This action cannot be undone."
    )
  ) {
    return;
  }

  try {
    const response = await fetch("/api/clear_history", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error("Failed to clear history");
    }

    await loadServerHistory();
    showNotification("Chat history cleared successfully", "success");

    // Reset UI to welcome state
    startNewChat();
  } catch (error) {
    console.error("Error clearing history:", error);
    showNotification("Failed to clear chat history", "error");
  }
}

async function deleteConversation(index) {
  try {
    const response = await fetch("/api/delete_conversation", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ index: index }),
    });

    if (!response.ok) {
      throw new Error("Failed to delete conversation");
    }

    await loadServerHistory();
    showNotification("Conversation deleted", "success");
  } catch (error) {
    console.error("Error deleting conversation:", error);
    showNotification("Failed to delete conversation", "error");
  }
}

function refreshHistory() {
  loadServerHistory();
  showNotification("History refreshed", "success");
}

function startNewChat() {
  // Clear current messages
  const messagesContainer = document.getElementById("messagesContainer");
  const welcomeSection = document.getElementById("welcomeSection");
  const chatContainer = document.getElementById("chatContainer");
  const chatInput = document.getElementById("chatInput");

  messagesContainer.innerHTML = "";
  messageHistory = [];

  // Show welcome section
  welcomeSection.style.display = "block";
  chatContainer.classList.remove("has-messages");

  // Reset form state
  resetFormState();

  // Focus input
  chatInput.focus();

  // Update breadcrumb
  document.getElementById("breadcrumbText").textContent =
    "Start a new conversation";

  // Close sidebar on mobile
  if (window.innerWidth <= 768) {
    closeSidebar();
  }
}

// Utility functions
function copyMessage(button) {
  const messageContent = button
    .closest(".message-content")
    .querySelector(".message-text");
  const text = messageContent.textContent;

  navigator.clipboard
    .writeText(text)
    .then(function () {
      showNotification("Message copied to clipboard", "success");

      // Visual feedback
      const icon = button.querySelector("i");
      const originalClass = icon.className;
      icon.className = "fas fa-check";
      setTimeout(() => {
        icon.className = originalClass;
      }, 1000);
    })
    .catch(function () {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      showNotification("Message copied to clipboard", "success");
    });
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function showNotification(message, type = "info") {
  // Remove existing notifications
  document.querySelectorAll(".notification").forEach((n) => n.remove());

  const notification = document.createElement("div");
  notification.className = `notification ${type}`;

  const iconClass =
    type === "success"
      ? "fa-check-circle"
      : type === "error"
      ? "fa-exclamation-circle"
      : "fa-info-circle";

  notification.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.75rem;">
            <i class="fas ${iconClass}" style="font-size: 1.1rem;"></i>
            <span>${message}</span>
        </div>
    `;

  document.body.appendChild(notification);

  // Auto-remove after 4 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.style.animation = "slideInRight 0.3s ease-out reverse";
      setTimeout(() => {
        if (notification.parentNode) {
          notification.remove();
        }
      }, 300);
    }
  }, 4000);
}

// Make functions available globally
window.startNewChat = startNewChat;
window.clearHistory = clearHistory;
window.refreshHistory = refreshHistory;
window.copyMessage = copyMessage;
window.closeSidebar = closeSidebar;
