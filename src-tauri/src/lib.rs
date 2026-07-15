use tauri::Manager;

#[tauri::command]
fn read_clipboard() -> Result<String, String> {
  let mut ctx = arboard::Clipboard::new().map_err(|e| e.to_string())?;
  ctx.get_text().map_err(|e| e.to_string())
}

#[tauri::command]
fn open_url(url: String) -> Result<(), String> {
  #[cfg(target_os = "windows")]
  {
    use std::os::windows::process::CommandExt;
    std::process::Command::new("cmd")
      .args(["/C", "start", &url])
      .creation_flags(0x08000000) // CREATE_NO_WINDOW
      .spawn()
      .map_err(|e| e.to_string())?;
  }
  #[cfg(target_os = "macos")]
  {
    std::process::Command::new("open")
      .arg(&url)
      .spawn()
      .map_err(|e| e.to_string())?;
  }
  #[cfg(target_os = "linux")]
  {
    std::process::Command::new("xdg-open")
      .arg(&url)
      .spawn()
      .map_err(|e| e.to_string())?;
  }
  Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![read_clipboard, open_url])
    .setup(|app| {
      if let Some(window) = app.get_webview_window("main") {
        window.show().map_err(|e| e.to_string())?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
