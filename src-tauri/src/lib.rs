use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, Emitter, AppHandle, Wry,
};
use tauri_plugin_dialog::{DialogExt};
use tauri_plugin_opener::OpenerExt;
use tauri_plugin_store::StoreExt;
use std::path::PathBuf;

const STORE_FILENAME: &str = "settings.json";
const WORK_DIR_KEY: &str = "default_work_directory";

#[tauri::command]
fn get_default_work_dir(app: AppHandle) -> Result<String, String> {
    let store = app.store(STORE_FILENAME).map_err(|e| e.to_string())?;

    if let Some(dir) = store.get(WORK_DIR_KEY) {
        if let Some(path) = dir.as_str() {
            return Ok(path.to_string());
        }
    }

    // 默认使用文档目录
    app.path()
        .document_dir()
        .map(|p| p.to_string_lossy().to_string())
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn set_default_work_dir(app: AppHandle, path: String) -> Result<(), String> {
    let store = app.store(STORE_FILENAME).map_err(|e| e.to_string())?;
    store.set(WORK_DIR_KEY, serde_json::json!(path));
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn open_file(app: AppHandle) -> Result<Option<String>, String> {
    let default_dir = get_default_work_dir(app.clone()).ok();

    let file_path = app
        .dialog()
        .file()
        .add_filter("Excalidraw Files", &["excalidraw"])
        .set_directory(default_dir.unwrap_or_default())
        .blocking_pick_file();

    if let Some(file) = file_path {
        let path_buf = PathBuf::from(file.to_string());

        // 读取文件内容
        let contents = std::fs::read_to_string(&path_buf)
            .map_err(|e| e.to_string())?;

        // 发送文件内容到前端
        app.emit("file-opened", contents.clone())
            .map_err(|e| e.to_string())?;

        Ok(Some(contents))
    } else {
        Ok(None)
    }
}

#[tauri::command]
async fn save_file(app: AppHandle, content: String) -> Result<(), String> {
    let default_dir = get_default_work_dir(app.clone()).ok();

    let file_path = app
        .dialog()
        .file()
        .add_filter("Excalidraw Files", &["excalidraw"])
        .set_directory(default_dir.unwrap_or_default())
        .set_file_name("drawing.excalidraw")
        .blocking_save_file();

    if let Some(file) = file_path {
        let path_buf = PathBuf::from(file.to_string());

        // 写入文件
        std::fs::write(&path_buf, content)
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
fn show_settings_window(app: AppHandle) -> Result<(), String> {
    // 检查窗口是否已存在
    if let Some(window) = app.get_webview_window("settings") {
        let _ = window.show();
        let _ = window.set_focus();
        return Ok(());
    }

    // 创建设置窗口
    // 在开发和生产模式下都使用 App 协议，通过 hash 路由区分
    let _settings_window = tauri::WebviewWindowBuilder::new(
        &app,
        "settings",
        tauri::WebviewUrl::App("index.html".into()),
    )
    .title("设置")
    .inner_size(600.0, 400.0)
    .resizable(false)
    .center()
    .initialization_script(r#"
        // 在窗口加载后导航到设置页面
        window.location.hash = '/settings';
    "#)
    .build()
    .map_err(|e| e.to_string())?;

    Ok(())
}

fn create_tray_menu(app: &AppHandle) -> Result<Menu<Wry>, Box<dyn std::error::Error>> {
    let open_item = MenuItem::with_id(app, "open", "打开文件", true, None::<&str>)?;
    let help_item = MenuItem::with_id(app, "help", "帮助", true, None::<&str>)?;
    let settings_item = MenuItem::with_id(app, "settings", "设置", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;

    let menu = Menu::with_items(
        app,
        &[&open_item, &help_item, &settings_item, &quit_item],
    )?;

    Ok(menu)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            get_default_work_dir,
            set_default_work_dir,
            open_file,
            save_file,
            show_settings_window,
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;

                let window = app.get_webview_window("main").unwrap();
                window.open_devtools();
            }

            // 创建系统托盘
            let menu = create_tray_menu(&app.handle())?;
            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .on_menu_event(move |app: &AppHandle, event| match event.id.as_ref() {
                    "open" => {
                        let app = app.clone();
                        tauri::async_runtime::spawn(async move {
                            if let Err(e) = open_file(app).await {
                                eprintln!("打开文件失败: {}", e);
                            }
                        });
                    }
                    "help" => {
                        // 使用 tauri-plugin-opener 打开帮助页面
                        if let Err(e) = app.opener().open_url("https://docs.excalidraw.com", None::<&str>) {
                            eprintln!("打开帮助页面失败: {:?}", e);
                        }
                    }
                    "settings" => {
                        if let Err(e) = show_settings_window(app.clone()) {
                            eprintln!("打开设置窗口失败: {}", e);
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray: &tauri::tray::TrayIcon<Wry>, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let app_handle = window.app_handle();
                let _ = window.hide();
                api.prevent_close();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
