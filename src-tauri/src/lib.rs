use tauri::Manager;

#[tauri::command]
fn read_clipboard() -> Result<String, String> {
  let mut ctx = arboard::Clipboard::new().map_err(|e| e.to_string())?;
  ctx.get_text().map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![read_clipboard])
    .setup(|app| {
      if let Some(window) = app.get_webview_window("main") {
        window.show().map_err(|e| e.to_string())?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
