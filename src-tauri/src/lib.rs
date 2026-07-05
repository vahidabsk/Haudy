use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use calamine::{open_workbook_auto, Data, Reader};

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct CertificatePdfText {
    file_name: String,
    text: String,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct TrackerAssignment {
    auditor_name: String,
    asc_name: String,
    city: String,
    state: String,
    ccn: String,
    file_no: String,
    scn: String,
    cert_count: String,
    psn: String,
    auditor_notes: String,
    asc_status: String,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct AppVersion {
    version: String,
}

#[tauri::command]
fn get_haudy_version() -> AppVersion {
    AppVersion {
        version: env!("CARGO_PKG_VERSION").to_string(),
    }
}

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
fn open_certificate_pdfs() -> Result<Vec<CertificatePdfText>, String> {
    let Some(files) = rfd::FileDialog::new()
        .set_title("Choose PDF certificate files")
        .add_filter("PDF certificate files", &["pdf"])
        .pick_files()
    else {
        return Ok(Vec::new());
    };

    let mut certificates = Vec::new();
    for path in files {
        let file_name = path
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("Certificate.pdf")
            .to_string();
        let text = pdf_extract::extract_text(&path)
            .map_err(|error| format!("Could not read {file_name}: {error}"))?;
        if text.trim().is_empty() {
            return Err(format!(
                "{file_name} does not contain selectable PDF text. Use the official certificate PDF, not a scanned image."
            ));
        }
        certificates.push(CertificatePdfText { file_name, text });
    }

    Ok(certificates)
}

#[tauri::command]
fn open_past_report_pdfs() -> Result<Vec<CertificatePdfText>, String> {
    let Some(files) = rfd::FileDialog::new()
        .set_title("Choose past report PDF files")
        .add_filter("PDF report files", &["pdf"])
        .pick_files()
    else {
        return Ok(Vec::new());
    };

    let mut reports = Vec::new();
    for path in files {
        let file_name = path
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("Past Report.pdf")
            .to_string();
        let text = pdf_extract::extract_text(&path)
            .map_err(|error| format!("Could not read {file_name}: {error}"))?;
        if text.trim().is_empty() {
            return Err(format!(
                "{file_name} does not contain selectable PDF text. Use a text-based report PDF, not a scanned image."
            ));
        }
        reports.push(CertificatePdfText { file_name, text });
    }

    Ok(reports)
}

#[tauri::command]
fn open_audit_tracker() -> Result<Vec<TrackerAssignment>, String> {
    let Some(path) = rfd::FileDialog::new()
        .set_title("Choose audit tracker workbook")
        .add_filter("Excel workbook", &["xlsx", "xlsm", "xls"])
        .pick_file()
    else {
        return Ok(Vec::new());
    };

    let mut workbook = open_workbook_auto(&path).map_err(|error| format!("Could not open tracker: {error}"))?;
    let range = workbook
        .worksheet_range("2026 US Assignments")
        .map_err(|error| format!("Could not read the 2026 US Assignments sheet: {error}"))?;

    let mut rows = range.rows();
    let Some(header_row) = rows.next() else {
        return Ok(Vec::new());
    };
    let headers = header_row.iter().map(cell_text).collect::<Vec<_>>();
    let index = |name: &str| -> Option<usize> {
        headers.iter().position(|header| header.trim().eq_ignore_ascii_case(name.trim()))
    };

    let auditor_index = index("Assigned Auditor").ok_or_else(|| "Tracker is missing Assigned Auditor column.".to_string())?;
    let asc_index = index("Company/ Service Center Name").ok_or_else(|| "Tracker is missing Company/ Service Center Name column.".to_string())?;
    let city_index = index("City").ok_or_else(|| "Tracker is missing City column.".to_string())?;
    let state_index = index("State").ok_or_else(|| "Tracker is missing State column.".to_string())?;
    let ccn_index = index("CCN").ok_or_else(|| "Tracker is missing CCN column.".to_string())?;
    let file_index = index("File").ok_or_else(|| "Tracker is missing File column.".to_string())?;
    let scn_index = index("SCN").ok_or_else(|| "Tracker is missing SCN column.".to_string())?;
    let cert_count_index = index("Cert Count").ok_or_else(|| "Tracker is missing Cert Count column.".to_string())?;
    let psn_index = index("PSN").ok_or_else(|| "Tracker is missing PSN column.".to_string())?;
    let notes_index = index("Auditor Notes");
    let status_index = index("ASC Status");

    let mut assignments = Vec::new();
    for row in rows {
        let assignment = TrackerAssignment {
            auditor_name: row_cell_text(row, auditor_index),
            asc_name: row_cell_text(row, asc_index),
            city: row_cell_text(row, city_index),
            state: row_cell_text(row, state_index),
            ccn: row_cell_text(row, ccn_index),
            file_no: row_cell_text(row, file_index),
            scn: row_cell_text(row, scn_index),
            cert_count: row_cell_text(row, cert_count_index),
            psn: row_cell_text(row, psn_index),
            auditor_notes: notes_index.map(|column| row_cell_text(row, column)).unwrap_or_default(),
            asc_status: status_index.map(|column| row_cell_text(row, column)).unwrap_or_default(),
        };
        if !assignment.auditor_name.is_empty() && !assignment.asc_name.is_empty() {
            assignments.push(assignment);
        }
    }

    Ok(assignments)
}

fn row_cell_text(row: &[Data], index: usize) -> String {
    row.get(index).map(cell_text).unwrap_or_default()
}

fn cell_text(cell: &Data) -> String {
    match cell {
        Data::Empty => String::new(),
        Data::String(value) => value.trim().to_string(),
        Data::Float(value) => {
            if value.fract() == 0.0 {
                format!("{value:.0}")
            } else {
                value.to_string()
            }
        }
        Data::Int(value) => value.to_string(),
        Data::Bool(value) => value.to_string(),
        _ => cell.to_string().trim().to_string(),
    }
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
fn save_haudy_binary_file_with_dialog(base_path: String, folders: Vec<String>, file_name: String, contents: Vec<u8>) -> Result<Option<String>, String> {
    let base = PathBuf::from(base_path);
    let mut directory = base.join("Haudy Database");
    for folder in folders {
        directory.push(safe_path_part(&folder));
    }
    fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
    let safe_file_name = safe_file_name(&file_name);
    let Some(path) = rfd::FileDialog::new()
        .set_title("Save Haudy PDF")
        .set_directory(&directory)
        .set_file_name(&safe_file_name)
        .add_filter("PDF document", &["pdf"])
        .save_file()
    else {
        return Ok(None);
    };
    fs::write(&path, contents).map_err(|error| error.to_string())?;
    Ok(Some(path.to_string_lossy().to_string()))
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

#[tauri::command]
fn install_haudy_patch(download_url: String, file_name: String) -> Result<String, String> {
    if !cfg!(target_os = "windows") {
        return Err("Patch installation is currently available in the Windows desktop app.".to_string());
    }
    if !is_allowed_patch_url(&download_url) {
        return Err("Haudy refused this patch because it did not come from the approved Haudy release channel.".to_string());
    }

    let mut path = std::env::temp_dir();
    path.push(safe_file_name(&file_name));
    let path_text = path.to_string_lossy().to_string();
    let command = format!(
        "$ProgressPreference='SilentlyContinue'; Invoke-WebRequest -Uri '{}' -OutFile '{}'",
        powershell_quote(&download_url),
        powershell_quote(&path_text)
    );
    let status = Command::new("powershell")
        .args(["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", &command])
        .status()
        .map_err(|error| format!("Could not start patch download: {error}"))?;
    if !status.success() {
        return Err("Patch download failed. Check internet access and try again.".to_string());
    }

    Command::new("cmd")
        .args(["/C", "start", "", &path_text])
        .spawn()
        .map_err(|error| format!("Patch downloaded, but Haudy could not open the installer: {error}"))?;
    Ok("Patch installer downloaded and opened. Close Haudy, finish the installer, then restart Haudy.".to_string())
}

fn is_allowed_patch_url(value: &str) -> bool {
    let lower = value.to_lowercase();
    lower.starts_with("https://github.com/vahidabsk/haudy/releases/download/")
        && (lower.ends_with(".msi") || lower.ends_with(".exe"))
}

fn powershell_quote(value: &str) -> String {
    value.replace('\'', "''")
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
            get_haudy_version,
            install_haudy_patch,
            open_audit_tracker,
            open_certificate_pdfs,
            open_past_report_pdfs,
            save_haudy_binary_file,
            save_haudy_binary_file_with_dialog,
            save_haudy_text_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Haudy");
}
