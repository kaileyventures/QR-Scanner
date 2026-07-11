document.addEventListener("DOMContentLoaded", () => {
  const statusDot = document.getElementById("status-dot");
  const statusText = document.getElementById("status-text");

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

  // Register service worker for installability
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js")
      .then((reg) => console.log("Service Worker registered successfully:", reg.scope))
      .catch((err) => console.error("Service Worker registration failed:", err));
  }

  // Initialize QR Code Scanner
  const html5QrCode = new Html5Qrcode("reader");

  const qrCodeSuccessCallback = (decodedText, decodedResult) => {
    if (isRedirecting) return;
    
    // Validate text
    if (!decodedText) return;

    isRedirecting = true;
    updateStatus("QR Detected! Redirecting...", "success");

    // Check if it looks like a URL
    let targetUrl = decodedText.trim();
    
    // Quick regex to test if it's a URL
    const urlPattern = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([\/\w .-]*)*\/?/i;
    
    if (urlPattern.test(targetUrl)) {
      // Ensure protocol is present
      if (!/^https?:\/\//i.test(targetUrl)) {
        targetUrl = "https://" + targetUrl;
      }
    } else {
      // Fallback: If not a URL, open as Google search query
      targetUrl = `https://www.google.com/search?q=${encodeURIComponent(targetUrl)}`;
    }

    // Stop scanner and redirect
    html5QrCode.stop().then(() => {
      window.location.href = targetUrl;
    }).catch((err) => {
      console.error("Failed to stop scanner", err);
      // Redirect anyway
      window.location.href = targetUrl;
    });
  };

  const config = {
    fps: 15,
    qrbox: (width, height) => {
      // Return a scan area matching our viewfinder
      const size = Math.min(width, height, 290);
      return { width: size, height: size };
    },
    aspectRatio: 1.0
  };

  // Request camera list first (this triggers the native browser permission prompt)
  updateStatus("Requesting camera access...", "searching");

  Html5Qrcode.getCameras().then(devices => {
    if (devices && devices.length > 0) {
      // We have camera devices, try to start with environment/back camera first
      html5QrCode.start(
        { facingMode: "environment" },
        config,
        qrCodeSuccessCallback,
        (errorMessage) => {}
      ).then(() => {
        updateStatus("Ready. Scan a QR code", "searching");
      }).catch((err) => {
        console.warn("Back camera failed, trying first available device", err);
        // Fallback to first available camera device ID
        html5QrCode.start(
          devices[0].id,
          config,
          qrCodeSuccessCallback,
          (errorMessage) => {}
        ).then(() => {
          updateStatus("Ready. Scan a QR code", "searching");
        }).catch((fallbackErr) => {
          console.error("Failed to start fallback camera ID", fallbackErr);
          updateStatus("Camera initialization failed", "error");
        });
      });
    } else {
      updateStatus("No cameras found on this device", "error");
    }
  }).catch(err => {
    console.error("Error getting cameras / Permission denied", err);
    updateStatus("Camera permission denied", "error");
  });
});
