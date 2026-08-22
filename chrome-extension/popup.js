document.addEventListener('DOMContentLoaded', () => {
  const scriptText = document.getElementById('scriptText');
  const scrollSpeed = document.getElementById('scrollSpeed');
  const speedVal = document.getElementById('speedVal');
  const fontSize = document.getElementById('fontSize');
  const fontVal = document.getElementById('fontVal');
  const launchBtn = document.getElementById('launchBtn');
  const hideBtn = document.getElementById('hideBtn');

  // Load saved storage
  chrome.storage?.local?.get(['autoedit_script', 'autoedit_speed', 'autoedit_font'], (res) => {
    if (res?.autoedit_script) scriptText.value = res.autoedit_script;
    if (res?.autoedit_speed) {
      scrollSpeed.value = res.autoedit_speed;
      speedVal.innerText = `${res.autoedit_speed}x`;
    }
    if (res?.autoedit_font) {
      fontSize.value = res.autoedit_font;
      fontVal.innerText = `${res.autoedit_font}px`;
    }
  });

  scrollSpeed.addEventListener('input', () => {
    speedVal.innerText = `${scrollSpeed.value}x`;
    chrome.storage?.local?.set({ autoedit_speed: scrollSpeed.value });
  });

  fontSize.addEventListener('input', () => {
    fontVal.innerText = `${fontSize.value}px`;
    chrome.storage?.local?.set({ autoedit_font: fontSize.value });
  });

  scriptText.addEventListener('input', () => {
    chrome.storage?.local?.set({ autoedit_script: scriptText.value });
  });

  launchBtn.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;

    chrome.tabs.sendMessage(tab.id, {
      action: 'SHOW_PROMPTER',
      text: scriptText.value || 'Paste your script to start recording!',
      speed: parseFloat(scrollSpeed.value),
      fontSize: parseInt(fontSize.value)
    });
  });

  hideBtn.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;

    chrome.tabs.sendMessage(tab.id, { action: 'HIDE_PROMPTER' });
  });
});
