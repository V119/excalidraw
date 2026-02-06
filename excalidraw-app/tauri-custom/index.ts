import "./cleanup.css";

export function initTauri() {
  // @ts-ignore
  if (window.__TAURI__) {
    // eslint-disable-next-line no-console
    console.log("🖥️ Excalidraw Desktop (Tauri v2) Initialized");
    document.body.classList.add("is-tauri");

    // 监听文件打开事件
    setupFileHandlers();

    // 设置键盘快捷键
    setupKeyboardShortcuts();

    // 主动移除不需要的 UI 元素
    cleanupUI();
  }
}

function cleanupUI() {
  // 使用 MutationObserver 监听 DOM 变化，持续移除不需要的元素
  const observer = new MutationObserver(() => {
    removeUnwantedElements();
  });

  // 立即执行一次
  removeUnwantedElements();

  // 开始观察
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // 页面加载完成后再执行一次
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", removeUnwantedElements);
  } else {
    setTimeout(removeUnwantedElements, 1000);
  }
}

function removeUnwantedElements() {
  // 移除欢迎屏幕
  const welcomeScreens = document.querySelectorAll(
    ".welcome-screen-container, .welcome-screen, .welcome-screen-geometric-bg, .welcome-screen-center, .welcome-screen-decor",
  );
  welcomeScreens.forEach((el) => el.remove());

  // 移除包含特定文本的按钮和链接
  const removeByText = [
    "Live collaboration",
    "Sign up",
    "Sign in",
    "Library",
    "Help",
    "Open",
  ];

  document.querySelectorAll("button, a").forEach((el) => {
    const text = el.textContent || "";
    const title = el.getAttribute("title") || "";
    const ariaLabel = el.getAttribute("aria-label") || "";
    const combinedText = `${text} ${title} ${ariaLabel}`.toLowerCase();

    if (
      removeByText.some((keyword) =>
        combinedText.includes(keyword.toLowerCase()),
      )
    ) {
      // 检查是否是主菜单按钮（三横线图标），不要删除它
      const isMainMenu = el.classList.contains("dropdown-menu-button");
      if (!isMainMenu) {
        el.remove();
      }
    }
  });

  // 移除特定 href 的链接
  document
    .querySelectorAll('a[href*="excalidraw.com"], a[href*="github.com"]')
    .forEach((el) => el.remove());

  // 移除页脚中的帮助部分
  document
    .querySelectorAll(
      ".layer-ui__wrapper__footer-left, .layer-ui__wrapper__footer-center",
    )
    .forEach((el) => el.remove());
}

async function setupFileHandlers() {
  const { listen } = await import("@tauri-apps/api/event");

  // 监听从 Rust 发来的文件打开事件
  await listen("file-opened", (event) => {
    try {
      const content = event.payload as string;
      const data = JSON.parse(content);

      // 获取 Excalidraw API 并加载数据
      // @ts-ignore
      if (window.excalidrawAPI) {
        // @ts-ignore
        window.excalidrawAPI.updateScene(data);
      }
    } catch (error) {
      console.error("加载文件失败:", error);
    }
  });
}

function setupKeyboardShortcuts() {
  document.addEventListener("keydown", async (e) => {
    const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
    const modKey = isMac ? e.metaKey : e.ctrlKey;

    // Ctrl/Cmd + S: 保存
    if (modKey && e.key === "s") {
      e.preventDefault();
      await saveCurrentDrawing();
    }

    // Ctrl/Cmd + O: 打开
    if (modKey && e.key === "o") {
      e.preventDefault();
      await openFile();
    }
  });
}

async function saveCurrentDrawing() {
  try {
    const { invoke } = await import("@tauri-apps/api/core");

    // @ts-ignore
    if (window.excalidrawAPI) {
      // @ts-ignore
      const elements = window.excalidrawAPI.getSceneElements();
      // @ts-ignore
      const appState = window.excalidrawAPI.getAppState();

      const data = {
        type: "excalidraw",
        version: 2,
        source: "https://excalidraw.com",
        elements,
        appState: {
          viewBackgroundColor: appState.viewBackgroundColor,
          gridSize: appState.gridSize,
        },
      };

      await invoke("save_file", { content: JSON.stringify(data, null, 2) });
    }
  } catch (error) {
    console.error("保存文件失败:", error);
  }
}

async function openFile() {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("open_file");
  } catch (error) {
    console.error("打开文件失败:", error);
  }
}
