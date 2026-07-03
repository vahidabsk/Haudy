use std::fs;
use std::path::{Path, PathBuf};

#[tauri::command]
fn choose_haudy_database_location() -> Result<Option<String>, String> {
    let Some(folder) = rfd::FileDialog::new()
        .set_title("Choose where Haudy Database will be stored")
        .pick_folder()
    else {
        return Ok(None);
    };
    let database = folder.join("Haudy Database");
    fs::create_dir_all(&database).map_err(|error| error.to_string())?;
    Ok(Some(folder.to_string_lossy().to_string()))
}

#[tauri::command]
fn save_haudy_text_file(base_path: String, folders: Vec<String>, file_name: String, contents: String) -> Result<String, String> {
    let base = PathBuf::from(base_path);
    let mut directory = base.join("Haudy Database");
    for folder in folders {
        directory.push(safe_path_part(&folder));
    }
    fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
    let path = directory.join(safe_file_name(&file_name));
    fs::write(&path, contents).map_err(|error| error.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
fn save_haudy_binary_file(base_path: String, folders: Vec<String>, file_name: String, contents: Vec<u8>) -> Result<String, String> {
    let base = PathBuf::from(base_path);
    let mut directory = base.join("Haudy Database");
    for folder in folders {
        directory.push(safe_path_part(&folder));
    }
    fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
    let path = directory.join(safe_file_name(&file_name));
    fs::write(&path, contents).map_err(|error| error.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
fn create_haudy_folders(base_path: String, folder_sets: Vec<Vec<String>>) -> Result<(), String> {
    let base = PathBuf::from(base_path);
    for folders in folder_sets {
        let mut directory = base.join("Haudy Database");
        for folder in folders {
            directory.push(safe_path_part(&folder));
        }
        fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
    }
    Ok(())
}

fn safe_path_part(value: &str) -> String {
    let cleaned = value
        .chars()
        .map(|character| match character {
            '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*' => ' ',
            _ => character,
        })
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ");
    if cleaned.is_empty() { "Haudy Folder".to_string() } else { cleaned }
}

fn safe_file_name(value: &str) -> String {
    let file_name = safe_path_part(value);
    if Path::new(&file_name).extension().is_some() {
        file_name
    } else {
        format!("{file_name}.html")
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            choose_haudy_database_location,
            create_haudy_folders,
            save_haudy_binary_file,
            save_haudy_text_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Haudy");
}
