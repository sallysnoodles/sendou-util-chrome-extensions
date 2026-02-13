// Background service worker for Sendou Utils Extension

// Listen for installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Sendou Utils Extension installed');
  } else if (details.reason === 'update') {
    console.log('Sendou Utils Extension updated');
  }
});
