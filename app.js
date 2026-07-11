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

  // Start scanning
  updateStatus("Requesting camera access...", "searching");
  
  html5QrCode.start(
    { facingMode: "environment" }, // Default to back camera
    config,
    qrCodeSuccessCallback,
    (errorMessage) => {
      // Verbose scanning logs can be ignored, just keep status active
    }
  ).then(() => {
    updateStatus("Ready. Scan a QR code", "searching");
  }).catch((err) => {
    console.warn("Unable to start with back camera, trying default/available camera...", err);
    
    // Fallback: start with any available camera
    html5QrCode.start(
      { facingMode: "user" }, // Fallback to front camera or default
      config,
      qrCodeSuccessCallback,
      (errorMessage) => {}
    ).then(() => {
      updateStatus("Ready. Scan a QR code", "searching");
    }).catch((fallbackErr) => {
      console.error("Camera start failed", fallbackErr);
      updateStatus("Camera access denied or unavailable", "error");
    });
  });
});
