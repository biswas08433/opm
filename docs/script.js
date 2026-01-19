// Tab switching for installation section
document.addEventListener("DOMContentLoaded", () => {
  const tabButtons = document.querySelectorAll(".tab-btn");
  const tabContents = document.querySelectorAll(".tab-content");

  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const tab = button.dataset.tab;

      // Remove active class from all buttons and contents
      tabButtons.forEach((btn) => btn.classList.remove("active"));
      tabContents.forEach((content) => content.classList.remove("active"));

      // Add active class to clicked button and corresponding content
      button.classList.add("active");
      document.getElementById(tab).classList.add("active");
    });
  });

  // Smooth scroll for anchor links
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", function (e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute("href"));
      if (target) {
        target.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    });
  });

  // Add copy button to code blocks
  document.querySelectorAll("pre").forEach((pre) => {
    const wrapper = document.createElement("div");
    wrapper.style.position = "relative";
    pre.parentNode.insertBefore(wrapper, pre);
    wrapper.appendChild(pre);

    const copyBtn = document.createElement("button");
    copyBtn.textContent = "Copy";
    copyBtn.className = "copy-btn";
    copyBtn.style.cssText = `
      position: absolute;
      top: 8px;
      right: 8px;
      background: #30363d;
      border: 1px solid #484f58;
      color: #8b949e;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      cursor: pointer;
      opacity: 0;
      transition: opacity 0.2s;
    `;
    wrapper.appendChild(copyBtn);

    wrapper.addEventListener("mouseenter", () => {
      copyBtn.style.opacity = "1";
    });

    wrapper.addEventListener("mouseleave", () => {
      copyBtn.style.opacity = "0";
    });

    copyBtn.addEventListener("click", async () => {
      const code = pre.querySelector("code").textContent;
      await navigator.clipboard.writeText(code);
      copyBtn.textContent = "Copied!";
      setTimeout(() => {
        copyBtn.textContent = "Copy";
      }, 2000);
    });
  });

  // Detect OS and auto-select tab
  const platform = navigator.platform.toLowerCase();
  let defaultTab = "linux";

  if (platform.includes("mac")) {
    // Check for Apple Silicon vs Intel
    defaultTab = navigator.userAgent.includes("Mac OS X")
      ? "macos-arm"
      : "macos-intel";
  } else if (platform.includes("win")) {
    defaultTab = "windows";
  }

  const defaultTabBtn = document.querySelector(
    `.tab-btn[data-tab="${defaultTab}"]`,
  );
  if (defaultTabBtn) {
    defaultTabBtn.click();
  }
});
