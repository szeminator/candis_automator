console.log("Popup geladen!", typeof chrome, chrome && chrome.storage, chrome && chrome.storage && chrome.storage.local);

let timerInterval = null;

function isChromeStorageAvailable() {
  return typeof chrome !== "undefined" && chrome.storage && chrome.storage.local;
}

function startTimerDisplay(seconds) {
  const timerDiv = document.getElementById('timer');
  timerDiv.classList.add('active');
  
  let remainingTime = seconds;
  timerDiv.textContent = remainingTime + 's';
  
  if (timerInterval) {
    clearInterval(timerInterval);
  }
  
  timerInterval = setInterval(() => {
    remainingTime--;
    if (remainingTime > 0) {
      timerDiv.textContent = remainingTime + 's';
    } else {
      timerDiv.textContent = 'Klick!';
      setTimeout(() => {
        timerDiv.classList.remove('active');
        clearInterval(timerInterval);
        timerInterval = null;
      }, 1000);
    }
  }, 1000);
}

function stopTimerDisplay() {
  const timerDiv = document.getElementById('timer');
  timerDiv.classList.remove('active');
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function updateUI(isOn, delay) {
  const btn = document.getElementById('startBtn');
  const status = document.getElementById('status');
  const delayInput = document.getElementById('delayInput');
  if (isOn) {
    btn.textContent = 'Autopilot ON';
    btn.classList.remove('off');
    btn.classList.add('on');
    status.textContent = 'Autopilot ist aktiviert';
    delayInput.disabled = true;
  } else {
    btn.textContent = 'Autopilot OFF';
    btn.classList.remove('on');
    btn.classList.add('off');
    status.textContent = 'Autopilot ist deaktiviert';
    delayInput.disabled = false;
    stopTimerDisplay();
  }
  if (typeof delay === 'number') {
    delayInput.value = delay;
  }
  btn.disabled = false;
}

function showUnavailable() {
  const btn = document.getElementById('startBtn');
  const status = document.getElementById('status');
  const delayInput = document.getElementById('delayInput');
  status.textContent = 'Autopilot nur im Extension-Popup verfügbar!';
  btn.disabled = true;
  delayInput.disabled = true;
}

function getStateAndUpdateUI() {
  if (!isChromeStorageAvailable()) {
    showUnavailable();
    return;
  }
  try {
    chrome.storage.local.get(['autopilot', 'delay'], (data) => {
      if (chrome.runtime.lastError) {
        console.error('Storage get error:', chrome.runtime.lastError);
        showUnavailable();
        return;
      }
      updateUI(!!data.autopilot, data.delay || 5);
    });
  } catch (error) {
    console.error('Storage error:', error);
    showUnavailable();
  }
}

document.getElementById('startBtn').addEventListener('click', () => {
  if (!isChromeStorageAvailable()) {
    showUnavailable();
    return;
  }
  try {
    chrome.storage.local.get(['autopilot', 'delay'], (data) => {
      if (chrome.runtime.lastError) {
        console.error('Storage get error:', chrome.runtime.lastError);
        showUnavailable();
        return;
      }
      const isOn = !!data.autopilot;
      const delayInput = parseInt(document.getElementById('delayInput').value, 10) || 5;
      if (isOn) {
        chrome.storage.local.set({ autopilot: false }, () => {
          if (chrome.runtime.lastError) {
            console.error('Storage set error:', chrome.runtime.lastError);
          }
        });
      } else {
        chrome.storage.local.set({ autopilot: true, delay: delayInput }, () => {
          if (chrome.runtime.lastError) {
            console.error('Storage set error:', chrome.runtime.lastError);
          }
        });
      }
    });
  } catch (error) {
    console.error('Storage error:', error);
    showUnavailable();
  }
});

document.getElementById('delayInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    document.getElementById('startBtn').focus();
  }
});

if (isChromeStorageAvailable() && chrome.storage.onChanged) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && (changes.autopilot || changes.delay)) {
      getStateAndUpdateUI();
    }
  });
}

// Timer-Status aus Storage überwachen
function checkTimerStatus() {
  if (!isChromeStorageAvailable()) return;
  
  chrome.storage.local.get(['timerActive', 'timerStartTime', 'timerDuration'], (data) => {
    if (chrome.runtime.lastError) return;
    
    console.log("Timer-Status:", data);
    
    if (data.timerActive && data.timerStartTime && data.timerDuration) {
      const elapsed = (Date.now() - data.timerStartTime) / 1000;
      const remaining = Math.max(0, data.timerDuration - elapsed);
      
      console.log("Verbleibende Zeit:", remaining);
      
      if (remaining > 0) {
        startTimerDisplay(Math.ceil(remaining));
      } else {
        const timerDiv = document.getElementById('timer');
        timerDiv.classList.add('active');
        timerDiv.textContent = 'Klick!';
        setTimeout(() => {
          timerDiv.classList.remove('active');
        }, 1000);
      }
    } else {
      stopTimerDisplay();
    }
  });
}

// Timer-Status regelmäßig prüfen
setInterval(checkTimerStatus, 500);

// Beim Öffnen sofort Timer-Status prüfen
checkTimerStatus();

// Beim Öffnen Status abfragen
getStateAndUpdateUI();