// Popup script for Match History Extension

document.addEventListener('DOMContentLoaded', async () => {
  // Load current username if set
  const result = await chrome.storage.local.get(['manualUsername', 'showTournaments', 'showWeapons']);
  if (result.manualUsername) {
    document.getElementById('usernameInput').value = result.manualUsername;
    document.getElementById('currentUser').textContent = `Current: ${result.manualUsername}`;
    document.getElementById('currentUser').style.display = 'block';
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

    document.getElementById('currentUser').textContent = `Current: ${username}`;
    document.getElementById('currentUser').style.display = 'block';
    showMessage('✓ Username saved! Reload sendou.ink to apply.', true);

    // Reload the content script on sendou.ink tabs
    chrome.tabs.query({ url: 'https://sendou.ink/*' }, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.reload(tab.id);
      });
    });
  });

  // Feature toggles
  document.getElementById('showTournaments').addEventListener('change', async (e) => {
    await chrome.storage.local.set({ showTournaments: e.target.checked });
    showMessage('✓ Settings saved! Reload sendou.ink to apply.', true);

    // Reload the content script on sendou.ink tabs
    chrome.tabs.query({ url: 'https://sendou.ink/*' }, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.reload(tab.id);
      });
    });
  });

  document.getElementById('showWeapons').addEventListener('change', async (e) => {
    await chrome.storage.local.set({ showWeapons: e.target.checked });
    showMessage('✓ Settings saved! Reload sendou.ink to apply.', true);

    // Reload the content script on sendou.ink tabs
    chrome.tabs.query({ url: 'https://sendou.ink/*' }, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.reload(tab.id);
      });
    });
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

function showMessage(text, isSuccess) {
  const messageElement = document.getElementById('saveMessage');
  messageElement.textContent = text;
  messageElement.style.display = 'block';
  messageElement.style.color = isSuccess ? '#4ade80' : '#f87171';

  setTimeout(() => {
    messageElement.style.display = 'none';
  }, 3000);
}
