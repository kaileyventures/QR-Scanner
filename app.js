document.addEventListener("DOMContentLoaded", () => {
  const statusDot = document.getElementById("status-dot");
  const statusText = document.getElementById("status-text");
  const laser = document.getElementById("laser");

  // Keep track of redirecting state to prevent multiple triggerings
  let isRedirecting = false;

  function updateStatus(text, state = "searching") {
    statusText.textContent = text;
    statusDot.className = "status-dot";
    if (state === "searching") {
      statusDot.classList.add("searching");
    } else if (state === "success") {
      statusDot.classList.add("success");
    } else if (state === "error") {
      statusDot.classList.add("error");
    }
  }

  // Register service worker for PWA installability
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js")
      .then((reg) => console.log("Service Worker registered successfully:", reg.scope))
      .catch((err) => console.error("Service Worker registration failed:", err));
  }

  // Initialize QR Code Scanner
  const html5QrCode = new Html5Qrcode("reader");

  const qrCodeSuccessCallback = (decodedText, decodedResult) => {
    if (isRedirecting) return;
    if (!decodedText) return;

    isRedirecting = true;
    updateStatus("QR Detected! Redirecting...", "success");

    let targetUrl = decodedText.trim();
    const urlPattern = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([\/\w .-]*)*\/?/i;
    
    if (urlPattern.test(targetUrl)) {
      if (!/^https?:\/\//i.test(targetUrl)) {
        targetUrl = "https://" + targetUrl;
      }
    } else {
      targetUrl = `https://www.google.com/search?q=${encodeURIComponent(targetUrl)}`;
    }

    html5QrCode.stop().then(() => {
      window.location.href = targetUrl;
    }).catch((err) => {
      console.error("Failed to stop scanner", err);
      window.location.href = targetUrl;
    });
  };

  const config = {
    fps: 15,
    qrbox: (width, height) => {
      const size = Math.min(width, height, 290);
      return { width: size, height: size };
    },
    aspectRatio: 1.0
  };

  function startScanner() {
    updateStatus("Starting camera...", "searching");
    
    html5QrCode.start(
      { facingMode: "environment" },
      config,
      qrCodeSuccessCallback,
      (errorMessage) => {}
    ).then(() => {
      updateStatus("Ready. Scan a QR code", "searching");
      if (laser) laser.style.display = "block"; // Show scanning animation once camera is active
    }).catch((err) => {
      console.warn("Back camera failed, trying first available device", err);
      
      // Fallback: try default/available camera
      Html5Qrcode.getCameras().then(devices => {
        if (devices && devices.length > 0) {
          html5QrCode.start(
            devices[0].id,
            config,
            qrCodeSuccessCallback,
            (errorMessage) => {}
          ).then(() => {
            updateStatus("Ready. Scan a QR code (front camera)", "searching");
            if (laser) laser.style.display = "block";
          }).catch((fallbackErr) => {
            updateStatus("Camera error: " + fallbackErr.message, "error");
          });
        } else {
          updateStatus("No cameras found.", "error");
        }
      }).catch(camerError => {
        updateStatus("Camera search error: " + camerError.message, "error");
      });
    });
  }

  // Trigger permission request using standard browser mediaDevices API
  updateStatus("Requesting camera permission...", "searching");

  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
      .then((stream) => {
        // Permission granted! Stop the temporary stream tracks
        stream.getTracks().forEach(track => track.stop());
        
        // Start the actual scanner library
        startScanner();
      })
      .catch((err) => {
        console.error("Camera permission denied", err);
        updateStatus("Permission denied. Enable camera in browser settings.", "error");
      });
  } else {
    // Fallback if mediaDevices.getUserMedia is missing (e.g. non-secure context or older webview)
    updateStatus("Camera API not supported or secure context (HTTPS) required.", "error");
  }
});
