// AutoEdit Studio Floating Teleprompter Content Script
(function () {
  let prompterEl = null;
  let scrollInterval = null;
  let isScrolling = false;
  let currentSpeed = 3;

  function createPrompter(text, speed, fontSize) {
    if (prompterEl) prompterEl.remove();

    currentSpeed = speed || 3;

    prompterEl = document.createElement('div');
    prompterEl.id = 'autoedit-teleprompter-root';
    prompterEl.className = 'autoedit-floating-prompter';

    prompterEl.innerHTML = `
      <div class="autoedit-prompter-header" id="autoedit-drag-handle">
        <div class="autoedit-header-title">
          <span class="autoedit-dot"></span>
          <span>AutoEdit Prompter</span>
        </div>
        <div class="autoedit-header-actions">
          <button id="autoedit-play-btn" class="autoedit-btn">▶ Play</button>
          <button id="autoedit-reset-btn" class="autoedit-btn">↺ Reset</button>
          <button id="autoedit-close-btn" class="autoedit-btn autoedit-close">✕</button>
        </div>
      </div>
      <div class="autoedit-prompter-body" id="autoedit-body" style="font-size: ${fontSize || 22}px;">
        <div class="autoedit-prompter-text">${(text || '').replace(/\n/g, '<br>')}</div>
      </div>
      <div class="autoedit-prompter-footer">
        <span>Space: Play/Pause | Drag header to move</span>
      </div>
    `;

    document.body.appendChild(prompterEl);

    // Make Draggable
    makeDraggable(prompterEl, document.getElementById('autoedit-drag-handle'));

    const bodyEl = document.getElementById('autoedit-body');
    const playBtn = document.getElementById('autoedit-play-btn');
    const resetBtn = document.getElementById('autoedit-reset-btn');
    const closeBtn = document.getElementById('autoedit-close-btn');

    function toggleScroll() {
      if (isScrolling) {
        clearInterval(scrollInterval);
        isScrolling = false;
        playBtn.innerText = '▶ Play';
        playBtn.style.background = '#4f46e5';
      } else {
        isScrolling = true;
        playBtn.innerText = '⏸ Pause';
        playBtn.style.background = '#d97706';
        scrollInterval = setInterval(() => {
          if (bodyEl) {
            bodyEl.scrollTop += currentSpeed * 0.75;
          }
        }, 30);
      }
    }

    playBtn.addEventListener('click', toggleScroll);

    resetBtn.addEventListener('click', () => {
      if (bodyEl) bodyEl.scrollTop = 0;
    });

    closeBtn.addEventListener('click', () => {
      clearInterval(scrollInterval);
      prompterEl.remove();
      prompterEl = null;
    });

    // Spacebar listener when active
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        if (prompterEl) {
          e.preventDefault();
          toggleScroll();
        }
      }
    });
  }

  function makeDraggable(el, handle) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    handle.onmousedown = dragMouseDown;

    function dragMouseDown(e) {
      e = e || window.event;
      e.preventDefault();
      pos3 = e.clientX;
      pos4 = e.clientY;
      document.onmouseup = closeDragElement;
      document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
      e = e || window.event;
      e.preventDefault();
      pos1 = pos3 - e.clientX;
      pos2 = pos4 - e.clientY;
      pos3 = e.clientX;
      pos4 = e.clientY;
      el.style.top = (el.offsetTop - pos2) + "px";
      el.style.left = (el.offsetLeft - pos1) + "px";
      el.style.right = 'auto';
      el.style.bottom = 'auto';
    }

    function closeDragElement() {
      document.onmouseup = null;
      document.onmousemove = null;
    }
  }

  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
    if (req.action === 'SHOW_PROMPTER') {
      createPrompter(req.text, req.speed, req.fontSize);
      sendResponse({ status: 'ok' });
    } else if (req.action === 'HIDE_PROMPTER') {
      if (prompterEl) {
        clearInterval(scrollInterval);
        prompterEl.remove();
        prompterEl = null;
      }
      sendResponse({ status: 'ok' });
    }
  });
})();
