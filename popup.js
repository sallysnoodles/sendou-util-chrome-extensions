// Popup script for Match History Extension

document.addEventListener('DOMContentLoaded', async () => {
  // Load current username and feature settings
  const result = await chrome.storage.local.get(['manualUsername', 'detectedUsername', 'showTournaments', 'showWeapons']);
  updateCurrentUserDisplay(result.manualUsername, result.detectedUsername);

  if (result.manualUsername) {
    document.getElementById('usernameInput').value = result.manualUsername;
  }

  // Load feature toggles (default to true if not set)
  document.getElementById('showTournaments').checked = result.showTournaments !== false;
  document.getElementById('showWeapons').checked = result.showWeapons !== false;

  // Save username button
  document.getElementById('saveUsername').addEventListener('click', async () => {
    const username = document.getElementById('usernameInput').value.trim();

    if (!username) {
      showMessage('Please enter a username', false);
      return;
    }

    await chrome.storage.local.set({ manualUsername: username });

    updateCurrentUserDisplay(username, result.detectedUsername);
    showMessage('✓ Username saved! Reload sendou.ink to apply.', true);

    reloadSendouTabs();
  });

  // Clear manual username button
  document.getElementById('clearUsername').addEventListener('click', async () => {
    const latest = await chrome.storage.local.get(['detectedUsername']);

    await chrome.storage.local.remove(['manualUsername']);
    document.getElementById('usernameInput').value = '';
    updateCurrentUserDisplay(null, latest.detectedUsername);
    showMessage('✓ Manual username cleared! Auto-detection will be used.', true);

    reloadSendouTabs();
  });

  // Feature toggles
  document.getElementById('showTournaments').addEventListener('change', async (e) => {
    await chrome.storage.local.set({ showTournaments: e.target.checked });
    showMessage('✓ Settings saved! Reload sendou.ink to apply.', true);

    reloadSendouTabs();
  });

  document.getElementById('showWeapons').addEventListener('change', async (e) => {
    await chrome.storage.local.set({ showWeapons: e.target.checked });
    showMessage('✓ Settings saved! Reload sendou.ink to apply.', true);

    reloadSendouTabs();
  });

  // Check if current tab is on sendou.ink
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const currentTab = tabs[0];
    const statusElement = document.getElementById('statusText');

    if (currentTab && currentTab.url && currentTab.url.includes('sendou.ink')) {
      statusElement.textContent = '✓ Active on this page';
      statusElement.style.color = '#4ade80';
    } else {
      statusElement.textContent = 'Visit sendou.ink to use this extension';
      statusElement.style.opacity = '0.7';
    }
  });
});

function reloadSendouTabs() {
  chrome.tabs.query({ url: 'https://sendou.ink/*' }, (tabs) => {
    tabs.forEach(tab => {
      chrome.tabs.reload(tab.id);
    });
  });
}

function updateCurrentUserDisplay(manualUsername, detectedUsername) {
  const currentUserElement = document.getElementById('currentUser');
  const activeUsername = manualUsername || detectedUsername;

  if (!activeUsername) {
    currentUserElement.textContent = 'Current: Not detected';
    currentUserElement.style.display = 'block';
    currentUserElement.style.opacity = '0.75';
    return;
  }

  const source = manualUsername ? 'Manual' : 'Auto-detected';
  currentUserElement.textContent = `${source}: ${activeUsername}`;
  currentUserElement.style.display = 'block';
  currentUserElement.style.opacity = '1';
}

function showMessage(text, isSuccess) {
  const messageElement = document.getElementById('saveMessage');
  messageElement.textContent = text;
  messageElement.style.display = 'block';
  messageElement.style.color = isSuccess ? '#4ade80' : '#f87171';

  setTimeout(() => {
    messageElement.style.display = 'none';
  }, 3000);
}
