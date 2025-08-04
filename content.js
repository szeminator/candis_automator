let autoClickActive = false;
let observer = null;
let timeoutId = null;
let currentDelay = 3; // Standardwert in Sekunden

// Debug: Content Script wurde geladen
console.log("Candis Content Script geladen auf:", window.location.href);

// Beim Start prüfen, ob Autopilot bereits aktiv ist
if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
  chrome.storage.local.get(['autopilot', 'delay'], (data) => {
    if (data.autopilot) {
      console.log("Autopilot bereits aktiv beim Laden, starte mit delay:", data.delay);
      startAutoClick(data.delay);
    }
  });
}

function clickCandisButton() {
  // Mehrere Selektoren versuchen
  const selectors = [
    "#approval_sidebar > div > div.css-12pf8jm > div > div > div.css-kpdse9 > button:nth-child(1)",
    "button[data-testid*='approve']",
    "button:contains('Freigeben')",
    "button:contains('Approve')",
    ".approval button",
    "#approval_sidebar button"
  ];
  
  let btn = null;
  for (const selector of selectors) {
    btn = document.querySelector(selector);
    if (btn) {
      console.log("Button gefunden mit Selector:", selector);
      break;
    }
  }
  
  if (btn) {
    btn.click();
    console.log(document.title + " freigeben");
  } else {
    console.log("Kein Button gefunden mit keinem der Selektoren");
  }
}

function checkForButtonAndStartTimer() {
  console.log("checkForButtonAndStartTimer aufgerufen, autoClickActive:", autoClickActive);
  if (!autoClickActive) return;
  
  // Warte bis der Button wirklich da ist (SPA braucht Zeit)
  let attempts = 0;
  const maxAttempts = 60; // 30 Sekunden warten (60 * 500ms)
  
  function waitForButton() {
    attempts++;
    
    // Erst prüfen, ob das root-Element Inhalt hat
    const root = document.getElementById('root');
    const hasContent = root && root.children.length > 0;
    
    console.log(`Versuch ${attempts}/${maxAttempts} - Root hat Inhalt:`, hasContent);
    
    if (!hasContent && attempts < maxAttempts) {
      setTimeout(waitForButton, 500);
      return;
    }
    
    // Jetzt nach dem Button suchen - verschiedene Selektoren probieren
    const selectors = [
      "#approval_sidebar > div > div.css-12pf8jm > div > div > div.css-kpdse9 > button:nth-child(1)",
      "#approval_sidebar button",
      "button[type='submit']",
      "button:contains('Freigeben')",
      "button:contains('Approve')",
      "[data-testid*='approve'] button",
      "[data-testid*='submit'] button"
    ];
    
    let btn = null;
    for (const selector of selectors) {
      try {
        btn = document.querySelector(selector);
        if (btn) {
          console.log("Button gefunden mit Selector:", selector);
          break;
        }
      } catch (e) {
        // Selector nicht unterstützt, weiter
      }
    }
    
    console.log("Suche Button... gefunden:", btn);
    
    if (btn) {
      console.log("Button gefunden, starte " + currentDelay + "-Sekunden Timer");
      
      // Clear existing timeout
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      
      // Timer-Status im Storage speichern
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        const timerData = { 
          timerActive: true, 
          timerStartTime: Date.now(), 
          timerDuration: currentDelay 
        };
        console.log("Speichere Timer-Daten:", timerData);
        chrome.storage.local.set(timerData);
      }
      
      timeoutId = setTimeout(() => {
        clickCandisButton();
        // Timer beendet
        if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
          chrome.storage.local.set({ timerActive: false });
        }
      }, currentDelay * 1000);
    } else if (attempts < maxAttempts) {
      // Button noch nicht da, nochmal in 500ms versuchen
      console.log(`Button nicht gefunden (${attempts}/${maxAttempts}), versuche erneut in 500ms`);
      setTimeout(waitForButton, 500);
    } else {
      console.log("Button nach 30 Sekunden nicht gefunden, gebe auf");
    }
  }
  
  waitForButton();
}

function startAutoClick(delay) {
  console.log("startAutoClick aufgerufen mit delay:", delay);
  if (autoClickActive) return;
  autoClickActive = true;
  currentDelay = typeof delay === 'number' && !isNaN(delay) ? delay : 3;
  
  console.log("Autopilot aktiviert, currentDelay:", currentDelay);
  
  // Sofort prüfen, ob Button da ist
  checkForButtonAndStartTimer();
  
  // Observer für DOM-Änderungen (neue Seiten)
  observer = new MutationObserver(() => {
    console.log("DOM-Änderung erkannt");
    checkForButtonAndStartTimer();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
    chrome.storage.local.set({ autopilot: true, delay: currentDelay });
  }
}

function stopAutoClick() {
  if (!autoClickActive) return;
  autoClickActive = false;
  if (observer) {
    observer.disconnect();
    observer = null;
  }
  if (timeoutId) {
    clearTimeout(timeoutId);
    timeoutId = null;
  }
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
    chrome.storage.local.set({ autopilot: false });
  }
}

// Storage-Änderungen überwachen (für START und STOP)
if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.onChanged) {
  chrome.storage.onChanged.addListener((changes, area) => {
    console.log("Storage-Änderung erkannt:", changes);
    if (area === 'local') {
      if (changes.autopilot) {
        if (changes.autopilot.newValue) {
          // Autopilot aktiviert
          chrome.storage.local.get(['delay'], (data) => {
            console.log("Autopilot über Storage aktiviert, delay:", data.delay);
            startAutoClick(data.delay);
          });
        } else {
          // Autopilot deaktiviert
          console.log("Autopilot über Storage deaktiviert");
          stopAutoClick();
        }
      }
    }
  });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "toggleAutopilot") {
    if (autoClickActive) {
      stopAutoClick();
    } else {
      startAutoClick(request.delay);
    }
    sendResponse({isOn: autoClickActive, delay: currentDelay});
    return true;
  }
  if (request.action === "getAutopilotState") {
    sendResponse({isOn: autoClickActive, delay: currentDelay});
    return true;
  }
});

// ESC-Taste schaltet Autopilot immer aus
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    stopAutoClick();
    if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({action: 'autopilotStoppedByEsc'});
    }
  }
});