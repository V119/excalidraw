import React, { useState, useEffect, useCallback } from "react";

import "./settings-page.css";

export const SettingsPage: React.FC = () => {
  const [workDir, setWorkDir] = useState("");
  const [originalPath, setOriginalPath] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [statusType, setStatusType] = useState<"success" | "error">("success");
  const [saveButtonDisabled, setSaveButtonDisabled] = useState(true);
  const [saveButtonText, setSaveButtonText] = useState("💾 保存设置");
  const [isLoading, setIsLoading] = useState(true);

  // 显示状态消息
  const showStatus = useCallback(
    (message: string, type: "success" | "error" = "success") => {
      setStatusMessage(message);
      setStatusType(type);

      if (type === "success") {
        setTimeout(() => {
          setStatusMessage("");
        }, 3000);
      }
    },
    [],
  );

  // 加载当前设置
  const loadSettings = useCallback(async () => {
    try {
      setIsLoading(true);
      // @ts-ignore
      const { invoke } = await import("@tauri-apps/api/core");
      setSaveButtonDisabled(true);
      const dir = await invoke("get_default_work_dir");
      setWorkDir(dir as string);
      setOriginalPath(dir as string);
      setSaveButtonDisabled(false);
      setIsLoading(false);
    } catch (error) {
      console.error("加载设置失败:", error);
      showStatus(`加载设置失败: ${error}`, "error");
      setIsLoading(false);
    }
  }, [showStatus]);

  // 浏览目录
  const handleBrowse = async () => {
    try {
      // @ts-ignore
      const { open } = await import("@tauri-apps/plugin-dialog");

      const selected = await open({
        directory: true,
        multiple: false,
        defaultPath: workDir || undefined,
      });

      if (selected) {
        setWorkDir(selected as string);
      }
    } catch (error) {
      console.error("选择目录失败:", error);
      showStatus(`选择目录失败: ${error}`, "error");
    }
  };

  // 保存设置
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!workDir) {
      showStatus("请选择一个目录", "error");
      return;
    }

    try {
      // @ts-ignore
      const { invoke } = await import("@tauri-apps/api/core");
      setSaveButtonDisabled(true);
      setSaveButtonText("⏳ 保存中...");

      await invoke("set_default_work_dir", { path: workDir });

      setOriginalPath(workDir);
      showStatus("设置已成功保存！");

      setSaveButtonText("✓ 已保存");

      // 2秒后恢复按钮文本
      setTimeout(() => {
        setSaveButtonText("💾 保存设置");
        setSaveButtonDisabled(false);
      }, 2000);
    } catch (error) {
      console.error("保存设置失败:", error);
      showStatus(`保存失败: ${error}`, "error");
      setSaveButtonText("💾 保存设置");
      setSaveButtonDisabled(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  return (
    <div className="settings-container">
      <h1>⚙️ 应用设置</h1>

      <form onSubmit={handleSave}>
        <div className="form-group">
          <label htmlFor="workDir">默认工作目录</label>
          <div className="input-wrapper">
            <input
              type="text"
              id="workDir"
              value={workDir}
              placeholder={isLoading ? "正在加载..." : "点击浏览选择目录..."}
              readOnly
            />
            <button
              type="button"
              className="btn-browse"
              onClick={handleBrowse}
              disabled={isLoading}
            >
              📂 浏览
            </button>
          </div>
          <div className="info-text">
            {isLoading ? (
              "⏳ 正在加载当前设置..."
            ) : workDir ? (
              workDir !== originalPath ? (
                <>
                  <strong>新选择:</strong> {workDir}{" "}
                  <span style={{ color: "#e67e22" }}>(未保存)</span>
                </>
              ) : (
                <>
                  <strong>当前设置:</strong> {workDir}
                </>
              )
            ) : (
              "未设置默认目录"
            )}
          </div>
        </div>

        <div className="divider"></div>

        <button
          type="submit"
          className="btn-save"
          disabled={saveButtonDisabled || isLoading || workDir === originalPath}
        >
          {saveButtonText}
        </button>
      </form>

      {statusMessage && (
        <div className={`status-message ${statusType}`}>{statusMessage}</div>
      )}
    </div>
  );
};
