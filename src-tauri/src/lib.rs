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

#[tauri::command]
fn read_binary_file(path: String) -> Result<Vec<u8>, String> {
  std::fs::read(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_sav_metadata(path: String) -> Result<(u64, String), String> {
  let metadata = std::fs::metadata(&path).map_err(|e| e.to_string())?;
  let size = metadata.len();
  let modified = metadata.modified().map_err(|e| e.to_string())?;
  let duration = modified.duration_since(std::time::UNIX_EPOCH).map_err(|e| e.to_string())?;
  let secs = duration.as_secs();
  Ok((size, secs.to_string()))
}

#[tauri::command]
fn auto_detect_sav_file() -> Result<String, String> {
  let local_app_data = std::env::var("LOCALAPPDATA").map_err(|_| "LOCALAPPDATA env var not found".to_string())?;
  let save_dir = std::path::Path::new(&local_app_data)
      .join("Foxhole")
      .join("Saved")
      .join("SaveGames");
  
  if !save_dir.exists() {
      return Err("Foxhole SaveGames directory not found".to_string());
  }
  
  let mut latest_file = None;
  let mut latest_mtime = std::time::SystemTime::UNIX_EPOCH;
  
  let entries = std::fs::read_dir(save_dir).map_err(|e| e.to_string())?;
  for entry in entries {
      let entry = entry.map_err(|e| e.to_string())?;
      let path = entry.path();
      if path.is_file() {
          if let Some(filename) = path.file_name().and_then(|f| f.to_str()) {
              if filename.ends_with("_MapData.sav") {
                  if let Ok(metadata) = path.metadata() {
                      if let Ok(modified) = metadata.modified() {
                          if modified > latest_mtime {
                              latest_mtime = modified;
                              latest_file = Some(path.to_string_lossy().to_string());
                          }
                      }
                  }
              }
          }
      }
  }
  
  latest_file.ok_or_else(|| "No _MapData.sav file found".to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![
      read_clipboard, 
      open_url,
      read_binary_file,
      get_sav_metadata,
      auto_detect_sav_file
    ])
    .setup(|app| {
      if let Some(window) = app.get_webview_window("main") {
        window.show().map_err(|e| e.to_string())?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
